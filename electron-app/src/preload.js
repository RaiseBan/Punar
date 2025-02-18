// preload.js
const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // Запуск процесса
    startProcess: (taskId, config) => {
        console.log(`start process config: ${JSON.stringify(config, null, 2)}`);
        ipcRenderer.send("start-process", { taskId, config });

        // Уведомляем, что процесс был запущен для этой задачи
        ipcRenderer.once(`process-started-${taskId}`, () => {
            console.log(`Process started for task ${taskId}`);
        });
    },
    resumeProcess: (taskId, config) => ipcRenderer.send("resume-process", {taskId, config}),
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners("process-started");
        ipcRenderer.removeAllListeners("process-output");
        ipcRenderer.removeAllListeners("process-exit");
    },


    // Остановка процесса
    stopProcess: (taskId) => ipcRenderer.send("stop-process", taskId),

    // Возобновление процесса


    // События
    onProcessStarted: (callback) =>
        ipcRenderer.on("process-started", (event, data) => {
            callback(event, data);
        }),

    onProcessOutput: (callback) =>
        ipcRenderer.on("process-output", (event, data) => {
            callback(event, data);
        }),

    onProcessExit: (callback) =>
        ipcRenderer.on("process-exit", (event, data) => {
            callback(event, data);
        }),

    onProcessError: (callback) =>
        ipcRenderer.on("process-error", (event, data) => {
            callback(event, data);
        }),

    // Снятие подписчика
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },

    getWallets: () => ipcRenderer.invoke('getWallets'),
    addWallet: (wallet) => ipcRenderer.invoke('addWallet', wallet),
    deleteWallet: (publicKey) => ipcRenderer.invoke('deleteWallet', publicKey), // Новый метод для удаления кошелька

    saveScriptDirectory: (directory) => ipcRenderer.send("save-script-directory", directory),
    getScriptDirectory: () => ipcRenderer.invoke('get-script-directory')
});
