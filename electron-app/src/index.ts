import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from "fs";
console.log('📝 [INDEX] Module start loading...');

const config = {
  port: process.env.PORT || 3000,
};

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  console.log('🪟 [INDEX] Creating main window...');

  const preloadPath = path.join(__dirname, 'preload.js');
  console.log(`📄 [INDEX] Preload path: ${preloadPath}`);

  if (fs.existsSync(preloadPath)) {
    console.log('✅ [INDEX] Preload file EXISTS');
  } else {
    console.error('❌ [INDEX] Preload file NOT FOUND!');
    console.log('📁 [INDEX] Files in __dirname:', fs.readdirSync(__dirname));
  }

  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
      autoHideMenuBar: true,
      frame: false,
      show: false,
    });

    console.log('✅ [INDEX] BrowserWindow created');

    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error('❌❌❌ [INDEX] PRELOAD ERROR!');
      console.error('Preload path:', preloadPath);
      console.error('Error:', error);
      console.error('Error stack:', error.stack);
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelName = ['verbose', 'info', 'warning', 'error'][level] || 'log';
      console.log(`[RENDERER ${levelName}] ${message} (${sourceId}:${line})`);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ [INDEX] Failed to load:', validatedURL);
      console.error('Error code:', errorCode);
      console.error('Description:', errorDescription);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ [INDEX] Page finished loading');
      mainWindow?.show();
    });

    mainWindow.webContents.on('dom-ready', () => {
      console.log('✅ [INDEX] DOM ready');
    });

    const url = process.env.NODE_ENV === 'production'
        ? `file://${path.join(app.getAppPath(), 'react-app', 'build', 'index.html')}`
        : `http://localhost:${config.port}`;

    console.log(`🌐 [INDEX] Loading URL: ${url}`);
    mainWindow.loadURL(url);

    console.log('✅ [INDEX] Window created successfully');
  } catch (error) {
    console.error('❌ [INDEX] Error creating window:', error);
    throw error;
  }
}

app.whenReady().then(async () => {
  console.log('✅ [INDEX] App is ready!');

  try {
    console.log('📝 [INDEX] Step 1: Creating window...');
    createWindow();

    console.log('📝 [INDEX] Step 2: Loading logger...');
    const loggerModule = await import('./services/loggerService');
    const logger = loggerModule.default;
    console.log('✅ [INDEX] Logger loaded');

    console.log('📝 [INDEX] Step 3: Initializing EventBus listeners...');
    logger.initializeEventBusListeners();
    logger.success(logger.LOG_MODULES.SYSTEM, 'EventBus интеграция инициализирована');
    console.log('✅ [INDEX] EventBus initialized');

    console.log('📝 [INDEX] Step 4: Loading handlers...');
    const { initializeProcessHandlers } = await import('./ipcHandlers/processHandler');
    const { initializeWindowHandlers } = await import('./ipcHandlers/windowHandler');
    const { initializeWalletHandlers } = await import('./ipcHandlers/walletHandler');
    const { initializeConfigHandlers } = await import('./ipcHandlers/configHandler');
    const { initializeApiHandlers } = await import('./ipcHandlers/tensorApiHandler');
    const { initializeTelegramHandlers } = await import('./ipcHandlers/telegramHandler');
    const { initializeSettingsHandlers } = await import('./ipcHandlers/settingsHandler');
    if (mainWindow) {
      console.log('  - Initializing process handlers...');
      initializeProcessHandlers(ipcMain, mainWindow);
      console.log('  - Initializing window handlers...');
      initializeWindowHandlers(ipcMain, mainWindow);
    }

    console.log('  - Initializing wallet handlers...');
    initializeWalletHandlers(ipcMain);
    console.log('  - Initializing config handlers...');
    initializeConfigHandlers(ipcMain);
    console.log('  - Initializing API handlers...');
    initializeApiHandlers(ipcMain);
    console.log('  - Initializing telegram handlers...');
    initializeTelegramHandlers(ipcMain);
    console.log('  - Initializing settings handlers...');
    initializeSettingsHandlers(ipcMain);

    console.log('✅ [INDEX] All handlers initialized');

    console.log('📝 [INDEX] Step 6: Creating Express API server...');
    const { createApiServer } = await import('./api/api-server');
    console.log('  - createApiServer function loaded');
    console.log('  - Starting server with mainWindow:', !!mainWindow);

    const server = createApiServer(mainWindow);
    console.log('✅ [INDEX] Express API server created:', !!server);

    console.log('📝 [INDEX] Step 7: Loading Telegram client...');
    console.log('✅ [INDEX] Telegram client loaded');

    console.log('✅✅✅ [INDEX] ALL INITIALIZATION COMPLETED SUCCESSFULLY ✅✅✅');
  } catch (error) {
    console.error('❌❌❌ [INDEX] CRITICAL ERROR during initialization:', error);
    console.error('Stack:', (error as Error).stack);

    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        alert('Critical initialization error: ${(error as Error).message}. Check console logs.');
      `);
    }
  }
});

app.on('window-all-closed', () => {
  console.log('🚪 [INDEX] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('🔄 [INDEX] App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('📝 [INDEX] Module loaded, waiting for app.whenReady()...');