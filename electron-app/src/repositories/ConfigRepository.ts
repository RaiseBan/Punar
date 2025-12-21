import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppSettings } from '../../../shared/types';
import { ConfigError, FileSystemError, ValidationError } from './errors';

/**
 * Репозиторий для работы с настройками приложения
 */
export class ConfigRepository {
  private readonly settingsPath: string;
  private cachedSettings: AppSettings | null = null;

  constructor() {
    const userDataPath =
      process.env.NODE_ENV === 'production'
        ? app.getPath('userData')
        : path.join(__dirname, '..', '..');

    this.settingsPath = path.join(userDataPath, 'globalConfigs', 'settings.json');
  }

  /**
   * Получить все настройки
   */
  async getSettings(): Promise<AppSettings> {
    try {
      // Возвращаем кэш если есть
      if (this.cachedSettings) {
        return this.cachedSettings;
      }

      // Проверяем существование директории
      const dirPath = path.dirname(this.settingsPath);
      await this.ensureDirectory(dirPath);

      // Проверяем существование файла
      try {
        await fs.access(this.settingsPath);
      } catch {
        // Файл не существует - создаем с дефолтными настройками
        const defaultSettings: AppSettings = {};
        await this.saveSettings(defaultSettings);
        return defaultSettings;
      }

      // Читаем файл
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(data) as AppSettings;

      // Кэшируем
      this.cachedSettings = settings;
      return settings;
    } catch (error) {
      throw new ConfigError(
        'Не удалось загрузить настройки',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Сохранить настройки
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Валидируем настройки
      this.validateSettings(settings);

      // Создаем директорию если не существует
      const dirPath = path.dirname(this.settingsPath);
      await this.ensureDirectory(dirPath);

      // Сохраняем
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

      // Обновляем кэш
      this.cachedSettings = settings;
    } catch (error) {
      throw new ConfigError(
        'Не удалось сохранить настройки',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Получить путь к директории со скриптами
   * @throws {ConfigError} если путь не установлен
   */
  async getScriptDirectory(): Promise<string> {
    const settings = await this.getSettings();

    if (!settings.scriptDirectory || settings.scriptDirectory.trim() === '') {
      throw new ConfigError('Путь к директории скриптов не установлен');
    }

    return settings.scriptDirectory;
  }

  /**
   * Установить путь к директории со скриптами
   */
  async setScriptDirectory(directory: string): Promise<void> {
    if (!directory || directory.trim() === '') {
      throw new ValidationError('Путь к директории не может быть пустым', 'scriptDirectory');
    }

    const settings = await this.getSettings();
    settings.scriptDirectory = directory;
    await this.saveSettings(settings);
  }

  /**
   * Получить главный RPC endpoint
   */
  async getMainRpc(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.mainRpc;
  }

  /**
   * Получить Tensor API токен
   */
  async getTensorApiToken(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.tensor_api_token;
  }

  /**
   * Получить конфигурацию Telegram
   */
  async getTelegramConfig(): Promise<{
    token?: string;
    enabled?: boolean;
    chatIds?: number[];
  }> {
    const settings = await this.getSettings();
    return {
      token: (settings as any).telegramToken,
      enabled: (settings as any).telegramEnabled,
      chatIds: (settings as any).telegramChatIds,
    };
  }

  /**
   * Установить конфигурацию Telegram
   */
  async setTelegramConfig(config: {
    token?: string;
    enabled?: boolean;
    chatIds?: number[];
  }): Promise<void> {
    const settings = await this.getSettings();
    const updatedSettings = { ...settings } as any;

    if (config.token !== undefined) {
      updatedSettings.telegramToken = config.token;
    }
    if (config.enabled !== undefined) {
      updatedSettings.telegramEnabled = config.enabled;
    }
    if (config.chatIds !== undefined) {
      updatedSettings.telegramChatIds = config.chatIds;
    }

    await this.saveSettings(updatedSettings);
  }

  /**
   * Очистить кэш настроек
   */
  clearCache(): void {
    this.cachedSettings = null;
  }

  /**
   * Валидация настроек
   */
  private validateSettings(settings: AppSettings): void {
    if (typeof settings !== 'object' || settings === null) {
      throw new ValidationError('Настройки должны быть объектом');
    }

    // Валидация scriptDirectory если присутствует
    if (settings.scriptDirectory !== undefined) {
      if (typeof settings.scriptDirectory !== 'string') {
        throw new ValidationError(
          'scriptDirectory должен быть строкой',
          'scriptDirectory'
        );
      }
    }

    // Валидация RPC endpoints
    if (settings.mainRpc !== undefined && typeof settings.mainRpc !== 'string') {
      throw new ValidationError('mainRpc должен быть строкой', 'mainRpc');
    }

    // Добавь другие валидации по необходимости
  }

  /**
   * Создать директорию если не существует
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new FileSystemError(
        `Не удалось создать директорию: ${dirPath}`,
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }
}

// Singleton instance
let configRepositoryInstance: ConfigRepository | null = null;

/**
 * Получить экземпляр ConfigRepository (singleton)
 */
export function getConfigRepository(): ConfigRepository {
  if (!configRepositoryInstance) {
    configRepositoryInstance = new ConfigRepository();
  }
  return configRepositoryInstance;
}
