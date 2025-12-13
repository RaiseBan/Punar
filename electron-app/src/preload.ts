import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  ProcessStartedEvent,
  ProcessOutputEvent,
  ProcessExitEvent,
  ProcessErrorEvent,
  AppSettings,
  Wallet,
  ConfigType,
  TaskConfig,
} from '../../shared/types';

// Типы для callback функций
type EventCallback<T> = (event: IpcRendererEvent, data: T) => void;

// Типизированный electronAPI
const electronAPI = {
  // ============= Process Management =============
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

  // ============= Process Events =============
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

  // ============= Settings =============
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
  },

  saveSettings: (settings: AppSettings): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings);
  },

  // ============= Wallets =============
  getWallets: (): Promise<Wallet[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_WALLETS);
  },

  addWallet: (wallet: Wallet): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ADD_WALLET, wallet);
  },

  deleteWallet: (publicKey: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_WALLET, publicKey);
  },

  // ============= Configs =============
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

  // ============= Window Controls =============
  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW);
  },

  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW);
  },

  enableDrag: (): void => {
    ipcRenderer.send(IPC_CHANNELS.ENABLE_DRAG);
  },

  // ============= Tensor API =============
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

  // ============= Telegram Bot =============
  setTelegramBotToken: (token: string): Promise<void> => {
    return ipcRenderer.invoke('telegram-bot:set-token', token);
  },

  getTelegramBotConfig: (): Promise<unknown> => {
    return ipcRenderer.invoke('telegram-bot:get-config');
  },

  sendTelegramTask: (taskData: unknown): Promise<void> => {
    return ipcRenderer.invoke('telegram-bot:send-task', taskData);
  },

  sendTaskStatus: (taskId: number): Promise<void> => {
    return ipcRenderer.invoke('telegram-bot:send-task-status', taskId);
  },

  onTelegramRunTask: (callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on('telegram-bot:run-task', callback);
  },

  onTelegramDeleteTask: (callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on('telegram-bot:delete-task', callback);
  },

  onTelegramStopTask: (callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on('telegram-bot:stop-task', callback);
  },

  onTelegramRemoveTask: (callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on('telegram-bot:remove-task', callback);
  },

  onTelegramResumeTask: (callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on('telegram-bot:resume-task', callback);
  },

  getTelegramBotStatus: (): Promise<unknown> => {
    return ipcRenderer.invoke('telegram-bot:get-status');
  },

  startTelegramBotStream: (): Promise<void> => {
    return ipcRenderer.invoke('telegram-bot:start-stream');
  },

  stopTelegramBotStream: (): Promise<void> => {
    return ipcRenderer.invoke('telegram-bot:stop-stream');
  },

  onPoolChanged: (callback: (data: unknown) => void): void => {
    ipcRenderer.on('telegram-notify-pool-change', (_event, data) => callback(data));
  },

  // ============= Tasks Management =============
  listenForTasks: (callback: () => void): void => {
    const wrappedCallback = () => {
      console.log('[Preload] Received get-tasks-from-redux request from main, forwarding to renderer');
      callback();
    };

    // @ts-expect-error - saving reference for cleanup
    ipcRenderer._tasksListener = wrappedCallback;
    ipcRenderer.on('get-tasks-from-redux', wrappedCallback);
  },

  removeTasksListener: (): void => {
    // @ts-expect-error - accessing saved reference
    if (ipcRenderer._tasksListener) {
      // @ts-expect-error
      ipcRenderer.removeListener('get-tasks-from-redux', ipcRenderer._tasksListener);
      // @ts-expect-error
      ipcRenderer._tasksListener = null;
    }
  },

  sendToMain: (channel: string, data: unknown): void => {
    if (channel === 'telegram-tasks-response') {
      console.log(`[Preload] Sending tasks to main process`);
      ipcRenderer.send(channel, data);
    }
  },

  // ============= Logs =============
  openLogFile: (taskId: number): Promise<void> => {
    console.log(`Opening log file for task ${taskId}`);
    return ipcRenderer.invoke('open-log-file', { taskId });
  },

  invoke: (channel: string, data: unknown): Promise<unknown> => {
    const validChannels = ['get-task-logs', 'open-log-file'];
    if (!validChannels.includes(channel)) {
      console.error(`Попытка вызвать неразрешенный канал: ${channel}`);
      return Promise.reject(new Error(`Неразрешенный канал: ${channel}`));
    }
    return ipcRenderer.invoke(channel, data);
  },

  // ============= MEV LoadBalancer =============
  mevLoadBalancer: {
    getStatus: (): Promise<unknown> => {
      return ipcRenderer.invoke('mev-loadbalancer:get-status');
    },

    start: (): Promise<void> => {
      return ipcRenderer.invoke('mev-loadbalancer:start');
    },

    stop: (): Promise<void> => {
      return ipcRenderer.invoke('mev-loadbalancer:stop');
    },

    getProcesses: (): Promise<unknown[]> => {
      return ipcRenderer.invoke('mev-loadbalancer:get-processes');
    },

    stopProcess: (processId: string): Promise<void> => {
      return ipcRenderer.invoke('mev-loadbalancer:stop-process', processId);
    },

    updateSettings: (settings: unknown): Promise<void> => {
      return ipcRenderer.invoke('mev-loadbalancer:update-settings', settings);
    },
  },
};

// Expose electronAPI to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ============= IPC Handlers =============
ipcRenderer.on('telegram-get-tasks', () => {
  const tasksState = document.getElementById('redux-store-data');
  let tasks: unknown[] = [];

  if (tasksState && tasksState.textContent) {
    try {
      const state = JSON.parse(tasksState.textContent);
      tasks = state.tasks.tasks;
    } catch (e) {
      console.error('Error parsing tasks:', e);
    }
  }

  ipcRenderer.send('telegram-tasks-response', tasks);
});

ipcRenderer.on('get-tasks-from-redux', () => {
  console.log('[Preload] Received get-tasks-from-redux request from main.');
  try {
    // @ts-expect-error - window.getReduxState injected by renderer
    if (typeof window.getReduxState === 'function') {
      console.log('[Preload] window.getReduxState function found. Attempting to get Redux state...');
      // @ts-expect-error
      const state = window.getReduxState();

      if (state?.tasks) {
        console.log(`[Preload] Got state.tasks. Keys: ${Object.keys(state.tasks)}`);
      } else {
        console.warn('[Preload] Redux state or state.tasks is missing after calling getReduxState.');
      }

      const tasks = state?.tasks?.tasks || [];

      console.log(`[Preload] Extracted tasks. Length: ${tasks.length}`);
      if (tasks.length > 0) {
        console.log('[Preload] First task being sent:', JSON.stringify(tasks[0], null, 2));
      }

      console.log('[Preload] Sending tasks-from-redux response back to main.');
      ipcRenderer.send('tasks-from-redux', tasks);
    } else {
      console.warn('[Preload] window.getReduxState is not available yet.');
      ipcRenderer.send('tasks-from-redux', []);
    }
  } catch (error) {
    console.error('[Preload] Error getting/sending tasks from Redux:', error);
    ipcRenderer.send('tasks-from-redux', []);
  }
});