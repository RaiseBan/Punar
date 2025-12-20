/**
 * Общие типы для API между electron-app и telegram-service
 */

/**
 * Базовый ответ API
 */
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Ответ с ошибкой
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Ответ с данными
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Информация о задаче для API
 */
export interface TaskApiInfo {
  id: string | number;
  name?: string;
  moduleName?: string;
  status: 'Running' | 'Stopped' | 'Paused' | 'Error';
  startTime?: number;
  pid?: number;
  logs?: string[];
}

/**
 * Информация о MEV процессе для API
 */
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

/**
 * Параметры пагинации
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Ответ с пагинацией
 */
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

/**
 * Параметры фильтрации
 */
export interface FilterParams {
  status?: string;
  moduleName?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Статус здоровья сервиса
 */
export interface HealthStatus {
  status: 'ok' | 'error' | 'degraded';
  timestamp: string;
  uptime?: number;
  version?: string;
  services?: Record<string, 'up' | 'down'>;
}

/**
 * HTTP методы
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Заголовки HTTP
 */
export interface HttpHeaders {
  [key: string]: string;
}

/**
 * Параметры запроса
 */
export interface RequestParams {
  method?: HttpMethod;
  headers?: HttpHeaders;
  body?: unknown;
  timeout?: number;
}
