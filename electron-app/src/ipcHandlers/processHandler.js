const { spawn } = require("child_process");
const treeKill = require("tree-kill");
const { getSettings } = require("../utils/fsHelper");
const { spawnProcess, stopMevProcess, forceKillWindowsProcess } = require("../utils/spawnProcess");
const telegramBotService = require("../services/telegramBotService");
const mevLoadBalancer = require("../services/mevLoadBalancer");
const fs = require("fs");
const path = require("path");
const { app, shell } = require("electron");

// Карта для отслеживания процессов
const processes = {};

// Константы для конфигурации логирования
const MAX_LOGS_IN_MEMORY = 1000; // Максимальное количество логов для одной задачи в памяти
const LOG_BATCH_SIZE = 50;             // Сколько логов обрабатывать за раз
const LOG_UPDATE_INTERVAL = 500; // Интервал обновления UI логов (мс)
const LOG_FILE_DIR = path.join(app.getPath("userData"), "logs");

// Создаем директорию для логов, если её нет
if (!fs.existsSync(LOG_FILE_DIR)) {
    fs.mkdirSync(LOG_FILE_DIR, { recursive: true });
}

// Константы для управления очередью логов
const LOG_QUEUE_MAX_SIZE = 1000;       // Максимальный размер очереди логов для одной задачи
const LOG_FLUSH_INTERVAL = 1000;       // Интервал обработки очереди (мс)

// Очереди логов и флаги обработки
const logQueues = {};
const queueTimers = {};

// Функция для записи лога в файл
function writeLogToFile(taskId, message, type = 'info') {
    const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;

    // Асинхронная запись в файл без ожидания завершения
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) {
            console.error(`Ошибка при записи в лог файл для задачи ${taskId}:`, err);
        }
    });
}

// Функция для пакетной обработки логов
function processLogBatch(taskId) {
    if (!logQueues[taskId] || logQueues[taskId].length === 0 || logQueues[taskId].processing) {
        return;
    }

    logQueues[taskId].processing = true;

    // Берём пакет логов (но не больше LOG_BATCH_SIZE)
    const batchSize = Math.min(LOG_BATCH_SIZE, logQueues[taskId].length);
    const batch = logQueues[taskId].splice(0, batchSize);

    // Обрабатываем пакет асинхронно
    setImmediate(() => {
        try {
            // Пишем все логи в файл (всегда)
            batch.forEach(logItem => {
                writeLogToFile(
                    logItem.taskId,
                    logItem.log,
                    logItem.type
                );
            });

            // Отключаем отправку логов в UI - записываем только в файл
            // Подготавливаем логи для UI (только если UI обновления не заблокированы)
            /* ОТКЛЮЧЕНО - больше не отправляем логи в UI
            if (!uiUpdateTimers[taskId] || uiUpdateTimers[taskId].canUpdate) {
                // Проверяем существование mainWindow
                const mainWindow = batch[0].mainWindow;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Отправляем только важные логи
                    const importantLogs = batch.filter(logItem =>
                        logItem.type === 'stderr' ||
                        logItem.log.includes("[TABLE_DATA]") ||
                        logItem.log.includes("ERROR") ||
                        logItem.log.includes("error") ||
                        (logItem.log.includes("[") && logItem.log.includes("]"))
                    );

                    if (importantLogs.length > 0) {
                        // Пакетная отправка важных логов в UI
                        importantLogs.forEach(logItem => {
                            mainWindow.webContents.send("process-output", {
                                taskId: logItem.taskId,
                                log: logItem.log
                            });
                        });

                        // Устанавливаем блокировку обновления UI на указанное время
                        uiUpdateTimers[taskId] = {
                            canUpdate: false,
                            timer: setTimeout(() => {
                                if (uiUpdateTimers[taskId]) {
                                    uiUpdateTimers[taskId].canUpdate = true;
                                }
                            }, LOG_UPDATE_INTERVAL)
                        };
                    }
                }
            }
            */

            // Отправляем только данные таблицы в UI для обновления, чтобы не терять функциональность
            const mainWindow = batch[0].mainWindow;
            if (mainWindow && !mainWindow.isDestroyed()) {
                // Отправляем только записи с данными таблицы
                const tableDataLogs = batch.filter(logItem =>
                    logItem.log.includes("[TABLE_DATA]")
                );

                if (tableDataLogs.length > 0) {
                    tableDataLogs.forEach(logItem => {
                        mainWindow.webContents.send("process-output", {
                            taskId: logItem.taskId,
                            log: logItem.log
                        });
                    });
                }
            }

            // Записываем важные ошибки в консоль (минимизируем)
            batch.filter(item => item.type === 'stderr').forEach(errorItem => {
                console.error(`STDERR [Task ${errorItem.taskId}]:`, errorItem.log.substring(0, 200) + (errorItem.log.length > 200 ? '...' : ''));
            });

            // Освобождаем флаг обработки
            logQueues[taskId].processing = false;

            // Запускаем обработку следующего пакета, если есть ещё данные
            if (logQueues[taskId].length > 0) {
                process.nextTick(() => processLogBatch(taskId));
            }
        } catch (error) {
            console.error(`Ошибка при пакетной обработке логов для задачи ${taskId}:`, error);
            logQueues[taskId].processing = false;

            // Продолжаем обработку даже в случае ошибки
            if (logQueues[taskId].length > 0) {
                process.nextTick(() => processLogBatch(taskId));
            }
        }
    });
}

// Улучшенная функция для добавления логов в очередь
function addLogToQueue(taskId, logMessage, mainWindow, logType = 'stdout', isImportant = false) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    // Отправляем лог в UI только если это важный лог или данные таблицы
    const shouldSendToUI = isImportant ||
        logMessage.includes("[TABLE_DATA]") ||
        logType === 'stderr' ||
        logMessage.includes("[ERROR]") ||
        logMessage.includes("error");

    if (shouldSendToUI) {
        try {
            mainWindow.webContents.send('process-output', {
                taskId: taskId,
                log: logMessage
            });
        } catch (error) {
            console.error(`Ошибка при отправке лога в UI для задачи ${taskId}:`, error.message);
        }
    }

    // Передаем лог в MEV LoadBalancer для анализа
    try {
        mevLoadBalancer.handleProcessLog({
            processId: taskId,
            message: logMessage,
            level: logType === 'stderr' || logMessage.includes("[ERROR]") || logMessage.includes("error") ? 'error' : 'info'
        });
    } catch (error) {
        console.error(`Ошибка при передаче лога в MEV LoadBalancer для задачи ${taskId}:`, error.message);
    }

    // Добавляем лог в очередь для записи в файл
    if (!logQueues[taskId]) {
        logQueues[taskId] = [];
    }

    // Если очередь слишком большая, удаляем старые логи
    if (logQueues[taskId].length >= LOG_QUEUE_MAX_SIZE) {
        const overflow = Math.floor(LOG_QUEUE_MAX_SIZE * 0.2); // Удаляем 20% старых логов
        logQueues[taskId].splice(0, overflow);

        // Добавляем сообщение о переполнении
        const timestamp = new Date().toISOString();
        logQueues[taskId].push({
            timestamp,
            type: 'system',
            message: `[SYSTEM] Пропущено ${overflow} логов из-за переполнения очереди`
        });
    }

    // Добавляем новый лог в очередь
    const timestamp = new Date().toISOString();
    logQueues[taskId].push({
        timestamp,
        type: logType,
        message: logMessage
    });

    // Запускаем обработку очереди, если еще не запущена
    if (!queueTimers[taskId]) {
        queueTimers[taskId] = setTimeout(() => processLogQueue(taskId), LOG_FLUSH_INTERVAL);
    }
}

// Функция для обработки очереди логов
function processLogQueue(taskId) {
    // Сбрасываем таймер
    queueTimers[taskId] = null;

    // Если очередь пуста, выходим
    if (!logQueues[taskId] || logQueues[taskId].length === 0) {
        return;
    }

    // Извлекаем пакет логов из очереди (не более LOG_BATCH_SIZE)
    const batchSize = Math.min(LOG_BATCH_SIZE, logQueues[taskId].length);
    const batch = logQueues[taskId].splice(0, batchSize);

    // Преобразуем в текст для записи в файл
    const logLines = batch.map(log => {
        const prefix = log.type === 'stderr' ? '[ERROR]' :
            log.type === 'system' ? '[SYSTEM]' : '[INFO]';
        return `[${log.timestamp}] ${prefix} ${log.message}`;
    }).join('\n') + '\n';

    // Записываем пакет логов в файл асинхронно
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');

    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch (err) {
            console.error(`Ошибка при создании директории логов: ${err.message}`);
        }
    }

    const logFilePath = path.join(logsDir, `task_${taskId}.log`);

    fs.appendFile(logFilePath, logLines, (err) => {
        if (err) {
            console.error(`ПРОЦЕСС: Ошибка при записи логов в файл для задачи ${taskId}:`, err);
        }

        // Если в очереди остались логи, планируем следующую обработку
        if (logQueues[taskId] && logQueues[taskId].length > 0) {
            queueTimers[taskId] = setTimeout(() => processLogQueue(taskId), LOG_FLUSH_INTERVAL);
        }
    });

    // Если очередь еще не пуста, но таймер не установлен, устанавливаем его
    if (logQueues[taskId] && logQueues[taskId].length > 0 && !queueTimers[taskId]) {
        queueTimers[taskId] = setTimeout(() => processLogQueue(taskId), LOG_FLUSH_INTERVAL);
    }
}

// Функция очистки ресурсов для неактивных задач
function cleanupLogQueues() {
    for (const taskId in logQueues) {
        // Проверяем, активна ли задача
        if (!processes[taskId] || !processes[taskId].isActive) {
            // Если есть незаписанные логи, записываем их
            if (logQueues[taskId] && logQueues[taskId].length > 0) {
                processLogQueue(taskId);
            }

            // Очищаем таймер
            if (queueTimers[taskId]) {
                clearTimeout(queueTimers[taskId]);
                queueTimers[taskId] = null;
            }

            // Удаляем очередь
            delete logQueues[taskId];
            console.log(`ЛОГИ: Очищены ресурсы очереди логов для неактивной задачи ${taskId}`);
        }
    }
}

// Запускаем периодическую очистку ресурсов
setInterval(cleanupLogQueues, 60000); // Раз в минуту

function initializeProcessHandlers(ipcMain, mainWindow) {
    // Метод для получения логов из файла по запросу
    ipcMain.handle("get-task-logs", async (event, { taskId, offset = 0, limit = 100 }) => {
        const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);

        try {
            if (!fs.existsSync(logFile)) {
                return { logs: [], totalLines: 0 };
            }

            // Читаем файл и возвращаем указанный диапазон логов
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            const totalLines = lines.length;

            const startIdx = Math.max(0, totalLines - offset - limit);
            const endIdx = Math.max(0, totalLines - offset);

            return {
                logs: lines.slice(startIdx, endIdx).reverse(),
                totalLines
            };
        } catch (error) {
            console.error(`Ошибка при чтении логов для задачи ${taskId}:`, error);
            return { logs: [], totalLines: 0, error: error.message };
        }
    });

    // Добавляем новый метод для открытия файла логов
    ipcMain.handle("open-log-file", async (event, { taskId }) => {
        const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);

        try {
            if (!fs.existsSync(logFile)) {
                console.error(`Файл логов для задачи ${taskId} не найден`);
                return { success: false, error: "Файл логов не найден" };
            }

            // Открываем файл логов в стандартном приложении пользователя для просмотра текстовых файлов
            await shell.openPath(logFile);
            return { success: true, filePath: logFile };
        } catch (error) {
            console.error(`Ошибка при открытии файла логов для задачи ${taskId}:`, error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on("start-process", async (event, { taskId, config }) => {
        console.log(`ПРОЦЕСС: Создан taskId: ${taskId}, запускаем процесс...`);
        const scriptPath = getSettings();

        try {
            const child = await spawnProcess(config, scriptPath);
            if (!child) {
                console.error(`ПРОЦЕСС: Не удалось запустить процесс для задачи ${taskId}`);
                addLogToQueue(taskId, `[ERROR] Не удалось запустить процесс`, mainWindow, 'stderr');
                return;
            }

            // Сохраняем информацию о процессе
            processes[taskId] = {
                process: child,
                pid: child.pid,
                isActive: true,
                moduleName: config.module_name,
                startTime: Date.now()
            };

            console.log(`ПРОЦЕСС: Процесс ${taskId} успешно запущен, PID: ${child.pid}`);

            // Записываем в файл лога о запуске процесса
            writeLogToFile(taskId, `Процесс запущен, PID: ${child.pid}`, 'system');

            // Отправляем событие только после сохранения процесса в карту
            // Используем process.nextTick для асинхронной отправки событий
            process.nextTick(() => {
                event.reply("process-started", { taskId, config });
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("process-started", { taskId, config });
                }
            });

            child.stdout.on("data", (data) => {
                const output = data.toString();
                addLogToQueue(taskId, output, mainWindow, 'stdout', false);
            });

            child.stderr.on("data", (data) => {
                const output = data.toString();
                addLogToQueue(taskId, `[ERROR] ${output}`, mainWindow, 'stderr', true);
            });

            child.on("exit", (code) => {
                console.log(`ПРОЦЕСС: Процесс ${taskId} завершился с кодом ${code}`);

                // Записываем в файл лога о завершении процесса
                writeLogToFile(taskId, `Процесс завершился с кодом ${code}`, 'system');

                // Обновляем статус в карте процессов
                let exitReason = code === 0 ? 'нормальное завершение' : `ошибка (код ${code})`;
                let runTime = 0;

                if (processes[taskId]) {
                    processes[taskId].isActive = false;
                    processes[taskId].exitCode = code;
                    processes[taskId].exitTime = Date.now();
                    processes[taskId].exitReason = exitReason;

                    // Вычисляем время работы в секундах
                    runTime = Math.floor((processes[taskId].exitTime - processes[taskId].startTime) / 1000);
                }

                // Асинхронно отправляем событие завершения
                process.nextTick(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send("process-exit", { taskId, code });
                    }
                });

                // Отправляем уведомление в Telegram асинхронно
                setImmediate(async () => {
                    try {
                        const exitTime = new Date().toISOString();
                        const moduleName = config.module_name || 'неизвестно';

                        const message = `🛑 Процесс остановлен\n\n` +
                            `Задача ID: ${taskId}\n` +
                            `Модуль: ${moduleName}\n` +
                            `Причина: ${exitReason}\n` +
                            `Время работы: ${runTime}с\n` +
                            `Время остановки: ${exitTime}`;

                        await telegramBotService.sendSystemNotification(message);
                    } catch (error) {
                        console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`, error);
                    }
                });
            });
        } catch (error) {
            console.error(`ПРОЦЕСС: Ошибка при запуске процесса ${taskId}:`, error);
            addLogToQueue(taskId, `[ERROR] Failed to start process: ${error.toString()}`, mainWindow, 'stderr');
        }
    });

    ipcMain.on("resume-process", async (event, data) => {
        const { taskId, config } = data;
        console.log(`ПРОЦЕСС: Возобновление процесса ${taskId} с обновленной конфигурацией`);
        const scriptPath = getSettings();

        // Проверяем, существует ли уже процесс с этим ID
        if (processes[taskId]) {
            // Проверяем, не запущен ли уже процесс
            if (processes[taskId].isActive) {
                console.log(`ПРОЦЕСС: Процесс ${taskId} уже активен, нельзя возобновить`);
                event.reply(`process-error`, { error: 'Process already running' });
                return;
            }

            // Если процесс существует в реестре, но не активен, перезапускаем его
            console.log(`ПРОЦЕСС: Перезапуск процесса ${taskId} с обновленной конфигурацией`);
        } else {
            // Если такого процесса нет, создаем новую запись
            processes[taskId] = {
                process: null,
                pid: null,
                isActive: false,
                exitCode: null,
                exitTime: null,
                exitReason: null,
                startTime: null,
                moduleName: config.module_name || 'Unknown'
            };
            console.log(`ПРОЦЕСС: Создание новой записи процесса ${taskId}`);
        }

        try {
            // Запускаем процесс с ПРАВИЛЬНЫМИ параметрами: (config, scriptPath)
            const childProcess = await spawnProcess(config, scriptPath);

            if (!childProcess) {
                throw new Error('Не удалось запустить процесс');
            }

            const pid = childProcess.pid;
            processes[taskId].process = childProcess;
            processes[taskId].pid = pid;
            processes[taskId].isActive = true;
            processes[taskId].startTime = Date.now();
            processes[taskId].exitCode = null;
            processes[taskId].exitTime = null;
            processes[taskId].exitReason = null;
            processes[taskId].moduleName = config.module_name || 'Unknown';

            console.log(`ПРОЦЕСС: Процесс ${taskId} успешно запущен с PID ${pid}`);

            // Отправляем уведомление о запуске процесса в Telegram - асинхронно и не блокируя
            setImmediate(async () => {
                try {
                    const moduleName = config.module_name || 'неизвестно';
                    const startTime = new Date().toISOString();

                    const message = `▶️ Процесс возобновлен\n\n` +
                        `Задача ID: ${taskId}\n` +
                        `Модуль: ${moduleName}\n` +
                        `Время запуска: ${startTime}\n` +
                        `PID: ${pid}`;

                    await telegramBotService.sendSystemNotification(message);
                } catch (error) {
                    console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram при возобновлении:`, error);
                }
            });

            // Отправляем событие в UI с информацией о запуске
            console.log(`ПРОЦЕСС: Отправка события process-started в UI для задачи ${taskId}`);
            event.reply('process-started', {
                taskId: taskId,
                config: config
            });

            // Также отправляем событие в main window
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("process-started", {
                    taskId,
                    config
                });
            }

            // Настраиваем обработчики событий для процесса
            childProcess.stdout.on('data', (data) => {
                const output = data.toString();
                addLogToQueue(taskId, output, mainWindow, 'stdout', false);
            });

            childProcess.stderr.on('data', (data) => {
                const output = data.toString();
                addLogToQueue(taskId, `[ERROR] ${output}`, mainWindow, 'stderr', true);
            });

            childProcess.on('exit', (code) => {
                console.log(`ПРОЦЕСС: Процесс ${taskId} завершен с кодом ${code}`);

                if (processes[taskId]) {
                    processes[taskId].isActive = false;
                    processes[taskId].exitCode = code;
                    processes[taskId].exitTime = Date.now();
                    processes[taskId].exitReason = code === 0 ? 'normal' : 'error';

                    const runTime = Math.floor((processes[taskId].exitTime - processes[taskId].startTime) / 1000);

                    // Отправляем уведомление о завершении процесса в Telegram - асинхронно
                    setImmediate(async () => {
                        try {
                            const moduleName = processes[taskId].moduleName || 'неизвестно';
                            const exitTime = new Date().toISOString();

                            const icon = code === 0 ? '✅' : '❌';
                            const message = `${icon} Процесс завершен\n\n` +
                                `Задача ID: ${taskId}\n` +
                                `Модуль: ${moduleName}\n` +
                                `Код завершения: ${code}\n` +
                                `Время работы: ${runTime}с\n` +
                                `Время завершения: ${exitTime}`;

                            await telegramBotService.sendSystemNotification(message);
                        } catch (error) {
                            console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram о завершении:`, error);
                        }
                    });
                }

                mainWindow.webContents.send('process-exit', {
                    taskId: taskId,
                    code: code
                });
            });

        } catch (error) {
            console.error(`ПРОЦЕСС: Ошибка при возобновлении процесса ${taskId}:`, error);
            event.reply(`process-error`, { taskId, error: error.message });
        }
    });

    ipcMain.on("stop-process", async (event, taskId) => {
        console.log(`ПРОЦЕСС: Остановка процесса ${taskId}`);

        // Сначала останавливаем мониторинг пулов для mev_subtask процессов
        stopMevProcess(taskId);

        // Проверяем наличие процесса в карте
        const processInfo = processes[taskId];
        if (!processInfo) {
            console.log(`ПРОЦЕСС: Процесс ${taskId} не найден в карте процессов`);
            return;
        }

        // Проверяем, активен ли процесс
        if (!processInfo.isActive) {
            console.log(`ПРОЦЕСС: Процесс ${taskId} уже остановлен (неактивен) в ${new Date(processInfo.exitTime).toISOString()}`);
            return;
        }

        const child = processInfo.process;

        if (child && !child.killed) {
            const pid = processInfo.pid;
            console.log(`ПРОЦЕСС: Остановка процесса ${taskId} с PID ${pid}, возраст: ${Math.floor((Date.now() - processInfo.startTime) / 1000)}с`);

            try {
                // Записываем причину остановки
                processInfo.exitReason = 'ручная остановка пользователем';
                processInfo.exitTime = Date.now();
                const runTime = Math.floor((processInfo.exitTime - processInfo.startTime) / 1000);

                // Отправляем уведомление в Telegram перед остановкой
                setImmediate(async () => {
                    try {
                        const exitTime = new Date().toISOString();
                        const moduleName = processInfo.moduleName || 'неизвестно';

                        const message = `🛑 Процесс остановлен вручную\n\n` +
                            `Задача ID: ${taskId}\n` +
                            `Модуль: ${moduleName}\n` +
                            `Причина: ручная остановка\n` +
                            `Время работы: ${runTime}с\n` +
                            `Время остановки: ${exitTime}`;

                        await telegramBotService.sendSystemNotification(message);
                    } catch (error) {
                        console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`, error);
                    }
                });

                // Убедимся, что убиваем процесс принудительно с помощью нашей улучшенной функции
                console.log(`ПРОЦЕСС: Принудительное завершение процесса ${taskId} с PID ${pid}`);

                try {
                    // Используем асинхронную функцию и ждем результата
                    const killSuccess = await forceKillWindowsProcess(pid);

                    if (killSuccess) {
                        console.log(`ПРОЦЕСС: Процесс ${taskId} успешно завершен через forceKillWindowsProcess`);
                    } else {
                        console.log(`ПРОЦЕСС: Не удалось завершить процесс ${taskId} через forceKillWindowsProcess, пробуем treeKill`);

                        // Резервный метод, если наша функция не сработала
                        treeKill(pid, "SIGKILL", (err) => {
                            if (err) {
                                // Проверяем, указывает ли ошибка на то, что процесс уже завершен
                                const errorStr = err.toString().toLowerCase();
                                const isProcessGoneError = errorStr.includes('no running instance') ||
                                    errorStr.includes('does not exist') ||
                                    errorStr.includes('no such process');

                                if (isProcessGoneError) {
                                    // Процесс уже завершен, это нормально
                                    console.log(`ПРОЦЕСС: Процесс ${taskId} уже завершен, игнорируем ошибку.`);
                                } else {
                                    // Другая ошибка, логируем
                                    console.error(`ПРОЦЕСС: Ошибка при завершении процесса ${taskId}:`, err);
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.error(`ПРОЦЕСС: Ошибка при завершении процесса ${taskId}:`, error);
                }

                // В любом случае отмечаем процесс как неактивный
                processInfo.isActive = false;
                processInfo.exitTime = Date.now();
                processInfo.exitReason = 'killed';
            } catch (error) {
                console.error(`ПРОЦЕСС: Ошибка при остановке процесса ${taskId}:`, error);
                // Отмечаем процесс как неактивный в любом случае
                processInfo.isActive = false;
                processInfo.exitTime = Date.now();
                processInfo.exitReason = 'error';
            }
        } else {
            console.log(`ПРОЦЕСС: Процесс ${taskId} уже завершен или убит`);
            // Отмечаем процесс как неактивный
            processInfo.isActive = false;
            processInfo.exitTime = Date.now();
            processInfo.exitReason = 'already_stopped';
        }
    });
}

module.exports = { initializeProcessHandlers };
