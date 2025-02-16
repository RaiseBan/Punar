const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
const processes = {}; // Храним child_process по taskId

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(
      app.isPackaged
          ? `file://${path.join(app.getAppPath(), "react-app", "build", "index.html")}`
          : "http://localhost:3000"
  );
}

app.whenReady().then(() => {
  createWindow();
});

// Запуск нового процесса
ipcMain.on("start-process", (event, taskConfig) => {
  const taskId = Date.now();
  console.log(`Создан taskId: ${taskId}, запускаем процесс...`);

  // Сразу говорим рендеру "process-started"
  event.reply("process-started", { taskId, config: taskConfig });

  const child = spawn("node", ["your_script.js", JSON.stringify(taskConfig)]);
  processes[taskId] = child;

  child.stdout.on("data", (data) => {
    console.log(`STDOUT [Task ${taskId}]:`, data.toString());
    mainWindow?.webContents.send("process-output", { taskId, log: data.toString() });
  });

  child.stderr.on("data", (data) => {
    console.error(`STDERR [Task ${taskId}]:`, data.toString());
  });

  child.on("exit", (code) => {
    console.log(`Процесс Task ${taskId} завершился с кодом ${code}`);
    mainWindow?.webContents.send("process-exit", { taskId, code });
  });
});

// Остановка процесса
ipcMain.on("stop-process", (event, taskId) => {
  const child = processes[taskId];
  if (child && !child.killed) {
    child.kill();
    console.log(`Процесс ${taskId} остановлен`);
  }
});

// Возобновление процесса
ipcMain.on("resume-process", (event, { taskId, config }) => {
  console.log(`Resume-process: Task ${taskId}, config:`, config);

  // Считаем, что создаём новый child-процесс под тем же taskId
  // Можно заново послать process-started, чтобы фронт понимал
  event.reply("process-started", { taskId, config });

  const child = spawn("node", ["your_script.js", JSON.stringify(config)]);
  processes[taskId] = child;

  child.stdout.on("data", (data) => {
    console.log(`STDOUT [Task ${taskId}]:`, data.toString());
    mainWindow?.webContents.send("process-output", { taskId, log: data.toString() });
  });

  child.stderr.on("data", (data) => {
    console.error(`STDERR [Task ${taskId}]:`, data.toString());
  });

  child.on("exit", (code) => {
    console.log(`Процесс Task ${taskId} (resume) завершился с кодом ${code}`);
    mainWindow?.webContents.send("process-exit", { taskId, code });
  });
});
