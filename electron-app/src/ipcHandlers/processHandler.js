const { spawn } = require("child_process");
const treeKill = require("tree-kill");
const { getSettings } = require("../utils/fsHelper");
const { spawnProcess, stopMevProcess } = require("../utils/spawnProcess");

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
                // Для mev_subtask логируем более сжато
                if (config.module_name === "mev_subtask") {
                    // Логируем только важные сообщения
                    const output = data.toString();
                    if (output.includes("[TABLE_DATA]") || output.includes("ERROR") || output.includes("error")) {
                        console.log(`STDOUT [Task ${taskId}]:`, output);
                        mainWindow?.webContents.send("process-output", { taskId, log: output });
                    }
                } else {
                    // Для остальных модулей логируем все
                    console.log(`STDOUT [Task ${taskId}]:`, data.toString());
                    mainWindow?.webContents.send("process-output", { taskId, log: data.toString() });
                }
            });

            child.stderr.on("data", (data) => {
                console.error(`STDERR [Task ${taskId}]:`, data.toString());
                // Всегда отправляем ошибки, независимо от модуля
                mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] ${data.toString()}` });
            });

            child.on("exit", (code) => {
                console.log(`ПРОЦЕСС: Процесс ${taskId} завершился с кодом ${code}`);
                // Обновляем статус в карте процессов
                if (processes[taskId]) {
                    processes[taskId].isActive = false;
                    processes[taskId].exitCode = code;
                    processes[taskId].exitTime = Date.now();
                }

                mainWindow?.webContents.send("process-exit", { taskId, code });

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
                // Для mev_subtask логируем более сжато
                if (config.module_name === "mev_subtask") {
                    // Логируем только важные сообщения
                    const output = data.toString();
                    if (output.includes("[TABLE_DATA]") || output.includes("ERROR") || output.includes("error")) {
                        console.log(`STDOUT [Task ${taskId}]:`, output);
                        mainWindow?.webContents.send("process-output", { taskId, log: output });
                    }
                } else {
                    // Для остальных модулей логируем все
                    console.log(`STDOUT [Task ${taskId}]:`, data.toString());
                    mainWindow?.webContents.send("process-output", { taskId, log: data.toString() });
                }
            });

            child.stderr.on("data", (data) => {
                console.error(`STDERR [Task ${taskId}]:`, data.toString());
                // Отправляем ошибки тоже как вывод, чтобы они отображались в логах
                mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] ${data.toString()}` });
            });

            child.on("exit", (code) => {
                console.log(`ПРОЦЕСС: Процесс Task ${taskId} (resume) завершился с кодом ${code}`);
                // Обновляем статус в карте процессов
                if (processes[taskId]) {
                    processes[taskId].isActive = false;
                    processes[taskId].exitCode = code;
                    processes[taskId].exitTime = Date.now();
                }

                mainWindow?.webContents.send("process-exit", { taskId, code });
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
                // Убедимся, что убиваем процесс принудительно сразу через treeKill
                console.log(`ПРОЦЕСС: Принудительное завершение процесса ${taskId} через tree-kill`);
                treeKill(pid, "SIGKILL", (err) => {
                    if (err) {
                        console.error(`ПРОЦЕСС: Ошибка при завершении процесса ${taskId}:`, err);
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
