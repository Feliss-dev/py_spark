import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { 
  ComprehensiveAnalysis, 
  EfficiencyAnalysis, 
  PriceLiftResponse,
  JobStatus, 
  BusinessInsights,
  ScenarioAnalysis
} from '@/types/api';

export function useJobStatus(jobId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<JobStatus>(
    jobId ? `/jobs/status/${jobId}` : null,
    () => jobId ? apiClient.getJobStatus(jobId) : null,
    {
      dedupingInterval: 5000, // Check status every 5 seconds
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      revalidateOnMount: true,
    }
  );

  return { 
    status: data, 
    error, 
    isLoading,
    refresh: mutate
  };
}

export function useJobAnalysis(jobId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ComprehensiveAnalysis>(
    jobId ? `/jobs/analyze/${jobId}/results` : null,
    () => jobId ? apiClient.getAnalysisResults(jobId) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
      shouldRetryOnError: false,
    }
  );

  return { 
    analysis: data, 
    error, 
    isLoading,
    refresh: mutate
  };
}

export function useJobEfficiency(jobId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<EfficiencyAnalysis>(
    jobId ? `/jobs/analysis/${jobId}/efficiency` : null,
    () => jobId ? apiClient.getEfficiencyAnalysis(jobId) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
      shouldRetryOnError: false,
    }
  );

  return { 
    efficiency: data, 
    error, 
    isLoading,
    refresh: mutate
  };
}

export function usePriceLiftAnalysis(jobId: string | null, autoFetch: boolean = false) {
  const { data, error, isLoading, mutate } = useSWR<PriceLiftResponse>(
    (jobId && autoFetch) ? `/jobs/model/price-lift/${jobId}` : null,
    () => jobId ? apiClient.runPriceLiftAnalysis(jobId) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
      shouldRetryOnError: false,
    }
  );

  const runAnalysis = async (params = {}) => {
    if (!jobId) return null;
    
    try {
      const result = await apiClient.runPriceLiftAnalysis(jobId, params);
      mutate(result);
      return result;
    } catch (error) {
      throw error;
    }
  };

  return { 
    priceLift: data, 
    error, 
    isLoading,
    runAnalysis,
    refresh: mutate
  };
}

export function useBusinessInsights(jobId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<BusinessInsights>(
    jobId ? `/jobs/insights/${jobId}` : null,
    () => jobId ? apiClient.getBusinessInsights(jobId) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
      shouldRetryOnError: false,
    }
  );

  return { 
    insights: data, 
    error, 
    isLoading,
    refresh: mutate
  };
}

export function useScenarioAnalysis(jobId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ScenarioAnalysis>(
    jobId ? `/jobs/scenarios/${jobId}` : null,
    () => jobId ? apiClient.getScenarioAnalysis(jobId) : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
      shouldRetryOnError: false,
    }
  );

  return { 
    scenarios: data, 
    error, 
    isLoading,
    refresh: mutate
  };
}