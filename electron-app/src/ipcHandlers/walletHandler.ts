import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { getGlobalConfigDirectory } from '../utils/wallet.js';
import { IpcMain } from 'electron';
import { Wallet } from '../shared/types';

function initializeWalletHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('getWallets', async (): Promise<Wallet[] | { message: string }> => {
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

            return JSON.parse(readFileSync(walletsFilePath, 'utf-8')) as Wallet[];
        } catch (error) {
            console.error('Ошибка при загрузке кошельков:', error);
            return { message: 'Error loading wallets.' };
        }
    });

    ipcMain.handle('addWallet', async (_event, wallet: Wallet): Promise<void> => {
        try {
            const configDir = getGlobalConfigDirectory();
            const walletsFilePath = path.join(configDir, 'wallets.json');

            let wallets: Wallet[] = [];
            if (existsSync(walletsFilePath)) {
                wallets = JSON.parse(readFileSync(walletsFilePath, 'utf-8')) as Wallet[];
            }

            wallets.push(wallet);
            writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
        } catch (error) {
            console.error('Ошибка при сохранении кошелька:', error);
        }
    });

    ipcMain.handle('deleteWallet', async (_event, publicKey: string): Promise<void> => {
        try {
            const configDir = getGlobalConfigDirectory();
            const walletsFilePath = path.join(configDir, 'wallets.json');

            if (!existsSync(walletsFilePath)) return;

            let wallets: Wallet[] = JSON.parse(readFileSync(walletsFilePath, 'utf-8')) as Wallet[];
            wallets = wallets.filter(wallet => wallet.publicKey !== publicKey);

            writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
        } catch (error) {
            console.error('Ошибка при удалении кошелька:', error);
        }
    });
}

export { initializeWalletHandlers };