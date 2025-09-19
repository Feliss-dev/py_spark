"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ScatterChart,
  Scatter,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Download, 
  BarChart3, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Activity
} from "lucide-react";
import type { ScenarioAnalysis } from "@/types/api";

interface ScenarioAnalysisViewProps {
  scenarios: ScenarioAnalysis | undefined;
  isLoading: boolean;
  error: unknown;
}

const COLORS = {
  strongly_recommended: '#22c55e', // Xanh lá
  recommended: '#3b82f6',          // Xanh dương  
  not_recommended: '#ef4444',      // Đỏ
  test_carefully: '#f59e0b',       // Cam
  neutral: '#6b7280'               // Xám
};

const RECOMMENDATION_ICONS = {
  strongly_recommended: CheckCircle,
  recommended: AlertCircle,
  not_recommended: XCircle,
  test_carefully: AlertTriangle,
  neutral: Activity
};

const RECOMMENDATION_LABELS = {
  strongly_recommended: 'Rất nên thực hiện',
  recommended: 'Nên cân nhắc',
  not_recommended: 'Không nên thực hiện', 
  test_carefully: 'Thử nghiệm cẩn thận',
  neutral: 'Trung tính'
};

export function ScenarioAnalysisView({ scenarios, isLoading, error }: ScenarioAnalysisViewProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Không thể tải phân tích kịch bản: {error instanceof Error ? error.message : "Lỗi không xác định"}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!scenarios || !scenarios.scenarios || scenarios.scenarios.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Không có dữ liệu phân tích kịch bản. Vui lòng chạy phân tích mô hình giá trước.
        </AlertDescription>
      </Alert>
    );
  }

  // Xử lý dữ liệu để phân tích chiến lược
  const processedScenarios = scenarios.scenarios.map(scenario => {
    const recommendationStats = scenario.recommendations?.reduce((acc, rec) => {
      const type = rec.recommendation || 'neutral';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Tính toán chỉ số hiệu suất từ dữ liệu thực tế
    const validRecommendations = scenario.recommendations?.filter(rec => 
      rec.expected_sales_lift_pct !== undefined && rec.expected_revenue_lift_pct !== undefined
    ) || [];

    const avgSalesLift = validRecommendations.length > 0 
      ? validRecommendations.reduce((sum, rec) => sum + (rec.expected_sales_lift_pct || 0), 0) / validRecommendations.length 
      : 0;

    const avgRevenueLift = validRecommendations.length > 0 
      ? validRecommendations.reduce((sum, rec) => sum + (rec.expected_revenue_lift_pct || 0), 0) / validRecommendations.length 
      : 0;

    return {
      name: scenario.scenario_name.replace('price_change_', ''),
      priceChange: scenario.price_change_percent,
      totalGroups: scenario.summary?.total_groups || 0,
      strongOpportunities: scenario.summary?.strong_opportunities || 0,
      recommendedActions: scenario.summary?.recommended_actions || 0,
      highConfidence: scenario.summary?.high_confidence_predictions || 0,
      recommendations: scenario.recommendations?.length || 0,
      recommendationBreakdown: recommendationStats,
      avgSalesLift: avgSalesLift,
      avgRevenueLift: avgRevenueLift,
      scenario: scenario
    };
  });

  // Dữ liệu Ma trận Hiệu suất Chiến lược
  const performanceMatrix = processedScenarios.map(item => ({
    name: item.name,
    priceChange: item.priceChange,
    effectiveness: (item.strongOpportunities / Math.max(item.totalGroups, 1)) * 100,
    confidence: (item.highConfidence / Math.max(item.totalGroups, 1)) * 100,
    actionability: (item.recommendedActions / Math.max(item.totalGroups, 1)) * 100,
    size: item.totalGroups,
    avgSalesLift: item.avgSalesLift,
    avgRevenueLift: item.avgRevenueLift
  }));

  // Phân tích Rủi ro - Lợi nhuận  
  const riskRewardData = processedScenarios.map(item => ({
    name: item.name,
    priceChange: item.priceChange,
    reward: item.strongOpportunities,
    risk: item.totalGroups - item.recommendedActions,
    netBenefit: item.strongOpportunities - (item.totalGroups - item.recommendedActions),
    salesLift: item.avgSalesLift,
    revenueLift: item.avgRevenueLift
  }));

  // Phân bố khuyến nghị
  const recommendationTypes = ['strongly_recommended', 'recommended', 'not_recommended', 'test_carefully'];
  const recommendationDistribution = recommendationTypes.map(type => {
    const total = processedScenarios.reduce((sum, scenario) => 
      sum + (scenario.recommendationBreakdown[type] || 0), 0
    );
    return {
      name: RECOMMENDATION_LABELS[type as keyof typeof RECOMMENDATION_LABELS],
      value: total,
      color: COLORS[type as keyof typeof COLORS],
      type: type
    };
  }).filter(item => item.value > 0);

  // Dữ liệu biểu đồ radar chiến lược
  const radarData = processedScenarios.map(item => ({
    scenario: item.name,
    'Cơ hội mạnh': (item.strongOpportunities / Math.max(item.totalGroups, 1)) * 100,
    'Độ tin cậy': (item.highConfidence / Math.max(item.totalGroups, 1)) * 100,
    'Khả năng thực hiện': (item.recommendedActions / Math.max(item.totalGroups, 1)) * 100,
    'Phạm vi bao phủ': Math.min(item.totalGroups / 100 * 100, 100),
    'Tăng trưởng doanh số': Math.max(0, item.avgSalesLift * 10), // Scale để hiển thị tốt hơn
    'Tăng trưởng doanh thu': Math.max(0, item.avgRevenueLift * 5) // Scale để hiển thị tốt hơn
  }));

  // Dữ liệu xu hướng hiệu suất
  const performanceTrendData = processedScenarios.map(item => ({
    scenario: item.name,
    priceChange: item.priceChange,
    salesLift: item.avgSalesLift,
    revenueLift: item.avgRevenueLift,
    effectiveness: (item.strongOpportunities / Math.max(item.totalGroups, 1)) * 100
  }));

  const formatPercentage = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getScenarioRecommendation = (scenario: any) => {
    const { strongOpportunities, recommendedActions, totalGroups } = scenario;
    const effectivenessRate = strongOpportunities / Math.max(totalGroups, 1);
    
    if (effectivenessRate > 0.7) return 'Rất khuyến nghị';
    if (effectivenessRate > 0.4) return 'Khuyến nghị';
    if (effectivenessRate > 0.2) return 'Cần cân nhắc';
    return 'Không khuyến nghị';
  };

  const getScenarioRisk = (priceChange: number) => {
    const absChange = Math.abs(priceChange);
    if (absChange >= 15) return 'Rủi ro cao';
    if (absChange >= 10) return 'Rủi ro trung bình';
    if (absChange >= 5) return 'Rủi ro thấp';
    return 'Rủi ro tối thiểu';
  };

  return (
    <div className="space-y-6">
      {/* Thẻ tóm tắt điều hành */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiến lược tốt nhất</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {(() => {
              const bestScenario = processedScenarios.reduce((best, current) => 
                current.strongOpportunities > best.strongOpportunities ? current : best
              );
              return (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(bestScenario.priceChange)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bestScenario.strongOpportunities} cơ hội mạnh
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lựa chọn an toàn nhất</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {(() => {
              const safestScenario = processedScenarios.reduce((safest, current) => {
                const currentRatio = current.highConfidence / Math.max(current.totalGroups, 1);
                const safestRatio = safest.highConfidence / Math.max(safest.totalGroups, 1);
                return currentRatio > safestRatio ? current : safest;
              });
              return (
                <>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPercentage(safestScenario.priceChange)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((safestScenario.highConfidence / Math.max(safestScenario.totalGroups, 1)) * 100)}% độ tin cậy
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng hành động</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processedScenarios.reduce((sum, scenario) => sum + scenario.recommendedActions, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Khuyến nghị có thể thực hiện</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phạm vi bao phủ</CardTitle>
            <BarChart3 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processedScenarios.reduce((sum, scenario) => sum + scenario.totalGroups, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Nhóm sản phẩm được phân tích</p>
          </CardContent>
        </Card>
      </div>

      {/* Xu hướng hiệu suất theo kịch bản */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Xu hướng hiệu suất theo kịch bản giá
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            So sánh tác động của thay đổi giá đến doanh số và doanh thu
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={performanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="priceChange" 
                label={{ value: 'Thay đổi giá (%)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis yAxisId="left" label={{ value: 'Tăng trưởng (%)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Hiệu quả (%)', angle: 90, position: 'insideRight' }} />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${Number(value).toFixed(2)}%`,
                  name === 'salesLift' ? 'Tăng trưởng doanh số' :
                  name === 'revenueLift' ? 'Tăng trưởng doanh thu' : 'Hiệu quả'
                ]}
                labelFormatter={(value) => `Thay đổi giá: ${formatPercentage(Number(value))}`}
              />
              <Bar yAxisId="left" dataKey="salesLift" fill="#3b82f6" name="Tăng trưởng doanh số" />
              <Bar yAxisId="left" dataKey="revenueLift" fill="#22c55e" name="Tăng trưởng doanh thu" />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="effectiveness" 
                stroke="#f59e0b" 
                strokeWidth={3}
                name="Hiệu quả tổng thể"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ma trận hiệu suất chiến lược
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Ma trận hiệu suất chiến lược
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hiệu quả vs Độ tin cậy: Kích thước bong bóng thể hiện số nhóm được phân tích
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={performanceMatrix}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="effectiveness" 
                type="number" 
                domain={[0, 100]}
                label={{ value: 'Tỷ lệ hiệu quả (%)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                dataKey="confidence" 
                type="number" 
                domain={[0, 100]}
                label={{ value: 'Mức độ tin cậy (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value, name) => [
                  `${Math.round(Number(value))}%`, 
                  name === 'effectiveness' ? 'Hiệu quả' : 'Độ tin cậy'
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    const data = payload[0].payload;
                    return `${data.name} (${formatPercentage(data.priceChange)})`;
                  }
                  return label;
                }}
              />
              <ReferenceLine x={50} stroke="#666" strokeDasharray="2 2" />
              <ReferenceLine y={50} stroke="#666" strokeDasharray="2 2" />
              <Scatter 
                dataKey="confidence" 
                fill="#3b82f6"
                fillOpacity={0.7}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="font-semibold text-green-700">Cao-Cao</div>
              <div className="text-green-600">Chiến lược lý tưởng</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="font-semibold text-blue-700">Cao-Thấp</div>
              <div className="text-blue-600">Thử nghiệm cẩn thận</div>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded">
              <div className="font-semibold text-orange-700">Thấp-Cao</div>
              <div className="text-orange-600">Bảo thủ</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded">
              <div className="font-semibold text-red-700">Thấp-Thấp</div>
              <div className="text-red-600">Tránh</div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Phân tích rủi ro - lợi nhuận và phân bố khuyến nghị */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Phân tích rủi ro vs lợi nhuận
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={riskRewardData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    Number(value).toFixed(1),
                    name === 'reward' ? 'Phần thưởng tiềm năng' :
                    name === 'risk' ? 'Rủi ro tiềm năng' : 'Lợi ích ròng'
                  ]}
                />
                <Bar yAxisId="left" dataKey="reward" fill="#22c55e" name="Phần thưởng tiềm năng" />
                <Bar yAxisId="left" dataKey="risk" fill="#ef4444" name="Rủi ro tiềm năng" />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="netBenefit" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  name="Lợi ích ròng"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân bố khuyến nghị</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={recommendationDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                >
                  {recommendationDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {recommendationDistribution.map((item) => {
                const Icon = RECOMMENDATION_ICONS[item.type as keyof typeof RECOMMENDATION_ICONS];
                return (
                  <div key={item.type} className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                    <span className="text-sm">{item.name}</span>
                    <Badge variant="outline">{item.value}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Biểu đồ radar so sánh chiến lược đa chiều */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            So sánh chiến lược đa chiều
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            So sánh các kịch bản theo nhiều tiêu chí chiến lược quan trọng
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="scenario" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Tooltip />
              {processedScenarios.map((scenario, index) => {
                const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
                return (
                  <Radar
                    key={scenario.name}
                    name={`${scenario.name} (${formatPercentage(scenario.priceChange)})`}
                    dataKey={Object.keys(radarData[0]).find(key => key !== 'scenario') || 'Cơ hội mạnh'}
                    stroke={colors[index % colors.length]}
                    fill={colors[index % colors.length]}
                    fillOpacity={0.1}
                  />
                );
              })}
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Phân tích và khuyến nghị chiến lược */}
      <Card>
        <CardHeader>
          <CardTitle>Phân tích và khuyến nghị chiến lược</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {processedScenarios.map((scenario, index) => {
              const recommendation = getScenarioRecommendation(scenario);
              const risk = getScenarioRisk(scenario.priceChange);
              const effectivenessRate = (scenario.strongOpportunities / Math.max(scenario.totalGroups, 1)) * 100;
              
              return (
                <div key={index} className="border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-xl">{scenario.name}</h3>
                      <Badge 
                        variant={scenario.priceChange < 0 ? "destructive" : "default"}
                        className="text-sm"
                      >
                        {formatPercentage(scenario.priceChange)}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={recommendation.includes('Rất') ? 'default' : 
                                   recommendation.includes('Khuyến nghị') ? 'secondary' : 'outline'}>
                        {recommendation}
                      </Badge>
                      <Badge variant="outline">{risk}</Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round(effectivenessRate)}%
                      </div>
                      <div className="text-sm text-green-700">Hiệu quả</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <div className="text-2xl font-bold text-blue-600">
                        {scenario.strongOpportunities}
                      </div>
                      <div className="text-sm text-blue-700">Cơ hội mạnh</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded">
                      <div className="text-2xl font-bold text-purple-600">
                        {scenario.recommendedActions}
                      </div>
                      <div className="text-sm text-purple-700">Hành động khuyến nghị</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded">
                      <div className="text-2xl font-bold text-orange-600">
                        {Math.round((scenario.highConfidence / Math.max(scenario.totalGroups, 1)) * 100)}%
                      </div>
                      <div className="text-sm text-orange-700">Độ tin cậy</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-indigo-50 rounded">
                      <div className="text-2xl font-bold text-indigo-600">
                        {formatPercentage(scenario.avgSalesLift)}
                      </div>
                      <div className="text-sm text-indigo-700">Tăng trưởng doanh số TB</div>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 rounded">
                      <div className="text-2xl font-bold text-emerald-600">
                        {formatPercentage(scenario.avgRevenueLift)}
                      </div>
                      <div className="text-sm text-emerald-700">Tăng trưởng doanh thu TB</div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Phân tích chiến lược:</h4>
                    <p className="text-sm text-gray-700">
                      {scenario.priceChange > 0 
                        ? `Tăng giá ${Math.abs(scenario.priceChange)}% cho thấy ${effectivenessRate > 50 ? 'tiềm năng mạnh' : 'tiềm năng hạn chế'} với ${scenario.strongOpportunities} nhóm sản phẩm có phản ứng tích cực. Doanh số dự kiến tăng ${formatPercentage(scenario.avgSalesLift)} và doanh thu tăng ${formatPercentage(scenario.avgRevenueLift)}. ${effectivenessRate > 70 ? 'Đây là chiến lược có độ tin cậy cao, phù hợp để triển khai ngay lập tức.' : effectivenessRate > 40 ? 'Nên cân nhắc thử nghiệm với các nhóm sản phẩm được chọn.' : 'Rủi ro cao - khuyến nghị tránh mức tăng giá này.'}`
                        : `Giảm giá ${Math.abs(scenario.priceChange)}% cho thấy ${effectivenessRate > 50 ? 'phản ứng thị trường mạnh' : 'phản ứng thị trường vừa phải'} trên ${scenario.strongOpportunities} nhóm sản phẩm. Doanh số dự kiến thay đổi ${formatPercentage(scenario.avgSalesLift)} và doanh thu thay đổi ${formatPercentage(scenario.avgRevenueLift)}. ${effectivenessRate > 70 ? 'Cơ hội tuyệt vời để mở rộng thị trường và tăng trưởng về lượng.' : effectivenessRate > 40 ? 'Cơ hội vừa phải - cần đánh giá cẩn thận về biên lợi nhuận.' : 'Việc giảm giá có thể không tạo ra đủ lượng để bù đắp tổn thất doanh thu.'}`
                      }
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      {scenario.recommendations} khuyến nghị chi tiết có sẵn
                    </span>
                    {scenario.scenario.detailed_csv_path && (
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Tải xuống phân tích
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}