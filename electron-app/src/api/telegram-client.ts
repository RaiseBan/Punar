import axios, { AxiosInstance } from 'axios';

const TELEGRAM_SERVICE_URL = process.env.TELEGRAM_SERVICE_URL || 'http://localhost:3003';

class TelegramClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: TELEGRAM_SERVICE_URL,
      timeout: 5000,
    });
  }

  async sendTaskNotification(data: {
    taskId: string;
    rowIndex?: number;
    rowId?: string;
    token?: string;
    volumeChange?: string;
    volumeValue?: string;
    allCells?: string[];
  }): Promise<void> {
    try {
      await this.client.post('/api/notifications/task', data);
    } catch (error) {
      console.error('[Telegram Client] Error sending task notification:', error);
    }
  }

  async sendTaskStatus(taskId: string): Promise<void> {
    try {
      await this.client.post('/api/notifications/task-status', { taskId });
    } catch (error) {
      console.error('[Telegram Client] Error sending task status:', error);
    }
  }

  async sendSystemNotification(message: string): Promise<void> {
    try {
      await this.client.post('/api/notifications/system', { message });
    } catch (error) {
      console.error('[Telegram Client] Error sending system notification:', error);
    }
  }
}

export const telegramClient = new TelegramClient();