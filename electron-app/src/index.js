const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { initializeProcessHandlers } = require("./ipcHandlers/processHandler");
const { initializeWalletHandlers } = require("./ipcHandlers/walletHandler");
const { initializeConfigHandlers } = require("./ipcHandlers/configHandler");
const { initializeWindowHandlers } = require("./ipcHandlers/windowHandler");
const { initializeApiHandlers } = require("./ipcHandlers/tensorApiHandler");
const { spawnProcess, stopMevProcess } = require("./utils/spawnProcess");
const telegramBotService = require('./services/telegramBotService');
const mevLoadBalancer = require('./services/mevLoadBalancer');

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
      : "http://localhost:3001"
  );
}

// Добавляем асинхронную обработку событий для Telegram
app.whenReady().then(() => {
  createWindow();
  initializeProcessHandlers(ipcMain, mainWindow);
  initializeWalletHandlers(ipcMain);
  initializeConfigHandlers(ipcMain);
  initializeWindowHandlers(ipcMain, mainWindow);
  initializeApiHandlers(ipcMain);

  // Инициализируем команды MEV для Telegram бота
  telegramBotService.initMevCommands(mevLoadBalancer);

  // Регистрируем обработчик события telegram-notify-pool-change после создания телеграм-бота
  // (после строки с initializeApiHandlers)

  // Добавляем обработчик для отправки уведомлений о смене пула Meteora
  ipcMain.on('telegram-notify-pool-change', (event, { taskId, oldPool, newPool, tokenAddress }) => {
    try {
      console.log(`Получено уведомление о смене пула для задачи ${taskId}`);

      // Передаем запрос на отправку уведомления в telegramBotService
      if (telegramBotService && typeof telegramBotService.sendSystemNotification === 'function') {
        // Формируем подробное сообщение о смене пула
        const poolChangeMessage = `🔄 Обнаружена смена пула Meteora\n\n` +
          `Задача ID: ${taskId}\n` +
          `Токен: ${tokenAddress || 'не указан'}\n` +
          `Старый пул: ${oldPool || 'не указан'}\n` +
          `Новый пул: ${newPool || 'не указан'}\n` +
          `Время: ${new Date().toISOString()}\n\n` +
          `Процесс будет перезапущен автоматически с новым пулом.`;

        // Отправляем уведомление
        telegramBotService.sendSystemNotification(poolChangeMessage)
          .then(() => {
            // После успешной отправки уведомления обновляем статус задачи
            if (typeof telegramBotService.sendTaskStatus === 'function') {
              telegramBotService.sendTaskStatus(taskId);
            }
          })
          .catch(error => {
            console.error(`Ошибка при отправке уведомления в Telegram:`, error);
          });
      } else {
        console.error(`telegramBotService не доступен или sendSystemNotification не является функцией`);
      }
    } catch (error) {
      console.error(`Ошибка при обработке уведомления о смене пула:`, error);
    }
  });

  // Используем асинхронные обработчики для Telegram-бота
  telegramBotService.onTaskRun(({ taskId, rowIndex, strategy, rowId }) => {
    console.log(`Sending run task to renderer: taskId=${taskId}, rowIndex=${rowIndex}, strategy=${strategy}, rowId=${rowId || 'undefined'}`);

    // Используем setImmediate для предотвращения блокировки основного потока
    setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telegram-bot:run-task', { taskId, rowIndex, strategy, rowId });
      }
    });
  });

  telegramBotService.onTaskDelete(({ taskId, rowIndex, rowId }) => {
    console.log(`Sending delete task to renderer: taskId=${taskId}, rowIndex=${rowIndex}, rowId=${rowId || 'undefined'}`);

    if (rowIndex !== undefined || rowId) {
      setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('telegram-bot:delete-task', { taskId, rowIndex, rowId });
        }
      });
    } else {
      console.error('rowIndex and rowId are undefined, not sending delete task event');
    }
  });

  telegramBotService.onTaskStop(({ taskId }) => {
    console.log(`Sending stop task to renderer: taskId=${taskId}`);

    setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telegram-bot:stop-task', { taskId });
      }
    });
  });

  // Добавляем обработчик для полного удаления задачи (остановка + удаление)
  telegramBotService.onTaskRemove(({ taskId }) => {
    console.log(`Sending remove task to renderer: taskId=${taskId}`);

    // Сначала останавливаем задачу
    setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telegram-bot:stop-task', { taskId });

        // Даем немного времени на остановку, а затем отправляем сигнал на удаление
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('telegram-bot:remove-task', { taskId });
          }
        }, 200);
      }
    });
  });

  // Регистрируем обработчик возобновления задач
  telegramBotService.onTaskResume(({ taskId }) => {
    console.log(`Sending resume task to renderer: taskId=${taskId}`);

    setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telegram-bot:resume-task', { taskId });
      }
    });
  });

  // Добавить обработчик для задач Telegram - делаем его асинхронным
  ipcMain.handle('telegram-tasks-response', async (event, tasks) => {
    return tasks;
  });
});

app.commandLine.appendSwitch("ignore-certificate-errors");

// Добавляем обработчик получения списка задач
ipcMain.handle('get-active-tasks', (event) => {
  // Получаем активные задачи из рендерера
  return mainWindow.webContents.executeJavaScript('window.store.getState().tasks.tasks');
});

// Добавляем обработчики команд для MEV LoadBalancer в телеграм бот
telegramBotService.registerCommand('mev_status', async (chatId, args) => {
  const status = mevLoadBalancer.getStatus();
  const statusText =
    `📊 Статус MEV LoadBalancer:\n\n` +
    `Активен: ${status.isActive ? '✅' : '❌'}\n` +
    `MEV процессов: ${status.processCount}\n` +
    `Обработано сигналов: ${status.stats.processedSignals}\n` +
    `Успешно: ${status.stats.successfulSignals}\n` +
    `С ошибками: ${status.stats.failedSignals}\n` +
    `Активных токенов: ${status.stats.activeTokens || 0}`;

  return telegramBotService.sendMessage(chatId, statusText);
});

telegramBotService.registerCommand('mev_start', async (chatId, args) => {
  const result = await mevLoadBalancer.start();

  const responseText = result.success
    ? `✅ MEV LoadBalancer успешно запущен`
    : `❌ Ошибка при запуске MEV LoadBalancer: ${result.error || 'неизвестная ошибка'}`;

  return telegramBotService.sendMessage(chatId, responseText);
});

telegramBotService.registerCommand('mev_stop', async (chatId, args) => {
  const result = await mevLoadBalancer.stop();

  const responseText = result.success
    ? `✅ MEV LoadBalancer успешно остановлен`
    : `❌ Ошибка при остановке MEV LoadBalancer: ${result.error || 'неизвестная ошибка'}`;

  return telegramBotService.sendMessage(chatId, responseText);
});

telegramBotService.registerCommand('mev_processes', async (chatId, args) => {
  const processes = mevLoadBalancer.getProcesses();

  if (!processes || processes.length === 0) {
    return telegramBotService.sendMessage(chatId, '📝 Нет активных MEV процессов');
  }

  let responseText = `📝 Активные MEV процессы (${processes.length}):\n\n`;

  processes.forEach((process, index) => {
    const config = process.config || {};
    const tokenSymbol = config.tokenSymbol || 'Неизвестный токен';
    const tokenAddress = config.tokenAddress || 'Нет адреса';
    const status = process.status || 'неизвестен';

    responseText += `${index + 1}. ID: ${process.id}\n` +
      `   Токен: ${tokenSymbol} (${tokenAddress.slice(0, 8)}...)\n` +
      `   Статус: ${status}\n` +
      `   Активность: ${new Date(process.lastActivity).toLocaleTimeString()}\n\n`;
  });

  return telegramBotService.sendMessage(chatId, responseText);
});

telegramBotService.registerCommand('mev_stop_process', async (chatId, args) => {
  if (!args || args.length === 0) {
    return telegramBotService.sendMessage(chatId, '❌ Ошибка: укажите ID процесса для остановки');
  }

  const processId = args[0];
  console.log()
  const result = await mevLoadBalancer.stopProcess(processId);

  const responseText = result.success
    ? `✅ MEV процесс ${processId} успешно остановлен`
    : `❌ Ошибка при остановке MEV процесса: ${result.error || 'неизвестная ошибка'}`;

  return telegramBotService.sendMessage(chatId, responseText);
});

// Добавляем обработчики IPC для интеграции с renderer process
ipcMain.handle('mev-loadbalancer:get-status', async () => {
  return mevLoadBalancer.getStatus();
});

ipcMain.handle('mev-loadbalancer:get-processes', async () => {
  return mevLoadBalancer.getProcesses();
});

// Регистрация команды /mev_help
telegramBotService.registerCommand('mev_help', (chatId) => {
  // Вызываем стандартную команду help
  const helpMessage = { text: '/help' };
  telegramBotService.handleIncomingMessage(chatId, helpMessage);
});

// Тестирование обработки сигнала MEV при запуске приложения
// Раскомментируйте этот блок кода для тестирования
/*
setTimeout(() => {
  console.log("Тестирование обработки сигнала MEV...");
  const testSignal = "[2025-04-05T14:36:24.872Z] [INFO] [PERFORM_MEV_ACTION] 8BtoThi2ZoXnF7QQK1Wjmh2JuBw9FjVvhnGMVZ2vpump | 4LEue1KFSHaWGarDR8hy5VG8MFXhiuWgvvHAQXceepAJ | ExtraPoolAddress12345678 [END]";
  mevLoadBalancer.testProcessSignal(testSignal);
}, 3000);
*/

