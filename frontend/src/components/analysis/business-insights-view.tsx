"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Lightbulb,
  Award,
} from "lucide-react";
import type { BusinessInsights } from "@/types/api";

interface BusinessInsightsViewProps {
  insights: BusinessInsights | undefined;
  isLoading: boolean;
  error: unknown;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
];

export function BusinessInsightsView({
  insights,
  isLoading,
  error,
}: BusinessInsightsViewProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load business insights:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!insights) {
    return (
      <Alert>
        <AlertDescription>
          No business insights available. Please run the price modeling analysis
          first.
        </AlertDescription>
      </Alert>
    );
  }

  // Parse executive summary
  const execSummary = insights.executive_summary;
  const actionableRecs = insights.actionable_recommendations || [];
  const keyFindings = insights.key_findings || [];
  const riskFactors = insights.risk_assessment || [];

  // Prepare chart data for actionable recommendations
  const revenueImpactData = actionableRecs.map((rec, index) => ({
    name: rec.group || `Group ${index + 1}`,
    impact: parseFloat(rec.expected_impact?.replace(/[+%]/g, "") || "0"),
    confidence:
      rec.confidence === "high" ? 100 : rec.confidence === "medium" ? 70 : 40,
    action: rec.action?.substring(0, 30) + "...",
  }));

  // Model reliability chart data
  const reliabilityData = [
    {
      name: "R²",
      value: insights.model_reliability?.r_squared
        ? insights.model_reliability.r_squared * 100
        : 0,
    },
    {
      name: "Quality",
      value:
        insights.model_reliability?.quality === "excellent"
          ? 95
          : insights.model_reliability?.quality === "good"
          ? 80
          : 60,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Product Groups
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {execSummary?.total_product_groups_analyzed || 0}
            </div>
            <p className="text-xs text-muted-foreground">Analyzed groups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {execSummary?.strong_opportunities_found || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Strong opportunities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Model Confidence
            </CardTitle>
            <Award className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge
                variant={
                  execSummary?.model_confidence === "high"
                    ? "default"
                    : "secondary"
                }
              >
                {execSummary?.model_confidence || "Unknown"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Prediction confidence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recommendation
            </CardTitle>
            <Lightbulb className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              <Badge variant="outline">
                {execSummary?.overall_recommendation?.replace(/_/g, " ") ||
                  "Pending"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Overall assessment</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Impact Chart */}
      {revenueImpactData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Impact by Product Group
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueImpactData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === "impact" ? `${value}%` : `${value}%`,
                    name === "impact" ? "Revenue Impact" : "Confidence",
                  ]}
                  labelFormatter={(label) => `Group: ${label}`}
                />
                <Bar
                  dataKey="impact"
                  fill="#0088FE"
                  name="Revenue Impact (%)"
                />
                <Bar
                  dataKey="confidence"
                  fill="#00C49F"
                  name="Confidence (%)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Model Reliability */}
      {insights.model_reliability && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>R² Score</span>
                    <span>
                      {(insights.model_reliability.r_squared * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={insights.model_reliability.r_squared * 100}
                    className="mt-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span>Quality Rating</span>
                    <Badge
                      variant={
                        insights.model_reliability.quality === "excellent"
                          ? "default"
                          : insights.model_reliability.quality === "good"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {insights.model_reliability.quality}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span>Confidence Level</span>
                    <Badge variant="outline">
                      {insights.model_reliability.confidence_level}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Predictive Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insights.model_reliability.predictive_features?.map(
                  (feature, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="text-sm font-medium">{feature}</span>
                      <Badge variant="outline" size="sm">
                        #{index + 1}
                      </Badge>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Key Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Key Findings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {keyFindings.map((finding, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg"
              >
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {index + 1}
                </div>
                <p className="text-sm flex-1">{finding}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actionable Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Actionable Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {actionableRecs.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{rec.group}</h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default">{rec.expected_impact}</Badge>
                    <Badge
                      variant={
                        rec.confidence === "high"
                          ? "default"
                          : rec.confidence === "medium"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {rec.confidence}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{rec.action}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      {riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskFactors.map((risk, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg"
                >
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{risk}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
