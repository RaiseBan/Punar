import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { Wallet, IPC_CHANNELS } from '../../../shared/types';
import { getWalletRepository } from '../repositories';
import { WalletError, ValidationError } from '../repositories/errors';

export function initializeWalletHandlers(ipcMain: IpcMain): void {
    const walletRepo = getWalletRepository();

    /**
     * Получить все кошельки
     */
    ipcMain.handle(
        IPC_CHANNELS.GET_WALLETS,
        async (_event: IpcMainInvokeEvent): Promise<Wallet[]> => {
            try {
                return await walletRepo.getAll();
            } catch (error) {
                console.error('Ошибка при загрузке кошельков:', error);

                // Возвращаем пустой массив в случае ошибки
                // Можно также пробросить ошибку дальше
                return [];
            }
        }
    );

    /**
     * Добавить кошелек
     */
    ipcMain.handle(
        IPC_CHANNELS.ADD_WALLET,
        async (_event: IpcMainInvokeEvent, wallet: Wallet): Promise<void> => {
            try {
                await walletRepo.add(wallet);
            } catch (error) {
                if (error instanceof ValidationError) {
                    console.error('Ошибка валидации кошелька:', error.message);
                    throw new Error(`Ошибка валидации: ${error.message}`);
                }
                if (error instanceof WalletError) {
                    console.error('Ошибка при добавлении кошелька:', error.message);
                    throw new Error(`Не удалось добавить кошелек: ${error.message}`);
                }
                console.error('Неизвестная ошибка при добавлении кошелька:', error);
                throw error;
            }
        }
    );

    /**
     * Удалить кошелек
     */
    ipcMain.handle(
        IPC_CHANNELS.DELETE_WALLET,
        async (_event: IpcMainInvokeEvent, publicKey: string): Promise<void> => {
            try {
                const deleted = await walletRepo.delete(publicKey);

                if (!deleted) {
                    console.warn(`Кошелек с publicKey ${publicKey} не найден`);
                }
            } catch (error) {
                console.error('Ошибка при удалении кошелька:', error);
                throw error;
            }
        }
    );
}