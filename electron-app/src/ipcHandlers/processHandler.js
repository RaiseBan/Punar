const { spawn } = require("child_process");
const treeKill = require("tree-kill");
const { getSettings } = require("../utils/fsHelper");
const { spawnProcess, stopMevProcess } = require("../utils/spawnProcess");

const processes = {};

function initializeProcessHandlers(ipcMain, mainWindow) {
    ipcMain.on("start-process", async (event, { taskId, config }) => {
        console.log(`ПРОЦЕСС: Создан taskId: ${taskId}, запускаем процесс...`);
        const scriptPath = getSettings();
        event.reply("process-started", { taskId, config });

        try {
            const child = await spawnProcess(config, scriptPath);
            // const child = spawn("node", ["your_script.js"]);
            processes[taskId] = child;
            console.log(`ПРОЦЕСС: Процесс ${taskId} успешно запущен, PID: ${child.pid}`);

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
                mainWindow?.webContents.send("process-exit", { taskId, code });
                // Удаляем процесс из списка
                delete processes[taskId];
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
            processes[taskId] = child;
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
                mainWindow?.webContents.send("process-exit", { taskId, code });
                // Удаляем процесс из списка
                delete processes[taskId];
            });
        } catch (error) {
            console.error(`ПРОЦЕСС: Ошибка при возобновлении процесса для Task ${taskId}:`, error);
            // Отправляем ошибку как вывод, чтобы пользователь был уведомлен
            mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] Failed to resume task: ${error.toString()}` });
            mainWindow?.webContents.send("process-error", { taskId, error: error.toString() });
        }
    });


    ipcMain.on("stop-process", (event, taskId) => {
        const child = processes[taskId];
        console.log(`ПРОЦЕСС: Остановка процесса ${taskId}`);

        // Сначала останавливаем мониторинг пулов для mev_subtask процессов
        stopMevProcess(taskId);

        if (child && !child.killed) {
            console.log(`ПРОЦЕСС: Остановка процесса ${taskId} с PID ${child.pid}`);
            treeKill(child.pid, "SIGKILL", (err) => {
                if (err) {
                    console.error(`ПРОЦЕСС: Ошибка при завершении процесса ${taskId}:`, err);
                } else {
                    console.log(`ПРОЦЕСС: Процесс ${taskId} и все его дочерние процессы убиты`);
                    // Удаляем процесс из списка
                    delete processes[taskId];
                }
            });
        } else {
            console.log(`ПРОЦЕСС: Процесс ${taskId} не найден или уже остановлен`);
        }
    });
}

module.exports = { initializeProcessHandlers };
