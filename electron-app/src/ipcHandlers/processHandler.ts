import { spawnProcess, forceKillWindowsProcess } from '../utils/spawnProcess';
import fs from 'fs';
import path from 'path';
import { app, shell, IpcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { EventBus } from '../../../shared/eventBus';
import { telegramClient } from '../api/telegram-client';
import { getConfigRepository } from '../repositories';
import { ConfigError } from '../repositories/errors';
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

// ============= Глобальные переменные =============

const processes: ProcessMap = {};
const logQueues: LogQueue = {};
const queueTimers: QueueTimers = {};

const LOG_FILE_DIR =
    process.env.NODE_ENV === 'production'
        ? path.join(app.getPath('userData'), 'logs')
        : path.join(__dirname, '..', '..', 'logs');


// ============= Логирование =============

/**
 * Запись лога в файл
 */
function writeLogToFile(taskId: string, message: string, type: string): void {
    try {
        if (!fs.existsSync(LOG_FILE_DIR)) {
            fs.mkdirSync(LOG_FILE_DIR, { recursive: true });
        }

        const logFile = path.join(LOG_FILE_DIR, `task_${taskId}.log`);
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${type}] ${message}\n`;

        fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (error) {
        console.error(`Ошибка записи в лог-файл для задачи ${taskId}:`, error);
    }
}

/**
 * Добавление лога в очередь
 */
function addLogToQueue(
    taskId: string,
    message: string,
    mainWindow: BrowserWindow,
    type: 'stdout' | 'stderr',
    isError: boolean
): void {
    if (!logQueues[taskId]) {
        logQueues[taskId] = [];
    }

    logQueues[taskId].push({
        timestamp: Date.now(),
        message,
        type: isError ? 'error' : 'info',
        taskId,
    });

    if (queueTimers[taskId]) {
        clearTimeout(queueTimers[taskId]!);
    }

    queueTimers[taskId] = setTimeout(() => {
        flushLogQueue(taskId, mainWindow);
    }, 100);
}

/**
 * Отправка логов из очереди
 */
function flushLogQueue(taskId: string, mainWindow: BrowserWindow): void {
    const logs = logQueues[taskId];

    if (!logs || logs.length === 0) {
        return;
    }

    const combinedLog = logs.map((l) => l.message).join('');

    writeLogToFile(taskId, combinedLog, 'process');

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('process-output', {
            taskId: parseInt(taskId),
            log: combinedLog,
        });
    }

    logQueues[taskId] = [];
    queueTimers[taskId] = null;
}

/**
 * Периодическая очистка старых очередей
 */
setInterval(() => {
    const now = Date.now();
    Object.keys(logQueues).forEach((taskId) => {
        const queue = logQueues[taskId];
        if (queue && queue.length > 0) {
            const lastLog = queue[queue.length - 1];
            if (now - lastLog.timestamp > 60000) {
                delete logQueues[taskId];
                if (queueTimers[taskId]) {
                    clearTimeout(queueTimers[taskId]!);
                    delete queueTimers[taskId];
                }
            }
        }
    });
}, 60000);

// ============= IPC Handlers =============

export function initializeProcessHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    const configRepo = getConfigRepository();

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
                // Используем ConfigRepository для получения пути к скриптам
                const scriptPath = await configRepo.getScriptDirectory();
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

                // spawnProcess теперь сам получает settings внутри
                const child = await spawnProcess(config);

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

                // Обработка ошибки конфигурации
                if (error instanceof ConfigError) {
                    console.error('Ошибка конфигурации:', error.message);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-error', {
                            taskId,
                            error: 'Настройте путь к директории скриптов в Settings',
                        });
                    }
                } else {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-error', {
                            taskId,
                            error: (error as Error).message,
                        });
                    }
                }
            }
        }
    );

    /**
     * Остановка процесса
     */
    ipcMain.on('stop-process', async (_event, taskId: number) => {
        console.log(`ПРОЦЕСС: Остановка процесса ${taskId}`);

        const processInfo = processes[taskId];

        if (!processInfo) {
            console.warn(`ПРОЦЕСС: Процесс ${taskId} не найден в карте процессов`);
            return;
        }

        if (processInfo.process && !processInfo.process.killed) {
            try {
                const pid = processInfo.process.pid;
                console.log(`ПРОЦЕСС: Попытка остановить процесс с PID ${pid}`);

                try {
                    processInfo.process.kill('SIGTERM');
                    console.log(`ПРОЦЕСС: Отправлен SIGTERM процессу ${taskId}`);

                    setTimeout(() => {
                        if (processInfo.process && !processInfo.process.killed) {
                            console.warn(`ПРОЦЕСС: Процесс ${taskId} не остановился, используем SIGKILL`);
                            processInfo.process.kill('SIGKILL');
                        }
                    }, 5000);

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
                // Используем ConfigRepository
                const scriptPath = await configRepo.getScriptDirectory();
                console.log(`ПРОЦЕСС: Запуск процесса для задачи ${taskId} с конфигурацией:`, config);

                // spawnProcess теперь сам получает settings внутри
                const childProcess = await spawnProcess(config);

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
                                const status = code === 0 ? 'успешно' : 'с ошибкой';

                                const message =
                                    `${icon} Процесс завершен ${status}\n\n` +
                                    `Задача ID: ${taskId}\n` +
                                    `Модуль: ${moduleName}\n` +
                                    `Код выхода: ${code}\n` +
                                    `Время работы: ${runTime}с\n` +
                                    `Время завершения: ${exitTime}`;

                                await telegramClient.sendSystemNotification(message);
                            } catch (error) {
                                console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`, error);
                            }
                        });
                    }

                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-exit', { taskId, code });
                    }
                });
            } catch (error) {
                console.error(`ПРОЦЕСС: Ошибка при возобновлении процесса ${taskId}:`, error);

                if (error instanceof ConfigError) {
                    console.error('Ошибка конфигурации:', error.message);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-error', {
                            taskId,
                            error: 'Настройте путь к директории скриптов в Settings',
                        });
                    }
                } else {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('process-error', {
                            taskId,
                            error: (error as Error).message,
                        });
                    }
                }
            }
        }
    );
}

export function getProcesses(): ProcessMap {
    return processes;
}