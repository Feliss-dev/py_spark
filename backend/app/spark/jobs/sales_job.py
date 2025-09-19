from app.spark.spark_session import get_spark_session

def sales_summary():
    spark = get_spark_session()
    data = [("A", 100), ("B", 200), ("A", 150)]
    df = spark.createDataFrame(data, ["product", "amount"])
    df.createOrReplaceTempView("sales")

    result = spark.sql("""
        SELECT product, SUM(amount) as total 
        FROM sales 
        GROUP BY product
    """).collect()

    return [{"product": r["product"], "total": r["total"]} for r in result]
