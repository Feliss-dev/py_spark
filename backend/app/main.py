from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.spark.spark_session import get_spark_session
from app.api import sales
from app.api import jobs

@asynccontextmanager
async def lifespan(app: FastAPI):
    # create spark once for app lifetime
    spark = get_spark_session()
    app.state.spark = spark
    app.state.jobs = {} 
    yield
    try:
        spark.stop()
    except Exception:
        pass



app = FastAPI(title="FastAPI + PySpark")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
@app.get("/")
def root():
    return {"msg": "Hello FastAPI + PySpark!"}
