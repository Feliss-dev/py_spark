from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Union
from enum import Enum

class AnalysisRequest(BaseModel):
    """Request model for analysis endpoint"""
    include_segments: bool = Field(default=True, description="Include brand/product type analysis")
    segment_columns: List[str] = Field(default=["brand", "product_type"], description="Columns to segment by")
    price_buckets: int = Field(default=10, ge=5, le=20, description="Number of price buckets for optimization")
    
class EffectivenessLevel(str, Enum):
    HIGHLY_EFFECTIVE = "highly_effective"
    MODERATELY_EFFECTIVE = "moderately_effective" 
    MARGINALLY_EFFECTIVE = "marginally_effective"
    INEFFECTIVE = "ineffective"

class ImpactLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NEUTRAL = "neutral"

class SalesInsights(BaseModel):
    avg_sales_lift_percent: float
    total_sales_lift_percent: float
    median_sales_lift_percent: float
    promo_share_of_total: float
    assessment: Dict[str, Union[str, float]]

class SalesAnalysisResponse(BaseModel):
    sales_by_promo: List[Dict[str, Any]]
    insights: SalesInsights
    csv_path: str

class RatingInsights(BaseModel):
    avg_rating_difference: float
    median_rating_difference: float
    rating_impact: str
    significance: str
    assessment: Dict[str, Union[str, bool]]

class RatingAnalysisResponse(BaseModel):
    rating_by_promo: List[Dict[str, Any]]
    rating_distribution: List[Dict[str, Any]]
    insights: RatingInsights

class ReviewInsights(BaseModel):
    review_engagement_lift_percent: float
    promo_generates_more_reviews: bool
    review_efficiency: Dict[str, float]
    assessment: Dict[str, str]

class ReviewAnalysisResponse(BaseModel):
    review_conversion: List[Dict[str, Any]]
    insights: ReviewInsights

class PriceOptimizationResponse(BaseModel):
    price_optimization: Dict[str, Any]

class SegmentAnalysisResponse(BaseModel):
    segment_analysis: Dict[str, Any]

class EfficiencyMetricsResponse(BaseModel):
    revenue_metrics: List[Dict[str, Any]]
    price_elasticity: List[Dict[str, Any]]
    market_penetration: List[Dict[str, Any]]
    insights: Dict[str, Any]

class OverallInsights(BaseModel):
    promotion_effectiveness: EffectivenessLevel
    key_findings: List[str]
    strategic_recommendations: List[str]
    risk_factors: List[str]

class ComprehensiveAnalysisResponse(BaseModel):
    # analysis_timestamp: str
    data_overview: Dict[str, Any]
    sales_volume_analysis: Optional[SalesAnalysisResponse] = None
    rating_impact_analysis: Optional[RatingAnalysisResponse] = None
    review_conversion_analysis: Optional[ReviewAnalysisResponse] = None
    price_optimization_analysis: Optional[PriceOptimizationResponse] = None
    segment_analysis: Optional[SegmentAnalysisResponse] = None
    efficiency_metrics: Optional[EfficiencyMetricsResponse] = None
    overall_insights: Optional[OverallInsights] = None

class PriceScenario(BaseModel):
    """Schema cho một kịch bản thay đổi giá"""
    name: str = Field(description="Tên kịch bản (vd: 'giảm_5%', 'giảm_10%')")
    price_change_percentage: float = Field(description="Phần trăm thay đổi giá (âm = giảm, dương = tăng)")
    description: Optional[str] = Field(default="", description="Mô tả kịch bản")

class PriceModelingRequest(BaseModel):
    """Schema cho request modeling giá"""
    scenarios: List[PriceScenario] = Field(
        default=[PriceScenario(name="baseline", price_change_percentage=0.0)],
        description="Danh sách các kịch bản giá cần phân tích"
    )
    group_by: str = Field(default="product_type", description="Nhóm sản phẩm theo cột nào")
    lift_threshold: float = Field(default=0.05, description="Ngưỡng lift để đưa ra khuyến nghị")
    features: Optional[List[str]] = Field(
        default=None, 
        description="Các features để train model, mặc định ['price', 'rating', 'reviews_numeric', 'is_promo']"
    )

class ProductRecommendation(BaseModel):
    """Schema cho khuyến nghị của một nhóm sản phẩm"""
    group: str = Field(description="Tên nhóm sản phẩm")
    group_value: str = Field(description="Giá trị của nhóm")
    scenario: str = Field(description="Tên kịch bản")
    recommendation: str = Field(description="Khuyến nghị: 'reduce_price', 'increase_price', 'no_change'")
    expected_lift_percentage: float = Field(description="Phần trăm lift dự kiến")
    avg_current_price: float = Field(description="Giá trung bình hiện tại")
    avg_predicted_sales_baseline: float = Field(description="Doanh số dự đoán baseline")
    avg_predicted_sales_modified: float = Field(description="Doanh số dự đoán sau thay đổi giá")
    sample_size: int = Field(description="Số lượng sản phẩm trong nhóm")

class ModelPerformance(BaseModel):
    """Schema cho hiệu suất model"""
    features: List[str] = Field(description="Các features được sử dụng")
    intercept: float = Field(description="Hệ số tự do")
    coefficients: List[float] = Field(description="Các hệ số của features")
    feature_importance: Dict[str, float] = Field(description="Tầm quan trọng của từng feature")

class PriceModelingResponse(BaseModel):
    """Schema cho response của price modeling"""
    model_performance: ModelPerformance
    scenarios_analysis: List[ProductRecommendation]
    summary: Dict[str, Any] = Field(description="Tóm tắt tổng quan")
    business_insights: List[str] = Field(description="Các insight kinh doanh")