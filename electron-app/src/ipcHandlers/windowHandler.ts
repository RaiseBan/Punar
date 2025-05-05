import { IpcMain, BrowserWindow } from 'electron';

function initializeWindowHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    ipcMain.handle("minimizeWindow", () => mainWindow.minimize());
    ipcMain.handle("closeWindow", () => mainWindow.close());
}

export { initializeWindowHandlers };