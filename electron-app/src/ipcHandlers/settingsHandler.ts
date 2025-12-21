import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/types';
import { getConfigRepository } from '../repositories';

/**
 * Инициализация handlers для работы с настройками
 */
export function initializeSettingsHandlers(ipcMain: IpcMain): void {
    const configRepo = getConfigRepository();

    /**
     * Получить настройки
     */
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async (_event: IpcMainInvokeEvent) => {
        try {
            return await configRepo.getSettings();
        } catch (error) {
            console.error('Ошибка при получении настроек:', error);
            // Возвращаем пустой объект в случае ошибки
            return {};
        }
    });

    /**
     * Сохранить настройки
     */
    ipcMain.handle(
        IPC_CHANNELS.SAVE_SETTINGS,
        async (_event: IpcMainInvokeEvent, settings: any) => {
            try {
                await configRepo.saveSettings(settings);
            } catch (error) {
                console.error('Ошибка при сохранении настроек:', error);
                throw error;
            }
        }
    );
}