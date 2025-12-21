// global.d.ts
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

export {};

declare global {
  interface Window {
    electronAPI: {
      // ============= General IPC =============
      invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>;
      sendToMain: (channel: string, ...args: any[]) => void;

      // ============= Process Management =============
      startProcess: (taskId: number, config: any) => void;
      stopProcess: (taskId: number) => void;
      resumeProcess: (taskId: number, config: any) => void;

      // ============= Process Events =============
      onProcessStarted: (callback: (event: any, data: { taskId: number; config: any }) => void) => void;
      onProcessOutput: (callback: (event: any, data: { taskId: number; log: string }) => void) => void;
      onProcessExit: (callback: (event: any, data: { taskId: number; code: number }) => void) => void;
      onProcessError: (callback: (event: any, data: { taskId: number; error: string }) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: () => void;

      // ============= Task Logs =============
      openLogFile: (taskId: number) => Promise<void>;

      // ============= Tasks Communication =============
      listenForTasks: (callback: () => void) => void;
      removeTasksListener: () => void;

      // ============= Settings =============
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;

      // ============= Wallets =============
      getWallets: () => Promise<{ publicKey: string; privateKey: string }[]>;
      addWallet: (wallet: { publicKey: string; privateKey: string }) => Promise<void>;
      deleteWallet: (publicKey: string) => Promise<void>;

      // ============= Configs =============
      saveConfig: (configType: string, fileName: string, content: any) => Promise<boolean>;
      getConfigs: (configType: string) => Promise<string[]>;
      getConfig: (configType: string, fileName: string) => Promise<any>;
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
        getNftsForCollection: (collId: string, limit?: number, onlyListings?: boolean) => Promise<any>;
        getTxHistory: (params: any) => Promise<any>;
      };

      // ============= Telegram Bot =============
      telegramBot: {
        getConfig: () => Promise<{
          token: string;
          enabled: boolean;
          chatIds?: number[];
        }>;
        setToken: (token: string) => Promise<{
          success: boolean;
          error?: string;
        }>;
        getStatus: () => Promise<{
          isRunning: boolean;
          isConfigured: boolean;
          chatCount: number;
          lastActivity?: string;
        }>;
        start: () => Promise<{
          success: boolean;
          error?: string;
        }>;
        stop: () => Promise<{
          success: boolean;
          error?: string;
        }>;
        testConnection: () => Promise<{
          success: boolean;
          error?: string;
        }>;
      };

      // ============= Telegram Events =============
      onTelegramStopTask: (callback: (event: any, taskId: number) => void) => void;
      onTelegramRemoveTask: (callback: (event: any, taskId: number) => void) => void;
      onTelegramResumeTask: (callback: (event: any, data: { taskId: number; config: any }) => void) => void;
    };
  }
}