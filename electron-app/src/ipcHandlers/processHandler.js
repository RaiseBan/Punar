const { spawn } = require("child_process");
const treeKill = require("tree-kill");
const { getSettings } = require("../utils/fsHelper");
const { spawnProcess, stopMevProcess } = require("../utils/spawnProcess");

const processes = {};

function initializeProcessHandlers(ipcMain, mainWindow) {
    ipcMain.on("start-process", async (event, { taskId, config }) => {
        console.log(`Создан taskId: ${taskId}, запускаем процесс...`);
        const scriptPath = getSettings();
        event.reply("process-started", { taskId, config });
        const child = await spawnProcess(config, scriptPath);
        // const child = spawn("node", ["your_script.js"]);
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
    // Возобновление процесса
    ipcMain.on("resume-process", async (event, { taskId, config }) => {
        console.log(`Resume-process: Task ${taskId}, config:`, config);
        const scriptPath = getSettings();
        console.log(`Resume-process: Spawning process for Task ${taskId}, script path:`, scriptPath);

        try {
            // СНАЧАЛА запускаем процесс
            const child = await spawnProcess(config, scriptPath);
            processes[taskId] = child;
            console.log(`Resume-process: Process spawned for Task ${taskId}, PID:`, child.pid);

            // ЗАТЕМ отправляем события после успешного запуска процесса
            event.reply(`process-started-${taskId}`); // Специфичное для задачи событие
            event.reply("process-started", { taskId, config }); // Общее событие
            mainWindow?.webContents.send("process-started", { taskId, config }); // Отправляем в главное окно

            child.stdout.on("data", (data) => {
                console.log(`STDOUT [Task ${taskId}]:`, data.toString());
                mainWindow?.webContents.send("process-output", { taskId, log: data.toString() });
            });

            child.stderr.on("data", (data) => {
                console.error(`STDERR [Task ${taskId}]:`, data.toString());
                // Отправляем ошибки тоже как вывод, чтобы они отображались в логах
                mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] ${data.toString()}` });
            });

            child.on("exit", (code) => {
                console.log(`Процесс Task ${taskId} (resume) завершился с кодом ${code}`);
                mainWindow?.webContents.send("process-exit", { taskId, code });
            });
        } catch (error) {
            console.error(`Resume-process: Error spawning process for Task ${taskId}:`, error);
            // Отправляем ошибку как вывод, чтобы пользователь был уведомлен
            mainWindow?.webContents.send("process-output", { taskId, log: `[ERROR] Failed to resume task: ${error.toString()}` });
            mainWindow?.webContents.send("process-error", { taskId, error: error.toString() });
        }
    });


    ipcMain.on("stop-process", (event, taskId) => {
        const child = processes[taskId];

        // Сначала останавливаем мониторинг пулов для mev_subtask процессов
        stopMevProcess(taskId);

        if (child && !child.killed) {
            console.log(`Stopping process ${taskId} with PID ${child.pid}`);
            treeKill(child.pid, "SIGKILL", (err) => {
                if (err) console.error(`Ошибка при завершении процесса ${taskId}:`, err);
                else console.log(`Процесс ${taskId} и все его дочерние процессы убиты`);
            });
        }
    });
}

module.exports = { initializeProcessHandlers };
