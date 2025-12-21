import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { Wallet } from '../../../shared/types';
import { WalletError, FileSystemError, ValidationError } from './errors';

/**
 * Репозиторий для работы с кошельками
 */
export class WalletRepository {
  private readonly walletsPath: string;
  private cachedWallets: Wallet[] | null = null;

  constructor() {
    const userDataPath =
      process.env.NODE_ENV === 'production'
        ? app.getPath('userData')
        : path.join(__dirname, '..', '..');

    this.walletsPath = path.join(userDataPath, 'globalConfigs', 'wallets.json');
  }

  /**
   * Получить все кошельки
   */
  async getAll(): Promise<Wallet[]> {
    try {
      // Возвращаем кэш если есть
      if (this.cachedWallets) {
        return this.cachedWallets;
      }

      // Проверяем существование директории
      const dirPath = path.dirname(this.walletsPath);
      await this.ensureDirectory(dirPath);

      // Проверяем существование файла
      try {
        await fs.access(this.walletsPath);
      } catch {
        // Файл не существует - создаем пустой массив
        await fs.writeFile(this.walletsPath, JSON.stringify([], null, 2), 'utf-8');
        this.cachedWallets = [];
        return [];
      }

      // Читаем файл
      const data = await fs.readFile(this.walletsPath, 'utf-8');
      const wallets = JSON.parse(data) as Wallet[];

      // Валидируем
      this.validateWalletArray(wallets);

      // Кэшируем
      this.cachedWallets = wallets;
      return wallets;
    } catch (error) {
      throw new WalletError(
        'Не удалось загрузить кошельки',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Получить кошелек по публичному ключу
   */
  async getByPublicKey(publicKey: string): Promise<Wallet | null> {
    const wallets = await this.getAll();
    return wallets.find((w) => w.publicKey === publicKey) ?? null;
  }

  /**
   * Добавить новый кошелек
   */
  async add(wallet: Wallet): Promise<void> {
    try {
      // Валидируем кошелек
      this.validateWallet(wallet);

      // Получаем текущие кошельки
      const wallets = await this.getAll();

      // Проверяем на дубликаты
      const exists = wallets.some((w) => w.publicKey === wallet.publicKey);
      if (exists) {
        throw new ValidationError(
          `Кошелек с публичным ключом ${wallet.publicKey} уже существует`,
          'publicKey'
        );
      }

      // Добавляем
      wallets.push(wallet);

      // Сохраняем
      await this.saveAll(wallets);
    } catch (error) {
      if (error instanceof WalletError || error instanceof ValidationError) {
        throw error;
      }
      throw new WalletError(
        'Не удалось добавить кошелек',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Удалить кошелек по публичному ключу
   */
  async delete(publicKey: string): Promise<boolean> {
    try {
      const wallets = await this.getAll();
      const initialLength = wallets.length;

      const filtered = wallets.filter((w) => w.publicKey !== publicKey);

      // Если длина не изменилась - кошелек не найден
      if (filtered.length === initialLength) {
        return false;
      }

      // Сохраняем
      await this.saveAll(filtered);
      return true;
    } catch (error) {
      throw new WalletError(
        'Не удалось удалить кошелек',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Обновить кошелек
   */
  async update(publicKey: string, updates: Partial<Wallet>): Promise<boolean> {
    try {
      const wallets = await this.getAll();
      const index = wallets.findIndex((w) => w.publicKey === publicKey);

      if (index === -1) {
        return false;
      }

      // Применяем обновления
      wallets[index] = { ...wallets[index], ...updates };

      // Валидируем обновленный кошелек
      this.validateWallet(wallets[index]);

      // Сохраняем
      await this.saveAll(wallets);
      return true;
    } catch (error) {
      throw new WalletError(
        'Не удалось обновить кошелек',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Проверить существование кошелька
   */
  async exists(publicKey: string): Promise<boolean> {
    const wallets = await this.getAll();
    return wallets.some((w) => w.publicKey === publicKey);
  }

  /**
   * Получить количество кошельков
   */
  async count(): Promise<number> {
    const wallets = await this.getAll();
    return wallets.length;
  }

  /**
   * Очистить все кошельки
   */
  async clear(): Promise<void> {
    await this.saveAll([]);
  }

  /**
   * Очистить кэш
   */
  clearCache(): void {
    this.cachedWallets = null;
  }

  /**
   * Сохранить все кошельки
   */
  private async saveAll(wallets: Wallet[]): Promise<void> {
    try {
      // Валидируем массив
      this.validateWalletArray(wallets);

      // Создаем директорию если не существует
      const dirPath = path.dirname(this.walletsPath);
      await this.ensureDirectory(dirPath);

      // Сохраняем
      await fs.writeFile(this.walletsPath, JSON.stringify(wallets, null, 2), 'utf-8');

      // Обновляем кэш
      this.cachedWallets = wallets;
    } catch (error) {
      throw new WalletError(
        'Не удалось сохранить кошельки',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Валидация кошелька
   */
  private validateWallet(wallet: Wallet): void {
    if (!wallet || typeof wallet !== 'object') {
      throw new ValidationError('Кошелек должен быть объектом');
    }

    if (!wallet.publicKey || typeof wallet.publicKey !== 'string') {
      throw new ValidationError('publicKey обязателен и должен быть строкой', 'publicKey');
    }

    if (wallet.publicKey.trim() === '') {
      throw new ValidationError('publicKey не может быть пустым', 'publicKey');
    }

    if (!wallet.privateKey || typeof wallet.privateKey !== 'string') {
      throw new ValidationError(
        'privateKey обязателен и должен быть строкой',
        'privateKey'
      );
    }

    if (wallet.privateKey.trim() === '') {
      throw new ValidationError('privateKey не может быть пустым', 'privateKey');
    }
  }

  /**
   * Валидация массива кошельков
   */
  private validateWalletArray(wallets: Wallet[]): void {
    if (!Array.isArray(wallets)) {
      throw new ValidationError('Кошельки должны быть массивом');
    }

    wallets.forEach((wallet, index) => {
      try {
        this.validateWallet(wallet);
      } catch (error) {
        throw new ValidationError(
          `Ошибка валидации кошелька на позиции ${index}: ${
            error instanceof Error ? error.message : 'неизвестная ошибка'
          }`
        );
      }
    });
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
let walletRepositoryInstance: WalletRepository | null = null;

/**
 * Получить экземпляр WalletRepository (singleton)
 */
export function getWalletRepository(): WalletRepository {
  if (!walletRepositoryInstance) {
    walletRepositoryInstance = new WalletRepository();
  }
  return walletRepositoryInstance;
}
