import { AppSettings, ConfigType } from './config.types';
import { Wallet } from './wallet.types';
import { TaskConfig } from './task.types';

// ============= REQUEST TYPES =============

export interface StartProcessRequest {
  taskId: number;
  taskConfig: TaskConfig;
}

export interface StopProcessRequest {
  taskId: number;
}

export interface ResumeProcessRequest {
  taskId: number;
  config: TaskConfig;
}

export interface SaveSettingsRequest {
  settings: AppSettings;
}

export interface AddWalletRequest {
  wallet: Wallet;
}

export interface DeleteWalletRequest {
  publicKey: string;
}

export interface SaveConfigRequest {
  configType: ConfigType;
  fileName: string;
  content: unknown;
}

export interface GetConfigRequest {
  configType: ConfigType;
  fileName?: string;
}

export interface DeleteConfigRequest {
  configType: ConfigType;
  fileName: string;
}

export interface TensorAPIRequest {
  slug?: string;
  url?: string;
  collId?: string;
  limit?: number;
  cursor?: string;
}

// ============= TELEGRAM TYPES =============

export interface TelegramBotConfig {
  token: string;
  enabled: boolean;
  chatIds?: number[];
}

export interface TelegramBotStatus {
  isRunning: boolean;
  isConfigured: boolean;
  chatCount: number;
  lastActivity?: string;
}

export interface SetTelegramTokenRequest {
  token: string;
}

// ============= RESPONSE TYPES =============

export interface ProcessStartedEvent {
  taskId: number;
  config: TaskConfig;
}

export interface ProcessOutputEvent {
  taskId: number;
  log: string;
}

export interface ProcessExitEvent {
  taskId: number;
  code: number;
}

export interface ProcessErrorEvent {
  taskId: number;
  error: string;
}

// ============= IPC CHANNEL NAMES =============

export const IPC_CHANNELS = {
  // Process management
  START_PROCESS: 'start-process',
  STOP_PROCESS: 'stop-process',
  RESUME_PROCESS: 'resume-process',

  // Process events
  PROCESS_STARTED: 'process-started',
  PROCESS_OUTPUT: 'process-output',
  PROCESS_EXIT: 'process-exit',
  PROCESS_ERROR: 'process-error',

  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',

  // Wallets
  GET_WALLETS: 'get-wallets',
  ADD_WALLET: 'add-wallet',
  DELETE_WALLET: 'delete-wallet',

  // Configs
  SAVE_CONFIG: 'save-config',
  GET_CONFIGS: 'get-configs',
  GET_CONFIG: 'get-config',
  DELETE_CONFIG: 'delete-config',
  GET_CONFIG_PATHS: 'get-config-paths',

  // Window controls
  MINIMIZE_WINDOW: 'minimize-window',
  CLOSE_WINDOW: 'close-window',
  ENABLE_DRAG: 'enable-drag',

  // Tensor API
  TENSOR_GET_COLLECTION_INFO: 'tensor-get-collection-info',
  TENSOR_GET_COLL_ID_BY_URL: 'tensor-get-coll-id-by-url',
  TENSOR_GET_NFTS_FOR_COLLECTION: 'tensor-get-nfts-for-collection',

  // Telegram Bot
  TELEGRAM_GET_CONFIG: 'telegram-bot:get-config',
  TELEGRAM_SET_TOKEN: 'telegram-bot:set-token',
  TELEGRAM_GET_STATUS: 'telegram-bot:get-status',
  TELEGRAM_START_BOT: 'telegram-bot:start',
  TELEGRAM_STOP_BOT: 'telegram-bot:stop',
  TELEGRAM_TEST_CONNECTION: 'telegram-bot:test-connection',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];