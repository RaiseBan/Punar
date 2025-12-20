import { getSettings } from '../utils/fsHelper';
import { spawnProcess, forceKillWindowsProcess } from '../utils/spawnProcess';
import fs from 'fs';
import path from 'path';
import { app, shell, IpcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { EventBus } from '../../../shared/eventBus';
import { telegramClient } from '../api/telegram-client';
import {
    ProcessInfo,
    LogEntry,
    ProcessMap,
    PROCESS_EVENTS,
    TaskConfig,
} from '../../../shared/types';

// ============= Типы =============

interface LogQueue {
    [taskId: string]: LogEntry[];
}

interface QueueTimers {
    [taskId: string]: NodeJS.Timeout | null;
}

interface GetTaskLogsParams {
    taskId: string;
    offset?: number;
    limit?: number;
}

interface GetTaskLogsResult {
    logs: string[];
    totalLines: number;
    error?: string;
}

interface OpenLogFileParams {
    taskId: string;
}

// ============= Состояние =============

const processes: ProcessMap = {};

// Константы для конфигурации логирования
const MAX_LOGS_IN_MEMORY = 1000;
const LOG_BATCH_SIZE = 50;
const LOG_UPDATE_INTERVAL = 500;
const LOG_FILE_DIR = path.join(app.getPath('userData'), 'logs');

// Создаем директорию для логов, если её нет
if (!fs.existsSync(LOG_FILE_DIR)) {
    fs.mkdirSync(LOG_FILE_DIR, { recursive: true });
}

// Константы для управления очередью логов
const LOG_QUEUE_MAX_SIZE = 1000;
const LOG_FLUSH_INTERVAL = 1000;

// Очереди логов и флаги обработки
const logQueues: LogQueue = {};
const queueTimers: QueueTimers = {};

// ============= Вспомогательные функции =============

/**
 * Записывает лог в файл
 */
function writeLogToFile(taskId: string, message: string, type: string = 'info'): void {
    const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;

    fs.appendFile(logFile, logEntry, (err) => {
        if (err) {
            console.error(`Ошибка при записи в лог файл для задачи ${taskId}:`, err);
        }
    });
}

/**
 * Добавляет лог в очередь для записи
 */
function addLogToQueue(
    taskId: string,
    logMessage: string,
    mainWindow: BrowserWindow,
    logType: 'stdout' | 'stderr' | 'system' = 'stdout',
    isImportant: boolean = false
): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    // Отправляем лог в UI только если это важный лог или данные таблицы
    const shouldSendToUI =
        isImportant ||
        logMessage.includes('[TABLE_DATA]') ||
        logType === 'stderr' ||
        logMessage.includes('[ERROR]') ||
        logMessage.includes('error');

    if (shouldSendToUI) {
        try {
            mainWindow.webContents.send('process-output', {
                taskId: taskId,
                log: logMessage,
            });
        } catch (error) {
            console.error(
                `Ошибка при отправке лога в UI для задачи ${taskId}:`,
                (error as Error).message
            );
        }
    }

    // Добавляем лог в очередь для записи в файл
    if (!logQueues[taskId]) {
        logQueues[taskId] = [];
    }

    // Если очередь слишком большая, удаляем старые логи
    if (logQueues[taskId].length >= LOG_QUEUE_MAX_SIZE) {
        const overflow = Math.floor(LOG_QUEUE_MAX_SIZE * 0.2);
        logQueues[taskId].splice(0, overflow);

        const timestamp = Date.now();
        logQueues[taskId].push({
            timestamp,
            type: 'system',
            message: `[SYSTEM] Пропущено ${overflow} логов из-за переполнения очереди`,
            taskId,
        });
    }

    // Добавляем новый лог в очередь
    const timestamp = Date.now();
    logQueues[taskId].push({
        timestamp,
        type: logType === 'stderr' ? 'error' : logType === 'system' ? 'system' : 'info',
        message: logMessage,
        taskId,
    });

    // Запускаем обработку очереди, если еще не запущена
    if (!queueTimers[taskId]) {
        queueTimers[taskId] = setTimeout(() => processLogQueue(taskId), LOG_FLUSH_INTERVAL);
    }
}

/**
 * Обрабатывает очередь логов
 */
function processLogQueue(taskId: string): void {
    queueTimers[taskId] = null;

    if (!logQueues[taskId] || logQueues[taskId].length === 0) {
        return;
    }

    const batchSize = Math.min(LOG_BATCH_SIZE, logQueues[taskId].length);
    const batch = logQueues[taskId].splice(0, batchSize);

    const logLines =
        batch
            .map((log: LogEntry) => {
                const prefix =
                    log.type === 'error'
                        ? '[ERROR]'
                        : log.type === 'system'
                            ? '[SYSTEM]'
                            : '[INFO]';
                return `[${log.timestamp}] ${prefix} ${log.message}`;
            })
            .join('\n') + '\n';

    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');

    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch (err) {
            console.error(`Ошибка при создании директории логов: ${(err as Error).message}`);
        }
    }

    const logFilePath = path.join(logsDir, `task_${taskId}.log`);

    fs.appendFile(logFilePath, logLines, (err) => {
        if (err) {
            console.error(`ПРОЦЕСС: Ошибка при записи логов в файл для задачи ${taskId}:`, err);
        }

        if (logQueues[taskId] && logQueues[taskId].length > 0) {
            queueTimers[taskId] = setTimeout(() => processLogQueue(taskId), LOG_FLUSH_INTERVAL);
        }
    });

    if (logQueues[taskId] && logQueues[taskId].length > 0 && !queueTimers[taskId]) {
        queueTimers[taskId] = setTimeout(() => processLogQueue(taskId), LOG_FLUSH_INTERVAL);
    }
}

/**
 * Очищает ресурсы для неактивных задач
 */
function cleanupLogQueues(): void {
    for (const taskId in logQueues) {
        if (!processes[taskId] || !processes[taskId].isActive) {
            if (logQueues[taskId] && logQueues[taskId].length > 0) {
                processLogQueue(taskId);
            }

            if (queueTimers[taskId]) {
                clearTimeout(queueTimers[taskId]);
                queueTimers[taskId] = null;
            }

            delete logQueues[taskId];
            console.log(`ЛОГИ: Очищены ресурсы очереди логов для неактивной задачи ${taskId}`);
        }
    }
}

// Запускаем периодическую очистку ресурсов
setInterval(cleanupLogQueues, 60000);

// ============= IPC Handlers =============

export function initializeProcessHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    /**
     * Получение логов из файла
     */
    ipcMain.handle(
        'get-task-logs',
        async (
            _event: IpcMainInvokeEvent,
            { taskId, offset = 0, limit = 100 }: GetTaskLogsParams
        ): Promise<GetTaskLogsResult> => {
            const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);

            try {
                if (!fs.existsSync(logFile)) {
                    return { logs: [], totalLines: 0 };
                }

                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n').filter((line) => line.trim());
                const totalLines = lines.length;

                const startIdx = Math.max(0, totalLines - offset - limit);
                const endIdx = Math.max(0, totalLines - offset);

                return {
                    logs: lines.slice(startIdx, endIdx).reverse(),
                    totalLines,
                };
            } catch (error) {
                console.error(`Ошибка при чтении логов для задачи ${taskId}:`, error);
                return { logs: [], totalLines: 0, error: (error as Error).message };
            }
        }
    );

    /**
     * Открытие файла логов
     */
    ipcMain.handle(
        'open-log-file',
        async (_event: IpcMainInvokeEvent, { taskId }: OpenLogFileParams): Promise<void> => {
            const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);

            if (fs.existsSync(logFile)) {
                shell.openPath(logFile);
            } else {
                console.error(`Файл логов для задачи ${taskId} не найден`);
            }
        }
    );

    /**
     * Запуск процесса
     */
    ipcMain.on(
        'start-process',
        async (event, { taskId, config }: { taskId: number; config: TaskConfig }) => {
            console.log(`ПРОЦЕСС: Запуск процесса для задачи ${taskId}`);

            if (processes[taskId]?.isActive) {
                console.warn(`ПРОЦЕСС: Процесс ${taskId} уже запущен`);
                return;
            }

            try {
                const settings = await getSettings();
                const scriptPath = settings?.scriptDirectory;

                if (!scriptPath) {
                    throw new Error('Путь к директории скриптов не установлен');
                }

                console.log(`ПРОЦЕСС: Путь к скриптам: ${scriptPath}`);

                if (!processes[taskId]) {
                    processes[taskId] = {
                        taskId: taskId,
                        process: null,
                        isActive: false,
                        startTime: 0,
                        logs: [],
                        config,
                        moduleName: config.module_name || config.moduleName || 'Unknown',
                    };
                }

                const child = await spawnProcess(config, scriptPath);

                if (!child) {
                    throw new Error('Не удалось запустить процесс');
                }

                processes[taskId] = {
                    ...processes[taskId],
                    process: child,
                    pid: child.pid,
                    isActive: true,
                    startTime: Date.now(),
                    exitCode: null,
                    exitTime: undefined,
                    exitReason: undefined,
                    moduleName: config.module_name || config.moduleName || 'Unknown',
                    config,
                };

                console.log(`ПРОЦЕСС: Процесс ${taskId} успешно запущен с PID ${child.pid}`);

                writeLogToFile(taskId.toString(), `Процесс запущен, PID: ${child.pid}`, 'system');

                EventBus.emit(PROCESS_EVENTS.STARTED, {
                    processId: taskId.toString(),
                    taskId: taskId,
                    moduleName: config.module_name,
                    config: config,
                });

                process.nextTick(() => {
                    event.reply('process-started', { taskId, config });
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-started', { taskId, config });
                    }
                });

                child.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString();
                    addLogToQueue(taskId.toString(), output, mainWindow, 'stdout', false);
                });

                child.stderr?.on('data', (data: Buffer) => {
                    const output = data.toString();
                    addLogToQueue(taskId.toString(), `[ERROR] ${output}`, mainWindow, 'stderr', true);
                });

                child.on('exit', (code: number | null) => {
                    console.log(`ПРОЦЕСС: Процесс ${taskId} завершился с кодом ${code}`);

                    EventBus.emit(PROCESS_EVENTS.STOPPED, {
                        processId: taskId.toString(),
                        taskId: taskId,
                        exitCode: code,
                    });

                    writeLogToFile(taskId.toString(), `Процесс завершился с кодом ${code}`, 'system');

                    const exitReason = code === 0 ? 'нормальное завершение' : `ошибка (код ${code})`;
                    let runTime = 0;

                    if (processes[taskId]) {
                        processes[taskId].isActive = false;
                        processes[taskId].exitCode = code;
                        processes[taskId].exitTime = Date.now();
                        processes[taskId].exitReason = exitReason;

                        runTime = Math.floor((processes[taskId].exitTime! - processes[taskId].startTime) / 1000);
                    }

                    process.nextTick(() => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('process-exit', { taskId, code });
                        }
                    });

                    setImmediate(async () => {
                        try {
                            const exitTime = new Date().toISOString();
                            const moduleName = config.module_name || 'неизвестно';

                            const message =
                                `🛑 Процесс остановлен\n\n` +
                                `Задача ID: ${taskId}\n` +
                                `Модуль: ${moduleName}\n` +
                                `Причина: ${exitReason}\n` +
                                `Время работы: ${runTime}с\n` +
                                `Время остановки: ${exitTime}`;

                            await telegramClient.sendSystemNotification(message);
                        } catch (error) {
                            console.error(
                                `ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`,
                                error
                            );
                        }
                    });
                });
            } catch (error) {
                console.error(`ПРОЦЕСС: Ошибка при запуске процесса ${taskId}:`, error);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('process-error', {
                        taskId,
                        error: (error as Error).message,
                    });
                }
            }
        }
    );

    /**
     * Остановка процесса
     */
    ipcMain.on('stop-process', async (_event, taskId: number) => {
        console.log(`ПРОЦЕСС: Получен запрос на остановку процесса ${taskId}`);

        const processInfo = processes[taskId];

        if (!processInfo) {
            console.warn(`ПРОЦЕСС: Процесс ${taskId} не найден`);
            return;
        }

        if (processInfo.isActive && processInfo.process) {
            const pid = processInfo.pid;
            console.log(
                `ПРОЦЕСС: Остановка процесса ${taskId} с PID ${pid}, возраст: ${Math.floor(
                    (Date.now() - processInfo.startTime) / 1000
                )}с`
            );

            try {
                processInfo.exitReason = 'ручная остановка пользователем';
                processInfo.exitTime = Date.now();
                const runTime = Math.floor((processInfo.exitTime - processInfo.startTime) / 1000);

                EventBus.emit(PROCESS_EVENTS.STOPPED, {
                    processId: taskId.toString(),
                    taskId: taskId,
                    exitCode: null,
                });

                setImmediate(async () => {
                    try {
                        const exitTime = new Date().toISOString();
                        const moduleName = processInfo.moduleName || 'неизвестно';

                        const message =
                            `🛑 Процесс остановлен вручную\n\n` +
                            `Задача ID: ${taskId}\n` +
                            `Модуль: ${moduleName}\n` +
                            `Причина: ручная остановка\n` +
                            `Время работы: ${runTime}с\n` +
                            `Время остановки: ${exitTime}`;

                        await telegramClient.sendSystemNotification(message);
                    } catch (error) {
                        console.error(
                            `ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`,
                            error
                        );
                    }
                });

                console.log(`ПРОЦЕСС: Принудительное завершение процесса ${taskId} с PID ${pid}`);

                try {
                    await forceKillWindowsProcess(pid!);
                    processInfo.isActive = false;
                } catch (error) {
                    console.error(`ПРОЦЕСС: Ошибка при завершении процесса ${taskId}:`, error);
                    processInfo.isActive = false;
                    processInfo.exitTime = Date.now();
                    processInfo.exitReason = 'error';
                }
            } catch (error) {
                console.error(`ПРОЦЕСС: Ошибка при остановке процесса ${taskId}:`, error);
                processInfo.isActive = false;
                processInfo.exitTime = Date.now();
                processInfo.exitReason = 'error';
            }
        } else {
            console.log(`ПРОЦЕСС: Процесс ${taskId} уже завершен или убит`);
            processInfo.isActive = false;
            processInfo.exitTime = Date.now();
            processInfo.exitReason = 'already_stopped';
        }
    });

    /**
     * Возобновление процесса
     */
    ipcMain.on(
        'resume-process',
        async (event, { taskId, config }: { taskId: number; config: TaskConfig }) => {
            console.log(`ПРОЦЕСС: Получен запрос на возобновление процесса ${taskId}`);

            const processInfo = processes[taskId];

            if (!processInfo) {
                console.warn(`ПРОЦЕСС: Процесс ${taskId} не найден в карте процессов, создаем новый`);
                processes[taskId] = {
                    taskId: taskId,
                    process: null,
                    isActive: false,
                    startTime: 0,
                    logs: [],
                    moduleName: config.module_name || config.moduleName || 'Unknown',
                };
            }

            if (processInfo?.isActive) {
                console.warn(`ПРОЦЕСС: Процесс ${taskId} уже активен, пропускаем запуск`);
                return;
            }

            try {
                const settings = await getSettings();
                const scriptPath = settings?.scriptDirectory;

                if (!scriptPath) {
                    throw new Error('Путь к директории скриптов не установлен');
                }

                console.log(`ПРОЦЕСС: Запуск процесса для задачи ${taskId} с конфигурацией:`, config);

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
                processes[taskId].exitTime = undefined;
                processes[taskId].exitReason = undefined;
                processes[taskId].moduleName = config.module_name || config.moduleName || 'Unknown';

                console.log(`ПРОЦЕСС: Процесс ${taskId} успешно запущен с PID ${pid}`);

                EventBus.emit(PROCESS_EVENTS.STARTED, {
                    processId: taskId.toString(),
                    taskId: taskId,
                    moduleName: config.module_name,
                    config: config,
                });

                setImmediate(async () => {
                    try {
                        const moduleName = config.module_name || 'неизвестно';
                        const startTime = new Date().toISOString();

                        const message =
                            `▶️ Процесс возобновлен\n\n` +
                            `Задача ID: ${taskId}\n` +
                            `Модуль: ${moduleName}\n` +
                            `Время запуска: ${startTime}\n` +
                            `PID: ${pid}`;

                        await telegramClient.sendSystemNotification(message);
                    } catch (error) {
                        console.error(
                            `ПРОЦЕСС: Ошибка при отправке уведомления в Telegram при возобновлении:`,
                            error
                        );
                    }
                });

                console.log(`ПРОЦЕСС: Отправка события process-started в UI для задачи ${taskId}`);
                event.reply('process-started', {
                    taskId: taskId,
                    config: config,
                });

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('process-started', {
                        taskId,
                        config,
                    });
                }

                childProcess.stdout?.on('data', (data: Buffer) => {
                    const output = data.toString();
                    addLogToQueue(taskId.toString(), output, mainWindow, 'stdout', false);
                });

                childProcess.stderr?.on('data', (data: Buffer) => {
                    const output = data.toString();
                    addLogToQueue(taskId.toString(), `[ERROR] ${output}`, mainWindow, 'stderr', true);
                });

                childProcess.on('exit', (code: number | null) => {
                    console.log(`ПРОЦЕСС: Процесс ${taskId} завершен с кодом ${code}`);

                    if (processes[taskId]) {
                        processes[taskId].isActive = false;
                        processes[taskId].exitCode = code;
                        processes[taskId].exitTime = Date.now();
                        processes[taskId].exitReason = code === 0 ? 'normal' : 'error';

                        const runTime = Math.floor(
                            (processes[taskId].exitTime! - processes[taskId].startTime) / 1000
                        );

                        setImmediate(async () => {
                            try {
                                const moduleName = processes[taskId].moduleName || 'неизвестно';
                                const exitTime = new Date().toISOString();

                                const icon = code === 0 ? '✅' : '❌';
                                const message =
                                    `${icon} Процесс завершен\n\n` +
                                    `Задача ID: ${taskId}\n` +
                                    `Модуль: ${moduleName}\n` +
                                    `Код выхода: ${code}\n` +
                                    `Время работы: ${runTime}с\n` +
                                    `Время завершения: ${exitTime}`;

                                await telegramClient.sendSystemNotification(message);
                            } catch (error) {
                                console.error(
                                    `ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`,
                                    error
                                );
                            }
                        });
                    }

                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-exit', { taskId, code });
                    }
                });
            } catch (error) {
                console.error(`ПРОЦЕСС: Ошибка при возобновлении процесса ${taskId}:`, error);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('process-error', {
                        taskId,
                        error: (error as Error).message,
                    });
                }
            }
        }
    );
}

/**
 * Получение карты процессов
 */
export function getProcesses(): ProcessMap {
    return processes;
}