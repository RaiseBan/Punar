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