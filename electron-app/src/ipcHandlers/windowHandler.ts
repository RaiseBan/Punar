import { IpcMain, BrowserWindow } from 'electron';

/**
 * Инициализирует IPC handlers для управления окном
 */
export function initializeWindowHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    /**
     * Минимизация окна
     */
    ipcMain.handle('minimizeWindow', (): void => {
        mainWindow.minimize();
    });

    /**
     * Закрытие окна
     */
    ipcMain.handle('closeWindow', (): void => {
        mainWindow.close();
    });
}