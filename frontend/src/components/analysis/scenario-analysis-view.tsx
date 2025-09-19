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
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Download,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import type { ScenarioAnalysis } from "@/types/api";

interface ScenarioAnalysisViewProps {
  scenarios: ScenarioAnalysis | undefined;
  isLoading: boolean;
  error: unknown;
}

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

export function ScenarioAnalysisView({
  scenarios,
  isLoading,
  error,
}: ScenarioAnalysisViewProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load scenario analysis:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
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
          No scenario analysis data available. Please run the price modeling
          analysis first.
        </AlertDescription>
      </Alert>
    );
  }

  // Prepare data for charts
  const scenarioChartData = scenarios.scenarios.map((scenario) => ({
    name: scenario.scenario_name.replace("price_change_", ""),
    priceChange: scenario.price_change_percent,
    totalGroups: scenario.summary?.total_groups || 0,
    strongOpportunities: scenario.summary?.strong_opportunities || 0,
    recommendedActions: scenario.summary?.recommended_actions || 0,
    highConfidence: scenario.summary?.high_confidence_predictions || 0,
    recommendations: scenario.recommendations?.length || 0,
  }));

  // Price change vs opportunities
  const opportunityData = scenarioChartData.map((data) => ({
    priceChange: `${data.priceChange > 0 ? "+" : ""}${data.priceChange}%`,
    opportunities: data.strongOpportunities,
    actions: data.recommendedActions,
    confidence: data.highConfidence,
  }));

  // Pie chart for scenario distribution
  const scenarioDistribution = scenarioChartData.map((data, index) => ({
    name: data.name,
    value: data.recommendations,
    color: COLORS[index % COLORS.length],
  }));

  const formatPercentage = (value: number) =>
    `${value > 0 ? "+" : ""}${value}%`;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Scenarios
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scenarios.scenarios.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Price scenarios analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Best Opportunity
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {(() => {
              const bestScenario = scenarioChartData.reduce((best, current) =>
                current.strongOpportunities > best.strongOpportunities
                  ? current
                  : best
              );
              return (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(bestScenario.priceChange)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bestScenario.strongOpportunities} opportunities
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Recommendations
            </CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scenarioChartData.reduce(
                (sum, scenario) => sum + scenario.recommendations,
                0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all scenarios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              High Confidence
            </CardTitle>
            <Badge variant="default">Reliable</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                scenarioChartData.reduce(
                  (sum, scenario) => sum + scenario.highConfidence,
                  0
                ) / scenarioChartData.length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg high confidence predictions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Price Change vs Opportunities Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Price Change Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={opportunityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priceChange" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar
                yAxisId="left"
                dataKey="opportunities"
                fill="#22c55e"
                name="Strong Opportunities"
              />
              <Bar
                yAxisId="left"
                dataKey="actions"
                fill="#3b82f6"
                name="Recommended Actions"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="confidence"
                stroke="#8b5cf6"
                strokeWidth={3}
                name="High Confidence Predictions"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Scenario Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recommendations Distribution by Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={scenarioDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {scenarioDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={scenarioChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value, name) => [value, name]} />
                <Area
                  type="monotone"
                  dataKey="strongOpportunities"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.6}
                  name="Strong Opportunities"
                />
                <Area
                  type="monotone"
                  dataKey="recommendedActions"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Recommended Actions"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Scenario Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Scenario Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {scenarios.scenarios.map((scenario, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {scenario.scenario_name}
                  </h3>
                  <Badge
                    variant={
                      scenario.price_change_percent < 0
                        ? "destructive"
                        : "default"
                    }
                    className="text-sm"
                  >
                    {formatPercentage(scenario.price_change_percent)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Groups</p>
                    <p className="font-semibold">
                      {scenario.summary?.total_groups || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Strong Opportunities
                    </p>
                    <p className="font-semibold text-green-600">
                      {scenario.summary?.strong_opportunities || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recommended Actions</p>
                    <p className="font-semibold text-blue-600">
                      {scenario.summary?.recommended_actions || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">High Confidence</p>
                    <p className="font-semibold">
                      {scenario.summary?.high_confidence_predictions || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {scenario.recommendations?.length || 0} detailed
                    recommendations
                  </span>
                  {scenario.detailed_csv_path && (
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download CSV
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
