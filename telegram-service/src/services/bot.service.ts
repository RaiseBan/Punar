import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import {
  TelegramUpdate,
  TelegramApiResponse,
  SendMessageOptions,
  TelegramMessage,
} from '../types/telegram.types';
import { CommandHandler } from '../types/api.types';

const TELEGRAM_MESSAGE_LIMIT = 4096;

export class BotService {
  private client: AxiosInstance;
  private isPolling: boolean = false;
  private lastUpdateId: number = 0;
  private pollInterval: NodeJS.Timeout | null = null;
  private commands: Map<string, CommandHandler> = new Map();
  private messageQueue: Array<{ chatId: number; text: string; options?: SendMessageOptions }> = [];
  private processing: boolean = false;
  private botToken: string = '';
  private chatIds: number[] = [];

  constructor() {
    this.botToken = config.botToken;
    this.chatIds = config.chatIds;

    this.client = axios.create({
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      timeout: 40000,
    });
  }

  updateConfig(botToken: string, chatIds: number[]): void {
    this.botToken = botToken;
    this.chatIds = chatIds;

    this.client = axios.create({
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      timeout: 40000,
    });
  }

  registerCommand(command: string, handler: CommandHandler): void {
    this.commands.set(command, handler);
  }

  async startPolling(): Promise<void> {
    if (this.isPolling) return;

    if (!this.botToken) {
      throw new Error('Bot token not configured. Call updateConfig first.');
    }

    this.isPolling = true;
    await this.deleteWebhook();
    this.poll();
  }

  async stopPolling(): Promise<void> {
    this.isPolling = false;
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    // Даем время на завершение текущего запроса
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  getStatus(): { isActive: boolean; lastActivity: string; chatCount: number } {
    return {
      isActive: this.isPolling,
      lastActivity: new Date().toISOString(),
      chatCount: this.chatIds.length,
    };
  }

  private async deleteWebhook(): Promise<void> {
    try {
      await this.client.get('/deleteWebhook');
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  }

  private async poll(): Promise<void> {
    if (!this.isPolling) return;

    try {
      const response = await this.client.get<TelegramApiResponse<TelegramUpdate[]>>('/getUpdates', {
        params: {
          offset: this.lastUpdateId + 1,
          timeout: 30,
        },
      });

      if (response.data.ok && response.data.result) {
        for (const update of response.data.result) {
          await this.handleUpdate(update);
          this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
        }
      }
    } catch (error: any) {
      // Если 409 - webhook conflict, пробуем удалить webhook
      if (error?.response?.status === 409) {
        console.log('Webhook conflict detected, removing webhook...');
        await this.deleteWebhook();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('Polling error:', error);
      }
    } finally {
      if (this.isPolling) {
        this.pollInterval = setTimeout(() => this.poll(), 1000);
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message?.text) {
      await this.handleMessage(update.message);
    }
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;

    if (!this.chatIds.includes(chatId)) {
      await this.sendMessage(chatId, '⛔ Доступ запрещен');
      return;
    }

    const text = message.text;
    if (!text || !text.startsWith('/')) return;

    const parts = text.split(' ');
    const command = parts[0].substring(1);
    const args = parts.slice(1);

    const handler = this.commands.get(command);
    if (handler) {
      try {
        await handler(chatId, args);
      } catch (error) {
        console.error(`Command ${command} error:`, error);
        await this.sendMessage(chatId, `❌ Ошибка выполнения команды: ${(error as Error).message}`);
      }
    }
  }

  async sendMessage(chatId: number, text: string, options: SendMessageOptions = {}): Promise<void> {
    this.messageQueue.push({ chatId, text, options });
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.messageQueue.length === 0) return;

    this.processing = true;
    const { chatId, text, options } = this.messageQueue.shift()!;

    try {
      if (text.length <= TELEGRAM_MESSAGE_LIMIT) {
        await this.sendSingleMessage(chatId, text, options);
      } else {
        await this.sendLongMessage(chatId, text, options);
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      this.processing = false;
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.messageQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  private async sendSingleMessage(
      chatId: number,
      text: string,
      options: SendMessageOptions
  ): Promise<void> {
    await this.client.post('/sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup,
    });
  }

  private async sendLongMessage(
      chatId: number,
      text: string,
      options: SendMessageOptions
  ): Promise<void> {
    const chunks = this.splitMessage(text);

    for (let i = 0; i < chunks.length; i++) {
      await this.client.post('/sendMessage', {
        chat_id: chatId,
        text: chunks[i],
        parse_mode: options.parse_mode || 'HTML',
        reply_markup: i === chunks.length - 1 ? options.reply_markup : undefined,
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private splitMessage(text: string): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if ((current + line + '\n').length > TELEGRAM_MESSAGE_LIMIT) {
        if (current.length > 0) {
          chunks.push(current);
          current = '';
        }

        if (line.length > TELEGRAM_MESSAGE_LIMIT) {
          let remaining = line;
          while (remaining.length > 0) {
            chunks.push(remaining.substring(0, TELEGRAM_MESSAGE_LIMIT));
            remaining = remaining.substring(TELEGRAM_MESSAGE_LIMIT);
          }
        } else {
          current = line + '\n';
        }
      } else {
        current += line + '\n';
      }
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    return chunks;
  }

  async broadcastMessage(text: string, options?: SendMessageOptions): Promise<void> {
    for (const chatId of this.chatIds) {
      await this.sendMessage(chatId, text, options);
    }
  }
}

export const botService = new BotService();