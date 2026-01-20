import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, AppSettings } from '../../../shared/types';
import { getConfigRepository } from '../repositories';

export function initializeSettingsHandlers(ipcMain: IpcMain): void {
    const configRepo = getConfigRepository();

    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
        try {
            return await configRepo.getSettings();
        } catch (error) {
            console.error('Ошибка при получении настроек:', error);
            return {};
        }
    });

    ipcMain.handle(
        IPC_CHANNELS.SAVE_SETTINGS,
        async (_event: IpcMainInvokeEvent, settings: AppSettings) => {
            try {
                await configRepo.saveSettings(settings);
            } catch (error) {
                console.error('Ошибка при сохранении настроек:', error);
                throw error;
            }
        }
    );
}