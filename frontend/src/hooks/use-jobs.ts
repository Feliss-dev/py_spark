import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { Job } from '@/types/api';

export function useJobs() {
  const { data, error, isLoading, mutate } = useSWR<Job[]>(
    '/jobs/list',
    () => apiClient.listJobs(),
    {
      refreshInterval: 0, // Refresh every 30 seconds
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
      revalidateOnMount: true,
      shouldRetryOnError: false,
    }
  );

  return {
    jobs: data || [],
    error,
    isLoading,
    refresh: mutate,
  };
}