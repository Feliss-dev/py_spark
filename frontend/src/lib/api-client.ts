import { 
  Job, 
  UploadResponse, 
  JobStatus, 
  ClassifyParams, 
  AnalysisRequest, 
  ComprehensiveAnalysis, 
  EfficiencyAnalysis, 
  PriceLiftRequest, 
  PriceLiftResponse 
} from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/jobs/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async listJobs(): Promise<Job[]> {
    return this.request('/jobs/list');
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    return this.request(`/jobs/status/${jobId}`);
  }

  async classifyJob(jobId: string, params: ClassifyParams = {}): Promise<any> {
    return this.request(`/jobs/classify/${jobId}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async analyzeJob(jobId: string, params: AnalysisRequest = {}): Promise<ComprehensiveAnalysis> {
    return this.request(`/jobs/analyze/${jobId}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getAnalysisResults(jobId: string): Promise<ComprehensiveAnalysis> {
    return this.request(`/jobs/analyze/${jobId}/results`);
  }

  async getEfficiencyAnalysis(jobId: string): Promise<EfficiencyAnalysis> {
    return this.request(`/jobs/analysis/${jobId}/efficiency`);
  }

  async getBusinessInsights(jobId: string): Promise<BusinessInsights> {
    return this.request(`/jobs/insights/${jobId}`);
  }

  async getScenarioAnalysis(jobId: string): Promise<ScenarioAnalysis> {
    return this.request(`/jobs/scenarios/${jobId}`);
  }

  async getExecutiveSummary(jobId: string): Promise<any> {
    return this.request(`/jobs/executive-summary/${jobId}`);
  }

  async runPriceLiftAnalysis(jobId: string, params: PriceLiftRequest = {}): Promise<PriceLiftResponse> {
    const defaultParams = {
      price_change: -0.10,
      scenarios: [-0.15, -0.10, -0.05, 0.05, 0.10, 0.15],
      group_by: "product_type",
      ...params
    };

    return this.request(`/jobs/model/price-lift/${jobId}`, {
      method: 'POST',
      body: JSON.stringify(defaultParams),
    });
  }

  async downloadProcessedData(jobId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/jobs/download/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    return response.blob();
  }
}

export const apiClient = new ApiClient();