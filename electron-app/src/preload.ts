import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('🔧 [PRELOAD] Script is loading...');
console.log('🔧 [PRELOAD] contextBridge:', contextBridge);
console.log('🔧 [PRELOAD] ipcRenderer:', ipcRenderer);

const IPC_CHANNELS = {

  START_PROCESS: 'start-process',
  STOP_PROCESS: 'stop-process',
  RESUME_PROCESS: 'resume-process',
  PROCESS_STARTED: 'process-started',
  PROCESS_OUTPUT: 'process-output',
  PROCESS_EXIT: 'process-exit',
  PROCESS_ERROR: 'process-error',

  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',

  GET_WALLETS: 'get-wallets',
  ADD_WALLET: 'add-wallet',
  DELETE_WALLET: 'delete-wallet',

  SAVE_CONFIG: 'save-config',
  GET_CONFIGS: 'get-configs',
  GET_CONFIG: 'get-config',
  DELETE_CONFIG: 'delete-config',
  GET_CONFIG_PATHS: 'get-config-paths',

  MINIMIZE_WINDOW: 'minimize-window',
  CLOSE_WINDOW: 'close-window',
  ENABLE_DRAG: 'enable-drag',

  TENSOR_GET_COLLECTION_INFO: 'tensor-get-collection-info',
  TENSOR_GET_COLL_ID_BY_URL: 'tensor-get-coll-id-by-url',
  TENSOR_GET_NFTS_FOR_COLLECTION: 'tensor-get-nfts-for-collection',

  TELEGRAM_GET_CONFIG: 'telegram-bot:get-config',
  TELEGRAM_SET_TOKEN: 'telegram-bot:set-token',
  TELEGRAM_GET_STATUS: 'telegram-bot:get-status',
  TELEGRAM_START_BOT: 'telegram-bot:start',
  TELEGRAM_STOP_BOT: 'telegram-bot:stop',
  TELEGRAM_TEST_CONNECTION: 'telegram-bot:test-connection',
} as const;

interface ProcessStartedEvent {
  taskId: number;
  config: TaskConfig;
}

interface ProcessOutputEvent {
  taskId: number;
  log: string;
}

interface ProcessExitEvent {
  taskId: number;
  code: number | null;
}

interface ProcessErrorEvent {
  taskId: number;
  error: string;
}

interface AppSettings {
  [key: string]: any;
}

interface Wallet {
  publicKey: string;
  privateKey: string;
}

type ConfigType = 'reprice_config' | 'snipe_config';

interface TaskConfig {
  [key: string]: any;
}

interface TelegramBotConfig {
  token: string;
  enabled: boolean;
  chatIds?: number[];
}

interface TelegramBotStatus {
  isRunning: boolean;
  isConfigured: boolean;
  chatCount: number;
  lastActivity?: string;
}

type EventCallback<T> = (event: IpcRendererEvent, data: T) => void;

const electronAPI = {

  startProcess: (taskId: number, config: TaskConfig): void => {
    console.log(`start process config: ${JSON.stringify(config, null, 2)}`);
    ipcRenderer.send(IPC_CHANNELS.START_PROCESS, { taskId, config });
  },

  stopProcess: (taskId: number): void => {
    ipcRenderer.send(IPC_CHANNELS.STOP_PROCESS, taskId);
  },

  resumeProcess: (taskId: number, config: TaskConfig): void => {
    ipcRenderer.send(IPC_CHANNELS.RESUME_PROCESS, { taskId, config });
  },

  onProcessStarted: (callback: EventCallback<ProcessStartedEvent>): void => {
    ipcRenderer.on(IPC_CHANNELS.PROCESS_STARTED, callback);
  },

  onProcessOutput: (callback: EventCallback<ProcessOutputEvent>): void => {
    ipcRenderer.on(IPC_CHANNELS.PROCESS_OUTPUT, callback);
  },

  onProcessExit: (callback: EventCallback<ProcessExitEvent>): void => {
    ipcRenderer.on(IPC_CHANNELS.PROCESS_EXIT, callback);
  },

  onProcessError: (callback: EventCallback<ProcessErrorEvent>): void => {
    ipcRenderer.on(IPC_CHANNELS.PROCESS_ERROR, callback);
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback);
  },

  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PROCESS_STARTED);
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PROCESS_OUTPUT);
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PROCESS_EXIT);
  },

  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
  },

  saveSettings: (settings: AppSettings): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings);
  },

  getWallets: (): Promise<Wallet[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_WALLETS);
  },

  addWallet: (wallet: Wallet): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ADD_WALLET, wallet);
  },

  deleteWallet: (publicKey: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_WALLET, publicKey);
  },

  saveConfig: (configType: ConfigType, fileName: string, content: unknown): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, configType, fileName, content);
  },

  getConfigs: (configType: ConfigType): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIGS, configType);
  },

  getConfig: (configType: ConfigType, fileName: string): Promise<unknown> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG, configType, fileName);
  },

  deleteConfig: (configType: ConfigType, fileName: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_CONFIG, configType, fileName);
  },

  getConfigPaths: (configType: ConfigType): Promise<{ name: string; path: string }[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG_PATHS, configType);
  },

  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW);
  },

  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW);
  },

  enableDrag: (): void => {
    ipcRenderer.send(IPC_CHANNELS.ENABLE_DRAG);
  },

  tensorAPI: {
    getCollectionInfo: (slug: string): Promise<string | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TENSOR_GET_COLLECTION_INFO, slug);
    },

    getCollIdByUrl: (url: string): Promise<string | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TENSOR_GET_COLL_ID_BY_URL, url);
    },

    getNftsForCollection: (
        collId: string,
        limit: number = 1,
        onlyListings: boolean = false
    ): Promise<unknown> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TENSOR_GET_NFTS_FOR_COLLECTION, collId, limit, onlyListings);
    },

    getTxHistory: (params: unknown): Promise<unknown> => {
      return ipcRenderer.invoke('get-txHistory', params);
    },
  },

  telegramBot: {

    getConfig: (): Promise<TelegramBotConfig> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_GET_CONFIG);
    },

    setToken: (token: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_SET_TOKEN, token);
    },

    getStatus: (): Promise<TelegramBotStatus> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_GET_STATUS);
    },

    start: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_START_BOT);
    },

    stop: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_STOP_BOT);
    },

    testConnection: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_TEST_CONNECTION);
    },
  },
};

console.log('✅ [PRELOAD] Exposing electronAPI to window...');

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('✅ [PRELOAD] electronAPI exposed successfully');
} catch (error) {
  console.error('❌ [PRELOAD] Error exposing electronAPI:', error);
}

console.log('✅ [PRELOAD] Preload script completed');