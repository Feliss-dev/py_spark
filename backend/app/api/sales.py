from fastapi import APIRouter
from app.spark.jobs.sales_job import sales_summary

router = APIRouter()

@router.get("/sales-summary")
def get_sales_summary():
    return sales_summary()
