export interface TaskDataRow {
  cells: string[];
  originalIndex?: number;
  rowId?: string;
}

export interface Task {
  id: number;
  name: string;
  moduleName: string;
  status: TaskStatus;
  columns: string[];
  data: TaskDataRow[];
  config?: TaskConfig;
}

export type TaskStatus = 'Running' | 'Stopped' | 'Paused' | 'Error';

export interface TaskConfig {

  moduleName: string;
  module_name: string;  
  task_name: string;
  taskId?: string | number;
  sourceTaskId?: string | number;

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

  [key: string]: unknown;
}

export interface TelegramTaskData {
  taskId: number;
  rowIndex: number;
  rowId?: string;
  token: string;
  volumeChange: string;
  volumeValue: number;
  allCells?: string[];
}