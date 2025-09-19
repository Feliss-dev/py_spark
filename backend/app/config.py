import os

SPARK_APP_NAME = "FastAPI-Spark"
SPARK_MASTER = "local[*]"  # hoặc "spark://localhost:7077" nếu cluster
# HADOOP_HOME should be the Hadoop root (folder that contains "bin\winutils.exe"), not the bin folder itself
HADOOP_HOME = r"C:\Apps\spark-4.0.1-bin-hadoop3"

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data")
