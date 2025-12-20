import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { getGlobalConfigDirectory } from '../utils/wallet';
import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { Wallet } from '../../../shared/types';

/**
 * Результат операции с кошельками
 */
interface WalletOperationResult {
    message?: string;
}

/**
 * Инициализирует IPC handlers для работы с кошельками
 */
export function initializeWalletHandlers(ipcMain: IpcMain): void {
    /**
     * Получение списка кошельков
     */
    ipcMain.handle(
        'getWallets',
        async (): Promise<Wallet[] | WalletOperationResult> => {
            try {
                const configDir = getGlobalConfigDirectory();

                if (!existsSync(configDir)) {
                    mkdirSync(configDir, { recursive: true });
                }

                const walletsFilePath = path.join(configDir, 'wallets.json');

                if (!existsSync(walletsFilePath)) {
                    writeFileSync(walletsFilePath, JSON.stringify([]));
                    return [];
                }

                const walletsData = readFileSync(walletsFilePath, 'utf-8');
                return JSON.parse(walletsData) as Wallet[];
            } catch (error) {
                console.error('Ошибка при загрузке кошельков:', error);
                return { message: 'Error loading wallets.' };
            }
        }
    );

    /**
     * Добавление нового кошелька
     */
    ipcMain.handle(
        'addWallet',
        async (_event: IpcMainInvokeEvent, wallet: Wallet): Promise<void> => {
            try {
                const configDir = getGlobalConfigDirectory();
                const walletsFilePath = path.join(configDir, 'wallets.json');

                let wallets: Wallet[] = [];

                if (existsSync(walletsFilePath)) {
                    const walletsData = readFileSync(walletsFilePath, 'utf-8');
                    wallets = JSON.parse(walletsData) as Wallet[];
                }

                wallets.push(wallet);
                writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
            } catch (error) {
                console.error('Ошибка при сохранении кошелька:', error);
                throw error;
            }
        }
    );

    /**
     * Удаление кошелька по публичному ключу
     */
    ipcMain.handle(
        'deleteWallet',
        async (_event: IpcMainInvokeEvent, publicKey: string): Promise<void> => {
            try {
                const configDir = getGlobalConfigDirectory();
                const walletsFilePath = path.join(configDir, 'wallets.json');

                if (!existsSync(walletsFilePath)) {
                    return;
                }

                const walletsData = readFileSync(walletsFilePath, 'utf-8');
                let wallets: Wallet[] = JSON.parse(walletsData) as Wallet[];

                wallets = wallets.filter((wallet) => wallet.publicKey !== publicKey);

                writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
            } catch (error) {
                console.error('Ошибка при удалении кошелька:', error);
                throw error;
            }
        }
    );
}