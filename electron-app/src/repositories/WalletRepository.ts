import { promises as fs } from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import { Wallet } from '../../../shared/types';
import {WalletError, ValidationError, FileSystemError} from './errors';
import logger from "../services/loggerService";

interface LegacyWallet {
  publicKey: string;
  privateKey: string; 
}

interface StoredWallet {
  publicKey: string;
  encryptedPrivateKey: string; 
}

function isLegacyWallet(wallet: Wallet): wallet is LegacyWallet {
  return wallet &&
      typeof wallet.publicKey === 'string' &&
      typeof wallet.privateKey === 'string' &&
      !('encryptedPrivateKey' in wallet);
}

function isStoredWallet(wallet: StoredWallet): wallet is StoredWallet {
  return wallet &&
      typeof wallet.publicKey === 'string' &&
      typeof wallet.encryptedPrivateKey === 'string';
}

export class WalletRepository {
  private readonly walletsPath: string;
  constructor() {
    const userDataPath =
        process.env.NODE_ENV === 'production'
            ? app.getPath('userData')
            : path.join(__dirname, '..', '..');

    this.walletsPath = path.join(userDataPath, 'globalConfigs', 'wallets.json');
    logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Initialized with path: ${this.walletsPath}`);
  }

  private encryptPrivateKey(privateKey: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[WalletRepository] Encryption not available, saving as plain text (NOT RECOMMENDED)');

      return Buffer.from(privateKey).toString('base64');
    }

    const buffer = safeStorage.encryptString(privateKey);
    return buffer.toString('base64');
  }

  private decryptPrivateKey(encryptedPrivateKey: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[WalletRepository] Encryption not available, reading as plain text');

      return Buffer.from(encryptedPrivateKey, 'base64').toString('utf-8');
    }

    try {
      const buffer = Buffer.from(encryptedPrivateKey, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[WalletRepository] Decryption failed:', error);

      try {
        return Buffer.from(encryptedPrivateKey, 'base64').toString('utf-8');
      } catch {
        throw new WalletError('Не удалось расшифровать приватный ключ');
      }
    }
  }

  private storedToWallet(stored: StoredWallet): Wallet {
    return {
      publicKey: stored.publicKey,
      privateKey: this.decryptPrivateKey(stored.encryptedPrivateKey),
    };
  }

  private walletToStored(wallet: Wallet): StoredWallet {
    return {
      publicKey: wallet.publicKey,
      encryptedPrivateKey: this.encryptPrivateKey(wallet.privateKey),
    };
  }

  private async migrateIfNeeded(): Promise<void> {
    try {
      const data = await fs.readFile(this.walletsPath, 'utf-8');
      const wallets = JSON.parse(data);

      if (!Array.isArray(wallets) || wallets.length === 0) {
        return;
      }

      const firstWallet = wallets[0];

      if (isLegacyWallet(firstWallet)) {
        logger.info(logger.LOG_MODULES.WALLET, '[WalletRepository] 🔄 Detected legacy format, migrating to encrypted format...');

        const migratedWallets = wallets.map((legacyWallet: LegacyWallet) => {
          const wallet: Wallet = {
            publicKey: legacyWallet.publicKey,
            privateKey: legacyWallet.privateKey,
          };
          return this.walletToStored(wallet);
        });

        await fs.writeFile(
            this.walletsPath,
            JSON.stringify(migratedWallets, null, 2),
            'utf-8'
        );

        logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] ✅ Successfully migrated ${migratedWallets.length} wallets to encrypted format`);
      } else if (isStoredWallet(firstWallet)) {
        logger.info(logger.LOG_MODULES.WALLET, '[WalletRepository] ✅ Wallets are already in encrypted format');
      } else {
        console.warn('[WalletRepository] ⚠️ Unknown wallet format detected');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {

        return;
      }
      console.error('[WalletRepository] Migration error:', error);
      throw error;
    }
  }

  async getAll(): Promise<Wallet[]> {
    try {
      logger.info(logger.LOG_MODULES.WALLET, '[WalletRepository] Getting all wallets...');

      const dirPath = path.dirname(this.walletsPath);
      await this.ensureDirectory(dirPath);

      try {
        await fs.access(this.walletsPath);
        logger.info(logger.LOG_MODULES.WALLET, '[WalletRepository] Wallets file exists, reading...');
      } catch {
        logger.info(logger.LOG_MODULES.WALLET, '[WalletRepository] Wallets file does not exist, creating empty...');
        await fs.writeFile(this.walletsPath, JSON.stringify([], null, 2), 'utf-8');
        return [];
      }

      await this.migrateIfNeeded();

      const data = await fs.readFile(this.walletsPath, 'utf-8');
      const storedWallets = JSON.parse(data);

      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Read ${storedWallets.length} wallets from file`);

      if (!Array.isArray(storedWallets)) {
        throw new WalletError('Некорректный формат файла кошельков');
      }

      const wallets = storedWallets.map((stored, index) => {
        if (isLegacyWallet(stored)) {

          logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Wallet ${index} is in legacy format, converting...`);
          return {
            publicKey: stored.publicKey,
            privateKey: stored.privateKey,
          };
        } else if (isStoredWallet(stored)) {

          logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Wallet ${index} is encrypted, decrypting...`);
          return this.storedToWallet(stored);
        } else {
          throw new WalletError(`Неизвестный формат кошелька на позиции ${index}`);
        }
      });

      this.validateWalletArray(wallets);

      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] ✅ Successfully loaded ${wallets.length} wallets`);
      return wallets;
    } catch (error) {
      console.error('[WalletRepository] Error loading wallets:', error);
      throw new WalletError(
          'Не удалось загрузить кошельки',
          error instanceof Error ? error : undefined
      );
    }
  }

  async getByPublicKey(publicKey: string): Promise<Wallet | null> {
    const wallets = await this.getAll();
    return wallets.find((w) => w.publicKey === publicKey) ?? null;
  }

  async add(wallet: Wallet): Promise<void> {
    try {
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Adding wallet: ${wallet.publicKey}`);
      this.validateWallet(wallet);

      const wallets = await this.getAll();

      const exists = wallets.some((w) => w.publicKey === wallet.publicKey);
      if (exists) {
        throw new ValidationError(
            `Кошелек с публичным ключом ${wallet.publicKey} уже существует`,
            'publicKey'
        );
      }

      wallets.push(wallet);

      await this.saveAll(wallets);
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] ✅ Wallet added successfully`);
    } catch (error) {
      console.error('[WalletRepository] Error adding wallet:', error);
      if (error instanceof WalletError || error instanceof ValidationError) {
        throw error;
      }
      throw new WalletError(
          'Не удалось добавить кошелек',
          error instanceof Error ? error : undefined
      );
    }
  }

  async delete(publicKey: string): Promise<boolean> {
    try {
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Deleting wallet: ${publicKey}`);
      const wallets = await this.getAll();
      const initialLength = wallets.length;

      const filtered = wallets.filter((w) => w.publicKey !== publicKey);

      if (filtered.length === initialLength) {
        logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Wallet not found`);
        return false;
      }

      await this.saveAll(filtered);
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] ✅ Wallet deleted successfully`);
      return true;
    } catch (error) {
      console.error('[WalletRepository] Error deleting wallet:', error);
      throw new WalletError(
          'Не удалось удалить кошелек',
          error instanceof Error ? error : undefined
      );
    }
  }

  async update(publicKey: string, updates: Partial<Wallet>): Promise<boolean> {
    try {
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Updating wallet: ${publicKey}`);
      const wallets = await this.getAll();
      const index = wallets.findIndex((w) => w.publicKey === publicKey);

      if (index === -1) {
        logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Wallet not found`);
        return false;
      }

      wallets[index] = { ...wallets[index], ...updates };

      this.validateWallet(wallets[index]);

      await this.saveAll(wallets);
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] ✅ Wallet updated successfully`);
      return true;
    } catch (error) {
      console.error('[WalletRepository] Error updating wallet:', error);
      throw new WalletError(
          'Не удалось обновить кошелек',
          error instanceof Error ? error : undefined
      );
    }
  }

  async exists(publicKey: string): Promise<boolean> {
    const wallets = await this.getAll();
    return wallets.some((w) => w.publicKey === publicKey);
  }

  async count(): Promise<number> {
    const wallets = await this.getAll();
    return wallets.length;
  }

  private async saveAll(wallets: Wallet[]): Promise<void> {
    try {
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Saving ${wallets.length} wallets...`);
      this.validateWalletArray(wallets);

      const dirPath = path.dirname(this.walletsPath);
      await this.ensureDirectory(dirPath);

      const storedWallets = wallets.map((wallet, index) => {
        logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Encrypting wallet ${index}: ${wallet.publicKey}`);
        return this.walletToStored(wallet);
      });

      await fs.writeFile(this.walletsPath, JSON.stringify(storedWallets, null, 2), 'utf-8');

      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] ✅ Successfully saved ${wallets.length} wallets`);

      const verification = await fs.readFile(this.walletsPath, 'utf-8');
      const saved = JSON.parse(verification);
      logger.info(logger.LOG_MODULES.WALLET, `[WalletRepository] Verification: file contains ${saved.length} wallets`);
    } catch (error) {
      console.error('[WalletRepository] Error saving wallets:', error);
      throw new WalletError(
          'Не удалось сохранить кошельки',
          error instanceof Error ? error : undefined
      );
    }
  }

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

let walletRepositoryInstance: WalletRepository | null = null;

export function getWalletRepository(): WalletRepository {
  if (!walletRepositoryInstance) {
    walletRepositoryInstance = new WalletRepository();
  }
  return walletRepositoryInstance;
}