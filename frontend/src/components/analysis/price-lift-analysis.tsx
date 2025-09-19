"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import type { PriceLiftResponse, PriceLiftRequest } from "@/types/api";
import { BusinessInsightsView } from "./business-insights-view";
import { ScenarioAnalysisView } from "./scenario-analysis-view";
import { useBusinessInsights, useScenarioAnalysis } from "@/hooks/use-job-data";

interface PriceLiftAnalysisProps {
  jobId: string;
  onRunAnalysis: (
    params?: PriceLiftRequest
  ) => Promise<PriceLiftResponse | null>;
  result?: PriceLiftResponse;
  isLoading: boolean;
  error?: string | null;
}

export function PriceLiftAnalysis({
  jobId,
  onRunAnalysis,
  result,
  isLoading,
  error,
}: PriceLiftAnalysisProps) {
  const [params, setParams] = useState<PriceLiftRequest>({
    price_change: -0.1,
    scenarios: [-0.15, -0.1, -0.05, 0.05, 0.1, 0.15],
    group_by: "product_type",
  });

  const [isRunning, setIsRunning] = useState(false);

  // Fetch business insights and scenario analysis
  const {
    insights,
    error: insightsError,
    isLoading: insightsLoading,
  } = useBusinessInsights(jobId);
  const {
    scenarios,
    error: scenariosError,
    isLoading: scenariosLoading,
  } = useScenarioAnalysis(jobId);

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      await onRunAnalysis(params);
    } finally {
      setIsRunning(false);
    }
  };

  const isAnalysisRunning = isLoading || isRunning;

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const addScenario = () => {
    const newScenario = 0.05; // Default 5%
    setParams((prev) => ({
      ...prev,
      scenarios: [...(prev.scenarios || []), newScenario],
    }));
  };

  const removeScenario = (index: number) => {
    setParams((prev) => ({
      ...prev,
      scenarios: prev.scenarios?.filter((_, i) => i !== index) || [],
    }));
  };

  const updateScenario = (index: number, value: number) => {
    setParams((prev) => ({
      ...prev,
      scenarios: prev.scenarios?.map((s, i) => (i === index ? value : s)) || [],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Price Lift Analysis Configuration
            {isAnalysisRunning && (
              <Badge variant="secondary" className="ml-auto">
                <Play className="w-3 h-3 mr-1 animate-spin" />
                Running...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_change">Primary Price Change</Label>
              <Input
                id="price_change"
                type="number"
                step="0.01"
                value={params.price_change}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    price_change: parseFloat(e.target.value),
                  }))
                }
                placeholder="-0.10"
              />
              <p className="text-xs text-muted-foreground">
                e.g., -0.10 for 10% price reduction
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_by">Group Analysis By</Label>
              <Select
                value={params.group_by}
                onValueChange={(value) =>
                  setParams((prev) => ({ ...prev, group_by: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_type">Product Type</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Price Scenarios</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addScenario}
                disabled={isLoading}
              >
                Add Scenario
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {params.scenarios?.map((scenario, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={scenario}
                    onChange={(e) =>
                      updateScenario(index, parseFloat(e.target.value))
                    }
                    className="text-sm"
                    disabled={isLoading}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeScenario(index)}
                    className="px-2"
                    disabled={isLoading}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Multiple scenarios to analyze (e.g., -0.15, -0.10, -0.05, 0.05,
              0.10, 0.15)
            </p>
          </div>

          <Button
            onClick={handleRunAnalysis}
            disabled={isAnalysisRunning}
            className="w-full"
          >
            {isAnalysisRunning ? (
              <>
                <Play className="w-4 h-4 mr-2 animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Price Lift Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {(error || insightsError || scenariosError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error ||
              (insightsError instanceof Error
                ? insightsError.message
                : "Error loading insights") ||
              (scenariosError instanceof Error
                ? scenariosError.message
                : "Error loading scenarios")}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isAnalysisRunning && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div className="text-center">
                <h3 className="font-semibold">Training Price Lift Model</h3>
                <p className="text-sm text-muted-foreground">
                  This may take a few minutes. Please do not refresh the page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Tabs */}
      {(result || insights || scenarios) && !isAnalysisRunning && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="insights">Business Insights</TabsTrigger>
            <TabsTrigger value="scenarios">Scenario Analysis</TabsTrigger>
            <TabsTrigger value="technical">Technical Details</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            {/* Summary Cards */}
            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Model R²
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {result.model_performance.r_squared?.toFixed(3) ||
                          "N/A"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Model accuracy
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Test RMSE
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {result.model_performance.test_rmse?.toFixed(2) ||
                          "N/A"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Prediction error
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Scenarios
                      </CardTitle>
                      <Badge variant="outline">
                        {result.scenarios_analyzed}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {result.scenarios_analyzed}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Price scenarios analyzed
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Group By
                      </CardTitle>
                      <Badge>{result.group_by}</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium">
                        {result.group_by.replace("_", " ")}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Analysis grouping
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Scenario Results Summary */}
                {result.scenario_results &&
                  result.scenario_results.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Quick Overview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {result.scenario_results.map((scenario, index) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">
                                  {scenario.scenario_name}
                                </span>
                                <Badge
                                  variant={
                                    scenario.price_change_percent < 0
                                      ? "destructive"
                                      : "default"
                                  }
                                >
                                  {scenario.price_change_percent > 0 ? "+" : ""}
                                  {formatPercentage(
                                    scenario.price_change_percent
                                  )}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {scenario.recommendations?.length || 0}{" "}
                                recommendations generated
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Business Insights Summary */}
                {result.business_insights &&
                  result.business_insights.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Key Business Insights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {result.business_insights
                            .slice(0, 5)
                            .map((insight, index) => (
                              <li
                                key={index}
                                className="flex items-start space-x-2"
                              >
                                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                                <span className="text-sm">{insight}</span>
                              </li>
                            ))}
                        </ul>
                        {result.business_insights.length > 5 && (
                          <p className="text-sm text-muted-foreground mt-2">
                            And {result.business_insights.length - 5} more
                            insights...
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights">
            <BusinessInsightsView
              insights={insights}
              isLoading={insightsLoading}
              error={insightsError}
            />
          </TabsContent>

          <TabsContent value="scenarios">
            <ScenarioAnalysisView
              scenarios={scenarios}
              isLoading={scenariosLoading}
              error={scenariosError}
            />
          </TabsContent>

          <TabsContent value="technical">
            {result && (
              <div className="space-y-4">
                {/* Model Performance Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Model Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">R² Score:</span>
                          <span className="text-sm">
                            {result.model_performance.r_squared?.toFixed(4) ||
                              "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Test RMSE:
                          </span>
                          <span className="text-sm">
                            {result.model_performance.test_rmse?.toFixed(4) ||
                              "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Training RMSE:
                          </span>
                          <span className="text-sm">
                            {result.model_performance.train_rmse?.toFixed(4) ||
                              "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Model Type:
                          </span>
                          <span className="text-sm">Linear Regression</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Features:</span>
                          <span className="text-sm">
                            Price, Promotion, Ratings
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Training Time:
                          </span>
                          <span className="text-sm">~2-3 minutes</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Generated Files */}
                <Card>
                  <CardHeader>
                    <CardTitle>Generated Files & Paths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Detailed Results:</p>
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          {result.detailed_results_path}
                        </p>
                      </div>
                      {result.business_insights_path && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">
                            Business Insights:
                          </p>
                          <p className="text-xs text-muted-foreground font-mono break-all">
                            {result.business_insights_path}
                          </p>
                        </div>
                      )}
                      {result.scenario_results &&
                        result.scenario_results.length > 0 && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium">
                              Scenario CSV Files:
                            </p>
                            <div className="space-y-1 mt-2">
                              {result.scenario_results.map(
                                (scenario, index) =>
                                  scenario.detailed_csv_path && (
                                    <p
                                      key={index}
                                      className="text-xs text-muted-foreground font-mono break-all"
                                    >
                                      {scenario.detailed_csv_path}
                                    </p>
                                  )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>

                {/* Analysis Parameters */}
                <Card>
                  <CardHeader>
                    <CardTitle>Analysis Parameters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Primary Price Change:
                          </span>
                          <Badge variant="outline">
                            {formatPercentage(params.price_change)}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Group By:</span>
                          <Badge variant="outline">{result.group_by}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Scenarios Analyzed:
                          </span>
                          <Badge variant="outline">
                            {result.scenarios_analyzed}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium">
                            Scenario Values:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {params.scenarios?.map((scenario, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs"
                              >
                                {formatPercentage(scenario)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Insights */}
                {result.top_insights && result.top_insights.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Technical Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.top_insights.map((insight, index) => (
                          <li
                            key={index}
                            className="flex items-start space-x-2"
                          >
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                            <span className="text-sm font-medium">
                              {insight}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
