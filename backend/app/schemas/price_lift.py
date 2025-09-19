from typing import List, Optional
from pydantic import BaseModel

class PriceLiftRequest(BaseModel):
    price_change: Optional[float] = -0.10  # Tỷ lệ thay đổi giá, ví dụ -0.10 là giảm 10%
    scenarios: Optional[List[float]] = None  # Danh sách các kịch bản thay đổi giá
    group_by: Optional[str] = "product_type"  # Trường để nhóm phân tích

class PriceLiftRecommendation(BaseModel):
    group: str
    recommendation: str
    confidence: str
    rationale: str
    suggested_action: str
    expected_sales_lift_pct: float
    expected_revenue_lift_pct: float
    economics_score: float
    sample_size: int
    price_sensitivity: str

class PriceLiftScenarioResult(BaseModel):
    scenario_name: str
    price_change_percent: float
    recommendations: List[PriceLiftRecommendation]
    detailed_csv_path: str

class PriceLiftModelPerformance(BaseModel):
    validation_rmse: float
    test_rmse: float
    test_r_squared: float
    test_mae: float

class PriceLiftSummary(BaseModel):
    model_performance: PriceLiftModelPerformance
    scenarios_analyzed: int
    group_by: str
    key_insights: Optional[List[str]] = None
    scenario_analysis_path: Optional[str] = None
    business_insights_path: Optional[str] = None
    recommendations: Optional[List[PriceLiftRecommendation]] = None