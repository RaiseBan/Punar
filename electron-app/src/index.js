//index.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { spawnProcess } = require("./utils/spawnProcess");
const { getGlobalConfigDirectory, ensureConfigDirectory} = require("./utils/wallet");
const fs = require("fs");
const treeKill = require("tree-kill"); // Установи: npm install tree-kill
const fsSync = require('fs');
const fsProm = require('fs').promises;


let mainWindow;
const processes = {}; // Храним child_process по taskId
let scriptDirectory = "";  // Храним путь к директории проектов

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true, // Добавить прозрачность
    backgroundColor: '#00000000', // Прозрачный фон
    webPreferences: {
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      overlayScrollbars: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
    roundedCorners: true,

  });
  if (process.platform === 'win32') {
    mainWindow.setBackgroundColor('#00000000');
  }

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(
      app.isPackaged
          ? `file://${path.join(app.getAppPath(), "react-app", "build", "index.html")}`
          : "http://localhost:3000"
  );

}

ipcMain.handle('minimizeWindow', () => {
  mainWindow.minimize();
});

ipcMain.handle('closeWindow', () => {
  mainWindow.close();
});

// Получение настроек
function getSettings(){ // можно будет потом отрефакторить код и сделать какой-то Type (кароче удобно)
  const settingsDir = getGlobalConfigDirectory();
  const settingsFilePath = path.join(settingsDir, 'userSettings.json');

  if (!fs.existsSync(settingsFilePath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(settingsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading settings:', error);
    return {};
  }
}

ipcMain.handle("get-settings", async () => {
  return getSettings();
});

// Сохранение настроек
ipcMain.handle("save-settings", (_, settings) => {
  const settingsDir = getGlobalConfigDirectory();
  const settingsFilePath = path.join(settingsDir, 'userSettings.json');

  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});




app.commandLine.appendSwitch("ignore-certificate-errors");
app.whenReady().then(() => {
  createWindow();

});


// Запуск нового процесса
ipcMain.on("start-process", (event, {taskId, config}) => {
  // const taskId = Date.now();
  console.log(`Создан taskId: ${taskId}, запускаем процесс...`);
  console.log(`taskConfig: ${JSON.stringify(config, null, 2)}`);
  // Сразу говорим рендеру "process-started"
  event.reply("process-started", { taskId, config: config });

  const scriptPath = getSettings();
  // Передаем путь к проекту и конфиг в spawnProcess
  const child = spawnProcess(config, scriptPath.scriptDirectory);
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
    child.stdin.write("terminate-workers\n");

    setTimeout(() => {
      if (!child.killed) {
        treeKill(child.pid, "SIGKILL", (err) => {
          if (err) {
            console.error(`Ошибка при завершении процесса ${taskId}:`, err);
          } else {
            console.log(`Процесс ${taskId} и все его дочерние процессы убиты`);
          }
        });
      }
    }, 1000);
  }
});




// Возобновление процесса
ipcMain.on("resume-process", (event, { taskId, config }) => {
  console.log(`Resume-process: Task ${taskId}, config:`, config);

  event.reply("process-started", { taskId, config });
  const scriptPath = getSettings();
  const child = spawnProcess(config, scriptPath.scriptDirectory);
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









// Добавить обработчики IPC
ipcMain.handle('save-config', async (_, configType, fileName, content) => {
  try {
    const baseDir = await ensureConfigDirectory();
    const configDir = path.join(baseDir, configType);

    if (!fsSync.existsSync(configDir)) {
      await fsProm.mkdir(configDir, { recursive: true });
    }

    const filePath = path.join(configDir, `${fileName}.json`);
    await fsProm.writeFile(filePath, JSON.stringify(content, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
});

ipcMain.handle('get-configs', async (_, configType) => {
  try {
    const baseDir = await ensureConfigDirectory();
    const configDir = path.join(baseDir, configType);

    if (!fsSync.existsSync(configDir)) {
      return [];
    }

    const files = await fsProm.readdir(configDir);
    return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace(/\.json$/, ''));
  } catch (error) {
    console.error('Error reading configs:', error);
    return [];
  }
});

ipcMain.handle('get-config', async (_, configType, fileName) => {
  try {
    const baseDir = await ensureConfigDirectory();
    const filePath = path.join(baseDir, configType, `${fileName}.json`);

    const data = await fsProm.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
});

ipcMain.handle('delete-config', async (_, configType, fileName) => {
  try {
    const baseDir = await ensureConfigDirectory();
    const filePath = path.join(baseDir, configType, `${fileName}.json`);

    await fsProm.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting config:', error);
    return false;
  }
});


ipcMain.handle('get-config-paths', async (_, configType) => {
  try {
    const baseDir = await ensureConfigDirectory();
    const configDir = path.join(baseDir, configType);

    if (!fsSync.existsSync(configDir)) {
      return [];
    }

    const files = await fsProm.readdir(configDir);
    return files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file.replace(/\.json$/, ''), // Оставляем только имя без `.json`
          path: path.join(configDir, file),  // Абсолютный путь к файлу
        }));
  } catch (error) {
    console.error('Error getting config paths:', error);
    return [];
  }
});




