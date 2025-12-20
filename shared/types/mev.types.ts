import { ChildProcess } from 'child_process';

/**
 * Типы для MEV (Maximal Extractable Value) системы
 */

/**
 * Тип пула Raydium
 */
export enum RAYDIUM_TYPE {
  CLMM = 'CLMM',
  CPMM = 'CPMM',
  V4 = 'V4',
}

/**
 * Базовый сигнал MEV
 */
export interface Signal {
  tokenAddress: string;
  meteoraPool: string;
  pumpSwapPool?: string;
  raydiumPool?: string;
  meteoraDAMMPool?: string;
  type: string;
  timestamp: number;
}

/**
 * Сигнал MEV с метаданными
 */
export interface SignalWithMeta extends Signal {
  sourceProcessId: string;
  addedTime: number;
}

/**
 * Конфигурация процесса MEV
 */
export interface ProcessConfig {
  tokenAddress: string;
  meteoraPool: string;
  pumpSwapPool?: string;
  raydiumPool?: string;
  dammMeteoraPool?: string;
  type: string;
  main_rpc: string;
  useJito: boolean;
  jito_lower_bound: number;
  jito_upper_bound: number;
  process_delay: number | null;
  task_name: string;
}

/**
 * Статус процесса MEV
 */
export type MevProcessStatus = 'running' | 'stopped' | 'error' | 'completed';

/**
 * MEV процесс
 */
export interface MevProcess {
  id?: string;
  pid: number;
  tokenAddress: string;
  meteoraPool: string;
  pumpSwapPool: string;
  process?: ChildProcess;
  startTime: number;
  initialCreationTime?: number;
  status: MevProcessStatus;
  lastActivity: number;
  signals: Signal[];
  config?: ProcessConfig;
  exitCode?: number | null;
  exitTime?: number;
  processTimer?: NodeJS.Timeout;
  instanceNumber?: number;
  signalId?: string;
}

/**
 * Результат проверки пула
 */
export interface CheckResult {
  pool: string;
  verdict: boolean;
}

/**
 * Статистика MEV балансировщика
 */
export interface MevLoadBalancerStats {
  processedSignals: number;
  successfulSignals: number;
  failedSignals: number;
  totalMevActions: number;
  totalProcesses?: number;
}

/**
 * Настройки MEV балансировщика
 */
export interface MevLoadBalancerSettings {
  maxProcesses: number;
  signalBufferSize: number;
  processingInterval: number;
  liquidityCheckInterval: number;
  notifyTelegram: boolean;
}

/**
 * Информация о пулах для токена
 */
export interface Pools {
  meteoraPools: string[];
  pumpSwapPool?: string;
  raydiumPool?: string;
  meteoraDAMMPool?: string;
  type: string;
}

/**
 * Использование пулов Meteora
 */
export interface UsageMeteoraPools {
  [poolAddress: string]: boolean;
}

/**
 * Процессы для управления
 */
export interface ProcessesToManage {
  configsToAdd: ProcessConfig[];
  configsToDelete: string[];
}

/**
 * Параметры распределения задержек
 */
export interface DelayDistribution {
  delays: number[];
  expectedPerformance: number;
}

/**
 * Конфигурация сигнала с распределением
 */
export interface SignalDistributionConfig {
  delays: number[];
  instanceCount: number;
}

/**
 * Опции запуска MEV процесса
 */
export interface MevProcessStartOptions {
  isRestart?: boolean;
  initialCreationTime?: number;
}

/**
 * Результат операции с процессом
 */
export interface ProcessOperationResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}
