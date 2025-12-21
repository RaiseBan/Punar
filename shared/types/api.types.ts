export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface TaskApiInfo {
  id: string | number;
  name?: string;
  moduleName?: string;
  status: 'Running' | 'Stopped' | 'Paused' | 'Error';
  startTime?: number;
  pid?: number;
  logs?: string[];
}

export interface MevProcessApiInfo {
  id: string;
  tokenAddress: string;
  meteoraPool?: string;
  pumpSwapPool?: string;
  raydiumPool?: string;
  config?: Record<string, unknown>;
  status?: string;
  lastActivity?: string;
  pid?: number;
  startTime?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FilterParams {
  status?: string;
  moduleName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HealthStatus {
  status: 'ok' | 'error' | 'degraded';
  timestamp: string;
  uptime?: number;
  version?: string;
  services?: Record<string, 'up' | 'down'>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpHeaders {
  [key: string]: string;
}

export interface RequestParams {
  method?: HttpMethod;
  headers?: HttpHeaders;
  body?: unknown;
  timeout?: number;
}
