import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { UploadResponse, AnalysisRequest, ClassifyParams } from '@/types/api';

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<UploadResponse | null> => {
    setIsUploading(true);
    setError(null);

    try {
      const result = await apiClient.uploadFile(file);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const runClassification = async (jobId: string, params: ClassifyParams = {}) => {
    setError(null);
    try {
      const result = await apiClient.classifyJob(jobId, params);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Classification failed';
      setError(errorMessage);
      throw err;
    }
  };

  const runAnalysis = async (jobId: string, params: AnalysisRequest = {}) => {
    setError(null);
    try {
      const result = await apiClient.analyzeJob(jobId, params);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    upload,
    runClassification,
    runAnalysis,
    isUploading,
    error,
    clearError: () => setError(null),
  };
}