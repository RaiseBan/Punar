import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppSettings } from '../../../shared/types';
import { ConfigError, FileSystemError, ValidationError } from './errors';

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

  async getSettings(): Promise<AppSettings> {
    try {

      if (this.cachedSettings) {
        return this.cachedSettings;
      }

      const dirPath = path.dirname(this.settingsPath);
      await this.ensureDirectory(dirPath);

      try {
        await fs.access(this.settingsPath);
      } catch {

        const defaultSettings: AppSettings = {
          mainRpc: '',
          heliusRpcs: [],
          tensor_api_token: '',
          walletsSet: {}
        };
        await this.saveSettings(defaultSettings);
        return defaultSettings;
      }

      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(data) as AppSettings;

      this.cachedSettings = settings;
      return settings;
    } catch (error) {
      throw new ConfigError(
          'Не удалось загрузить настройки',
          error instanceof Error ? error : undefined
      );
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {

      this.validateSettings(settings);

      const dirPath = path.dirname(this.settingsPath);
      await this.ensureDirectory(dirPath);

      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

      this.cachedSettings = settings;
    } catch (error) {
      throw new ConfigError(
          'Не удалось сохранить настройки',
          error instanceof Error ? error : undefined
      );
    }
  }

  async getScriptDirectory(): Promise<string> {
    const settings = await this.getSettings();

    if (!settings.scriptDirectory || settings.scriptDirectory.trim() === '') {
      throw new ConfigError('Путь к директории скриптов не установлен');
    }

    return settings.scriptDirectory;
  }

  async setScriptDirectory(directory: string): Promise<void> {
    if (!directory || directory.trim() === '') {
      throw new ValidationError('Путь к директории не может быть пустым', 'scriptDirectory');
    }

    const settings = await this.getSettings();
    settings.scriptDirectory = directory;
    await this.saveSettings(settings);
  }

  async getMainRpc(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.mainRpc;
  }

  async getTensorApiToken(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.tensor_api_token;
  }

  async getTelegramConfig(): Promise<{
    token?: string;
    enabled?: boolean;
    chatIds?: number[];
  }> {
    const settings = await this.getSettings();
    return {
      token: (settings as AppSettings).telegramToken,
      enabled: (settings as AppSettings).telegramEnabled,
      chatIds: (settings as AppSettings).telegramChatIds,
    };
  }

  async setTelegramConfig(config: {
    token?: string;
    enabled?: boolean;
    chatIds?: number[];
  }): Promise<void> {
    const settings = await this.getSettings();
    const updatedSettings = { ...settings } as AppSettings;

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

  clearCache(): void {
    this.cachedSettings = null;
  }

  private validateSettings(settings: AppSettings): void {
    if (typeof settings !== 'object' || settings === null) {
      throw new ValidationError('Настройки должны быть объектом');
    }

    if (settings.scriptDirectory !== undefined) {
      if (typeof settings.scriptDirectory !== 'string') {
        throw new ValidationError(
            'scriptDirectory должен быть строкой',
            'scriptDirectory'
        );
      }
    }

    if (settings.mainRpc !== undefined && typeof settings.mainRpc !== 'string') {
      throw new ValidationError('mainRpc должен быть строкой', 'mainRpc');
    }

  }

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

let configRepositoryInstance: ConfigRepository | null = null;

export function getConfigRepository(): ConfigRepository {
  if (!configRepositoryInstance) {
    configRepositoryInstance = new ConfigRepository();
  }
  return configRepositoryInstance;
}