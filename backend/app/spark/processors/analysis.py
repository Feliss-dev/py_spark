from pyspark.sql import functions as F
from pyspark.sql import SparkSession
from pyspark.sql.types import *
from pathlib import Path
import json
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import LinearRegression
from pyspark.ml.evaluation import RegressionEvaluator
import numpy as np
from typing import List
import pandas as pd
from datetime import datetime
from app.schemas.analysis import ModelPerformance, ProductRecommendation, PriceScenario, PriceModelingRequest, PriceModelingResponse

def _read_processed_or_csv(path: str, spark: SparkSession):
    """Read processed parquet or fallback to CSV"""
    p = Path(path)
    # prefer parquet folder/file produced by classify_promotions
    parquet_path = p / "processed.parquet" if p.is_dir() else (p if str(p).endswith(".parquet") else None)
    if parquet_path and Path(parquet_path).exists():
        return spark.read.parquet(str(parquet_path))
    # fallback: look for single CSV (processed_csv) or provided csv file
    if p.is_dir():
        csv_dir = p / "processed_csv"
        if csv_dir.exists():
            # read CSV part files
            return spark.read.option("header", "true").option("inferSchema", "true").csv(str(csv_dir))
    # else try p as file
    return spark.read.option("header", "true").option("inferSchema", "true").csv(str(p))

def compare_sales_volume(df, out_dir: Path):
    """So sánh sales_volume giữa hàng giảm giá và không giảm giá"""
    agg = df.groupBy("is_promo").agg(
        F.sum("sales_volume").alias("total_sales"),
        F.avg("sales_volume").alias("avg_sales"),
        F.expr("percentile_approx(sales_volume, 0.5)").alias("median_sales"),
        F.expr("percentile_approx(sales_volume, 0.75)").alias("q75_sales"),
        F.expr("percentile_approx(sales_volume, 0.25)").alias("q25_sales"),
        F.stddev("sales_volume").alias("stddev_sales"),
        F.count("*").alias("n_rows")
    ).orderBy("is_promo")
    
    results = agg.collect()
    
    # Tính toán insights và nhận xét
    promo_data = next((r.asDict() for r in results if int(r["is_promo"]) == 1), None)
    non_promo_data = next((r.asDict() for r in results if int(r["is_promo"]) == 0), None)
    
    insights = {}
    if promo_data and non_promo_data:
        # Tính lift ratio
        avg_lift = (promo_data["avg_sales"] - non_promo_data["avg_sales"]) / non_promo_data["avg_sales"] * 100
        total_lift = (promo_data["total_sales"] - non_promo_data["total_sales"]) / non_promo_data["total_sales"] * 100 if non_promo_data["total_sales"] > 0 else 0
        median_lift = (promo_data["median_sales"] - non_promo_data["median_sales"]) / non_promo_data["median_sales"] * 100 if non_promo_data["median_sales"] > 0 else 0
        
        insights = {
            "avg_sales_lift_percent": round(avg_lift, 2),
            "total_sales_lift_percent": round(total_lift, 2),
            "median_sales_lift_percent": round(median_lift, 2),
            "promo_share_of_total": round(promo_data["n_rows"] / (promo_data["n_rows"] + non_promo_data["n_rows"]) * 100, 2),
            "assessment": {
                "effectiveness": "high" if avg_lift > 20 else "medium" if avg_lift > 5 else "low",
                "volume_impact": "significant" if abs(total_lift) > 15 else "moderate" if abs(total_lift) > 5 else "minimal",
                "recommendation": _get_sales_recommendation(avg_lift, total_lift, promo_data["n_rows"], non_promo_data["n_rows"])
            }
        }
    
    # Save detailed CSV
    out_csv_dir = out_dir / "analysis_sales_by_promo_csv"
    agg.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(out_csv_dir))
    
    return {
        "sales_by_promo": [r.asDict() for r in results], 
        "insights": insights,
        "csv_path": str(out_csv_dir)
    }

def _get_sales_recommendation(avg_lift, total_lift, promo_count, non_promo_count):
    """Generate sales analysis recommendations"""
    if avg_lift > 20:
        return "Khuyến mãi rất hiệu quả, nên mở rộng chương trình"
    elif avg_lift > 5:
        return "Khuyến mãi có hiệu quả tích cực, cân nhắc tối ưu hóa chi phí"
    elif avg_lift > 0:
        return "Khuyến mãi có hiệu quả nhẹ, cần đánh giá lại strategy"
    else:
        return "Khuyến mãi không hiệu quả, cần review lại chương trình"

def analyze_rating_impact(df, out_dir: Path):
    """Phân tích ảnh hưởng giảm giá đến rating"""
    # Phân tích rating theo promo status
    rating_agg = df.groupBy("is_promo").agg(
        F.avg("rating").alias("avg_rating"),
        F.expr("percentile_approx(rating, 0.5)").alias("median_rating"),
        F.expr("percentile_approx(rating, 0.75)").alias("q75_rating"),
        F.expr("percentile_approx(rating, 0.25)").alias("q25_rating"),
        F.stddev("rating").alias("stddev_rating"),
        F.count("rating").alias("n_rating")
    ).orderBy("is_promo")
    
    # Phân tích phân phối rating
    rating_dist = df.groupBy("is_promo", "rating").agg(
        F.count("*").alias("count")
    ).orderBy("is_promo", "rating")
    
    results = rating_agg.collect()
    distribution = rating_dist.collect()
    
    # Tính insights
    promo_rating = next((r.asDict() for r in results if int(r["is_promo"]) == 1), None)
    non_promo_rating = next((r.asDict() for r in results if int(r["is_promo"]) == 0), None)
    
    insights = {}
    if promo_rating and non_promo_rating:
        rating_diff = promo_rating["avg_rating"] - non_promo_rating["avg_rating"]
        median_diff = promo_rating["median_rating"] - non_promo_rating["median_rating"]
        
        insights = {
            "avg_rating_difference": round(rating_diff, 3),
            "median_rating_difference": round(median_diff, 3),
            "rating_impact": "positive" if rating_diff > 0.1 else "negative" if rating_diff < -0.1 else "neutral",
            "significance": "high" if abs(rating_diff) > 0.3 else "medium" if abs(rating_diff) > 0.1 else "low",
            "assessment": {
                "customer_perception": _assess_rating_impact(rating_diff),
                "quality_concern": rating_diff < -0.2,
                "recommendation": _get_rating_recommendation(rating_diff, median_diff)
            }
        }
    
    return {
        "rating_by_promo": [r.asDict() for r in results],
        "rating_distribution": [r.asDict() for r in distribution],
        "insights": insights
    }

def _assess_rating_impact(rating_diff):
    """Assess customer perception based on rating difference"""
    if rating_diff > 0.2:
        return "Khuyến mãi cải thiện đáng kể perception của khách hàng"
    elif rating_diff > 0.1:
        return "Khuyến mãi có tác động tích cực nhẹ đến customer satisfaction"
    elif rating_diff > -0.1:
        return "Khuyến mãi không ảnh hưởng đáng kể đến rating"
    elif rating_diff > -0.2:
        return "Khuyến mãi có thể làm giảm nhẹ customer satisfaction"
    else:
        return "Khuyến mãi có thể gây tác động tiêu cực đến brand perception"

def _get_rating_recommendation(rating_diff, median_diff):
    """Generate rating-based recommendations"""
    if rating_diff < -0.2:
        return "Cần review chất lượng sản phẩm khuyến mãi và customer experience"
    elif rating_diff > 0.2:
        return "Khuyến mãi tạo positive experience, nên maintain strategy này"
    else:
        return "Rating impact trung tính, focus vào metrics khác"

def calculate_review_conversion(df, out_dir: Path):
    """Tính hệ số chuyển đổi review/doanh số khi có khuyến mãi"""
    # Normalize reviews -> numeric
    df_clean = df.withColumn("reviews_numeric",
                            F.when(F.col("reviews").cast("double").isNotNull(), 
                                  F.col("reviews").cast("double"))
                             .otherwise(F.regexp_replace(F.col("reviews"), "[^0-9]", "").cast("double"))
                            ).filter(F.col("sales_volume") > 0)  # Only products with sales
    
    # Calculate conversion rates
    conversion_df = df_clean.withColumn(
        "review_to_sales_ratio", 
        F.col("reviews_numeric") / F.col("sales_volume")
    ).withColumn(
        "sales_to_review_ratio",
        F.col("sales_volume") / F.when(F.col("reviews_numeric") > 0, F.col("reviews_numeric")).otherwise(F.lit(None))
    )
    
    conv_agg = conversion_df.groupBy("is_promo").agg(
        F.avg("review_to_sales_ratio").alias("avg_review_to_sales"),
        F.expr("percentile_approx(review_to_sales_ratio, 0.5)").alias("median_review_to_sales"),
        F.avg("sales_to_review_ratio").alias("avg_sales_to_review"),
        F.expr("percentile_approx(sales_to_review_ratio, 0.5)").alias("median_sales_to_review"),
        F.avg("reviews_numeric").alias("avg_reviews"),
        F.avg("sales_volume").alias("avg_sales_volume"),
        F.count("*").alias("n_products_with_reviews")
    )
    
    results = conv_agg.collect()
    
    # Calculate insights
    promo_conv = next((r.asDict() for r in results if int(r["is_promo"]) == 1), None)
    non_promo_conv = next((r.asDict() for r in results if int(r["is_promo"]) == 0), None)
    
    insights = {}
    if promo_conv and non_promo_conv:
        review_engagement_lift = ((promo_conv["avg_review_to_sales"] - non_promo_conv["avg_review_to_sales"]) 
                                 / non_promo_conv["avg_review_to_sales"] * 100) if non_promo_conv["avg_review_to_sales"] > 0 else 0
        
        insights = {
            "review_engagement_lift_percent": round(review_engagement_lift, 2),
            "promo_generates_more_reviews": promo_conv["avg_review_to_sales"] > non_promo_conv["avg_review_to_sales"],
            "review_efficiency": {
                "promo": round(promo_conv["avg_sales_to_review"] or 0, 2),
                "non_promo": round(non_promo_conv["avg_sales_to_review"] or 0, 2)
            },
            "assessment": {
                "engagement_impact": "high" if abs(review_engagement_lift) > 20 else "medium" if abs(review_engagement_lift) > 10 else "low",
                "recommendation": _get_review_recommendation(review_engagement_lift, promo_conv, non_promo_conv)
            }
        }
    
    return {
        "review_conversion": [r.asDict() for r in results],
        "insights": insights
    }

def _get_review_recommendation(engagement_lift, promo_data, non_promo_data):
    """Generate review conversion recommendations"""
    if engagement_lift > 20:
        return "Khuyến mãi tăng đáng kể review engagement, tốt cho long-term brand building"
    elif engagement_lift < -20:
        return "Khuyến mãi giảm review engagement, có thể ảnh hưởng đến social proof"
    else:
        return "Review engagement không thay đổi đáng kể, focus vào conversion metrics"

def find_optimal_price_thresholds(df, out_dir: Path, by_columns=["product_type"], n_buckets=10):
    """Tìm ngưỡng giá tối ưu để đạt doanh số cao"""
    results = {}
    
    for by_col in by_columns:
        if by_col not in df.columns:
            continue
            
        col_results = {}
        groups = [r[0] for r in df.select(by_col).distinct().collect() if r[0] is not None]
        
        for group in groups:
            group_df = df.filter(F.col(by_col) == group).select("price", "sales_volume", "is_promo")
            
            try:
                # Get price quantiles
                quantiles = group_df.approxQuantile("price", 
                                                  [i / n_buckets for i in range(n_buckets + 1)], 
                                                  0.01)
                
                # Create price buckets and analyze
                bucket_conditions = []
                for i in range(n_buckets):
                    lo, hi = quantiles[i], quantiles[i+1]
                    if i == n_buckets - 1:  # Last bucket includes upper bound
                        condition = (F.col("price") >= lo) & (F.col("price") <= hi)
                    else:
                        condition = (F.col("price") >= lo) & (F.col("price") < hi)
                    bucket_conditions.append((i, lo, hi, condition))
                
                bucket_analysis = []
                for bucket_idx, price_min, price_max, condition in bucket_conditions:
                    bucket_data = group_df.filter(condition).agg(
                        F.sum("sales_volume").alias("total_sales"),
                        F.avg("sales_volume").alias("avg_sales"),
                        F.count("*").alias("n_products"),
                        F.avg("price").alias("avg_price"),
                        F.sum(F.when(F.col("is_promo").cast("int") == 1, 1).otherwise(0)).alias("promo_count")
                    ).collect()[0]
                    
                    if bucket_data["n_products"] > 0:
                        bucket_analysis.append({
                            "bucket": bucket_idx,
                            "price_range": f"{price_min:.2f} - {price_max:.2f}",
                            "price_min": round(price_min, 2),
                            "price_max": round(price_max, 2),
                            "avg_price": round(bucket_data["avg_price"] or 0, 2),
                            "total_sales": int(bucket_data["total_sales"] or 0),
                            "avg_sales": round(bucket_data["avg_sales"] or 0, 2),
                            "n_products": int(bucket_data["n_products"]),
                            "promo_ratio": round((bucket_data["promo_count"] or 0) / bucket_data["n_products"], 3),
                            "sales_efficiency": round((bucket_data["total_sales"] or 0) / bucket_data["n_products"], 2)
                        })
                
                # Find optimal buckets
                if bucket_analysis:
                    best_total = max(bucket_analysis, key=lambda x: x["total_sales"])
                    best_efficiency = max(bucket_analysis, key=lambda x: x["sales_efficiency"])
                    
                    col_results[group] = {
                        "buckets": bucket_analysis,
                        "optimal_for_total_sales": best_total,
                        "optimal_for_efficiency": best_efficiency,
                        "insights": _generate_price_insights(bucket_analysis, best_total, best_efficiency)
                    }
            
            except Exception as e:
                col_results[group] = {"error": str(e)}
        
        results[by_col] = col_results
    
    return {"price_optimization": results}

def _generate_price_insights(buckets, best_total, best_efficiency):
    """Generate insights for price optimization"""
    total_products = sum(b["n_products"] for b in buckets)
    total_sales = sum(b["total_sales"] for b in buckets)
    
    insights = {
        "sweet_spot_range": best_total["price_range"],
        "efficiency_range": best_efficiency["price_range"],
        "price_sensitivity": "high" if best_total != best_efficiency else "low",
        "market_concentration": f"{best_total['n_products']/total_products*100:.1f}% sản phẩm trong price bucket tối ưu",
        "recommendation": _get_price_recommendation(best_total, best_efficiency, buckets)
    }
    
    return insights

def _get_price_recommendation(best_total, best_efficiency, buckets):
    """Generate price-based recommendations"""
    if best_total["bucket"] == best_efficiency["bucket"]:
        return f"Tập trung vào price range {best_total['price_range']} để maximize cả volume và efficiency"
    else:
        return f"Trade-off: {best_total['price_range']} cho volume, {best_efficiency['price_range']} cho efficiency"

def analyze_by_segments(df, out_dir: Path, segment_cols=["brand", "product_type"]):
    """So sánh theo brand và loại sản phẩm"""
    results = {}
    
    for segment_col in segment_cols:
        if segment_col not in df.columns:
            continue
        
        # Segment analysis
        segment_agg = df.groupBy(segment_col, "is_promo").agg(
            F.sum("sales_volume").alias("total_sales"),
            F.avg("sales_volume").alias("avg_sales"),
            F.avg("price").alias("avg_price"),
            F.avg("rating").alias("avg_rating"),
            F.count("*").alias("n_products")
        ).orderBy(segment_col, "is_promo")
        
        segment_results = segment_agg.collect()
        
        # Calculate segment insights
        segment_insights = {}
        segments = list(set(r[segment_col] for r in segment_results if r[segment_col] is not None))
        
        for segment in segments:
            promo_data = next((r.asDict() for r in segment_results 
                             if r[segment_col] == segment and int(r["is_promo"]) == 1), None)
            non_promo_data = next((r.asDict() for r in segment_results 
                                 if r[segment_col] == segment and int(r["is_promo"]) == 0), None)
            
            if promo_data and non_promo_data:
                sales_lift = ((promo_data["avg_sales"] - non_promo_data["avg_sales"]) 
                            / non_promo_data["avg_sales"] * 100) if non_promo_data["avg_sales"] > 0 else 0
                price_diff = promo_data["avg_price"] - non_promo_data["avg_price"]
                rating_diff = promo_data["avg_rating"] - non_promo_data["avg_rating"]
                
                segment_insights[segment] = {
                    "sales_lift_percent": round(sales_lift, 2),
                    "price_difference": round(price_diff, 2),
                    "rating_difference": round(rating_diff, 3),
                    "promo_effectiveness": "high" if sales_lift > 15 else "medium" if sales_lift > 5 else "low",
                    "market_share_promo": round(promo_data["n_products"] / (promo_data["n_products"] + non_promo_data["n_products"]) * 100, 1),
                    "recommendation": _get_segment_recommendation(sales_lift, price_diff, rating_diff, segment_col, segment)
                }
        
        results[segment_col] = {
            "data": [r.asDict() for r in segment_results],
            "insights": segment_insights
        }
    
    return {"segment_analysis": results}

def _get_segment_recommendation(sales_lift, price_diff, rating_diff, segment_type, segment_name):
    """Generate segment-specific recommendations"""
    if sales_lift > 20 and rating_diff > 0:
        return f"{segment_name}: Excellent promo performance, expand program"
    elif sales_lift > 10:
        return f"{segment_name}: Good promo response, optimize pricing strategy"
    elif sales_lift < 0:
        return f"{segment_name}: Poor promo performance, review strategy"
    else:
        return f"{segment_name}: Average performance, monitor and adjust"

def calculate_sales_efficiency_metrics(df, spark):
    """Dùng Spark SQL tính toán các chỉ số hiệu quả bán"""
    df.createOrReplaceTempView("products")
    
    # Revenue per product
    revenue_sql = """
    SELECT 
        is_promo,
        SUM(sales_volume * price) as total_revenue,
        AVG(sales_volume * price) as avg_revenue_per_product,
        SUM(sales_volume) as total_volume,
        AVG(price) as avg_price,
        COUNT(*) as product_count,
        SUM(sales_volume * price) / SUM(sales_volume) as revenue_per_unit_sold
    FROM products 
    WHERE sales_volume > 0 
    GROUP BY is_promo
    ORDER BY is_promo
    """
    
    # Price elasticity approximation
    elasticity_sql = """
    WITH price_segments AS (
        SELECT *,
            CASE 
                WHEN price < PERCENTILE_APPROX(price, 0.33) OVER() THEN 'low'
                WHEN price < PERCENTILE_APPROX(price, 0.66) OVER() THEN 'medium' 
                ELSE 'high'
            END as price_segment
        FROM products
        WHERE sales_volume > 0
    )
    SELECT 
        is_promo,
        price_segment,
        AVG(price) as avg_price,
        AVG(sales_volume) as avg_sales,
        COUNT(*) as count
    FROM price_segments
    GROUP BY is_promo, price_segment
    ORDER BY is_promo, price_segment
    """
    
    # Market penetration
    penetration_sql = """
    SELECT 
        is_promo,
        COUNT(*) as total_products,
        SUM(CASE WHEN sales_volume > 0 THEN 1 ELSE 0 END) as selling_products,
        SUM(CASE WHEN sales_volume > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as penetration_rate,
        AVG(CASE WHEN sales_volume > 0 THEN sales_volume END) as avg_sales_of_selling_products
    FROM products
    GROUP BY is_promo
    ORDER BY is_promo
    """
    
    revenue_results = spark.sql(revenue_sql).collect()
    elasticity_results = spark.sql(elasticity_sql).collect()
    penetration_results = spark.sql(penetration_sql).collect()
    
    # Calculate efficiency insights
    promo_revenue = next((r.asDict() for r in revenue_results if int(r["is_promo"]) == 1), None)
    non_promo_revenue = next((r.asDict() for r in revenue_results if int(r["is_promo"]) == 0), None)
    
    efficiency_insights = {}
    if promo_revenue and non_promo_revenue:
        revenue_lift = ((promo_revenue["total_revenue"] - non_promo_revenue["total_revenue"]) 
                       / non_promo_revenue["total_revenue"] * 100) if non_promo_revenue["total_revenue"] > 0 else 0
        
        efficiency_insights = {
            "revenue_lift_percent": round(revenue_lift, 2),
            "revenue_per_product_lift": round((promo_revenue["avg_revenue_per_product"] - non_promo_revenue["avg_revenue_per_product"]) 
                                            / non_promo_revenue["avg_revenue_per_product"] * 100, 2),
            "unit_economics": {
                "promo_revenue_per_unit": round(promo_revenue["revenue_per_unit_sold"], 2),
                "non_promo_revenue_per_unit": round(non_promo_revenue["revenue_per_unit_sold"], 2)
            },
            "assessment": {
                "revenue_efficiency": "high" if revenue_lift > 25 else "medium" if revenue_lift > 10 else "low",
                "recommendation": _get_efficiency_recommendation(revenue_lift, promo_revenue, non_promo_revenue)
            }
        }
    
    return {
        "revenue_metrics": [r.asDict() for r in revenue_results],
        "price_elasticity": [r.asDict() for r in elasticity_results],
        "market_penetration": [r.asDict() for r in penetration_results],
        "insights": efficiency_insights
    }

def _get_efficiency_recommendation(revenue_lift, promo_data, non_promo_data):
    """Generate efficiency-based recommendations"""
    if revenue_lift > 30:
        return "Excellent revenue efficiency, scale up promo activities"
    elif revenue_lift > 15:
        return "Good revenue impact, optimize promo targeting"
    elif revenue_lift > 0:
        return "Positive but modest impact, review cost-benefit"
    else:
        return "Negative revenue impact, restructure promo strategy"

def run_comprehensive_analysis(job_processed_dir: str, spark: SparkSession = None):
    """Run comprehensive promotion analysis"""
    out_dir = Path(job_processed_dir)
    if spark is None:
        from app.spark.spark_session import get_spark_session
        spark = get_spark_session()
    
    df = _read_processed_or_csv(out_dir, spark)
    
    # Ensure proper data types
    df = df.withColumn("sales_volume", F.col("sales_volume").cast("double")) \
           .withColumn("price", F.col("price").cast("double")) \
           .withColumn("rating", F.col("rating").cast("double"))
    
    # Handle reviews column
    if "reviews" in df.columns:
        df = df.withColumn("reviews_numeric", 
                          F.when(F.col("reviews").cast("double").isNotNull(), 
                                F.col("reviews").cast("double"))
                           .otherwise(F.regexp_replace(F.col("reviews"), "[^0-9]", "").cast("double")))
    else:
        df = df.withColumn("reviews_numeric", F.lit(0.0))
    
    # Create output directory
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Run all analyses
    print("Running sales volume comparison...")
    sales_analysis = compare_sales_volume(df, out_dir)
    
    print("Running rating impact analysis...")
    rating_analysis = analyze_rating_impact(df, out_dir)
    
    print("Running review conversion analysis...")
    review_analysis = calculate_review_conversion(df, out_dir)
    
    print("Running price optimization analysis...")
    price_analysis = find_optimal_price_thresholds(df, out_dir)
    
    print("Running segment analysis...")
    segment_analysis = analyze_by_segments(df, out_dir)
    
    # print("Running efficiency metrics calculation...")
    # efficiency_analysis = calculate_sales_efficiency_metrics(df, spark)
    
    # Combine all results
    comprehensive_summary = {
        # "analysis_timestamp": spark.sql("SELECT current_timestamp()").collect()[0][0].isoformat(),
        "data_overview": {
            "total_products": df.count(),
            "promo_products": df.filter(F.col("is_promo") == 1).count(),
            "columns": df.columns
        },
        "sales_volume_analysis": sales_analysis,
        "rating_impact_analysis": rating_analysis,
        "review_conversion_analysis": review_analysis,
        "price_optimization_analysis": price_analysis,
        "segment_analysis": segment_analysis,
        # "efficiency_metrics": efficiency_analysis,
        "overall_insights": _generate_overall_insights(sales_analysis, rating_analysis, review_analysis, segment_analysis, price_analysis)
    }
    
    # Save comprehensive results
    summary_path = out_dir / "comprehensive_analysis.json"
    summary_path.write_text(
        json.dumps(comprehensive_summary, ensure_ascii=False, indent=2, default=str), 
        encoding="utf-8"
    )
    
    return comprehensive_summary

def _generate_overall_insights(sales_analysis, rating_analysis, review_analysis, segment_analysis, price_analysis):
    """Generate overall business insights"""
    insights = {
        "promotion_effectiveness": "unknown",
        "key_findings": [],
        "strategic_recommendations": [],
        "risk_factors": []
    }
    
    try:
        # Determine overall effectiveness
        sales_lift = sales_analysis.get("insights", {}).get("avg_sales_lift_percent", 0)
        rating_impact = rating_analysis.get("insights", {}).get("rating_impact", "neutral")
        # efficiency_rating = efficiency_analysis.get("insights", {}).get("assessment", {}).get("revenue_efficiency", "low")
        
        if sales_lift > 20 and rating_impact != "negative" :
            insights["promotion_effectiveness"] = "highly_effective"
            insights["key_findings"].append("Khuyến mãi mang lại hiệu quả cao về doanh số và revenue")
            insights["strategic_recommendations"].append("Mở rộng chương trình khuyến mãi với strategy hiện tại")
        elif sales_lift > 10 and rating_impact != "negative":
            insights["promotion_effectiveness"] = "moderately_effective"
            insights["key_findings"].append("Khuyến mãi có hiệu quả tích cực nhưng chưa tối ưu")
            insights["strategic_recommendations"].append("Tối ưu hóa targeting và timing của chương trình")
        elif sales_lift > 0:
            insights["promotion_effectiveness"] = "marginally_effective"
            insights["key_findings"].append("Khuyến mãi có hiệu quả nhẹ, cần cải thiện")
            insights["strategic_recommendations"].append("Review lại strategy và cost-benefit analysis")
        else:
            insights["promotion_effectiveness"] = "ineffective"
            insights["key_findings"].append("Khuyến mãi không mang lại hiệu quả mong đợi")
            insights["strategic_recommendations"].append("Tạm dừng và thiết kế lại chương trình khuyến mãi")
            insights["risk_factors"].append("Khuyến mãi có thể đang làm giảm profitability")
        
        # Rating concerns
        if rating_impact == "negative":
            insights["risk_factors"].append("Khuyến mãi có thể ảnh hưởng tiêu cực đến customer satisfaction")
            insights["strategic_recommendations"].append("Kiểm tra chất lượng sản phẩm và customer experience")
        
        # Review engagement insights
        review_insights = review_analysis.get("insights", {})
        engagement_lift = review_insights.get("review_engagement_lift_percent", 0)
        if abs(engagement_lift) > 20:
            if engagement_lift > 0:
                insights["key_findings"].append("Khuyến mãi tăng đáng kể review engagement")
            else:
                insights["risk_factors"].append("Khuyến mãi giảm review engagement, ảnh hưởng social proof")
        
        # Segment performance
        if "segment_analysis" in segment_analysis:
            for segment_type, segment_data in segment_analysis["segment_analysis"].items():
                segment_insights = segment_data.get("insights", {})
                high_performers = [seg for seg, data in segment_insights.items() 
                                 if data.get("promo_effectiveness") == "high"]
                if high_performers:
                    insights["strategic_recommendations"].append(
                        f"Focus khuyến mãi trên {segment_type}: {', '.join(high_performers[:3])}"
                    )
        
        # Price optimization insights
        price_insights = price_analysis.get("price_optimization", {})
        for category, data in price_insights.items():
            if isinstance(data, dict):
                for segment, segment_data in data.items():
                    if isinstance(segment_data, dict) and "insights" in segment_data:
                        sweet_spot = segment_data["insights"].get("sweet_spot_range")
                        if sweet_spot:
                            insights["strategic_recommendations"].append(
                                f"Tối ưu giá {segment} trong khoảng {sweet_spot}"
                            )
                            break
        
    except Exception as e:
        insights["error"] = f"Error generating insights: {str(e)}"
    
    return insights

def load_trained_model(model_dir: Path):
    """
    Load trained model artifacts (supports both RandomForest and LinearRegression)
    """
    from pyspark.ml.feature import VectorAssembler
    
    # Load summary first to determine model type
    summary_path = model_dir / "model_summary.json"
    if summary_path.exists():
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        model_type = summary.get("model_type", "LinearRegression")
    else:
        summary = {}
        model_type = "LinearRegression"  # Default fallback
    
    # Load appropriate model type
    if model_type == "RandomForestRegressor":
        from pyspark.ml.regression import RandomForestRegressionModel
        model = RandomForestRegressionModel.load(str(model_dir / "spark_model"))
        assembler = VectorAssembler.load(str(model_dir / "assembler"))
        
        return {"model": model, "assembler": assembler, "summary": summary}
    else:
        # Linear Regression (original implementation)
        from pyspark.ml.regression import LinearRegressionModel
        from pyspark.ml.feature import StandardScalerModel
        
        model = LinearRegressionModel.load(str(model_dir / "spark_model"))
        assembler = VectorAssembler.load(str(model_dir / "assembler"))
        
        # Check if scaler exists (for backward compatibility)
        scaler_path = model_dir / "scaler"
        if scaler_path.exists():
            scaler = StandardScalerModel.load(str(scaler_path))
            return {"model": model, "assembler": assembler, "scaler": scaler, "summary": summary}
        else:
            return {"model": model, "assembler": assembler, "summary": summary}

def prepare_enhanced_features(df):
    """
    Tạo features mạnh mẽ hơn dựa trên domain knowledge
    """
    # 1. Price features
    df = df.withColumn("log_price", F.log(F.col("price")))
    df = df.withColumn("price_squared", F.col("price") * F.col("price"))
    
    # Price positioning vs market average
    avg_price = df.agg(F.avg("price")).collect()[0][0]
    df = df.withColumn("price_vs_market", F.col("price") / F.lit(avg_price))
    df = df.withColumn("is_premium", F.when(F.col("price") > F.lit(avg_price * 1.5), 1.0).otherwise(0.0))
    df = df.withColumn("is_budget", F.when(F.col("price") < F.lit(avg_price * 0.7), 1.0).otherwise(0.0))
    
    # 2. Rating và review features
    df = df.withColumn("rating_squared", F.col("rating") * F.col("rating"))
    df = df.withColumn("high_rating", F.when(F.col("rating") >= 4.0, 1.0).otherwise(0.0))
    df = df.withColumn("low_rating", F.when(F.col("rating") <= 2.0, 1.0).otherwise(0.0))
    
    # Review engagement
    df = df.withColumn("log_reviews", F.log1p(F.col("reviews_numeric")))
    df = df.withColumn("reviews_per_sale", F.col("reviews_numeric") / F.col("sales_volume"))
    
    # 3. Interaction features (quan trọng cho price elasticity)
    df = df.withColumn("price_rating_interaction", F.col("price") * F.col("rating"))
    df = df.withColumn("price_reviews_interaction", F.col("price") * F.col("log_reviews"))
    
    # Price elasticity proxy - higher price with good rating = less elastic
    df = df.withColumn("price_elasticity_proxy", 
                      F.col("price") / (F.col("rating") * F.col("log_reviews") + 1))
    
    # 4. Platform encoding
    df = df.withColumn("is_shopee", F.when(F.col("platform") == "Shopee", 1.0).otherwise(0.0))
    df = df.withColumn("is_lazada", F.when(F.col("platform") == "Lazada", 1.0).otherwise(0.0))
    
    # 5. Product category features
    # Brand popularity
    brand_sales = df.groupBy("brand").agg(F.avg("sales_volume").alias("brand_avg_sales"))
    df = df.join(brand_sales, on="brand", how="left")
    df = df.withColumn("brand_performance", F.col("brand_avg_sales") / F.lit(df.agg(F.avg("sales_volume")).collect()[0][0]))
    
    # Product type popularity  
    type_sales = df.groupBy("product_type").agg(F.avg("sales_volume").alias("type_avg_sales"))
    df = df.join(type_sales, on="product_type", how="left")
    df = df.withColumn("category_performance", F.col("type_avg_sales") / F.lit(df.agg(F.avg("sales_volume")).collect()[0][0]))
    
    # 6. Temporal features
    df = df.withColumn("month_numeric", 
                      F.when(F.col("sale_time").contains("Tháng 1"), 1)
                       .when(F.col("sale_time").contains("Tháng 2"), 2)
                       .when(F.col("sale_time").contains("Tháng 3"), 3)
                       .when(F.col("sale_time").contains("Tháng 4"), 4)
                       .when(F.col("sale_time").contains("Tháng 5"), 5)
                       .when(F.col("sale_time").contains("Tháng 6"), 6)
                       .when(F.col("sale_time").contains("Tháng 7"), 7)
                       .when(F.col("sale_time").contains("Tháng 8"), 8)
                       .when(F.col("sale_time").contains("Tháng 9"), 9)
                       .when(F.col("sale_time").contains("Tháng 10"), 10)
                       .when(F.col("sale_time").contains("Tháng 11"), 11)
                       .when(F.col("sale_time").contains("Tháng 12"), 12)
                       .otherwise(6))
    
    # Seasonal effects
    df = df.withColumn("is_peak_season", F.when(F.col("month_numeric").isin([11, 12, 1]), 1.0).otherwise(0.0))
    df = df.withColumn("is_summer", F.when(F.col("month_numeric").isin([6, 7, 8]), 1.0).otherwise(0.0))
    
    return df

def load_and_clean_raw_data(csv_path: str, spark: SparkSession):
    """
    Load và clean dữ liệu raw với feature engineering tốt hơn
    """
    df = spark.read.option("header", "true").option("inferSchema", "true").csv(csv_path)
    
    # Validate columns
    required_cols = ["product_name", "product_type", "sales_volume", "price", "rating", "reviews", "platform", "brand"]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    print(f"Raw data loaded: {df.count()} rows")
    
    # Clean data - loại bỏ outliers và invalid data
    df = df.filter(
        (F.col("sales_volume") > 0) & 
        (F.col("price") > 0) & 
        (F.col("rating") >= 1.0) & (F.col("rating") <= 5.0) &
        (F.col("reviews").isNotNull())
    )
    
    # Cast numeric columns
    df = df.withColumn("sales_volume", F.col("sales_volume").cast("double")) \
           .withColumn("price", F.col("price").cast("double")) \
           .withColumn("rating", F.col("rating").cast("double"))
    
    # Clean reviews column
    df = df.withColumn("reviews_numeric",
                      F.when(F.col("reviews").cast("double").isNotNull(), 
                            F.col("reviews").cast("double"))
                       .otherwise(F.regexp_replace(F.col("reviews"), "[^0-9]", "").cast("double")))
    
    # Remove extreme outliers (> 99.5th percentile, < 0.5th percentile)
    price_bounds = df.approxQuantile("price", [0.005, 0.995], 0.01)
    sales_bounds = df.approxQuantile("sales_volume", [0.005, 0.995], 0.01)
    
    df = df.filter(
        (F.col("price") >= price_bounds[0]) & (F.col("price") <= price_bounds[1]) &
        (F.col("sales_volume") >= sales_bounds[0]) & (F.col("sales_volume") <= sales_bounds[1])
    )
    
    print(f"After cleaning: {df.count()} rows")
    
    # Enhanced feature engineering
    df = prepare_enhanced_features(df)
    
    return df

def remove_outliers(df, columns, quantiles=[0.01, 0.99]):
    """
    Remove outliers based on quantiles
    """
    for col in columns:
        if col in df.columns:
            bounds = df.approxQuantile(col, quantiles, 0.01)
            df = df.filter((F.col(col) >= bounds[0]) & (F.col(col) <= bounds[1]))
    return df

def run_price_modeling_from_raw(csv_path: str, output_dir: str, spark: SparkSession = None, 
                               price_change: float = -0.10, scenarios: list = None, 
                               group_by: str = "product_type"):
    """
    Complete pipeline với model persistence và improved predictions
    """
    if spark is None:
        from app.spark.spark_session import get_spark_session
        spark = get_spark_session()
    
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Load và clean data
    print("=== STEP 1: Loading and cleaning data ===")
    df = load_and_clean_raw_data(csv_path, spark)
    
    if df.count() < 100:
        raise ValueError("Insufficient data for reliable modeling")
    
    # Step 2: Train model (only if not exists)
    model_dir = out_dir / "model"
    print("=== STEP 2: Training/Loading model ===")
    
    if (model_dir / "model_summary.json").exists():
        print("Loading existing model...")
        model_artifacts = load_trained_model(model_dir)
        model_summary = model_artifacts["summary"]
    else:
        print("Training new model...")
        model_summary, model_objects = train_enhanced_sales_model(df, model_dir)
        model_artifacts = model_objects
        model_artifacts["summary"] = model_summary
    
    model_quality = model_summary.get("model_quality", "unknown")
    r_squared = model_summary.get("performance", {}).get("test_r_squared", 0)
    
    print(f"Model Quality: {model_quality}, R²: {r_squared:.4f}")
    
    if r_squared < 0.1:
        print("WARNING: Model has low predictive power. Results should be interpreted with caution.")
    
    # Step 3: Prepare scenarios
    if not scenarios:
        scenarios = [price_change]
    
    print(f"=== STEP 3: Analyzing {len(scenarios)} price scenarios ===")
    
    # Step 4: Run predictions for each scenario
    scenario_results = []
    results_dir = out_dir / "recommendations"
    results_dir.mkdir(parents=True, exist_ok=True)
    
    for i, scenario_change in enumerate(scenarios):
        scenario_name = f"price_change_{scenario_change*100:+.1f}%"
        print(f"Analyzing scenario {i+1}/{len(scenarios)}: {scenario_name}")
        
        # Predict impact
        df_pred = predict_price_impact_improved(model_artifacts, df, scenario_change, group_by)
        
        # Generate recommendations
        recommendations = generate_pricing_recommendations_improved(
            df_pred, scenario_change, group_by, model_quality
        )
        
        # Export detailed CSV
        scenario_csv_path = results_dir / f"detailed_{scenario_name}.csv"
        df_pred.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(scenario_csv_path))
        
        scenario_results.append({
            "scenario_name": scenario_name,
            "price_change_percent": scenario_change * 100,
            "recommendations": recommendations,
            "detailed_csv_path": str(scenario_csv_path),
            "summary": {
                "total_groups": len(recommendations),
                "strong_opportunities": len([r for r in recommendations if r["recommendation"] == "strongly_recommended"]),
                "recommended_actions": len([r for r in recommendations if r["recommendation"] in ["strongly_recommended", "recommended"]]),
                "high_confidence_predictions": len([r for r in recommendations if r["confidence"] == "high"])
            }
        })
    
    # Step 5: Business insights
    print("=== STEP 5: Generating business insights ===")
    business_insights = generate_comprehensive_business_insights_improved(
        scenario_results, model_summary, df, model_quality
    )
    
    # Step 6: Export all results
    # Save scenario analysis
    (results_dir / "scenario_analysis.json").write_text(
        json.dumps(scenario_results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    
    # Save business insights
    (results_dir / "business_insights.json").write_text(
        json.dumps(business_insights, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    
    # Create executive summary
    summary = {
        "analysis_timestamp": datetime.now().isoformat(),
        "data_source": csv_path,
        "model_summary": {
            "quality": model_quality,
            "r_squared": r_squared,
            "predictive_power": "high" if r_squared > 0.5 else "medium" if r_squared > 0.2 else "low",
            "features_count": len(model_summary.get("features", [])),
            "top_features": [f[0] for f in model_summary.get("top_features", [])[:3]]
        },
        "scenarios_analyzed": len(scenarios),
        "analysis_scope": {
            "group_by": group_by,
            "total_products": df.count(),
            "price_range_analyzed": scenarios
        },
        "key_findings": business_insights.get("key_findings", [])[:5],
        "actionable_recommendations": business_insights.get("actionable_recommendations", [])[:3],
        "paths": {
            "model_dir": str(model_dir),
            "detailed_results": str(results_dir / "scenario_analysis.json"),
            "business_insights": str(results_dir / "business_insights.json"),
            "model_summary": str(model_dir / "model_summary.json")
        }
    }
    
    (out_dir / "executive_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    
    print("=== ANALYSIS COMPLETE ===")
    print(f"Model Quality: {model_quality}")
    print(f"Results saved to: {out_dir}")
    print(f"Top recommendations: {len([r for result in scenario_results for r in result['recommendations'] if r['recommendation'] in ['strongly_recommended', 'recommended']])}")
    
    return summary

def train_enhanced_sales_model(df, out_dir: Path, features=None, label="sales_volume"):
    """
    Train Random Forest model với hyperparameter tuning để cải thiện accuracy
    """
    if features is None:
        # Features được chọn dựa trên domain knowledge về price elasticity
        features = [
            "log_price", "price_vs_market", "price_squared",
            "rating", "rating_squared", "high_rating", "low_rating", 
            "log_reviews", "reviews_per_sale",
            "price_rating_interaction", "price_reviews_interaction", "price_elasticity_proxy",
            "is_shopee", "is_lazada",
            "brand_performance", "category_performance", 
            "month_numeric", "is_peak_season", "is_summer",
            "is_premium", "is_budget"
        ]
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Prepare data với feature selection
    df_features = df.select(*(features + [label, "product_type", "brand", "platform"]))
    
    # Remove rows with null values
    df_clean = df_features.na.drop()
    total_rows = df_clean.count()
    
    if total_rows < 200:
        raise ValueError(f"Insufficient data: {total_rows} rows (need at least 200)")
    
    print(f"Training Random Forest on {total_rows} products with {len(features)} features")
    
    # Split: 70% train, 20% validation, 10% test
    train_df, val_test_df = df_clean.randomSplit([0.7, 0.3], seed=42)
    val_df, test_df = val_test_df.randomSplit([0.67, 0.33], seed=42)
    
    print(f"Train: {train_df.count()}, Validation: {val_df.count()}, Test: {test_df.count()}")
    
    # Prepare features using VectorAssembler (Random Forest không cần scaling)
    assembler = VectorAssembler(inputCols=features, outputCol="features")
    
    # Prepare training data
    train_assembled = assembler.transform(train_df).select("features", F.col(label).alias("label"))
    
    # Validation data
    val_assembled = assembler.transform(val_df).select("features", F.col(label).alias("label"))
    
    # Test data
    test_assembled = assembler.transform(test_df).select("features", F.col(label).alias("label"))
    
    # Random Forest với hyperparameter tuning
    from pyspark.ml.regression import RandomForestRegressor
    
    best_rmse = float('inf')
    best_model = None
    best_params = None
    
    # Grid search for Random Forest hyperparameters
    num_trees_options = [20, 50, 100]
    max_depth_options = [5, 10, 15]
    min_instances_per_node_options = [1, 5, 10]
    
    print("Starting hyperparameter tuning...")
    
    for num_trees in num_trees_options:
        for max_depth in max_depth_options:
            for min_instances in min_instances_per_node_options:
                print(f"Testing: trees={num_trees}, depth={max_depth}, min_instances={min_instances}")
                
                rf = RandomForestRegressor(
                    featuresCol="features",
                    labelCol="label",
                    numTrees=num_trees,
                    maxDepth=max_depth,
                    minInstancesPerNode=min_instances,
                    seed=42,
                    subsamplingRate=0.8,  # Bootstrap sampling
                    featureSubsetStrategy="sqrt"  # Feature subsampling
                )
                
                try:
                    model = rf.fit(train_assembled)
                    val_pred = model.transform(val_assembled)
                    
                    evaluator = RegressionEvaluator(labelCol="label", predictionCol="prediction", metricName="rmse")
                    val_rmse = evaluator.evaluate(val_pred)
                    
                    if val_rmse < best_rmse:
                        best_rmse = val_rmse
                        best_model = model
                        best_params = {
                            "numTrees": num_trees, 
                            "maxDepth": max_depth, 
                            "minInstancesPerNode": min_instances
                        }
                        print(f"New best RMSE: {val_rmse:.2f}")
                        
                except Exception as e:
                    print(f"Error with params {num_trees}, {max_depth}, {min_instances}: {str(e)}")
                    continue
    
    if best_model is None:
        raise ValueError("Failed to train any Random Forest model. Check your data and parameters.")
    
    print(f"Best validation RMSE: {best_rmse:.2f} with params: {best_params}")
    
    # Final evaluation on test set
    test_pred = best_model.transform(test_assembled)
    
    test_evaluator = RegressionEvaluator(labelCol="label", predictionCol="prediction", metricName="rmse")
    test_rmse = test_evaluator.evaluate(test_pred)
    
    r2_evaluator = RegressionEvaluator(labelCol="label", predictionCol="prediction", metricName="r2")
    test_r2 = r2_evaluator.evaluate(test_pred)
    
    mae_evaluator = RegressionEvaluator(labelCol="label", predictionCol="prediction", metricName="mae")
    test_mae = mae_evaluator.evaluate(test_pred)
    
    print(f"Test Results - RMSE: {test_rmse:.2f}, R²: {test_r2:.4f}, MAE: {test_mae:.2f}")
    
    # Feature importance từ Random Forest
    feature_importance_scores = best_model.featureImportances.toArray()
    feature_importance = {
        features[i]: round(float(feature_importance_scores[i]), 4)
        for i in range(len(features))
    }
    
    # Model quality assessment (Random Forest thường có R² cao hơn)
    if test_r2 >= 0.7:
        quality = "excellent"
    elif test_r2 >= 0.5:
        quality = "good"
    elif test_r2 >= 0.3:
        quality = "fair"
    elif test_r2 >= 0.1:
        quality = "poor"
    else:
        quality = "very_poor"
    
    # Model summary
    summary = {
        "model_type": "RandomForestRegressor",
        "features": features,
        "feature_count": len(features),
        "best_params": best_params,
        "feature_importance": feature_importance,
        "performance": {
            "validation_rmse": float(best_rmse),
            "test_rmse": float(test_rmse),
            "test_r_squared": float(test_r2),
            "test_mae": float(test_mae)
        },
        "data_split": {
            "train_size": train_df.count(),
            "val_size": val_df.count(), 
            "test_size": test_df.count(),
            "total_size": total_rows
        },
        "model_quality": quality,
        "top_features": sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:10],
        "model_insights": {
            "num_trees": best_params["numTrees"],
            "tree_depth": best_params["maxDepth"],
            "handles_non_linearity": True,
            "captures_feature_interactions": True
        }
    }
    
    # Save model artifacts
    model_path = out_dir / "spark_model"
    assembler_path = out_dir / "assembler"
    
    # Save Spark ML objects
    best_model.write().overwrite().save(str(model_path))
    assembler.write().overwrite().save(str(assembler_path))
    
    # Save summary
    (out_dir / "model_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    
    print(f"Random Forest model saved to {out_dir}")
    print(f"Quality: {quality}, R²: {test_r2:.4f}")
    print(f"Top features: {[f[0] for f in summary['top_features'][:5]]}")
    
    return summary, {"model": best_model, "assembler": assembler}

def generate_comprehensive_business_insights_improved(scenario_results, model_summary, df, model_quality):
    """
    Generate insights với nhiều context hơn
    """
    insights = {
        "executive_summary": {},
        "key_findings": [],
        "actionable_recommendations": [], 
        "risk_assessment": [],
        "market_opportunities": [],
        "model_reliability": {
            "quality": model_quality,
            "r_squared": model_summary.get("performance", {}).get("test_r_squared", 0),
            "confidence_level": "high" if model_quality in ["excellent", "good"] else "medium" if model_quality == "fair" else "low",
            "predictive_features": [f[0] for f in model_summary.get("top_features", [])[:3]]
        }
    }
    
    # Aggregate all recommendations
    all_recommendations = []
    for scenario in scenario_results:
        for rec in scenario["recommendations"]:
            rec["scenario"] = scenario["scenario_name"]
            all_recommendations.append(rec)
    
    if not all_recommendations:
        return insights
    
    # Find best opportunities
    strong_opportunities = [r for r in all_recommendations if r["recommendation"] == "strongly_recommended"]
    opportunities = [r for r in all_recommendations if r["recommendation"] in ["strongly_recommended", "recommended"]]
    
    # Market insights
    high_price_sensitive = [r for r in all_recommendations if r["price_sensitivity"] == "high"]
    low_price_sensitive = [r for r in all_recommendations if r["price_sensitivity"] == "low"]
    
    # Executive summary
    insights["executive_summary"] = {
        "total_product_groups_analyzed": len(set(r["group"] for r in all_recommendations)),
        "scenarios_tested": len(scenario_results),
        "strong_opportunities_found": len(strong_opportunities),
        "model_confidence": insights["model_reliability"]["confidence_level"],
        "overall_recommendation": "proceed_with_caution" if model_quality == "poor" else "actionable_insights_available"
    }
    
    # Key findings
    if strong_opportunities:
        best_opportunity = max(strong_opportunities, key=lambda x: x["economics_score"])
        insights["key_findings"].append(
            f"Cơ hội tốt nhất: {best_opportunity['suggested_action']} (điểm số kinh tế: {best_opportunity['economics_score']:.1f})"
        )
    
    if high_price_sensitive:
        insights["key_findings"].append(
            f"{len(high_price_sensitive)} nhóm sản phẩm có độ nhạy cảm giá cao - cần thận trọng khi tăng giá"
        )
    
    if low_price_sensitive:
        insights["key_findings"].append(
            f"{len(low_price_sensitive)} nhóm sản phẩm ít nhạy cảm giá - có thể tăng giá để tối ưu doanh thu"
        )
    
    # Actionable recommendations
    for opportunity in strong_opportunities[:3]:
        insights["actionable_recommendations"].append({
            "action": opportunity["suggested_action"],
            "expected_impact": f"{opportunity['expected_revenue_lift_pct']:+.1f}% doanh thu",
            "confidence": opportunity["confidence"],
            "group": opportunity["group"]
        })
    
    # Risk assessment
    high_risk = [r for r in all_recommendations if r["recommendation"] == "not_recommended"]
    if high_risk:
        insights["risk_assessment"].append(
            f"Tránh thay đổi giá cho {len(high_risk)} nhóm sản phẩm có nguy cơ tác động tiêu cực"
        )
    
    if model_quality == "poor":
        insights["risk_assessment"].append(
            "Mô hình có độ chính xác thấp - cần thu thập thêm dữ liệu hoặc cải thiện features"
        )
    
    return insights

def predict_price_impact_improved(model_artifacts, df, price_change_fraction, group_by="product_type"):
    """
    Dự đoán impact với logic kinh tế đúng: giá giảm → demand tăng
    Supports both RandomForest and LinearRegression models
    """
    model = model_artifacts["model"]
    assembler = model_artifacts["assembler"]
    scaler = model_artifacts.get("scaler")  # May not exist for RandomForest
    features = model_artifacts["summary"].get("features", [])
    model_type = model_artifacts["summary"].get("model_type", "RandomForest")
    
    print(f"Predicting impact of {price_change_fraction*100:+.1f}% price change using {model_type}...")
    
    # Add unique ID
    df = df.withColumn("_row_id", F.monotonically_increasing_id())
    
    # Baseline prediction (current state)
    df_baseline = assembler.transform(df)
    
    # Apply scaling if it exists (for LinearRegression)
    if scaler is not None:
        df_baseline_scaled = scaler.transform(df_baseline)
        pred_baseline = model.transform(df_baseline_scaled)
    else:
        # RandomForest doesn't need scaling
        pred_baseline = model.transform(df_baseline)
    
    pred_baseline = pred_baseline.select(
        "_row_id", group_by, "price", "sales_volume", "rating", "reviews_numeric",
        F.col("prediction").alias("predicted_baseline")
    )
    
    # Modified scenario: adjust price and recalculate dependent features
    new_price_multiplier = (1.0 + price_change_fraction)
    df_modified = df.withColumn("price", F.col("price") * new_price_multiplier)
    
    # Recalculate price-dependent features
    avg_price_original = df.agg(F.avg("price")).collect()[0][0] / new_price_multiplier  # Original avg
    
    df_modified = df_modified.withColumn("log_price", F.log(F.col("price"))) \
                           .withColumn("price_squared", F.col("price") * F.col("price")) \
                           .withColumn("price_vs_market", F.col("price") / F.lit(avg_price_original * new_price_multiplier)) \
                           .withColumn("is_premium", F.when(F.col("price") > F.lit(avg_price_original * new_price_multiplier * 1.5), 1.0).otherwise(0.0)) \
                           .withColumn("is_budget", F.when(F.col("price") < F.lit(avg_price_original * new_price_multiplier * 0.7), 1.0).otherwise(0.0)) \
                           .withColumn("price_rating_interaction", F.col("price") * F.col("rating")) \
                           .withColumn("price_reviews_interaction", F.col("price") * F.log1p(F.col("reviews_numeric"))) \
                           .withColumn("price_elasticity_proxy", F.col("price") / (F.col("rating") * F.log1p(F.col("reviews_numeric")) + 1))
    
    # Predict with modified features
    df_mod_assembled = assembler.transform(df_modified)
    
    # Apply scaling if it exists
    if scaler is not None:
        df_mod_scaled = scaler.transform(df_mod_assembled)
        pred_modified = model.transform(df_mod_scaled)
    else:
        pred_modified = model.transform(df_mod_assembled)
    
    pred_modified = pred_modified.select(
        "_row_id", F.col("prediction").alias("predicted_modified")
    )
    
    # Combine results
    df_combined = pred_baseline.join(pred_modified, on="_row_id", how="left")
    
    # Calculate business metrics
    df_result = df_combined.withColumn(
        "sales_lift_absolute",
        F.col("predicted_modified") - F.col("predicted_baseline")
    ).withColumn(
        "sales_lift_percentage",
        F.when(
            F.col("predicted_baseline") > 0,
            (F.col("predicted_modified") - F.col("predicted_baseline")) / F.col("predicted_baseline") * 100
        ).otherwise(0.0)
    ).withColumn(
        "new_price",
        F.col("price") * new_price_multiplier
    ).withColumn(
        "original_price",
        F.col("price")
    ).withColumn(
        "revenue_baseline",
        F.col("predicted_baseline") * F.col("original_price")
    ).withColumn(
        "revenue_modified",
        F.col("predicted_modified") * F.col("new_price")
    ).withColumn(
        "revenue_lift_percentage",
        F.when(
            F.col("revenue_baseline") > 0,
            (F.col("revenue_modified") - F.col("revenue_baseline")) / F.col("revenue_baseline") * 100
        ).otherwise(0.0)
    ).withColumn(
        "unit_economics_score",
        F.col("revenue_lift_percentage") + F.col("sales_lift_percentage") * 0.5
    )
    
    return df_result

def predict_price_impact(model, df, features, price_change_fraction, group_by="product_type"):
    """
    Predict sales impact of price changes by group
    """
    # Add row ID for joining
    df = df.withColumn("_row_id", F.monotonically_increasing_id())
    
    # Prepare assembler
    assembler = VectorAssembler(inputCols=features, outputCol="features")
    
    # Baseline predictions (current prices)
    df_baseline = assembler.transform(df)
    pred_baseline = model.transform(df_baseline).select(
        "_row_id", group_by, "price", "sales_volume", 
        F.col("prediction").alias("predicted_baseline")
    )
    
    # Modified price predictions
    df_modified = df.withColumn("price", F.col("price") * (1.0 + price_change_fraction))
    
    # Recalculate price-dependent features for modified scenario
    df_modified = df_modified.withColumn("log_price", F.log1p(F.col("price"))) \
                           .withColumn("price_rating_interaction", F.col("price") * F.col("rating"))
    
    df_mod_assembled = assembler.transform(df_modified)
    pred_modified = model.transform(df_mod_assembled).select(
        "_row_id", F.col("prediction").alias("predicted_modified")
    )
    
    # Combine predictions
    df_combined = pred_baseline.join(pred_modified, on="_row_id", how="left")
    
    # Calculate impact metrics
    df_result = df_combined.withColumn(
        "sales_lift_absolute", 
        F.col("predicted_modified") - F.col("predicted_baseline")
    ).withColumn(
        "sales_lift_percentage",
        F.when(F.col("predicted_baseline") > 0,
               (F.col("predicted_modified") - F.col("predicted_baseline")) / F.col("predicted_baseline") * 100)
         .otherwise(0.0)
    ).withColumn(
        "revenue_baseline",
        F.col("predicted_baseline") * F.col("price") / (1.0 + price_change_fraction)  # Original price
    ).withColumn(
        "revenue_modified", 
        F.col("predicted_modified") * F.col("price")  # New price
    ).withColumn(
        "revenue_lift_percentage",
        F.when(F.col("revenue_baseline") > 0,
               (F.col("revenue_modified") - F.col("revenue_baseline")) / F.col("revenue_baseline") * 100)
         .otherwise(0.0)
    )
    
    return df_result

def generate_pricing_recommendations_improved(df_pred, price_change_fraction, group_by, model_quality):
    """
    Generate business recommendations với logic cải thiện
    """
    # Group-level analysis với confidence intervals
    group_stats = df_pred.groupBy(group_by).agg(
        F.avg("sales_lift_percentage").alias("avg_sales_lift"),
        F.stddev("sales_lift_percentage").alias("std_sales_lift"),
        F.avg("revenue_lift_percentage").alias("avg_revenue_lift"),
        F.stddev("revenue_lift_percentage").alias("std_revenue_lift"),
        F.avg("unit_economics_score").alias("avg_economics_score"),
        F.avg("predicted_baseline").alias("avg_baseline_sales"),
        F.avg("original_price").alias("avg_price"),
        F.count("*").alias("sample_size"),
        F.expr("percentile_approx(sales_lift_percentage, 0.25)").alias("sales_lift_q25"),
        F.expr("percentile_approx(sales_lift_percentage, 0.75)").alias("sales_lift_q75"),
        F.expr("percentile_approx(revenue_lift_percentage, 0.25)").alias("revenue_lift_q25"),
        F.expr("percentile_approx(revenue_lift_percentage, 0.75)").alias("revenue_lift_q75")
    ).filter(F.col("sample_size") >= 3)  # Minimum sample size
    
    recommendations = []
    
    for row in group_stats.collect():
        group_name = row[group_by]
        sales_lift = float(row["avg_sales_lift"]) if row["avg_sales_lift"] else 0.0
        revenue_lift = float(row["avg_revenue_lift"]) if row["avg_revenue_lift"] else 0.0
        economics_score = float(row["avg_economics_score"]) if row["avg_economics_score"] else 0.0
        sample_size = int(row["sample_size"])
        
        # Confidence based on model quality, sample size, economics score và độ biến thiên (standard error)
        # Lấy std dev từ aggregation nếu có
        std_sales = float(row["std_sales_lift"]) if row["std_sales_lift"] else None
        std_revenue = float(row["std_revenue_lift"]) if row["std_revenue_lift"] else None
        # Tính standard error (SE) = std / sqrt(n)
        import math
        se_sales = (std_sales / math.sqrt(sample_size)) if std_sales and sample_size > 0 else float("inf")
        se_revenue = (std_revenue / math.sqrt(sample_size)) if std_revenue and sample_size > 0 else float("inf")
        
        # Ngưỡng (có thể điều chỉnh): SE nhỏ => estimate ổn định
        SE_SALES_THRESHOLD_HIGH = 5.0    # % điểm chuẩn cho sales lift
        SE_REV_THRESHOLD_HIGH = 3.0      # % điểm chuẩn cho revenue lift
        
        # stricter rules: high only khi mẫu đủ lớn, mô hình tốt, economics có ý nghĩa và SE nhỏ
        if model_quality == "excellent" and sample_size >= 50 and abs(economics_score) >= 5 \
           and se_sales <= SE_SALES_THRESHOLD_HIGH and se_revenue <= SE_REV_THRESHOLD_HIGH:
            confidence = "high"
        elif model_quality in ["excellent", "good"] and sample_size >= 20 and abs(economics_score) >= 2 \
             and se_sales <= (SE_SALES_THRESHOLD_HIGH * 2):
            confidence = "medium"
        else:
            confidence = "low"
        
        # Decision logic với price elasticity concepts
        if price_change_fraction < 0:  # Price reduction
            if revenue_lift > 5.0 and sales_lift > 15.0:
                recommendation = "strongly_recommended"
                rationale = f"Giảm giá {abs(price_change_fraction)*100:.0f}% tạo hiệu ứng tích cực mạnh: +{revenue_lift:.1f}% doanh thu, +{sales_lift:.1f}% doanh số"
                action = f"Triển khai giảm giá ngay lập tức cho nhóm '{group_name}'"
            elif revenue_lift > 0 and sales_lift > 8.0:
                recommendation = "recommended"
                rationale = f"Giảm giá mang lại lợi ích: +{revenue_lift:.1f}% doanh thu, +{sales_lift:.1f}% doanh số"
                action = f"Thử nghiệm giảm giá trong thời gian ngắn cho '{group_name}'"
            elif revenue_lift > -2.0:
                recommendation = "test_carefully"
                rationale = f"Tác động hỗn hợp: {revenue_lift:+.1f}% doanh thu, {sales_lift:+.1f}% doanh số"
                action = f"A/B test với nhóm nhỏ trước khi áp dụng rộng rãi"
            else:
                recommendation = "not_recommended"
                rationale = f"Giảm giá có thể gây tổn hại: {revenue_lift:.1f}% doanh thu, {sales_lift:+.1f}% doanh số"
                action = f"Tránh giảm giá cho '{group_name}', tập trung vào value-add"
        else:  # Price increase
            if revenue_lift > 10.0 and sales_lift > -5.0:
                recommendation = "strongly_recommended"
                rationale = f"Tăng giá {price_change_fraction*100:.0f}% hiệu quả: +{revenue_lift:.1f}% doanh thu, {sales_lift:+.1f}% doanh số"
                action = f"Tăng giá cho '{group_name}' - sản phẩm ít nhạy cảm với giá"
            elif revenue_lift > 5.0:
                recommendation = "recommended" 
                rationale = f"Tăng giá có lợi: +{revenue_lift:.1f}% doanh thu, {sales_lift:+.1f}% doanh số"
                action = f"Xem xét tăng giá từ từ cho '{group_name}'"
            else:
                recommendation = "not_recommended"
                rationale = f"Tăng giá có thể phản tác dụng: {revenue_lift:+.1f}% doanh thu"
                action = f"Giữ nguyên giá cho '{group_name}'"
        
        recommendations.append({
            "group": group_name,
            "recommendation": recommendation,
            "confidence": confidence,
            "rationale": rationale,
            "suggested_action": action,
            "expected_sales_lift_pct": round(sales_lift, 1),
            "expected_revenue_lift_pct": round(revenue_lift, 1),
            "economics_score": round(economics_score, 1),
            "sample_size": sample_size,
            "price_sensitivity": "high" if abs(sales_lift) > 15 else "medium" if abs(sales_lift) > 8 else "low"
        })
    
    # Sort by economics score
    recommendations.sort(key=lambda x: x["economics_score"], reverse=True)
    
    return recommendations

def generate_scenario_recommendations(df_pred, price_change_fraction, group_by, min_sample_size=5):
    """
    Generate business recommendations for a price scenario
    """
    # Group-level analysis
    group_analysis = df_pred.groupBy(group_by).agg(
        F.avg("sales_lift_percentage").alias("avg_sales_lift"),
        F.avg("revenue_lift_percentage").alias("avg_revenue_lift"),
        F.avg("predicted_baseline").alias("avg_baseline_sales"),
        F.avg("predicted_modified").alias("avg_modified_sales"),
        F.avg("price").alias("avg_current_price"),
        F.count("*").alias("sample_size")
    ).filter(F.col("sample_size") >= min_sample_size)
    
    recommendations = []
    
    for row in group_analysis.collect():
        group_name = row[group_by]
        sales_lift = float(row["avg_sales_lift"]) if row["avg_sales_lift"] else 0.0
        revenue_lift = float(row["avg_revenue_lift"]) if row["avg_revenue_lift"] else 0.0
        sample_size = int(row["sample_size"])
        
        # Determine recommendation based on both sales and revenue impact
        if revenue_lift > 5.0 and sales_lift > 10.0:
            recommendation = "highly_recommended"
            rationale = f"Strong positive impact: +{revenue_lift:.1f}% revenue, +{sales_lift:.1f}% sales"
        elif revenue_lift > 0 and sales_lift > 5.0:
            recommendation = "recommended"
            rationale = f"Positive impact: +{revenue_lift:.1f}% revenue, +{sales_lift:.1f}% sales"
        elif revenue_lift > 0:
            recommendation = "neutral"
            rationale = f"Mixed impact: +{revenue_lift:.1f}% revenue, {sales_lift:+.1f}% sales"
        elif revenue_lift > -5.0:
            recommendation = "caution"
            rationale = f"Slight negative impact: {revenue_lift:.1f}% revenue, {sales_lift:+.1f}% sales"
        else:
            recommendation = "not_recommended"
            rationale = f"Negative impact: {revenue_lift:.1f}% revenue, {sales_lift:+.1f}% sales"
        
        recommendations.append({
            "group": group_name,
            "recommendation": recommendation,
            "rationale": rationale,
            "expected_sales_lift_pct": round(sales_lift, 2),
            "expected_revenue_lift_pct": round(revenue_lift, 2),
            "sample_size": sample_size,
            "confidence": "high" if sample_size >= 20 else "medium" if sample_size >= 10 else "low"
        })
    
    return recommendations

def generate_comprehensive_business_insights(scenario_results, model_summary, df):
    """
    Generate comprehensive business insights from all scenarios
    """
    insights = {
        "key_findings": [],
        "pricing_strategy_recommendations": [],
        "risk_factors": [],
        "opportunities": [],
        "model_reliability": {
            "r_squared": model_summary.get("r_squared", 0),
            "quality_assessment": model_summary.get("model_quality", "unknown"),
            "most_important_factor": max(model_summary.get("feature_importance", {}).items(), 
                                       key=lambda x: x[1])[0] if model_summary.get("feature_importance") else "unknown"
        }
    }
    
    # Analyze across all scenarios
    all_recommendations = []
    for scenario in scenario_results:
        all_recommendations.extend(scenario["recommendations"])
    
    # Find best performing groups across scenarios
    group_performance = {}
    for rec in all_recommendations:
        group = rec["group"]
        revenue_lift = rec["expected_revenue_lift_pct"]
        
        if group not in group_performance:
            group_performance[group] = []
        group_performance[group].append(revenue_lift)
    
    # Key findings
    if group_performance:
        best_group = max(group_performance.items(), key=lambda x: max(x[1]))
        worst_group = min(group_performance.items(), key=lambda x: min(x[1]))
        
        insights["key_findings"].extend([
            f"'{best_group[0]}' cho thấy phản ứng tích cực nhất với thay đổi giá (tối đa +{max(best_group[1]):.1f}% revenue)",
            f"'{worst_group[0]}' nhạy cảm nhất với thay đổi giá (tối thiểu {min(worst_group[1]):+.1f}% revenue)",
            f"Mô hình có độ tin cậy {insights['model_reliability']['quality_assessment']} với R² = {insights['model_reliability']['r_squared']:.3f}"
        ])
    
    # Strategy recommendations
    positive_scenarios = [s for s in scenario_results if any(r["expected_revenue_lift_pct"] > 0 for r in s["recommendations"])]
    if positive_scenarios:
        insights["pricing_strategy_recommendations"].append(
            "Có cơ hội tăng revenue thông qua điều chỉnh giá cho một số nhóm sản phẩm"
        )
    
    # Risk assessment
    high_negative_impact = [r for r in all_recommendations if r["expected_revenue_lift_pct"] < -10]
    if high_negative_impact:
        insights["risk_factors"].append(
            f"Cần thận trọng với {len(high_negative_impact)} nhóm sản phẩm có nguy cơ giảm revenue mạnh"
        )
    
    return insights

def export_scenario_csv(df, filepath):
    """
    Export a Spark DataFrame to a single CSV file at filepath.

    This attempts to convert to pandas and write a single CSV file (convenient for small-to-medium datasets).
    If that fails (memory or serialization issues), it falls back to Spark's CSV writer into a temporary
    directory and moves the produced part file to the requested filepath.
    """
    from pathlib import Path
    import shutil
    import glob

    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Prefer Pandas for a single-file CSV (works when data fits in memory)
        pdf = df.toPandas()
        pdf.to_csv(str(path), index=False, encoding="utf-8")
    except Exception:
        # Fallback: use Spark to write to a temporary directory, then move the part file
        tmp_dir = str(path.parent / (path.stem + "_csv_tmp"))
        # remove any existing tmp dir
        try:
            shutil.rmtree(tmp_dir)
        except Exception:
            pass
        df.coalesce(1).write.mode("overwrite").option("header", "true").csv(tmp_dir)
        part_files = glob.glob(str(Path(tmp_dir) / "part-*"))
        if part_files:
            # move the first part file to desired location
            shutil.move(part_files[0], str(path))
        # cleanup tmp dir
        try:
            shutil.rmtree(tmp_dir)
        except Exception:
            pass