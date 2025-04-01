const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { initializeProcessHandlers } = require("./ipcHandlers/processHandler");
const { initializeWalletHandlers } = require("./ipcHandlers/walletHandler");
const { initializeConfigHandlers } = require("./ipcHandlers/configHandler");
const { initializeWindowHandlers } = require("./ipcHandlers/windowHandler");
const { initializeApiHandlers } = require("./ipcHandlers/tensorApiHandler");

const telegramBotService = require('./services/telegramBotService');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
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
      : "http://localhost:3000"
  );
}

// Настройка обработчиков IPC
app.whenReady().then(() => {
  createWindow();
  initializeProcessHandlers(ipcMain, mainWindow);
  initializeWalletHandlers(ipcMain);
  initializeConfigHandlers(ipcMain);
  initializeWindowHandlers(ipcMain, mainWindow);
  initializeApiHandlers(ipcMain);

  telegramBotService.onTaskRun(({ taskId, rowIndex, strategy, rowId }) => {
    console.log(`Sending run task to renderer: taskId=${taskId}, rowIndex=${rowIndex}, strategy=${strategy}, rowId=${rowId || 'undefined'}`);
    mainWindow.webContents.send('telegram-bot:run-task', { taskId, rowIndex, strategy, rowId });
  });

  telegramBotService.onTaskDelete(({ taskId, rowIndex, rowId }) => {
    console.log(`Sending delete task to renderer: taskId=${taskId}, rowIndex=${rowIndex}, rowId=${rowId || 'undefined'}`);
    if (rowIndex !== undefined || rowId) {
      mainWindow.webContents.send('telegram-bot:delete-task', { taskId, rowIndex, rowId });
    } else {
      console.error('rowIndex and rowId are undefined, not sending delete task event');
    }
  });

  telegramBotService.onTaskStop(({ taskId }) => {
    console.log(`Sending stop task to renderer: taskId=${taskId}`);
    mainWindow.webContents.send('telegram-bot:stop-task', { taskId });
  });

  // Добавить обработчик для задач Telegram
  ipcMain.handle('telegram-tasks-response', (event, tasks) => {
    return tasks;
  });
});

app.commandLine.appendSwitch("ignore-certificate-errors");

// Добавляем обработчик получения списка задач
ipcMain.handle('get-active-tasks', (event) => {
  // Получаем активные задачи из рендерера
  return mainWindow.webContents.executeJavaScript('window.store.getState().tasks.tasks');
});
