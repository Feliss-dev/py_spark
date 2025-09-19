"use client";

import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUploadZone } from "@/components/upload/file-upload-zone";
import { JobList } from "@/components/jobs/job-list";
import { ComprehensiveAnalysisView } from "@/components/analysis/comprehensive-analysis";
import { PriceLiftAnalysis } from "@/components/analysis/price-lift-analysis";
import { useJobs } from "@/hooks/use-jobs";
import { useUpload } from "@/hooks/use-upload";
import {
  useJobStatus,
  useJobAnalysis,
  useJobEfficiency,
  usePriceLiftAnalysis,
} from "@/hooks/use-job-data";
import {
  Upload,
  Database,
  BarChart3,
  AlertCircle,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  FileText,
  Brain,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
} from "lucide-react";

type ViewMode = "dashboard" | "analysis";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Dashboard hooks
  const { jobs, error: jobsError, isLoading: jobsLoading, refresh } = useJobs();
  const {
    upload,
    runClassification,
    runAnalysis,
    isUploading,
    error: uploadError,
    clearError,
  } = useUpload();

  // Analysis hooks (only active when selectedJobId exists)
  const { status, error: statusError, isLoading: statusLoading } = useJobStatus(selectedJobId);
  const { analysis, error: analysisError, isLoading: analysisLoading } = useJobAnalysis(selectedJobId);
  const { efficiency, error: efficiencyError, isLoading: efficiencyLoading } = useJobEfficiency(selectedJobId);
  const {
    priceLift,
    error: priceLiftError,
    isLoading: priceLiftLoading,
    runAnalysis: runPriceLiftAnalysis,
  } = usePriceLiftAnalysis(selectedJobId);

  // Dashboard handlers
  const handleUpload = async (file: File) => {
    clearError();
    setUploadSuccess(false);

    const result = await upload(file);
    if (result) {
      setUploadSuccess(true);
      refresh();
      setTimeout(() => setUploadSuccess(false), 5000);
    }
  };

  const handleClassify = async (jobId: string) => {
    try {
      await runClassification(jobId);
      refresh();
    } catch (error) {
      console.error("Classification failed:", error);
    }
  };

  const handleAnalyze = async (jobId: string) => {
    try {
      await runAnalysis(jobId);
      refresh();
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleComputeEfficiency = async (jobId: string) => {
    try {
      await apiClient.getEfficiencyAnalysis(jobId);
      refresh();
    } catch (error) {
      console.error("Compute efficiency failed:", error);
    }
  };

  const handleViewAnalysis = (jobId: string) => {
    setSelectedJobId(jobId);
    setViewMode("analysis");
  };

  const handleBackToDashboard = () => {
    setViewMode("dashboard");
    setSelectedJobId(null);
  };

  // Stats calculation
  const stats = {
    totalJobs: jobs.length,
    completedJobs: jobs.filter(
      (job) => job.status === "completed" || job.status === "classified"
    ).length,
    processingJobs: jobs.filter((job) => job.status === "processing").length,
    uploadedJobs: jobs.filter((job) => job.status === "uploaded").length,
  };

  // Dashboard View
  if (viewMode === "dashboard") {
    return (
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">BigData Analytics Platform</h1>
            <p className="text-muted-foreground">
              Upload data, analyze promotion effectiveness, and generate business insights
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalJobs}</div>
              <p className="text-xs text-muted-foreground">Data processing jobs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Activity className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processingJobs}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedJobs}</div>
              <p className="text-xs text-muted-foreground">Successfully processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Process</CardTitle>
              <Upload className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uploadedJobs}</div>
              <p className="text-xs text-muted-foreground">Uploaded and validated</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Upload className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Upload & Process Data</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload CSV/Excel files for promotion analysis
              </p>
              <Button asChild variant="outline" className="w-full">
                <span>Get Started</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">Sales Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Analyze promotion effectiveness and sales impact
              </p>
              <Button asChild variant="outline" className="w-full">
                <span>View Analytics</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-lg">Price Modeling</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Run price modeling scenarios and optimization analysis
              </p>
              <Button asChild variant="outline" className="w-full">
                <span>Start Modeling</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upload">Upload Data</TabsTrigger>
            <TabsTrigger value="jobs">Manage Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Dataset
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUploadZone
                  onUpload={handleUpload}
                  isUploading={isUploading}
                  error={uploadError}
                  success={uploadSuccess}
                />
              </CardContent>
            </Card>

            {/* Upload Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Required Data Format</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Your CSV/Excel file should contain the following columns:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-mono">
                    <span className="bg-muted p-1 rounded">product_name</span>
                    <span className="bg-muted p-1 rounded">product_type</span>
                    <span className="bg-muted p-1 rounded">sales_volume</span>
                    <span className="bg-muted p-1 rounded">price</span>
                    <span className="bg-muted p-1 rounded">sale_time</span>
                    <span className="bg-muted p-1 rounded">date</span>
                    <span className="bg-muted p-1 rounded">platform</span>
                    <span className="bg-muted p-1 rounded">brand</span>
                    <span className="bg-muted p-1 rounded">reviews</span>
                    <span className="bg-muted p-1 rounded">rating</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The system will automatically validate your file structure after upload.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            {jobsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load jobs: {jobsError instanceof Error ? jobsError.message : "Unknown error"}
                </AlertDescription>
              </Alert>
            )}

            <JobList
              jobs={jobs}
              onClassify={handleClassify}
              onAnalyze={handleAnalyze}
              onComputeEfficiency={handleComputeEfficiency}
              onViewAnalysis={handleViewAnalysis}
              isLoading={jobsLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Recent Jobs Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Jobs</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="#jobs">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.slice(0, 3).map((job) => (
                <div key={job.job_id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-4">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{job.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        job.status === "completed" || job.status === "classified"
                          ? "default"
                          : job.status === "processing"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {job.status}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleViewAnalysis(job.job_id)}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No jobs uploaded yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Analysis View
  if (viewMode === "analysis" && selectedJobId) {
    const hasAnyError = statusError || analysisError || efficiencyError || priceLiftError;

    return (
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={handleBackToDashboard}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Job Analysis</h1>
              <p className="text-muted-foreground font-mono text-sm">
                ID: {selectedJobId}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {status && (
              <Badge
                variant={
                  status.status === "completed" || status.status === "classified"
                    ? "default"
                    : status.status === "processing"
                    ? "secondary"
                    : status.status === "failed" || status.status === "error"
                    ? "destructive"
                    : "outline"
                }
              >
                {status.status}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Card */}
        {statusLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : status ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      status.status === "completed" || status.status === "classified"
                        ? "default"
                        : status.status === "processing"
                        ? "secondary"
                        : status.status === "failed" || status.status === "error"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {status.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File Name</p>
                  <p
                    className="font-medium truncate max-w-[120px] cursor-pointer"
                    title={status.raw_file?.split("/").pop() || "N/A"}
                  >
                    {(() => {
                      const name = status.raw_file?.split("/").pop() || "N/A";
                      return name.length > 8 ? `...${name.slice(-20)}` : name;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Columns Valid</p>
                  <Badge variant={status.columns_ok ? "default" : "destructive"}>
                    {status.columns_ok ? "✓ Valid" : "✗ Invalid"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {status.created_at ? new Date(status.created_at).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>

              {/* Modeling Status */}
              {status.modeling && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold mb-2">Price Modeling Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={status.modeling.status === "completed" ? "default" : "destructive"}>
                        {status.modeling.status}
                      </Badge>
                    </div>
                    {status.modeling.scenarios_analyzed && (
                      <div>
                        <p className="text-sm text-muted-foreground">Scenarios</p>
                        <p className="font-medium">{status.modeling.scenarios_analyzed}</p>
                      </div>
                    )}
                    {status.modeling.group_by && (
                      <div>
                        <p className="text-sm text-muted-foreground">Grouped By</p>
                        <p className="font-medium">{status.modeling.group_by}</p>
                      </div>
                    )}
                    {status.modeling.r_squared && (
                      <div>
                        <p className="text-sm text-muted-foreground">Model R²</p>
                        <p className="font-medium">{status.modeling.r_squared}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Error Alerts */}
        {hasAnyError && (
          <div className="space-y-2">
            {statusError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Status Error: {statusError instanceof Error ? statusError.message : "Unknown error"}
                </AlertDescription>
              </Alert>
            )}
            {analysisError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Analysis Error: {analysisError instanceof Error ? analysisError.message : "Unknown error"}
                </AlertDescription>
              </Alert>
            )}
            {efficiencyError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Efficiency Error: {efficiencyError instanceof Error ? efficiencyError.message : "Unknown error"}
                </AlertDescription>
              </Alert>
            )}
            {priceLiftError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Price Lift Error: {typeof priceLiftError === "string" ? priceLiftError : "Unknown error"}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Main Analysis Content */}
        <Tabs defaultValue="comprehensive" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="comprehensive">Comprehensive</TabsTrigger>
            <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
            <TabsTrigger value="pricing">Price Modeling</TabsTrigger>
            <TabsTrigger value="data">Raw Data</TabsTrigger>
          </TabsList>

          <TabsContent value="comprehensive">
            <ComprehensiveAnalysisView
              analysis={analysis}
              isLoading={analysisLoading}
              error={analysisError}
            />
          </TabsContent>

          <TabsContent value="efficiency" className="space-y-4">
            {efficiencyLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : efficiency ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Sales Efficiency Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {efficiency.insights && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                          <h4 className="font-semibold text-sm text-muted-foreground">Revenue Lift</h4>
                          <p className="text-2xl font-bold text-green-600">
                            {efficiency.insights.revenue_lift_percent || 0}%
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-muted-foreground">Assessment</h4>
                          <Badge>
                            {efficiency.insights.assessment?.revenue_efficiency || "Unknown"}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Revenue Metrics</h4>
                        <div className="space-y-2">
                          {efficiency.revenue_metrics?.map((metric, index) => (
                            <div key={index} className="flex justify-between items-center p-2 border rounded">
                              <span>{metric.is_promo ? "Promoted Items" : "Regular Items"}</span>
                              <div className="text-right">
                                <div className="font-semibold">
                                  ${metric.total_revenue?.toLocaleString() || 0}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {metric.product_count || 0} products
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Market Penetration</h4>
                        <div className="space-y-2">
                          {efficiency.market_penetration?.map((penetration, index) => (
                            <div key={index} className="flex justify-between items-center p-2 border rounded">
                              <span>{penetration.is_promo ? "Promoted Items" : "Regular Items"}</span>
                              <div className="text-right">
                                <div className="font-semibold">
                                  {penetration.penetration_rate?.toFixed(1) || 0}%
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {penetration.selling_products || 0} of {penetration.total_products || 0} selling
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  No efficiency analysis available. Please run the efficiency analysis first.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <PriceLiftAnalysis
              jobId={selectedJobId}
              onRunAnalysis={runPriceLiftAnalysis}
              result={priceLift}
              isLoading={priceLiftLoading}
              error={typeof priceLiftError === "string" ? priceLiftError : null}
            />
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Raw data and processed files for this job are stored on the server.
                    Analysis results are displayed in the other tabs.
                  </p>
                  {status && (
                    <div className="space-y-1">
                      <p className="text-sm">
                        <strong>Raw File:</strong> {status.raw_file?.split("/").pop() || "N/A"}
                      </p>
                      <p className="text-sm">
                        <strong>CSV File:</strong> {status.csv_file?.split("/").pop() || "N/A"}
                      </p>
                      {status.columns && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Detected Columns:</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mt-1">
                            {status.columns.map((col, index) => (
                              <span key={index} className="text-xs bg-muted p-1 rounded font-mono">
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Fallback view
  return (
    <div className="container mx-auto py-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Invalid application state</AlertDescription>
      </Alert>
    </div>
  );
}