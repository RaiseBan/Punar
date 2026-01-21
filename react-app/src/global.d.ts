// global.d.ts
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

export {};

declare global {
  interface Window {
    electronAPI?: {
      // ============= General IPC =============
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
      sendToMain: (channel: string, ...args: unknown[]) => void;

      // ============= Process Management =============
      startProcess: (taskId: number, config: unknown) => void;
      stopProcess: (taskId: number) => void;
      resumeProcess: (taskId: number, config: unknown) => void;

      // ============= Process Events =============
      onProcessStarted: (callback: (event: unknown, data: { taskId: number; config: unknown }) => void) => void;
      onProcessOutput: (callback: (event: unknown, data: { taskId: number; log: string }) => void) => void;
      onProcessExit: (callback: (event: unknown, data: { taskId: number; code: number }) => void) => void;
      onProcessError: (callback: (event: unknown, data: { taskId: number; error: string }) => void) => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeAllListeners: () => void;

      // ============= Task Logs =============
      openLogFile: (taskId: number) => Promise<void>;

      // ============= Tasks Communication =============
      listenForTasks: (callback: () => void) => void;
      removeTasksListener: () => void;

      // ============= Settings =============
      getSettings: () => Promise<unknown>;
      saveSettings: (settings: unknown) => Promise<void>;

      // ============= Wallets =============
      getWallets: () => Promise<{ publicKey: string; privateKey: string }[]>;
      addWallet: (wallet: { publicKey: string; privateKey: string }) => Promise<void>;
      deleteWallet: (publicKey: string) => Promise<void>;

      // ============= Configs =============
      saveConfig: (configType: string, fileName: string, content: unknown) => Promise<boolean>;
      getConfigs: (configType: string) => Promise<string[]>;
      getConfig: (configType: string, fileName: string) => Promise<unknown>;
      deleteConfig: (configType: string, fileName: string) => Promise<boolean>;
      getConfigPaths: (configType: string) => Promise<{ name: string; path: string }[]>;

      // ============= Window Controls =============
      minimizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      enableDrag: () => void;

      // ============= Tensor API =============
      tensorAPI: {
        getCollectionInfo: (slug: string) => Promise<string | null>;
        getCollIdByUrl: (url: string) => Promise<string | null>;
        getNftsForCollection: (collId: string, limit?: number, onlyListings?: boolean) => Promise<unknown>;
        getTxHistory: (params: unknown) => Promise<unknown>;
      };

      // ============= Telegram Bot =============
      telegramBot: {
        getConfig: () => Promise<{
          token: string;
          enabled: boolean;
          chatIds?: number[];
        }>;
        setToken: (token: string) => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{
          isRunning: boolean;
          isConfigured: boolean;
          chatCount: number;
          lastActivity?: string;
        }>;
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        testConnection: () => Promise<{ success: boolean; error?: string }>;
      };

      // ============= Telegram Task Events =============
      onTelegramStopTask?: (callback: (event: unknown, data: { taskId: number }) => void) => void;
      onTelegramRemoveTask?: (callback: (event: unknown, data: { taskId: number }) => void) => void;
      onTelegramResumeTask?: (callback: (event: unknown, data: { taskId: number }) => void) => void;
    };
  }
}