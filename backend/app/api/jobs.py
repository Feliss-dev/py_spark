from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Request, Body
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import uuid, shutil, json
import pandas as pd
from app.config import DATA_PATH
from app.spark.processors.udf_processor import classify_promotions
from app.spark.processors.analysis import run_comprehensive_analysis,  run_price_modeling_from_raw
from app.spark.processors.efficiency import run_sales_efficiency
from app.schemas.analysis import AnalysisRequest, ComprehensiveAnalysisResponse
from datetime import datetime
from app.schemas.classify import ClassifyParams
from app.spark.processors.analysis import (
    PriceModelingRequest, 
    PriceModelingResponse, 
    PriceScenario
)
from typing import Optional, List
router = APIRouter()


DATA_DIR = Path(DATA_PATH)
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# expected schema for raw files (canonical column names)
EXPECTED_COLUMNS = [
    "product_name","product_type","sales_volume","price",
    "sale_time","date","platform","brand","reviews","rating"
]

def _write_status(job_dir: Path, obj: dict):
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "status.json").write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")

def _read_status(job_dir: Path):
    p = job_dir / "status.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    name = Path(file.filename).name
    ext = Path(name).suffix.lower()
    if ext not in [".csv", ".xls", ".xlsx"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    job_id = uuid.uuid4().hex
    job_dir = RAW_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    raw_path = job_dir / name
    # save raw uploaded file bytes (no parsing here)
    with open(raw_path, "wb") as f:
        f.write(await file.read())

    # convert Excel -> CSV (no schema inference)
    if ext in [".xls", ".xlsx"]:
        df = pd.read_excel(raw_path, engine="openpyxl")
        csv_path = job_dir / (raw_path.stem + ".csv")
        df.to_csv(csv_path, index=False, encoding="utf-8")
    else:
        csv_path = job_dir / (raw_path.stem + ".csv")
        # ensure we create a UTF-8 CSV copy (do not load full file into memory)
        # read only header line to preserve original file
        try:
            with open(raw_path, "r", encoding="utf-8", errors="replace") as fh_in, open(csv_path, "w", encoding="utf-8") as fh_out:
                first = fh_in.readline()
                # write header + remaining bytes (fast copy)
                fh_out.write(first)
                shutil.copyfileobj(fh_in, fh_out)
        except Exception:
            # fallback: just copy binary if text read fails
            shutil.copyfile(str(raw_path), str(csv_path))

    # quick header validation: read first line and compare canonical column names (case-insensitive)
    try:
        with open(csv_path, "r", encoding="utf-8", errors="replace") as fh:
            header = fh.readline().strip()
            columns = [c.strip().lower() for c in header.split(",")]
    except Exception:
        columns = []

    cols_ok = (columns == EXPECTED_COLUMNS) or (set(EXPECTED_COLUMNS).issubset(set(columns)))

    meta = {
        "job_id": job_id,
        "status": "uploaded",
        "raw_file": str(raw_path),
        "csv_file": str(csv_path),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "columns": columns,
        "columns_ok": bool(cols_ok)
    }

    # persist metadata
    _write_status(job_dir, meta)
    # register in-memory if app.state.jobs exists
    try:
        from fastapi import Request
        # get app from request not available here; best-effort: skip in upload
        if hasattr(router, "app") and getattr(router, "app", None):
            router.app.state.jobs[job_id] = meta
    except Exception:
        pass

    return {"job_id": job_id, "csv_file": str(csv_path), "columns_ok": bool(cols_ok)}

@router.get("/list")
def list_jobs():
    """
    Liệt kê các job_id có trong RAW_DIR kèm tên file, trạng thái và thông tin cơ bản.
    Trả về: [{ "job_id": "...", "file_name": "...", "status": "...", "columns_ok": True/False, "created_at": "..."}]
    """
    out = []
    for job_dir in sorted(RAW_DIR.iterdir(), key=lambda p: p.name, reverse=True):
        if not job_dir.is_dir():
            continue
        job_id = job_dir.name
        status = _read_status(job_dir) or {}
        # try to find a sensible file name
        file_name = None
        for ext in (".csv", ".xlsx", ".xls"):
            candidate = next(job_dir.glob(f"*{ext}"), None)
            if candidate:
                file_name = candidate.name
                break
        # fallback to fields in status.json
        if not file_name:
            file_name = Path(status.get("raw_file") or status.get("csv_file") or "").name or None

        # created_at fallback to folder mtime
        created_at = status.get("created_at")
        if not created_at:
            try:
                created_at = datetime.utcfromtimestamp(job_dir.stat().st_mtime).isoformat() + "Z"
            except Exception:
                created_at = None

        out.append({
            "job_id": job_id,
            "file_name": file_name,
            "status": status.get("status"),
            "columns_ok": status.get("columns_ok"),
            "created_at": created_at
        })

    # optional: sort by created_at desc when available
    def _key(x):
        try:
            return x.get("created_at") or ""
        except Exception:
            return ""
    out = sorted(out, key=_key, reverse=True)
    return out

@router.post("/classify/{job_id}")
def classify_job(job_id: str, request: Request, payload: ClassifyParams = Body(ClassifyParams())):
    """
    Trigger promotion classification for an uploaded job (job_id).
    Follows project flow: update status.json -> processing, run classify, persist result.
    Optional JSON body: { "threshold": 0.05 }
    """
    app = request.app
    job_dir = RAW_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="job_id not found")

    status = _read_status(job_dir) or {}
    if status.get("status") == "processing":
        return JSONResponse({"detail": "already processing"}, status_code=409)

    # mark processing
    status["status"] = "processing"
    _write_status(job_dir, status)

    # determine csv path (prefer status metadata)
    csv_path = status.get("csv_file")
    if not csv_path:
        csvs = list(job_dir.glob("*.csv"))
        if not csvs:
            status.update({"status": "error", "error": "No CSV found"})
            _write_status(job_dir, status)
            raise HTTPException(status_code=400, detail="No CSV found for job")
        csv_path = str(csvs[0])

    out_dir = PROCESSED_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    spark = getattr(app.state, "spark", None)

    try:
        threshold = float(payload.threshold or 0.15)
        summary = classify_promotions(csv_path=csv_path, out_dir=str(out_dir), spark=spark, threshold=threshold)
        status.update({"status": "classified", "classification": summary})
        _write_status(job_dir, status)
        return summary
    except Exception as e:
        status.update({"status": "error", "error": str(e)})
        _write_status(job_dir, status)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/{job_id}", response_model=ComprehensiveAnalysisResponse)
def analyze_job(
    job_id: str, 
    request: Request, 
    analysis_request: AnalysisRequest = Body(default=AnalysisRequest())
):
    """
    Run comprehensive promotion analysis on processed data for job_id.
    
    Includes:
    - Sales volume comparison between promo/non-promo
    - Rating impact analysis
    - Review conversion metrics
    - Price optimization thresholds
    - Segment analysis by brand/product type
    - Sales efficiency metrics via Spark SQL
    """
    app = request.app
    job_dir = RAW_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="job_id not found")

    proc_dir = PROCESSED_DIR / job_id
    if not proc_dir.exists():
        raise HTTPException(status_code=404, detail="processed data not found; run /classify/{job_id} first")

    # Update status
    status = _read_status(job_dir) or {}
    status["analysis_status"] = "running"
    _write_status(job_dir, status)

    spark = getattr(app.state, "spark", None)
    try:
        # Run comprehensive analysis
        summary = run_comprehensive_analysis(str(proc_dir), spark=spark)
        
        status.update({
            "analysis_status": "completed",
            "analysis_summary": {
                "path": str(proc_dir / "comprehensive_analysis.json"),
                # "timestamp": summary["analysis_timestamp"]
            }
        })
        _write_status(job_dir, status)
        
        return ComprehensiveAnalysisResponse(**summary)
        
    except Exception as e:
        status.update({"analysis_status": "error", "analysis_error": str(e)})
        _write_status(job_dir, status)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/analyze/{job_id}/results")
def get_analysis_results(job_id: str, request: Request):
    """Get cached analysis results if available"""
    proc_dir = PROCESSED_DIR / job_id
    analysis_file = proc_dir / "comprehensive_analysis.json"
    
    if not analysis_file.exists():
        raise HTTPException(status_code=404, detail="Analysis results not found")
    
    try:
        import json
        with open(analysis_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load results: {str(e)}")

# @router.get("/analysis/{job_id}/summary")
# def get_analysis_summary(job_id: str):
#     proc_dir = PROCESSED_DIR / job_id
#     p = proc_dir / "analysis_summary.json"
#     if not p.exists():
#         raise HTTPException(status_code=404, detail="analysis summary not found; run /analyze/{job_id}")
#     return json.loads(p.read_text(encoding="utf-8"))

@router.get("/analysis/{job_id}/efficiency")
def analysis_efficiency(job_id: str, request: Request):
    """
    Calculate sales efficiency metrics for job_id and return summary.
    If summary file exists, return cached result instead of recomputing.
    """
    app = request.app
    job_dir = RAW_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="job_id not found")

    proc_dir = PROCESSED_DIR / job_id
    if not proc_dir.exists():
        raise HTTPException(status_code=404, detail="processed data not found; run /classify/{job_id} first")

    summary_file = proc_dir / "efficiency" / "efficiency_summary.json"
    if summary_file.exists():
        try:
            with open(summary_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load cached efficiency summary: {str(e)}")

    # Nếu chưa có file, mới chạy lại Spark
    try:
        spark = getattr(app.state, "spark", None)
        if spark is None:
            from app.spark.spark_session import get_spark_session
            spark = get_spark_session()
            try:
                app.state.spark = spark
            except Exception:
                pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to intialize Spark Session")

    try:
        summary = run_sales_efficiency(str(proc_dir), spark)
        # update status
        status = _read_status(job_dir) or {}
        status.setdefault("analysis", {})["last_efficiency"] = {
            "path": str(proc_dir / "efficiency" / "efficiency_summary.json"),
            "ts": datetime.utcnow().isoformat() + "Z"
        }
        _write_status(job_dir, status)
        return summary
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="processed file not found for job")
    except Exception as e:
        status = _read_status(job_dir) or {}
        status.update({"analysis_status": "error", "analysis_error": str(e)})
        _write_status(job_dir, status)
        raise HTTPException(status_code=500, detail=f"Efficiency analysis failed: {str(e)}")

@router.post("/model/price-lift/{job_id}")
def model_price_lift(job_id: str, request: Request, body: dict = Body(default=None)):
    """
    Train sales model directly from raw CSV data and simulate price changes.
    No longer requires processed data - works directly with raw uploaded data.
    
    Body example:
    {
        "price_change": -0.10,  # -10% price reduction
        "scenarios": [-0.05, -0.10, -0.15, 0.05, 0.10],  # Multiple scenarios
        "group_by": "product_type"  # Group analysis by product_type, brand, platform
    }
    """
    app = request.app
    job_dir = RAW_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="job_id not found")

    # Find raw CSV file
    csv_files = list(job_dir.glob("*.csv"))
    if not csv_files:
        raise HTTPException(status_code=404, detail="No CSV file found for this job")
    
    csv_path = str(csv_files[0])  # Use first CSV file found

    # Parse request parameters
    price_change = -0.10  # Default 10% price reduction
    scenarios = None
    group_by = "product_type"
    
    if body:
        price_change = float(body.get("price_change", -0.10))
        scenarios = body.get("scenarios", [])
        group_by = body.get("group_by", "product_type")

    # Create output directory
    proc_dir = PROCESSED_DIR / job_id
    proc_dir.mkdir(parents=True, exist_ok=True)

    spark = getattr(app.state, "spark", None)
    try:
        # Run enhanced modeling directly from raw data
        summary = run_price_modeling_from_raw(
            csv_path=csv_path,
            output_dir=str(proc_dir), 
            spark=spark, 
            price_change=price_change,
            scenarios=scenarios,
            group_by=group_by
        )
        
        # Update job status
        status = _read_status(job_dir) or {}
        status["modeling"] = {
            "status": "completed", 
            "summary_path": str(proc_dir / "price_modeling_summary.json"),
            "scenarios_analyzed": len(scenarios) if scenarios else 1,
            "primary_price_change": price_change,
            "group_by": group_by,
            "rmse": summary.get("model_performance", {}).get("rmse", "N/A"),
            "r_squared": summary.get("model_performance", {}).get("r_squared", "N/A")
        }
        _write_status(job_dir, status)
        return summary
        
    except Exception as e:
        status = _read_status(job_dir) or {}
        status["modeling"] = {"status": "error", "error": str(e)}
        _write_status(job_dir, status)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/insights/{job_id}")
def get_business_insights(job_id: str):
    """Get business insights JSON for job_id"""
    proc_dir = PROCESSED_DIR / job_id
    insights_file = proc_dir / "recommendations" / "business_insights.json"
    
    if not insights_file.exists():
        raise HTTPException(status_code=404, detail="Business insights not found")
    
    try:
        import json
        with open(insights_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load insights: {str(e)}")

@router.get("/scenarios/{job_id}")
def get_scenario_analysis(job_id: str):
    """Get scenario analysis JSON for job_id"""
    proc_dir = PROCESSED_DIR / job_id
    scenarios_file = proc_dir / "recommendations" / "scenario_analysis.json"
    
    if not scenarios_file.exists():
        raise HTTPException(status_code=404, detail="Scenario analysis not found")
    
    try:
        import json
        with open(scenarios_file, 'r', encoding='utf-8') as f:
            scenarios_data = json.load(f)
            return {"scenarios": scenarios_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load scenarios: {str(e)}")

@router.get("/executive-summary/{job_id}")
def get_executive_summary(job_id: str):
    """Get executive summary JSON for job_id"""
    proc_dir = PROCESSED_DIR / job_id
    summary_file = proc_dir / "executive_summary.json"
    
    if not summary_file.exists():
        raise HTTPException(status_code=404, detail="Executive summary not found")
    
    try:
        import json
        with open(summary_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load summary: {str(e)}")

    
@router.post("/model/flexible-pricing/{job_id}")
def flexible_pricing_analysis(
    job_id: str, 
    request: Request,
    scenarios: List[float] = Body(default=[-0.15, -0.10, -0.05, 0.05, 0.10, 0.15]),
    group_by: str = Body(default="product_type"),
    include_insights: bool = Body(default=True)
):
    """
    Comprehensive pricing analysis with multiple scenarios.
    
    Body example:
    {
        "scenarios": [-0.20, -0.15, -0.10, -0.05, 0.05, 0.10, 0.15, 0.20],
        "group_by": "product_type",  # or "brand", "platform"
        "include_insights": true
    }
    """
    app = request.app
    job_dir = RAW_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    csv_files = list(job_dir.glob("*.csv"))
    if not csv_files:
        raise HTTPException(status_code=404, detail="No CSV file found")

    csv_path = str(csv_files[0])
    proc_dir = PROCESSED_DIR / job_id
    proc_dir.mkdir(parents=True, exist_ok=True)

    spark = getattr(app.state, "spark", None)
    
    try:
        summary = run_price_modeling_from_raw(
            csv_path=csv_path,
            output_dir=str(proc_dir),
            spark=spark,
            scenarios=scenarios,
            group_by=group_by
        )
        
        return {
            "job_id": job_id,
            "analysis_completed": True,
            "scenarios_analyzed": len(scenarios),
            "group_by": group_by,
            "model_performance": summary["model_performance"],
            "key_insights": summary.get("top_insights", []),
            "detailed_results_path": summary["scenario_analysis_path"],
            "business_insights_path": summary["business_insights_path"] if include_insights else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
@router.get("/status/{job_id}")
def status(job_id: str):
    job_dir = RAW_DIR / job_id
    status = _read_status(job_dir)
    if not status:
        raise HTTPException(status_code=404, detail="job not found")
    return status

@router.get("/download/{job_id}")
def download(job_id: str):
    out_csv = PROCESSED_DIR / job_id / "processed.csv"
    if not out_csv.exists():
        raise HTTPException(status_code=404, detail="processed file not found")
    return FileResponse(path=str(out_csv), filename=f"processed_{job_id}.csv", media_type="text/csv")


