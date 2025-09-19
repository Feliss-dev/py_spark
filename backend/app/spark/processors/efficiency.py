from pathlib import Path
import json
from decimal import Decimal
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from app.spark.processors.analysis import _read_processed_or_csv

def _sanitize_value(v):
    # convert Decimal -> float, keep None as is, decode bytes
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        try:
            return v.decode("utf-8")
        except Exception:
            return str(v)
    return v

def _safe_collect_to_dict(rows):
    out = []
    for r in rows:
        d = r.asDict()
        out.append({k: _sanitize_value(v) for k, v in d.items()})
    return out

def run_sales_efficiency(job_processed_dir: str, spark: SparkSession):
    """
    Run sales efficiency metrics on processed data folder (job_processed_dir).
    Returns dict with revenue_metrics, price_elasticity, market_penetration and insights.
    Writes summary JSON + CSV parts under processed/{job_id}/efficiency/.
    """
    out_dir = Path(job_processed_dir)
    df = _read_processed_or_csv(out_dir, spark)

    # ensure numeric types
    df = df.withColumn("sales_volume", F.col("sales_volume").cast("double")) \
           .withColumn("price", F.col("price").cast("double"))

    # protect: if no rows return early
    total_rows = df.count()
    if total_rows == 0:
        return {"error": "no_rows", "message": "Dataset contains 0 rows"}

    # create temp view for SQL queries
    df.createOrReplaceTempView("products")

    revenue_sql = """
    SELECT 
        is_promo,
        SUM(sales_volume * price) as total_revenue,
        AVG(sales_volume * price) as avg_revenue_per_product,
        SUM(sales_volume) as total_volume,
        AVG(price) as avg_price,
        COUNT(*) as product_count,
        CASE WHEN SUM(sales_volume) = 0 THEN 0 ELSE SUM(sales_volume * price) / SUM(sales_volume) END as revenue_per_unit_sold
    FROM products 
    WHERE sales_volume IS NOT NULL AND price IS NOT NULL
    GROUP BY is_promo
    ORDER BY is_promo
    """

    elasticity_sql = """
    WITH price_segments AS (
        SELECT *,
            CASE 
                WHEN price < PERCENTILE_APPROX(price, 0.33) OVER(PARTITION BY is_promo) THEN 'low'
                WHEN price < PERCENTILE_APPROX(price, 0.66) OVER(PARTITION BY is_promo) THEN 'medium' 
                ELSE 'high'
            END as price_segment
        FROM products
        WHERE sales_volume IS NOT NULL AND price IS NOT NULL
    )
    SELECT 
        is_promo,
        price_segment,
        AVG(price) as avg_price,
        AVG(sales_volume) as avg_sales,
        COUNT(*) as cnt
    FROM price_segments
    GROUP BY is_promo, price_segment
    ORDER BY is_promo, price_segment
    """

    penetration_sql = """
    SELECT 
        is_promo,
        COUNT(*) as total_products,
        SUM(CASE WHEN sales_volume > 0 THEN 1 ELSE 0 END) as selling_products,
        CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(CASE WHEN sales_volume > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) END as penetration_rate,
        AVG(CASE WHEN sales_volume > 0 THEN sales_volume END) as avg_sales_of_selling_products
    FROM products
    GROUP BY is_promo
    ORDER BY is_promo
    """

    revenue_results = spark.sql(revenue_sql)
    elasticity_results = spark.sql(elasticity_sql)
    penetration_results = spark.sql(penetration_sql)

    revenue_list = _safe_collect_to_dict(revenue_results.collect())
    elasticity_list = _safe_collect_to_dict(elasticity_results.collect())
    penetration_list = _safe_collect_to_dict(penetration_results.collect())

    # compute insights (use int casting for is_promo values)
    promo_revenue = next((r for r in revenue_list if int(r.get("is_promo", 0)) == 1), None)
    non_promo_revenue = next((r for r in revenue_list if int(r.get("is_promo", 0)) == 0), None)

    insights = {}
    if promo_revenue and non_promo_revenue:
        try:
            non_total = non_promo_revenue.get("total_revenue", 0) or 0
            revenue_lift = ((promo_revenue.get("total_revenue", 0) - non_total) / non_total * 100) if non_total > 0 else 0.0
            avg_rev_prod_lift = 0.0
            if (non_promo_revenue.get("avg_revenue_per_product") or 0) > 0:
                avg_rev_prod_lift = ((promo_revenue.get("avg_revenue_per_product") - non_promo_revenue.get("avg_revenue_per_product")) 
                                     / non_promo_revenue.get("avg_revenue_per_product") * 100)
            insights = {
                "revenue_lift_percent": round(float(revenue_lift), 2),
                "revenue_per_product_lift_percent": round(float(avg_rev_prod_lift), 2),
                "unit_economics": {
                    "promo_revenue_per_unit": round(float(promo_revenue.get("revenue_per_unit_sold") or 0), 2),
                    "non_promo_revenue_per_unit": round(float(non_promo_revenue.get("revenue_per_unit_sold") or 0), 2)
                },
                "assessment": {
                    "revenue_efficiency": "high" if revenue_lift > 25 else "medium" if revenue_lift > 10 else "low",
                    "recommendation": ("Scale up promos" if revenue_lift > 10 else "Review promo cost-benefit")
                }
            }
        except Exception as e:
            insights = {"error": f"insight_calc_failed: {str(e)}"}

    # write outputs
    target_dir = out_dir / "efficiency"
    target_dir.mkdir(parents=True, exist_ok=True)

    # save each table as CSV for BI
    try:
        revenue_results.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(target_dir / "revenue_metrics_csv"))
        elasticity_results.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(target_dir / "price_elasticity_csv"))
        penetration_results.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(target_dir / "market_penetration_csv"))
    except Exception:
        # best-effort: ignore write errors, still return results
        pass

    summary = {
        "revenue_metrics": revenue_list,
        "price_elasticity": elasticity_list,
        "market_penetration": penetration_list,
        "insights": insights,
        "csv_paths": {
            "revenue_metrics_dir": str(target_dir / "revenue_metrics_csv"),
            "price_elasticity_dir": str(target_dir / "price_elasticity_csv"),
            "market_penetration_dir": str(target_dir / "market_penetration_csv")
        }
    }

    # save JSON summary (use default=str as fallback and ensure numbers sanitized)
    try:
        (target_dir / "efficiency_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    except TypeError:
        # fallback: use default=str to serialize any remaining non-serializable objects
        (target_dir / "efficiency_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return summary