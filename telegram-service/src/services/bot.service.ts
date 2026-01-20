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

// Rate Limiting настройки
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 секунд
const MAX_COMMANDS_PER_WINDOW = 10; // Максимум 10 команд в минуту на пользователя

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

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

  // Rate limiting state - отслеживаем команды по chatId
  private rateLimitMap: Map<number, RateLimitEntry> = new Map();

  constructor() {
    this.botToken = config.botToken;
    this.chatIds = config.chatIds;

    this.client = axios.create({
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      timeout: 40000,
    });

    // Очищаем старые записи rate limit каждые 5 минут
    setInterval(() => this.cleanupRateLimitMap(), 5 * 60 * 1000);
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

  /**
   * Проверяет, не превысил ли пользователь rate limit
   * @returns true если команду можно выполнить, false если лимит превышен
   */
  private checkRateLimit(chatId: number): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(chatId);

    if (!entry) {
      // Первая команда от этого пользователя
      this.rateLimitMap.set(chatId, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    const timeSinceWindowStart = now - entry.windowStart;

    if (timeSinceWindowStart > RATE_LIMIT_WINDOW) {
      // Окно истекло, сбрасываем счетчик
      this.rateLimitMap.set(chatId, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Окно еще активно
    if (entry.count >= MAX_COMMANDS_PER_WINDOW) {
      // Лимит превышен
      return false;
    }

    // Увеличиваем счетчик
    entry.count++;
    return true;
  }

  /**
   * Очищает старые записи из rate limit map
   */
  private cleanupRateLimitMap(): void {
    const now = Date.now();
    const entriesToDelete: number[] = [];

    this.rateLimitMap.forEach((entry, chatId) => {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
        entriesToDelete.push(chatId);
      }
    });

    entriesToDelete.forEach(chatId => this.rateLimitMap.delete(chatId));

    if (entriesToDelete.length > 0) {
      console.log(`Cleaned up ${entriesToDelete.length} old rate limit entries`);
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
    if (!handler) {
      // Команда не найдена, игнорируем
      return;
    }

    // Проверяем rate limit
    if (!this.checkRateLimit(chatId)) {
      const entry = this.rateLimitMap.get(chatId)!;
      const timeRemaining = Math.ceil(
          (RATE_LIMIT_WINDOW - (Date.now() - entry.windowStart)) / 1000
      );

      await this.sendMessage(
          chatId,
          `⚠️ Слишком много команд! Пожалуйста, подождите ${timeRemaining} секунд.`
      );
      console.log(`Rate limit exceeded for chatId ${chatId}, command: /${command}`);
      return;
    }

    // Выполняем команду
    try {
      await handler(chatId, args);
    } catch (error) {
      console.error(`Command ${command} error:`, error);
      await this.sendMessage(chatId, `❌ Ошибка выполнения команды: ${(error as Error).message}`);
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
        await this.sendSingleMessage(chatId, text, options!);
      } else {
        await this.sendLongMessage(chatId, text, options!);
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