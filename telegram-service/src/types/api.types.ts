export interface BotConfig {
  botToken: string;
  chatIds: number[];
}

export interface BotStatus {
  isActive: boolean;
  lastActivity: string;
  chatCount: number;
}

export interface TaskNotificationRequest {
  taskId: string;
  rowIndex?: number;
  rowId?: string;
  token?: string;
  volumeChange?: string;
  volumeValue?: string;
  allCells?: string[];
}

export interface TaskStatusRequest {
  taskId: string;
}

export interface SystemNotificationRequest {
  message: string;
}

export interface PoolChangeNotificationRequest {
  taskId: string;
  oldPool?: string;
  newPool?: string;
  tokenAddress?: string;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CommandHandler {
  (chatId: number, args?: string[]): Promise<void>;
}

export interface Task {
  id: number | string;
  name?: string;
  moduleName?: string;
  status?: string;
  logs?: string[];
}