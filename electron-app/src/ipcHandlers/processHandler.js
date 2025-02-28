const { spawn } = require("child_process");
const treeKill = require("tree-kill");

const processes = {};

function initializeProcessHandlers(ipcMain, mainWindow) {
    ipcMain.on("start-process", (event, { taskId, config }) => {
        console.log(`Создан taskId: ${taskId}, запускаем процесс...`);

        event.reply("process-started", { taskId, config });

        const child = spawn("node", ["your_script.js"]);
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

    ipcMain.on("stop-process", (event, taskId) => {
        const child = processes[taskId];

        if (child && !child.killed) {
            treeKill(child.pid, "SIGKILL", (err) => {
                if (err) console.error(`Ошибка при завершении процесса ${taskId}:`, err);
                else console.log(`Процесс ${taskId} и все его дочерние процессы убиты`);
            });
        }
    });
}

module.exports = { initializeProcessHandlers };
