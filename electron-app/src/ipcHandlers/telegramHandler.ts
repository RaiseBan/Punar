import { IpcMain } from 'electron';
import axios, { AxiosInstance } from 'axios';
import { getConfigRepository } from '../repositories';
import { EventBus } from '../../../shared/eventBus';
import { TELEGRAM_EVENTS } from '../../../shared/eventBus/events';
import {
  TelegramBotConfig,
  TelegramBotStatus,
  IPC_CHANNELS
} from '../../../shared/types';

const TELEGRAM_SERVICE_URL = process.env.TELEGRAM_SERVICE_URL || 'http://localhost:3003';
const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY || 'your-secret-api-key-here';

class TelegramServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: TELEGRAM_SERVICE_URL,
      timeout: 5000,
      headers: {
        'x-api-key': TELEGRAM_API_KEY,
      },
    });
  }

  async setBotConfig(config: { botToken: string; chatIds: number[] }): Promise<boolean> {
    try {
      const response = await this.client.post('/api/bot/config', config, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data.success;
    } catch (error) {
      console.error('[TelegramHandler] Error setting bot config:', error);
      return false;
    }
  }

  async getBotStatus(): Promise<TelegramBotStatus | null> {
    try {
      const response = await this.client.get('/api/bot/status');
      if (response.data.success && response.data.data) {
        return {
          isRunning: response.data.data.isActive || false,
          isConfigured: true,
          chatCount: 0,
          lastActivity: response.data.data.lastActivity,
        };
      }
      return null;
    } catch (error) {
      console.error('[TelegramHandler] Error getting bot status:', error);
      return null;
    }
  }

  async startBot(): Promise<boolean> {
    try {
      const response = await this.client.post('/api/bot/start', {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data.success;
    } catch (error) {
      console.error('[TelegramHandler] Error starting bot:', error);
      return false;
    }
  }

  async stopBot(): Promise<boolean> {
    try {
      const response = await this.client.post('/api/bot/stop', {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data.success;
    } catch (error) {
      console.error('[TelegramHandler] Error stopping bot:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('[TelegramHandler] Telegram service is not available:', error);
      return false;
    }
  }
}

const telegramServiceClient = new TelegramServiceClient();

export function initializeTelegramHandlers(ipcMain: IpcMain): void {
  const configRepo = getConfigRepository();

  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_GET_CONFIG,
      async (): Promise<TelegramBotConfig> => {
        const config = await configRepo.getTelegramConfig();

        return {
          token: config.token || '',
          enabled: config.enabled || false,
          chatIds: config.chatIds || [],
        };
      }
  );

  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_SET_TOKEN,
      async (_event, token: string): Promise<{ success: boolean; error?: string }> => {
        if (!token || token.trim().length === 0) {
          return { success: false, error: 'Token cannot be empty' };
        }

        try {
          await configRepo.setTelegramConfig({ token, enabled: true });

          const config = await configRepo.getTelegramConfig();
          const chatIds = config.chatIds || [];

          const success = await telegramServiceClient.setBotConfig({
            botToken: token,
            chatIds: chatIds,
          });

          if (success) {
            return { success: true };
          } else {
            return { success: false, error: 'Failed to configure bot in telegram-service' };
          }
        } catch (error) {
          console.error('[TelegramHandler] Error setting token:', error);
          return { success: false, error: (error as Error).message };
        }
      }
  );

  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_GET_STATUS,
      async (): Promise<TelegramBotStatus | null> => {
        return await telegramServiceClient.getBotStatus();
      }
  );

  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_START_BOT,
      async (): Promise<{ success: boolean; error?: string }> => {
        try {
          const config = await configRepo.getTelegramConfig();

          if (!config.token) {
            return { success: false, error: 'Bot token not configured. Please set token first.' };
          }

          const chatIds = config.chatIds || [];

          await telegramServiceClient.setBotConfig({
            botToken: config.token,
            chatIds: chatIds,
          });

          const success = await telegramServiceClient.startBot();

          if (success) {
            await configRepo.setTelegramConfig({ enabled: true });

            EventBus.emit(TELEGRAM_EVENTS.BOT_STARTED, {
              timestamp: Date.now(),
            });

            return { success: true };
          } else {
            return { success: false, error: 'Failed to start bot' };
          }
        } catch (error) {
          console.error('[TelegramHandler] Error starting bot:', error);
          return { success: false, error: (error as Error).message };
        }
      }
  );

  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_STOP_BOT,
      async (): Promise<{ success: boolean; error?: string }> => {
        try {
          const success = await telegramServiceClient.stopBot();

          if (success) {
            await configRepo.setTelegramConfig({ enabled: false });

            EventBus.emit(TELEGRAM_EVENTS.BOT_STOPPED, {
              timestamp: Date.now(),
            });

            return { success: true };
          } else {
            return { success: false, error: 'Failed to stop bot' };
          }
        } catch (error) {
          console.error('[TelegramHandler] Error stopping bot:', error);
          return { success: false, error: (error as Error).message };
        }
      }
  );

  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_TEST_CONNECTION,
      async (): Promise<{ success: boolean; error?: string }> => {
        const isConnected = await telegramServiceClient.testConnection();

        if (isConnected) {
          return { success: true };
        } else {
          return {
            success: false,
            error: 'Cannot connect to telegram-service. Make sure it is running.'
          };
        }
      }
  );
}