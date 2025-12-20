/**
 * Типы для задач
 */

/**
 * Строка данных задачи
 */
export interface TaskDataRow {
  cells: string[];
  originalIndex?: number;
  rowId?: string;
}

/**
 * Задача
 */
export interface Task {
  id: number;
  name: string;
  moduleName: string;
  status: TaskStatus;
  columns: string[];
  data: TaskDataRow[];
  config?: TaskConfig;
}

/**
 * Статус задачи
 */
export type TaskStatus = 'Running' | 'Stopped' | 'Paused' | 'Error';

/**
 * Конфигурация задачи
 */
export interface TaskConfig {
  // Основные поля
  moduleName: string;
  module_name: string;  // Для обратной совместимости (используется в legacy коде)
  task_name: string;
  taskId?: string | number;
  sourceTaskId?: string | number;

  // Дополнительные поля (используются в разных модулях)
  rowData?: string[];
  globalStrategy?: string;
  volume_threshold?: number;
  check_interval?: number;
  max_attempts?: number;
  thread_workers?: number;
  enablePoolMonitoring?: boolean;
  poolCheckInterval?: number;
  tokenAddress?: string;
  meteoraPool?: string;
  poolAddress?: string | string[];
  meteoraPools?: string[];
  pumpSwapPool?: string;
  additionalRpc?: string;
  useJito?: boolean;
  jito_lower_bound?: number;
  jito_upper_bound?: number;
  strategy?: string;

  // Для расширяемости
  [key: string]: unknown;
}

/**
 * Данные задачи для Telegram
 */
export interface TelegramTaskData {
  taskId: number;
  rowIndex: number;
  rowId?: string;
  token: string;
  volumeChange: string;
  volumeValue: number;
  allCells?: string[];
}