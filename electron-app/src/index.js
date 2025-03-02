const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { initializeProcessHandlers } = require("./ipcHandlers/processHandler");
const { initializeWalletHandlers } = require("./ipcHandlers/walletHandler");
const { initializeConfigHandlers } = require("./ipcHandlers/configHandler");
const { initializeWindowHandlers } = require("./ipcHandlers/windowHandler");
const {initializeApiHandlers} = require("./ipcHandlers/tensorApiHandler");

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
});

app.commandLine.appendSwitch("ignore-certificate-errors");
