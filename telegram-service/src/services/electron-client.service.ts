import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import { Task, ApiResponse } from '../types/api.types';

export class ElectronClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.electronApiUrl,
      headers: {
        'x-api-key': config.serviceApiKey,
      },
      timeout: 10000,
    });
  }

  async getTasks(): Promise<Task[]> {
    const response = await this.client.get<ApiResponse<Task[]>>('/api/tasks');
    return response.data.data || [];
  }

  async getTask(taskId: string): Promise<Task | null> {
    const response = await this.client.get<ApiResponse<Task>>(`/api/tasks/${taskId}`);
    return response.data.data || null;
  }

  async startTask(taskId: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(`/api/tasks/${taskId}/start`);
    return response.data;
  }

  async stopTask(taskId: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(`/api/tasks/${taskId}/stop`);
    return response.data;
  }

  async removeTask(taskId: string): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(`/api/tasks/${taskId}`);
    return response.data;
  }

  async getTaskLogs(taskId: string, limit?: number): Promise<string[]> {
    const response = await this.client.get<ApiResponse<string[]>>(
      `/api/tasks/${taskId}/logs`,
      { params: { limit } }
    );
    return response.data.data || [];
  }
}

export const electronClient = new ElectronClient();
