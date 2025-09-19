export interface Job {
  job_id: string;
  file_name: string;
  status: 'uploaded' | 'processing' | 'classified' | 'completed' | 'failed' | 'error';
  columns_ok: boolean;
  created_at: string;
}

export interface UploadResponse {
  job_id: string;
  csv_file: string;
  columns_ok: boolean;
}

export interface JobStatus {
  job_id: string;
  status: string;
  raw_file?: string;
  csv_file?: string;
  created_at?: string;
  columns?: string[];
  columns_ok?: boolean;
  classification?: any;
  analysis_status?: string;
  analysis_summary?: any;
  modeling?: {
    status: string;
    summary_path?: string;
    scenarios_analyzed?: number;
    primary_price_change?: number;
    group_by?: string;
    rmse?: number | string;
    r_squared?: number | string;
    error?: string;
  };
  error?: string;
}

export interface ClassifyParams {
  threshold?: number;
}

export interface AnalysisRequest {
  include_segments?: boolean;
  segment_columns?: string[];
  price_buckets?: number;
}

export interface SalesInsights {
  avg_sales_lift_percent: number;
  total_sales_lift_percent: number;
  median_sales_lift_percent: number;
  promo_share_of_total: number;
  assessment: {
    effectiveness: 'high' | 'medium' | 'low';
    recommendation: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

export interface RatingInsights {
  avg_rating_difference: number;
  rating_impact: string;
  recommendations: string[];
}

export interface ComprehensiveAnalysis {
  analysis_timestamp: string;
  data_overview: {
    total_records: number;
    promoted_items: number;
    regular_items: number;
  };
  sales_volume_analysis?: {
    sales_by_promo: any[];
    insights: SalesInsights;
    csv_path: string;
  };
  rating_impact_analysis?: {
    insights: RatingInsights;
    csv_path: string;
  };
  review_conversion_analysis?: any;
  price_optimization_analysis?: any;
  segment_analysis?: any;
  efficiency_metrics?: {
    insights?: {
      revenue_lift_percent: number;
      assessment?: {
        revenue_efficiency: string;
      };
    };
    revenue_metrics?: Array<{
      is_promo: boolean;
      total_revenue: number;
      product_count: number;
    }>;
    market_penetration?: Array<{
      is_promo: boolean;
      penetration_rate: number;
      selling_products: number;
      total_products: number;
    }>;
  };
  overall_insights?: {
    promotion_effectiveness: string;
    key_findings: string[];
    strategic_recommendations: string[];
    risk_factors: string[];
  };
}

export interface EfficiencyAnalysis {
  insights: {
    revenue_lift_percent: number;
    assessment: {
      revenue_efficiency: string;
    };
  };
  revenue_metrics: Array<{
    is_promo: boolean;
    total_revenue: number;
    product_count: number;
  }>;
  market_penetration: Array<{
    is_promo: boolean;
    penetration_rate: number;
    selling_products: number;
    total_products: number;
  }>;
  price_elasticity: any[];
}

export interface PriceLiftRequest {
  price_change?: number;
  scenarios?: number[];
  group_by?: string;
}

export interface PriceLiftResponse {
  job_id: string;
  analysis_completed: boolean;
  scenarios_analyzed: number;
  group_by: string;
  model_performance: {
    rmse: number;
    r_squared: number;
    test_rmse?: number;
    test_r_squared?: number;
  };
  scenario_results?: Array<{
    scenario_name: string;
    price_change_percent: number;
    recommendations: any[];
    detailed_csv_path: string;
  }>;
  business_insights: string[];
  top_insights?: string[];
  detailed_results_path: string;
  business_insights_path?: string;
}

export interface ModelSummary {
  model_performance: {
    features: string[];
    intercept: number;
    coefficients: number[];
    feature_importance: Record<string, number>;
    rmse?: number;
    r_squared?: number;
    test_rmse?: number;
    test_r_squared?: number;
  };
  scenarios_analysis: any[];
  summary: any;
  business_insights: string[];
}

export interface BusinessInsights {
  executive_summary: {
    total_product_groups_analyzed: number;
    scenarios_tested: number;
    strong_opportunities_found: number;
    model_confidence: 'high' | 'medium' | 'low';
    overall_recommendation: string;
  };
  key_findings: string[];
  actionable_recommendations: Array<{
    action: string;
    expected_impact: string;
    confidence: 'high' | 'medium' | 'low';
    group: string;
  }>;
  risk_assessment: string[];
  market_opportunities: string[];
  model_reliability: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    r_squared: number;
    confidence_level: 'high' | 'medium' | 'low';
    predictive_features: string[];
  };
}

export interface ScenarioAnalysis {
  scenarios: Array<{
    scenario_name: string;
    price_change_percent: number;
    recommendations: any[];
    detailed_csv_path: string;
    summary: {
      total_groups: number;
      strong_opportunities: number;
      recommended_actions: number;
      high_confidence_predictions: number;
    };
  }>;
}