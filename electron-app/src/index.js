const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { initializeProcessHandlers } = require("./ipcHandlers/processHandler");
const { initializeWalletHandlers } = require("./ipcHandlers/walletHandler");
const { initializeConfigHandlers } = require("./ipcHandlers/configHandler");
const { initializeWindowHandlers } = require("./ipcHandlers/windowHandler");
const { initializeApiHandlers } = require("./ipcHandlers/tensorApiHandler");
const { spawnProcess, stopMevProcess } = require("./utils/spawnProcess");
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

// Добавляем асинхронную обработку событий для Telegram
app.whenReady().then(() => {
  createWindow();
  initializeProcessHandlers(ipcMain, mainWindow);
  initializeWalletHandlers(ipcMain);
  initializeConfigHandlers(ipcMain);
  initializeWindowHandlers(ipcMain, mainWindow);
  initializeApiHandlers(ipcMain);

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
