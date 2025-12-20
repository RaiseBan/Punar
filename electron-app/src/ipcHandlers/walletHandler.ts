import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { getGlobalConfigDirectory } from '../utils/wallet';
import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { Wallet, IPC_CHANNELS } from '../../../shared/types';

interface WalletOperationResult {
    message?: string;
}

export function initializeWalletHandlers(ipcMain: IpcMain): void {
    ipcMain.handle(
        IPC_CHANNELS.GET_WALLETS,
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

    ipcMain.handle(
        IPC_CHANNELS.ADD_WALLET,
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

    ipcMain.handle(
        IPC_CHANNELS.DELETE_WALLET,
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