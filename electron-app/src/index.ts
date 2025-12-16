import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { initializeProcessHandlers } from "./ipcHandlers/processHandler";
import { initializeWalletHandlers } from "./ipcHandlers/walletHandler";
import { initializeConfigHandlers } from "./ipcHandlers/configHandler";
import { initializeWindowHandlers } from "./ipcHandlers/windowHandler";
import { initializeApiHandlers } from "./ipcHandlers/tensorApiHandler";
import mevLoadBalancer from './services/mevLoadBalancer/mevLoadBalancer';
import logger from './services/loggerService';
import config from './config/config';
import { createApiServer } from './api/api-server';
import { telegramClient } from './api/telegram-client';

interface PoolChangeNotification {
  taskId: string;
  oldPool?: string;
  newPool?: string;
  tokenAddress?: string;
}

export let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
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
  mainWindow.loadURL(
    app.isPackaged
      ? `file://${path.join(app.getAppPath(), "react-app", "build", "index.html")}`
      : `http://localhost:${config.port}`
  );
}

app.whenReady().then(() => {
  console.log(123);
  createWindow();

  logger.initializeEventBusListeners();
  logger.success(logger.LOG_MODULES.SYSTEM, 'EventBus интеграция инициализирована');

  if (mainWindow) {
    initializeProcessHandlers(ipcMain, mainWindow);
    initializeWindowHandlers(ipcMain, mainWindow);
  }

  initializeWalletHandlers(ipcMain);
  initializeConfigHandlers(ipcMain);
  initializeApiHandlers(ipcMain);

  // Запускаем Express API сервер
  console.log("11111111");
  createApiServer(mainWindow, mevLoadBalancer);

  // Обработчик уведомлений о смене пула
  ipcMain.on('telegram-notify-pool-change', (event, data: PoolChangeNotification) => {
    telegramClient.sendPoolChangeNotification(data);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});