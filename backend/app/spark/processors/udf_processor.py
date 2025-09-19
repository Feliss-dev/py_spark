from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, DoubleType
from app.spark.spark_session import get_spark_session
from pathlib import Path
import pandas as pd
import numpy as np
import json


def classify_promotions(csv_path: str, out_dir: str, spark=None, threshold: float = 0.15):
    """
    Enhanced promotion classification với nhiều tiêu chí
    """
    if spark is None:
        spark = get_spark_session()

    df = spark.read.option("header", "true").option("inferSchema", "true").csv(str(csv_path))
    df = df.withColumn("price", F.col("price").cast("double"))
    df = df.withColumn("sales_volume", F.col("sales_volume").cast("double"))

    # 1. Price-based classification (như cũ nhưng threshold cao hơn)
    if "product_type" in df.columns:
        price_stats = df.groupBy("product_type").agg(
            F.expr("percentile_approx(price, 0.5)").alias("median_price"),
            F.expr("percentile_approx(price, 0.25)").alias("q25_price"),
            F.expr("percentile_approx(price, 0.75)").alias("q75_price")
        )
        df = df.join(price_stats, on="product_type", how="left")
    else:
        df = df.withColumn("median_price", F.lit(None).cast("double"))
        df = df.withColumn("q25_price", F.lit(None).cast("double"))
        df = df.withColumn("q75_price", F.lit(None).cast("double"))

    # 2. Multi-criteria promotion detection
    df = df.withColumn(
        "is_deep_discount", 
        F.when(
            (F.col("price").isNotNull()) & (F.col("q25_price").isNotNull()) &
            (F.col("price") < F.col("q25_price")), F.lit(1)
        ).otherwise(F.lit(0))
    ).withColumn(
        "is_high_volume",
        F.when(
            (F.col("sales_volume").isNotNull()) & 
            (F.col("sales_volume") > F.expr("percentile_approx(sales_volume, 0.8) OVER(PARTITION BY product_type)")),
            F.lit(1)
        ).otherwise(F.lit(0))
    ).withColumn(
        "price_volume_score",
        F.when(
            (F.col("price").isNotNull()) & (F.col("median_price").isNotNull()) & (F.col("sales_volume").isNotNull()),
            # Score cao khi: giá thấp + volume cao
            (F.lit(1.0) - F.col("price") / F.col("median_price")) * 
            F.log1p(F.col("sales_volume")) / F.lit(10.0)
        ).otherwise(F.lit(0.0))
    )

    # 3. Final promotion classification
    df = df.withColumn(
        "is_promo",
        F.when(
            # Điều kiện 1: Giá rất thấp (dưới Q1)
            (F.col("is_deep_discount") == 1) |
            # Điều kiện 2: Giá thấp + volume cao
            ((F.col("price") < F.col("median_price") * (1.0 - threshold)) & 
             (F.col("is_high_volume") == 1)) |
            # Điều kiện 3: Score tổng hợp cao
            (F.col("price_volume_score") > 0.3),
            F.lit(1)
        ).otherwise(F.lit(0))
    )

    # Rest of the function remains the same...
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Keep useful columns for analysis
    analysis_cols = [c for c in df.columns if c not in ["median_price", "q25_price", "q75_price", "is_deep_discount", "is_high_volume", "price_volume_score"]]
    df_final = df.select(*analysis_cols)

    df_final.write.mode("overwrite").parquet(str(out_dir / "processed.parquet"))
    df_final.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(out_dir / "processed_csv"))

    # Summary với thống kê chi tiết
    agg_df = df_final.groupBy("is_promo").agg(
        F.count("*").alias("n_items"),
        F.sum("sales_volume").alias("total_sales"),
        F.avg("price").alias("avg_price"),
        F.avg("sales_volume").alias("avg_sales_volume"),
        F.expr("percentile_approx(price, 0.5)").alias("median_price"),
        F.expr("percentile_approx(sales_volume, 0.5)").alias("median_sales")
    )

    summary = {
        "n_rows": df_final.count(),
        "promotion_stats": {
            "total_promotions": df_final.filter(F.col("is_promo") == 1).count(),
            "promotion_rate": df_final.filter(F.col("is_promo") == 1).count() / df_final.count() * 100
        },
        "aggregates": [r.asDict() for r in agg_df.collect()],
        "processed_parquet": str(out_dir / "processed.parquet"),
        "processed_csv_dir": str(out_dir / "processed_csv")
    }

    with open(out_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    return summary

