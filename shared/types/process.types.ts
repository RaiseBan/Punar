import { ChildProcess } from 'child_process';
import { TaskConfig } from './task.types';

/**
 * Типы для управления процессами приложения
 */

/**
 * Статус процесса
 */
export type ProcessStatus = 'running' | 'stopped' | 'paused' | 'error' | 'killed';

/**
 * Информация о процессе
 */
export interface ProcessInfo {
  taskId: string | number;
  process: ChildProcess | null;
  pid?: number;
  isActive: boolean;
  startTime: number;
  exitTime?: number;
  exitCode?: number | null;
  exitReason?: string;
  moduleName?: string;
  config?: TaskConfig;
  logs: string[];
  status?: ProcessStatus;
}

/**
 * Информация о процессе MEV токен-релиза
 */
export interface TokenReleaseProcessInfo extends ProcessInfo {
  intervalId: NodeJS.Timeout | null;
  tokenAddress: string;
  meteoraPairAddress: string | null;
  configFilePath: string;
  lastCheckTime: number;
  checkCount: number;
}

/**
 * Запись лога
 */
export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'error' | 'warning' | 'debug' | 'stdout' | 'stderr' | 'system';
  taskId: string | number;
}

/**
 * Очередь логов для задачи
 */
export interface LogQueue {
  taskId: string | number;
  logs: LogEntry[];
  lastFlush: number;
}

/**
 * Результат завершения процесса
 */
export interface ProcessExitResult {
  taskId: string | number;
  code: number | null;
  signal?: string;
  runTime: number;
  exitReason: string;
}

/**
 * Результат остановки процесса
 */
export interface KillProcessResult {
  success: boolean;
  message?: string;
  error?: string;
  taskId?: string | number;
}

/**
 * Параметры для spawn процесса
 */
export interface SpawnProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  detached?: boolean;
  shell?: boolean | string;
  windowsHide?: boolean;
}

/**
 * Карта активных процессов
 */
export type ProcessMap = Record<string | number, ProcessInfo>;

/**
 * События процесса для EventBus
 */
export const PROCESS_EVENTS = {
  STARTED: 'process:started',
  STOPPED: 'process:stopped',
  OUTPUT: 'process:output',
  ERROR: 'process:error',
  EXIT: 'process:exit',
} as const;

/**
 * Данные события запуска процесса
 */
export interface ProcessStartedEventData {
  processId: string;
  taskId: string | number;
  moduleName: string;
  config: TaskConfig;
}

/**
 * Данные события остановки процесса
 */
export interface ProcessStoppedEventData {
  processId: string;
  taskId: string | number;
  exitCode: number | null;
}

/**
 * Данные события вывода процесса
 */
export interface ProcessOutputEventData {
  processId: string;
  taskId: string | number;
  output: string;
  type: 'stdout' | 'stderr';
}

/**
 * Данные события ошибки процесса
 */
export interface ProcessErrorEventData {
  processId: string;
  taskId: string | number;
  error: string | Error;
}
