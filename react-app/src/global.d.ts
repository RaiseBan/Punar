import {
    AppSettings,
    Wallet,
    ConfigType,
    ProcessStartedEvent,
    ProcessOutputEvent,
    ProcessExitEvent,
    ProcessErrorEvent,
    TaskConfig,
  } from '../../shared/types';
  
  declare module '*.module.css' {
    const classes: { [key: string]: string };
    export default classes;
  }
  
  // Re-export types for components to use
  export {
    AppSettings,
    Wallet,
    ConfigType,
    ProcessStartedEvent,
    ProcessOutputEvent,
    ProcessExitEvent,
    ProcessErrorEvent,
    TaskConfig,
  };
  
  declare global {
    interface Window {
      electronAPI?: {
        // ============= Process Management =============
        startProcess: (taskId: number, config: TaskConfig) => void;
        stopProcess: (taskId: number) => void;
        resumeProcess: (taskId: number, config: TaskConfig) => void;
        removeAllListeners: () => void;
  
        // ============= Process Events =============
        onProcessStarted: (callback: (event: unknown, data: ProcessStartedEvent) => void) => void;
        onProcessOutput: (callback: (event: unknown, data: ProcessOutputEvent) => void) => void;
        onProcessExit: (callback: (event: unknown, data: ProcessExitEvent) => void) => void;
        onProcessError: (callback: (event: unknown, data: ProcessErrorEvent) => void) => void;
        removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
  
        // ============= Settings =============
        getSettings: () => Promise<AppSettings>;
        saveSettings: (settings: AppSettings) => Promise<void>;
  
        // ============= Wallets =============
        getWallets: () => Promise<Wallet[]>;
        addWallet: (wallet: Wallet) => Promise<void>;
        deleteWallet: (publicKey: string) => Promise<void>;
  
        // ============= Configs =============
        saveConfig: (configType: ConfigType, fileName: string, content: unknown) => Promise<boolean>;
        getConfigs: (configType: ConfigType) => Promise<string[]>;
        getConfig: (configType: ConfigType, fileName: string) => Promise<unknown>;
        deleteConfig: (configType: ConfigType, fileName: string) => Promise<boolean>;
        getConfigPaths: (configType: ConfigType) => Promise<{ name: string; path: string }[]>;
  
        // ============= Window Controls =============
        minimizeWindow: () => Promise<void>;
        closeWindow: () => Promise<void>;
        enableDrag: () => void;
  
        // ============= Tensor API =============
        tensorAPI: {
          getCollectionInfo: (slug: string) => Promise<string | null>;
          getCollIdByUrl: (url: string) => Promise<string | null>;
          getNftsForCollection: (
            collId: string,
            limit?: number,
            onlyListings?: boolean
          ) => Promise<unknown>;
          getTxHistory: (params: unknown) => Promise<unknown>;
        };
  
        // ============= Telegram Bot =============
        setTelegramBotToken: (token: string) => Promise<void>;
        getTelegramBotConfig: () => Promise<unknown>;
        sendTelegramTask: (taskData: unknown) => Promise<void>;
        sendTaskStatus: (taskId: number) => Promise<void>;
  
        onTelegramRunTask: (callback: (...args: unknown[]) => void) => void;
        onTelegramDeleteTask: (callback: (...args: unknown[]) => void) => void;
        onTelegramStopTask: (callback: (...args: unknown[]) => void) => void;
        onTelegramRemoveTask: (callback: (...args: unknown[]) => void) => void;
        onTelegramResumeTask: (callback: (...args: unknown[]) => void) => void;
  
        getTelegramBotStatus: () => Promise<unknown>;
        startTelegramBotStream: () => Promise<void>;
        stopTelegramBotStream: () => Promise<void>;
        onPoolChanged: (callback: (data: unknown) => void) => void;
  
        // ============= Tasks Management =============
        listenForTasks: (callback: () => void) => void;
        removeTasksListener: () => void;
        sendToMain: (channel: string, data: unknown) => void;
  
        // ============= Logs =============
        openLogFile: (taskId: number) => Promise<void>;
        invoke: (channel: string, data: unknown) => Promise<unknown>;
      };
  
      // Redux state getter (injected by App.tsx)
      getReduxState?: () => unknown;
    }
  }