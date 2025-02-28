function initializeWindowHandlers(ipcMain, mainWindow) {
    ipcMain.handle("minimizeWindow", () => mainWindow.minimize());
    ipcMain.handle("closeWindow", () => mainWindow.close());
}

module.exports = { initializeWindowHandlers };
