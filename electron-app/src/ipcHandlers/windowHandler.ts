import { IpcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../../shared/types';

export function initializeWindowHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, (): void => {
        mainWindow.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, (): void => {
        mainWindow.close();
    });
}