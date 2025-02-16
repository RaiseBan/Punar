// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // Запуск процесса
    startProcess: (config) => ipcRenderer.send("start-process", config),

    // Остановка процесса
    stopProcess: (taskId) => ipcRenderer.send("stop-process", taskId),

    // Возобновление процесса
    resumeProcess: (taskId, config) => ipcRenderer.send("resume-process", { taskId, config }),

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
});
