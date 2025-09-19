from pyspark.sql import SparkSession
from app.config import SPARK_APP_NAME, SPARK_MASTER, HADOOP_HOME  # add HADOOP_HOME in config if you want
import os
import sys
import shutil

def _ensure_hadoop_winutils():
    """
    On Windows Spark/Hadoop expect winutils.exe available under HADOOP_HOME\bin.
    Prefer setting HADOOP_HOME in environment or app.config; this helper will
    set environment vars if HADOOP_HOME exists on disk.
    """
    h = os.environ.get("HADOOP_HOME") or globals().get("HADOOP_HOME") or None
    if not h and 'HADOOP_HOME' in globals():
        h = globals()['HADOOP_HOME']
    if h and os.path.isdir(h):
        binp = os.path.join(h, "bin")
        # add bin to PATH if not already
        path = os.environ.get("PATH", "")
        if binp not in path:
            os.environ["PATH"] = binp + os.pathsep + path
        os.environ["HADOOP_HOME"] = h
        return True
    # if not found, try common location C:\hadoop
    fallback = r"C:\hadoop"
    if os.path.isdir(fallback):
        os.environ["HADOOP_HOME"] = fallback
        os.environ["PATH"] = os.path.join(fallback, "bin") + os.pathsep + os.environ.get("PATH", "")
        return True
    return False

def get_spark_session():
    # ensure PySpark uses same python interpreter
    os.environ.setdefault("PYSPARK_PYTHON", sys.executable)
    os.environ.setdefault("PYSPARK_DRIVER_PYTHON", sys.executable)

    # try ensure HADOOP_HOME/winutils on Windows
    if os.name == "nt":
        ok = _ensure_hadoop_winutils()
        if not ok:
            # prefer user action: set HADOOP_HOME to folder that contains bin\winutils.exe
            # we don't raise here, but you will see native errors when writing files
            print("WARNING: HADOOP_HOME/winutils not found. On Windows you should install winutils.exe and set HADOOP_HOME (see README).")

    spark = SparkSession.builder \
        .appName(SPARK_APP_NAME) \
        .master(SPARK_MASTER) \
        .config("spark.executorEnv.PYSPARK_PYTHON", sys.executable) \
        .config("spark.driver.memory", "4g") \
        .config("spark.executor.memory", "2g") \
        .config("spark.sql.execution.pyspark.udf.faulthandler.enabled", "true") \
        .config("spark.python.worker.reuse", "false") \
        .config("spark.python.worker.faulthandler.enabled", "true") \
        .getOrCreate()
    return spark
