import { IpcMain, IpcMainInvokeEvent } from 'electron';
import axios, { AxiosInstance } from 'axios';
import { getConfigRepository } from '../repositories';
import { EventBus } from '../../../shared/eventBus';
import { TELEGRAM_EVENTS } from '../../../shared/eventBus/events';
import {
  TelegramBotConfig,
  TelegramBotStatus,
  IPC_CHANNELS
} from '../../../shared/types';

// URL telegram-service (можно вынести в конфиг)
const TELEGRAM_SERVICE_URL = process.env.TELEGRAM_SERVICE_URL || 'http://localhost:3003';
const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY || 'your-secret-api-key-here';

/**
 * Клиент для взаимодействия с telegram-service
 */
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

  /**
   * Отправить конфиг боту
   */
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

  /**
   * Получить статус бота
   */
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

  /**
   * Запустить бота
   */
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

  /**
   * Остановить бота
   */
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

  /**
   * Проверить подключение к telegram-service
   */
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

// ============= IPC Handlers =============

/**
 * Инициализация Telegram IPC хендлеров
 */
export function initializeTelegramHandlers(ipcMain: IpcMain): void {
  console.log('[TelegramHandler] Initializing Telegram IPC handlers...');

  const configRepo = getConfigRepository();

  /**
   * Получить конфигурацию бота
   */
  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_GET_CONFIG,
      async (_event: IpcMainInvokeEvent): Promise<TelegramBotConfig> => {
        console.log('[TelegramHandler] Getting Telegram config');

        // Используем ConfigRepository вместо getSettings
        const config = await configRepo.getTelegramConfig();

        return {
          token: config.token || '',
          enabled: config.enabled || false,
          chatIds: config.chatIds || [],
        };
      }
  );

  /**
   * Установить токен бота
   */
  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_SET_TOKEN,
      async (_event: IpcMainInvokeEvent, token: string): Promise<{ success: boolean; error?: string }> => {
        console.log('[TelegramHandler] Setting Telegram token');

        if (!token || token.trim().length === 0) {
          return { success: false, error: 'Token cannot be empty' };
        }

        try {
          // Используем ConfigRepository для сохранения токена
          await configRepo.setTelegramConfig({ token, enabled: true });

          // Получаем chatIds для отправки в сервис
          const config = await configRepo.getTelegramConfig();
          const chatIds = config.chatIds || [];

          console.log('[TelegramHandler] Configuring with chatIds:', chatIds);

          // Отправляем конфиг в telegram-service (но НЕ запускаем!)
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

  /**
   * Получить статус бота
   */
  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_GET_STATUS,
      async (_event: IpcMainInvokeEvent): Promise<TelegramBotStatus | null> => {
        console.log('[TelegramHandler] Getting Telegram bot status');
        return await telegramServiceClient.getBotStatus();
      }
  );

  /**
   * Запустить бота
   */
  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_START_BOT,
      async (_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
        console.log('[TelegramHandler] Starting Telegram bot');

        try {
          // Используем ConfigRepository для получения конфига
          const config = await configRepo.getTelegramConfig();

          if (!config.token) {
            return { success: false, error: 'Bot token not configured. Please set token first.' };
          }

          // Получаем chatIds
          const chatIds = config.chatIds || [];

          // Отправляем конфиг в telegram-service
          await telegramServiceClient.setBotConfig({
            botToken: config.token,
            chatIds: chatIds,
          });

          // Запускаем бота
          const success = await telegramServiceClient.startBot();

          if (success) {
            // Используем ConfigRepository для сохранения enabled
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

  /**
   * Остановить бота
   */
  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_STOP_BOT,
      async (_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
        console.log('[TelegramHandler] Stopping Telegram bot');

        try {
          const success = await telegramServiceClient.stopBot();

          if (success) {
            // Используем ConfigRepository для сохранения enabled
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

  /**
   * Проверить подключение к telegram-service
   */
  ipcMain.handle(
      IPC_CHANNELS.TELEGRAM_TEST_CONNECTION,
      async (_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
        console.log('[TelegramHandler] Testing connection to telegram-service');

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

  console.log('[TelegramHandler] Telegram IPC handlers initialized');
}