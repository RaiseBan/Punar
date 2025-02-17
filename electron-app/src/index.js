const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { spawnProcess } = require("./utils/spawnProcess");
const { getGlobalConfigDirectory } = require("./utils/wallet");
const fs = require("fs");

let mainWindow;
const processes = {}; // Храним child_process по taskId
let scriptDirectory = "";  // Храним путь к директории проектов

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

// Сохранение пути к директории
ipcMain.on("save-script-directory", (event, directory) => {
  scriptDirectory = directory;
  console.log(`Сохранен путь к директории: ${scriptDirectory}`);
});

app.whenReady().then(() => {
  createWindow();
});

// Запуск нового процесса
ipcMain.on("start-process", (event, {taskId, config}) => {
  // const taskId = Date.now();
  console.log(`Создан taskId: ${taskId}, запускаем процесс...`);
  console.log(`taskConfig: ${JSON.stringify(config)}`);
  // Сразу говорим рендеру "process-started"
  event.reply("process-started", { taskId, config: config });


  // Передаем путь к проекту и конфиг в spawnProcess
  const child = spawnProcess(config, scriptDirectory);
  // const child = spawn("node", ["your_script.js", scriptDirectory]);
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

  event.reply("process-started", { taskId, config });

  const child = spawnProcess(config, scriptDirectory);
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


ipcMain.handle('getWallets', async () => {
  try {
    const configDir = getGlobalConfigDirectory();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true }); // Создаем директорию, если она не существует
    }

    const walletsFilePath = path.join(configDir, "wallets.json");

    // Проверяем, существует ли файл
    if (!fs.existsSync(walletsFilePath)) {
      // Если файла нет, создаем его с пустым массивом
      fs.writeFileSync(walletsFilePath, JSON.stringify([]));
      return []; // Отправляем пустой массив
    }

    // Чтение данных из файла
    const data = fs.readFileSync(walletsFilePath, 'utf-8');
    const wallets = JSON.parse(data);

    // Если файл пустой, отправляем информацию, что кошельков нет
    if (wallets.length === 0) {
      return { message: 'No wallets available, please create one.' };
    }

    return wallets; // Возвращаем массив кошельков
  } catch (error) {
    console.error('Ошибка при загрузке кошельков:', error);
    return { message: 'Error loading wallets.' }; // Возвращаем ошибку в случае проблем
  }
});

// Добавление нового кошелька в файл
ipcMain.handle('addWallet', async (event, wallet) => {
  try {
    const configDir = getGlobalConfigDirectory();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    let wallets = [];
    try {


      const data = fs.readFileSync(path.join(configDir, "wallets.json"), 'utf-8');
      wallets = JSON.parse(data);
    } catch (error) {
      // Если файл не существует, начинаем с пустого массива
      console.log('Создание нового файла кошельков');
    }

    wallets.push(wallet);
    fs.writeFileSync(path.join(configDir, "wallets.json"), JSON.stringify(wallets, null, 2));
  } catch (error) {
    console.error('Ошибка при сохранении кошелька:', error);
  }
});


// Удаление кошелька
ipcMain.handle('deleteWallet', async (event, publicKey) => {
  try {
    const configDir = getGlobalConfigDirectory();
    const walletsFilePath = path.join(configDir, "wallets.json");

    if (!fs.existsSync(walletsFilePath)) {
      return;
    }

    const data = fs.readFileSync(walletsFilePath, 'utf-8');
    let wallets = JSON.parse(data);
    wallets = wallets.filter(wallet => wallet.publicKey !== publicKey);

    fs.writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
  } catch (error) {
    console.error('Ошибка при удалении кошелька:', error);
  }
});
