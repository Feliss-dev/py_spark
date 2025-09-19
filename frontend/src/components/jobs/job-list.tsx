"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Play, BarChart3, Brain, Copy, Activity } from "lucide-react";
import type { Job } from "@/types/api";

interface JobListProps {
  jobs: Job[];
  onClassify?: (jobId: string) => void;
  onAnalyze?: (jobId: string) => void;
  onComputeEfficiency?: (jobId: string) => void;
  onViewAnalysis?: (jobId: string) => void;
  isLoading?: boolean;
}

export function JobList({
  jobs,
  onClassify,
  onAnalyze,
  onViewAnalysis,
  onComputeEfficiency,
  isLoading,
}: JobListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const filteredJobs = jobs.filter(
    (job) =>
      job.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "classified":
        return "default";
      case "processing":
        return "secondary";
      case "failed":
      case "error":
        return "destructive";
      case "uploaded":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "classified":
        return "✓";
      case "processing":
        return "⏳";
      case "failed":
      case "error":
        return "✗";
      case "uploaded":
        return "📤";
      default:
        return "?";
    }
  };

  const handleViewAnalysis = (jobId: string) => {
    if (onViewAnalysis) {
      onViewAnalysis(jobId);
    } else {
      router.push(`/dashboard/${jobId}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Jobs...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Processing Jobs ({jobs.length})</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm
                ? "No jobs found matching your search."
                : "No jobs uploaded yet."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Job ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Columns Valid</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.job_id}>
                  <TableCell className="font-medium">{job.file_name}</TableCell>
                  <TableCell className="font-mono text-sm flex items-center space-x-2">
                    {job.job_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusColor(job.status)}
                      className="gap-1"
                    >
                      <span>{getStatusIcon(job.status)}</span>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.columns_ok ? "default" : "destructive"}>
                      {job.columns_ok ? "✓ Valid" : "✗ Invalid"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.created_at
                      ? format(new Date(job.created_at), "MMM dd, yyyy HH:mm")
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {job.status === "uploaded" && job.columns_ok && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onClassify?.(job.job_id)}
                            title="Classify promotions"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Classify
                          </Button>
                          {/* <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAnalyze?.(job.job_id)}
                            title="Run comprehensive analysis"
                          >
                            <BarChart3 className="w-4 h-4 mr-1" />
                            Analyze
                          </Button> */}
                        </>
                      )}
                      {(job.status === "classified" || job.status === "completed") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAnalyze?.(job.job_id)}
                            title="Run comprehensive analysis"
                          >
                            <BarChart3 className="w-4 h-4 mr-1" />
                            Analyze
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onComputeEfficiency?.(job.job_id)}
                            title="Compute efficiency metrics"
                          >
                            <Activity className="w-4 h-4 mr-1" />
                            Efficiency
                          </Button>
                        </>
                      )}
                      {job.status !== "uploaded" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewAnalysis?.(job.job_id)}
                          title="View analysis results"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Results
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
