"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  BarChart3,
  PieChart,
  Target,
  Star,
  ShoppingCart,
  DollarSign,
  Users,
  Lightbulb
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart
} from "recharts";
import type { ComprehensiveAnalysis } from "@/types/api";

interface ComprehensiveAnalysisProps {
  analysis: ComprehensiveAnalysis | undefined;
  isLoading: boolean;
  error: unknown;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function ComprehensiveAnalysisView({
  analysis,
  isLoading,
  error,
}: ComprehensiveAnalysisProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Không thể tải dữ liệu phân tích:{" "}
          {error instanceof Error ? error.message : "Lỗi không xác định"}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <Alert>
        <AlertDescription>
          Không có dữ liệu phân tích. Vui lòng chạy phân tích trước.
        </AlertDescription>
      </Alert>
    );
  }

  // Chuẩn bị dữ liệu cho biểu đồ
  const salesData = analysis.sales_volume_analysis?.sales_by_promo?.map(item => ({
    type: item.is_promo ? 'Khuyến mãi' : 'Thường',
    avgSales: item.avg_sales,
    totalSales: item.total_sales,
    medianSales: item.median_sales,
    productCount: item.n_rows
  })) || [];

  const ratingData = analysis.rating_impact_analysis?.rating_by_promo?.map(item => ({
    type: item.is_promo ? 'Khuyến mãi' : 'Thường',
    avgRating: item.avg_rating,
    medianRating: item.median_rating,
    count: item.n_rating
  })) || [];

  
  // Top 10 product types với performance tốt nhất
  const topProductTypes = Object.entries(analysis.price_optimization_analysis?.price_optimization?.product_type || {})
    .slice(0, 10)
    .map(([name, data]) => ({
      name: name,
      efficiency: data.optimal_for_efficiency?.sales_efficiency || 0,
      totalSales: data.optimal_for_total_sales?.total_sales || 0,
      priceRange: data.insights?.sweet_spot_range || 'N/A',
      priceOptimal: data.insights?.price_sensitivity || 'unknown'
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  // Top brands performance
  const topBrands = Object.entries(analysis.segment_analysis?.segment_analysis?.brand?.insights || {})
    .slice(0, 15)
    .map(([brand, data]) => ({
      brand: brand,
      performance: data.recommendation?.includes('Excellent') ? 'Xuất sắc' :
                   data.recommendation?.includes('Good') ? 'Tốt' :
                   data.recommendation?.includes('Average') ? 'Trung bình' : 'Kém',
      score: data.recommendation?.includes('Excellent') ? 5 :
             data.recommendation?.includes('Good') ? 4 :
             data.recommendation?.includes('Average') ? 3 : 2
    }))
    .sort((a, b) => b.score - a.score);

  const performanceDistribution = [
    { name: 'Xuất sắc', value: topBrands.filter(b => b.performance === 'Xuất sắc').length, color: '#22c55e' },
    { name: 'Tốt', value: topBrands.filter(b => b.performance === 'Tốt').length, color: '#3b82f6' },
    { name: 'Trung bình', value: topBrands.filter(b => b.performance === 'Trung bình').length, color: '#eab308' },
    { name: 'Kém', value: topBrands.filter(b => b.performance === 'Kém').length, color: '#ef4444' }
  ];

  const salesAnalysis = analysis.sales_volume_analysis;
  const ratingAnalysis = analysis.rating_impact_analysis;
  const reviewAnalysis = analysis.review_conversion_analysis;
  const overallInsights = analysis.overall_insights;

  return (
    <div className="space-y-6">
      {/* Tổng quan thống kê chính */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tăng Trưởng Doanh Số</CardTitle>
            {salesAnalysis?.insights.avg_sales_lift_percent > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{salesAnalysis?.insights.avg_sales_lift_percent.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Trung bình tăng từ khuyến mãi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ Lệ Khuyến Mãi</CardTitle>
            <PieChart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {salesAnalysis?.insights.promo_share_of_total.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Sản phẩm được khuyến mãi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ảnh Hưởng Đánh Giá</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {ratingAnalysis?.insights.avg_rating_difference > 0 ? "+" : ""}
              {ratingAnalysis?.insights.avg_rating_difference.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Thay đổi rating trung bình
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hiệu Quả Tổng Thể</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                overallInsights?.promotion_effectiveness === "highly_effective"
                  ? "default"
                  : overallInsights?.promotion_effectiveness === "moderately_effective"
                  ? "secondary"
                  : "destructive"
              }
            >
              {overallInsights?.promotion_effectiveness === "highly_effective" 
                ? "Hiệu quả cao"
                : overallInsights?.promotion_effectiveness === "moderately_effective"
                ? "Hiệu quả vừa"
                : "Hiệu quả thấp"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Đánh giá tổng quan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Phân tích chi tiết */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sales">Doanh Số</TabsTrigger>
          <TabsTrigger value="ratings">Đánh Giá</TabsTrigger>
          <TabsTrigger value="products">Sản Phẩm</TabsTrigger>
          <TabsTrigger value="brands">Thương Hiệu</TabsTrigger>
          <TabsTrigger value="insights">Khuyến Nghị</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Biểu đồ so sánh doanh số */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  So Sánh Doanh Số Trung Bình
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString()}`, 
                        name === 'avgSales' ? 'Doanh số TB' : 'Doanh số tổng'
                      ]}
                    />
                    <Bar dataKey="avgSales" fill="#0088FE" name="Doanh số TB" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Thống kê chi tiết */}
            <Card>
              <CardHeader>
                <CardTitle>Thống Kê Chi Tiết</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {salesData.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <h4 className="font-semibold text-sm mb-2">{item.type}</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Doanh số TB:</span>
                        <p className="font-mono">{item.avgSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Doanh số giữa:</span>
                        <p className="font-mono">{item.medianSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tổng doanh số:</span>
                        <p className="font-mono">{item.totalSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Số sản phẩm:</span>
                        <p className="font-mono">{item.productCount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {salesAnalysis?.insights && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Đánh Giá</h4>
                    <p className="text-sm mb-2">{salesAnalysis.insights.assessment.recommendation}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {salesAnalysis.insights.assessment.effectiveness === 'high' ? 'Hiệu quả cao' :
                         salesAnalysis.insights.assessment.effectiveness === 'medium' ? 'Hiệu quả vừa' : 'Hiệu quả thấp'}
                      </Badge>
                      <Badge variant="secondary">
                        {salesAnalysis.insights.assessment.volume_impact === 'significant' ? 'Tác động lớn' : 'Tác động nhỏ'}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ratings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Biểu đồ rating */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  So Sánh Đánh Giá Trung Bình
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis domain={[0, 5]} />
                    <Tooltip 
                      formatter={(value, name) => [
                        Number(value).toFixed(2), 
                        name === 'avgRating' ? 'Rating TB' : 'Rating giữa'
                      ]}
                    />
                    <Bar dataKey="avgRating" fill="#fbbf24" name="Rating TB" />
                    <Bar dataKey="medianRating" fill="#f59e0b" name="Rating giữa" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Phân tích tác động rating */}
            <Card>
              <CardHeader>
                <CardTitle>Phân Tích Tác Động Rating</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ratingAnalysis?.insights && (
                  <>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold mb-2">
                        {ratingAnalysis.insights.avg_rating_difference > 0 ? "+" : ""}
                        {ratingAnalysis.insights.avg_rating_difference.toFixed(3)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Chênh lệch rating trung bình
                      </p>
                      <Badge className="mt-2">
                        {ratingAnalysis.insights.rating_impact === 'positive' ? 'Tích cực' :
                         ratingAnalysis.insights.rating_impact === 'negative' ? 'Tiêu cực' : 'Trung tính'}
                      </Badge>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Nhận Định</h4>
                      <p className="text-sm mb-2">{ratingAnalysis.insights.assessment?.customer_perception}</p>
                      <p className="text-xs text-muted-foreground">{ratingAnalysis.insights.assessment?.recommendation}</p>
                    </div>
                  </>
                )}

                {reviewAnalysis?.insights && (
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Tác Động Review</h4>
                    <p className="text-sm mb-2">
                      Khuyến mãi {reviewAnalysis.insights.promo_generates_more_reviews ? 'tăng' : 'giảm'} review engagement
                    </p>
                    <div className="text-lg font-bold">
                      {reviewAnalysis.insights.review_engagement_lift_percent}%
                    </div>
                    <p className="text-xs text-muted-foreground">{reviewAnalysis.insights.assessment?.recommendation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Top 10 Loại Sản Phẩm Hiệu Quả Nhất
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topProductTypes} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip 
                    formatter={(value, name) => [
                      Number(value).toLocaleString(), 
                      name === 'efficiency' ? 'Hiệu suất bán hàng' : 'Tổng doanh số'
                    ]}
                  />
                  <Bar dataKey="efficiency" fill="#22c55e" name="Hiệu suất" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chi Tiết Sản Phẩm Hàng Đầu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProductTypes.slice(0, 5).map((product, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{product.name}</h4>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Hiệu suất:</span>
                        <p className="font-mono font-semibold">{product.efficiency.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tổng doanh số:</span>
                        <p className="font-mono">{product.totalSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Giá tối ưu:</span>
                        <p className="font-mono text-xs">{product.priceRange}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Badge variant={product.priceOptimal === 'low' ? 'default' : 'secondary'}>
                        {product.priceOptimal === 'low' ? 'Ít nhạy cảm giá' : 
                         product.priceOptimal === 'high' ? 'Nhạy cảm giá cao' : 'Nhạy cảm giá vừa'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Phân Bố Hiệu Quả Thương Hiệu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={performanceDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {performanceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 10 Thương Hiệu Hiệu Quả Nhất</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topBrands.slice(0, 10).map((brand, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                        <span className="font-medium text-sm">{brand.brand}</span>
                      </div>
                      <Badge 
                        variant={
                          brand.performance === 'Xuất sắc' ? 'default' :
                          brand.performance === 'Tốt' ? 'secondary' :
                          brand.performance === 'Trung bình' ? 'outline' : 'destructive'
                        }
                        className="text-xs"
                      >
                        {brand.performance}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Khuyến Nghị Cho Từng Nhóm Thương Hiệu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-600">🌟 Thương Hiệu Xuất Sắc</h4>
                  <div className="text-sm text-muted-foreground">
                    Mở rộng chương trình khuyến mãi
                  </div>
                  <ul className="text-xs space-y-1">
                    {topBrands.filter(b => b.performance === 'Xuất sắc').slice(0, 5).map((brand, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        {brand.brand}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-red-600">⚠️ Thương Hiệu Cần Cải Thiện</h4>
                  <div className="text-sm text-muted-foreground">
                    Xem xét lại chiến lược khuyến mãi
                  </div>
                  <ul className="text-xs space-y-1">
                    {topBrands.filter(b => b.performance === 'Kém').slice(0, 5).map((brand, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        {brand.brand}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Phát hiện chính */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Phát Hiện Chính
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {overallInsights?.key_findings?.map((finding, index) => (
                    <li key={index} className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {index + 1}
                      </div>
                      <span className="text-sm flex-1">{finding}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Khuyến nghị chiến lược */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Khuyến Nghị Chiến Lược
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {overallInsights?.strategic_recommendations?.map((recommendation, index) => (
                    <li key={index} className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        ✓
                      </div>
                      <span className="text-sm flex-1">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Yếu tố rủi ro */}
          {overallInsights?.risk_factors && overallInsights.risk_factors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Yếu Tố Rủi Ro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {overallInsights.risk_factors.map((risk, index) => (
                    <li key={index} className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Tóm tắt hiệu quả */}
          <Card>
            <CardHeader>
              <CardTitle>Tóm Tắt Hiệu Quả Tổng Thể</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold">
                  {overallInsights?.promotion_effectiveness === "highly_effective" 
                    ? "🎯 Hiệu Quả Cao"
                    : overallInsights?.promotion_effectiveness === "moderately_effective"
                    ? "📊 Hiệu Quả Vừa Phải"
                    : "⚠️ Cần Cải Thiện"}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      +{salesAnalysis?.insights.avg_sales_lift_percent.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Tăng trưởng doanh số</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {salesAnalysis?.insights.promo_share_of_total.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Tỷ lệ sản phẩm KM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {reviewAnalysis?.insights.review_engagement_lift_percent}%
                    </div>
                    <div className="text-sm text-muted-foreground">Thay đổi engagement</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}