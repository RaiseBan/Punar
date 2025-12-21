import { ChildProcess } from 'child_process';
import { TaskConfig } from './task.types';

export type ProcessStatus = 'running' | 'stopped' | 'paused' | 'error' | 'killed';

export interface ProcessInfo {
  taskId: string | number;
  process: ChildProcess | null;
  pid?: number;
  isActive: boolean;
  startTime: number;
  exitTime?: number;
  exitCode?: number | null;
  exitReason?: string;
  moduleName: string;  
  config?: TaskConfig;
  logs: string[];
  status?: ProcessStatus;
}

export interface TokenReleaseProcessInfo extends ProcessInfo {
  intervalId: NodeJS.Timeout | null;
  tokenAddress: string;
  meteoraPairAddress: string | null;
  configFilePath: string;
  lastCheckTime: number;
  checkCount: number;
}

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'error' | 'warning' | 'debug' | 'stdout' | 'stderr' | 'system';
  taskId: string | number;
}

export interface LogQueue {
  taskId: string | number;
  logs: LogEntry[];
  lastFlush: number;
}

export interface ProcessExitResult {
  taskId: string | number;
  code: number | null;
  signal?: string;
  runTime: number;
  exitReason: string;
}

export interface KillProcessResult {
  success: boolean;
  message?: string;
  error?: string;
  taskId?: string | number;
}

export interface SpawnProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  detached?: boolean;
  shell?: boolean | string;
  windowsHide?: boolean;
}

export type ProcessMap = Record<string | number, ProcessInfo>;

export const PROCESS_EVENTS = {
  STARTED: 'process:started',
  STOPPED: 'process:stopped',
  OUTPUT: 'process:output',
  ERROR: 'process:error',
  EXIT: 'process:exit',
} as const;

export interface ProcessStartedEventData {
  processId: string;
  taskId: string | number;
  moduleName: string;
  config: TaskConfig;
}

export interface ProcessStoppedEventData {
  processId: string;
  taskId: string | number;
  exitCode: number | null;
}

export interface ProcessOutputEventData {
  processId: string;
  taskId: string | number;
  output: string;
  type: 'stdout' | 'stderr';
}

export interface ProcessErrorEventData {
  processId: string;
  taskId: string | number;
  error: string | Error;
}