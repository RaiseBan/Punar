import { TaskConfig } from '../../../../shared/types';

export interface TaskDataRow {
  cells: string[];
  originalIndex?: number;
  rowId?: string;
}

export interface TaskProps {
  id: number;
  name: string;
  moduleName: string;
  status: string;
  columns: string[];
  data: TaskDataRow[];
  config?: TaskConfig;
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
