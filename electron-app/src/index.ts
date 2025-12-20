import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

console.log('📝 [INDEX] Module start loading...');

const config = {
  port: process.env.PORT || 3000,
};

let mainWindow: BrowserWindow | null = null;

/**
 * Интерфейс для уведомления о смене пула
 */
interface PoolChangeNotification {
  taskId: string;
  oldPool?: string;
  newPool?: string;
  tokenAddress?: string;
}

/**
 * Создает главное окно приложения
 */
function createWindow(): void {
  console.log('🪟 [INDEX] createWindow called');

  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      autoHideMenuBar: true,
      frame: false,
    });

    console.log('✅ [INDEX] BrowserWindow created');

    mainWindow.loadURL(
        process.env.NODE_ENV === 'production'
            ? `file://${path.join(app.getAppPath(), 'react-app', 'build', 'index.html')}`
            : `http://localhost:${config.port}`
    );

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
    const { getSettings, saveSettings } = await import('./utils/fsHelper');

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

    // Settings handlers - используем существующие функции из fsHelper
    console.log('  - Initializing settings handlers...');
    ipcMain.handle('get-settings', async () => {
      return getSettings();
    });

    ipcMain.handle('save-settings', async (_event, settings) => {
      await saveSettings(settings);
    });

    console.log('✅ [INDEX] All handlers initialized');

    console.log('📝 [INDEX] Step 5: Loading MEV Load Balancer...');
    const mevLoadBalancerModule = await import('./services/mevLoadBalancer/mevLoadBalancer');
    const mevLoadBalancer = mevLoadBalancerModule.default;
    console.log('✅ [INDEX] MEV Load Balancer loaded');

    console.log('📝 [INDEX] Step 6: Creating Express API server...');
    const { createApiServer } = await import('./api/api-server');
    console.log('  - createApiServer function loaded');
    console.log('  - Starting server with mainWindow:', !!mainWindow);
    console.log('  - Starting server with mevLoadBalancer:', !!mevLoadBalancer);

    const server = createApiServer(mainWindow, mevLoadBalancer);
    console.log('✅ [INDEX] Express API server created:', !!server);

    console.log('📝 [INDEX] Step 7: Loading Telegram client...');
    const { telegramClient } = await import('./api/telegram-client');
    console.log('✅ [INDEX] Telegram client loaded');

    // Обработчик уведомлений о смене пула
    ipcMain.on('telegram-notify-pool-change', (_event, data: PoolChangeNotification) => {
      try {
        telegramClient.sendPoolChangeNotification(data);
      } catch (e) {
        console.error('❌ [INDEX] Error sending pool change notification:', e);
      }
    });
    console.log('✅ [INDEX] Telegram pool change handler registered');

    console.log('✅✅✅ [INDEX] ALL INITIALIZATION COMPLETED SUCCESSFULLY ✅✅✅');
  } catch (error) {
    console.error('❌❌❌ [INDEX] CRITICAL ERROR during initialization:', error);
    console.error('Stack:', (error as Error).stack);

    // Показываем диалог с ошибкой
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