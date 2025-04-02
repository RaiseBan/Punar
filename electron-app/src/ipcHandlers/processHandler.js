const { spawn } = require("child_process");
const treeKill = require("tree-kill");
const { getSettings } = require("../utils/fsHelper");
const { spawnProcess, stopMevProcess } = require("../utils/spawnProcess");
const telegramBotService = require("../services/telegramBotService");

// Карта для отслеживания процессов
const processes = {};

function initializeProcessHandlers(ipcMain, mainWindow) {
    ipcMain.on("start-process", async (event, { taskId, config }) => {
        console.log(`ПРОЦЕСС: Создан taskId: ${taskId}, запускаем процесс...`);
        const scriptPath = getSettings();

        try {

            const child = await spawnProcess(config, scriptPath);
            if (!child) {
                console.error(`ПРОЦЕСС: Не удалось запустить процесс для задачи ${taskId}`);
                mainWindow?.webContents.send("process-output", {
                    taskId,
                    log: `[ERROR] Не удалось запустить процесс`
                });
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

            // Отправляем событие только после сохранения процесса в карту
            event.reply("process-started", { taskId, config });
            mainWindow?.webContents.send("process-started", { taskId, config });

            child.stdout.on("data", (data) => {
                const output = data.toString();

                // Всегда выводим полную информацию в консоль электрона 
                console.log(`STDOUT [Task ${taskId}]:`, output);

                // Для UI фильтруем и отправляем только важные сообщения
                if (output.includes("[TABLE_DATA]") ||
                    output.includes("ERROR") ||
                    output.includes("error") ||
                    (output.includes("[") && output.includes("]"))) {

                    mainWindow?.webContents.send("process-output", { taskId, log: output });
                }
            });

            child.stderr.on("data", (data) => {
                const output = data.toString();

                // Всегда выводим ошибки в консоль
                console.error(`STDERR [Task ${taskId}]:`, output);

                // Ошибки всегда отправляем в UI
                mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] ${output}` });
            });

            child.on("exit", (code) => {
                console.log(`ПРОЦЕСС: Процесс ${taskId} завершился с кодом ${code}`);

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

                mainWindow?.webContents.send("process-exit", { taskId, code });

                // Отправляем уведомление в Telegram
                try {
                    const exitTime = new Date().toISOString();
                    const moduleName = config.module_name || 'неизвестно';

                    const message = `🛑 Процесс остановлен\n\n` +
                        `Задача ID: ${taskId}\n` +
                        `Модуль: ${moduleName}\n` +
                        `Причина: ${exitReason}\n` +
                        `Время работы: ${runTime}с\n` +
                        `Время остановки: ${exitTime}`;

                    telegramBotService.sendSystemNotification(message);
                } catch (error) {
                    console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`, error);
                }

                // НЕ удаляем процесс из карты здесь, чтобы избежать race condition
                // с остановкой процесса. Вместо этого помечаем его как неактивный
            });
        } catch (error) {
            console.error(`ПРОЦЕСС: Ошибка при запуске процесса ${taskId}:`, error);
            mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] Failed to start process: ${error.toString()}` });
        }
    });

    // Возобновление процесса
    ipcMain.on("resume-process", async (event, { taskId, config }) => {
        console.log(`ПРОЦЕСС: Возобновление процесса: Task ${taskId}`);
        const scriptPath = getSettings();

        try {

            // СНАЧАЛА запускаем процесс
            const child = await spawnProcess(config, scriptPath);
            if (!child) {
                console.error(`ПРОЦЕСС: Не удалось возобновить процесс для задачи ${taskId}`);
                mainWindow?.webContents.send("process-output", {
                    taskId,
                    log: `[ERROR] Не удалось возобновить процесс`
                });
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

            console.log(`ПРОЦЕСС: Процесс возобновлен для Task ${taskId}, PID:`, child.pid);

            // ЗАТЕМ отправляем события после успешного запуска процесса
            event.reply(`process-started-${taskId}`); // Специфичное для задачи событие
            event.reply("process-started", { taskId, config }); // Общее событие
            mainWindow?.webContents.send("process-started", { taskId, config }); // Отправляем в главное окно

            child.stdout.on("data", (data) => {
                const output = data.toString();

                // Всегда выводим полную информацию в консоль электрона 
                console.log(`STDOUT [Task ${taskId}]:`, output);

                // Для UI фильтруем и отправляем только важные сообщения
                if (output.includes("[TABLE_DATA]") ||
                    output.includes("ERROR") ||
                    output.includes("error") ||
                    (output.includes("[") && output.includes("]"))) {

                    mainWindow?.webContents.send("process-output", { taskId, log: output });
                }
            });

            child.stderr.on("data", (data) => {
                const output = data.toString();

                // Всегда выводим ошибки в консоль
                console.error(`STDERR [Task ${taskId}]:`, output);

                // Ошибки всегда отправляем в UI
                mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] ${output}` });
            });

            child.on("exit", (code) => {
                console.log(`ПРОЦЕСС: Процесс Task ${taskId} (resume) завершился с кодом ${code}`);

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

                mainWindow?.webContents.send("process-exit", { taskId, code });

                // Отправляем уведомление в Telegram
                try {
                    const exitTime = new Date().toISOString();
                    const moduleName = config.module_name || 'неизвестно';

                    const message = `🛑 Процесс остановлен\n\n` +
                        `Задача ID: ${taskId}\n` +
                        `Модуль: ${moduleName}\n` +
                        `Причина: ${exitReason}\n` +
                        `Время работы: ${runTime}с\n` +
                        `Время остановки: ${exitTime}`;

                    telegramBotService.sendSystemNotification(message);
                } catch (error) {
                    console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`, error);
                }
            });
        } catch (error) {
            console.error(`ПРОЦЕСС: Ошибка при возобновлении процесса для Task ${taskId}:`, error);
            // Отправляем ошибку как вывод, чтобы пользователь был уведомлен
            mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] Failed to resume task: ${error.toString()}` });
            mainWindow?.webContents.send("process-error", { taskId, error: error.toString() });
        }
    });


    ipcMain.on("stop-process", (event, taskId) => {
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
                try {
                    const exitTime = new Date().toISOString();
                    const moduleName = processInfo.moduleName || 'неизвестно';

                    const message = `🛑 Процесс остановлен вручную\n\n` +
                        `Задача ID: ${taskId}\n` +
                        `Модуль: ${moduleName}\n` +
                        `Причина: ручная остановка\n` +
                        `Время работы: ${runTime}с\n` +
                        `Время остановки: ${exitTime}`;

                    telegramBotService.sendSystemNotification(message);
                } catch (error) {
                    console.error(`ПРОЦЕСС: Ошибка при отправке уведомления в Telegram:`, error);
                }

                // Убедимся, что убиваем процесс принудительно сразу через treeKill
                console.log(`ПРОЦЕСС: Принудительное завершение процесса ${taskId} через tree-kill`);
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
                    } else {
                        console.log(`ПРОЦЕСС: Процесс ${taskId} и все его дочерние процессы убиты через tree-kill`);
                    }

                    // В любом случае отмечаем процесс как неактивный
                    if (processes[taskId]) {
                        processes[taskId].isActive = false;
                        processes[taskId].exitTime = Date.now();
                        processes[taskId].exitReason = 'killed';
                    }
                });
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

    // Функция для очистки неактивных процессов (запускать периодически)
    const cleanupInactiveProcesses = () => {
        const now = Date.now();
        const taskIds = Object.keys(processes);
        let cleaned = 0;

        for (const taskId of taskIds) {
            const processInfo = processes[taskId];
            // Удаляем процессы, которые неактивны более 5 минут
            if (!processInfo.isActive && (now - processInfo.exitTime > 5 * 60 * 1000)) {
                delete processes[taskId];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`ПРОЦЕСС: Очищено ${cleaned} неактивных процессов из карты`);
        }
    };

    // Запускаем очистку каждые 10 минут
    setInterval(cleanupInactiveProcesses, 10 * 60 * 1000);
}

module.exports = { initializeProcessHandlers };
