import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";

// Добавляем глобальную обработку ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
});

console.log('🚀 [INDEX] Starting electron app...');
console.log(`[INDEX] Node version: ${process.version}`);
console.log(`[INDEX] Platform: ${process.platform}`);

interface PoolChangeNotification {
  taskId: string;
  oldPool?: string;
  newPool?: string;
  tokenAddress?: string;
}

export let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  console.log('🪟 [INDEX] Creating main window...');
  console.log(`📂 [INDEX] __dirname = ${__dirname}`);

  const preloadPath = path.join(__dirname, "preload.js");
  console.log(`📄 [INDEX] Preload path = ${preloadPath}`);

  // Проверяем существует ли файл
  const fs = require('fs');
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
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: {
        webSecurity: false,
        preload: path.join(__dirname, "preload.js"),
        // @ts-ignore
        overlayScrollbars: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
      roundedCorners: true,
    });

    if (process.platform === "win32") {
      mainWindow.setBackgroundColor("#00000000");
    }

    mainWindow.setMenuBarVisibility(false);

    console.log('🔗 [INDEX] Loading URL...');
    // Попробуем импортировать config здесь
    let config: any;
    try {
      config = require('./config/config').default;
      console.log(`✅ [INDEX] Config loaded, port: ${config.port}`);
    } catch (e) {
      console.error('❌ [INDEX] Failed to load config:', e);
      config = { port: 3000 };
    }

    mainWindow.loadURL(
        app.isPackaged
            ? `file://${path.join(app.getAppPath(), "react-app", "build", "index.html")}`
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
    let logger: any;
    try {
      logger = require('./services/loggerService').default;
      console.log('✅ [INDEX] Logger loaded');
    } catch (e) {
      console.error('❌ [INDEX] Failed to load logger:', e);
      throw e;
    }

    console.log('📝 [INDEX] Step 3: Initializing EventBus listeners...');
    try {
      logger.initializeEventBusListeners();
      logger.success(logger.LOG_MODULES.SYSTEM, 'EventBus интеграция инициализирована');
      console.log('✅ [INDEX] EventBus initialized');
    } catch (e) {
      console.error('❌ [INDEX] Failed to initialize EventBus:', e);
      throw e;
    }

    console.log('📝 [INDEX] Step 4: Loading handlers...');
    try {
      const { initializeProcessHandlers } = require('./ipcHandlers/processHandler');
      const { initializeWindowHandlers } = require('./ipcHandlers/windowHandler');
      const { initializeWalletHandlers } = require('./ipcHandlers/walletHandler');
      const { initializeConfigHandlers } = require('./ipcHandlers/configHandler');
      const { initializeApiHandlers } = require('./ipcHandlers/tensorApiHandler');

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

      console.log('✅ [INDEX] All handlers initialized');
    } catch (e) {
      console.error('❌ [INDEX] Failed to initialize handlers:', e);
      throw e;
    }

    console.log('📝 [INDEX] Step 5: Loading MEV Load Balancer...');
    let mevLoadBalancer: any;
    try {
      mevLoadBalancer = require('./services/mevLoadBalancer/mevLoadBalancer').default;
      console.log('✅ [INDEX] MEV Load Balancer loaded');
    } catch (e) {
      console.error('❌ [INDEX] Failed to load MEV Load Balancer:', e);
      console.error('Stack:', e.stack);
      throw e;
    }

    console.log('📝 [INDEX] Step 6: Creating Express API server...');
    try {
      const { createApiServer } = require('./api/api-server');
      console.log('  - createApiServer function loaded');
      console.log('  - Starting server with mainWindow:', !!mainWindow);
      console.log('  - Starting server with mevLoadBalancer:', !!mevLoadBalancer);

      const server = createApiServer(mainWindow, mevLoadBalancer);
      console.log('✅ [INDEX] Express API server created:', !!server);
    } catch (e) {
      console.error('❌ [INDEX] Failed to create API server:', e);
      console.error('Stack:', e.stack);
      // НЕ бросаем ошибку здесь, чтобы приложение продолжило работу
      logger.error(logger.LOG_MODULES.SYSTEM, 'Failed to start API server', e);
    }

    console.log('📝 [INDEX] Step 7: Loading Telegram client...');
    try {
      const { telegramClient } = require('./api/telegram-client');
      console.log('✅ [INDEX] Telegram client loaded');

      // Обработчик уведомлений о смене пула
      ipcMain.on('telegram-notify-pool-change', (event, data: PoolChangeNotification) => {
        try {
          telegramClient.sendPoolChangeNotification(data);
        } catch (e) {
          console.error('❌ [INDEX] Error sending pool change notification:', e);
        }
      });
      console.log('✅ [INDEX] Telegram pool change handler registered');
    } catch (e) {
      console.error('❌ [INDEX] Failed to load Telegram client:', e);
      // НЕ бросаем ошибку, Telegram не критичен
      logger.warn(logger.LOG_MODULES.SYSTEM, 'Telegram client unavailable', e);
    }

    console.log('✅✅✅ [INDEX] ALL INITIALIZATION COMPLETED SUCCESSFULLY ✅✅✅');

  } catch (error) {
    console.error('❌❌❌ [INDEX] CRITICAL ERROR during initialization:', error);
    console.error('Stack:', error.stack);
    // Показываем диалог с ошибкой
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        alert('Critical initialization error: ${error.message}. Check console logs.');
      `);
    }
  }
}).catch(error => {
  console.error('❌ [INDEX] Error in whenReady promise:', error);
  console.error('Stack:', error.stack);
});

app.on("window-all-closed", () => {
  console.log('🚪 [INDEX] All windows closed');
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  console.log('🔄 [INDEX] App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('📝 [INDEX] Module loaded, waiting for app.whenReady()...');