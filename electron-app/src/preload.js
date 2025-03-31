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

    // saveScriptDirectory: (directory) => ipcRenderer.send("save-script-directory", directory),
    // getScriptDirectory: () => ipcRenderer.invoke('get-script-directory'),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Функция для сворачивания окна
    minimizeWindow: () => ipcRenderer.invoke("minimizeWindow"),

    // Функция для закрытия окна
    closeWindow: () => ipcRenderer.invoke("closeWindow"),

    enableDrag: () => ipcRenderer.send('enable-drag'),

    // Новые методы
    saveConfig: (configType, fileName, content) =>
        ipcRenderer.invoke('save-config', configType, fileName, content),
    getConfigs: (configType) =>
        ipcRenderer.invoke('get-configs', configType),
    getConfig: (configType, fileName) =>
        ipcRenderer.invoke('get-config', configType, fileName),
    deleteConfig: (configType, fileName) =>
        ipcRenderer.invoke('delete-config', configType, fileName),
    getConfigPaths: (configType) =>
        ipcRenderer.invoke('get-config-paths', configType),

    // tensor api:
    tensorAPI: {
        getCollectionInfo: (slug) => ipcRenderer.invoke("get-collectionInfo", slug),
        getCollIdByUrl: (slug) => ipcRenderer.invoke("get-collIdByUrl", slug),
        getNftsForCollection: (collId, limit = 1, onlyListings = false) =>
            ipcRenderer.invoke("get-nftsForCollection", collId, limit, onlyListings),
        getTxHistory: (params) => ipcRenderer.invoke("get-txHistory", params)

    },


    setTelegramBotToken: (token) => ipcRenderer.invoke('telegram-bot:set-token', token),
    getTelegramBotConfig: () => ipcRenderer.invoke('telegram-bot:get-config'),
    sendTelegramTask: (taskData) => ipcRenderer.invoke('telegram-bot:send-task', taskData),

    // Event listeners
    onTelegramRunTask: (callback) => ipcRenderer.on('telegram-bot:run-task', callback),
    onTelegramDeleteTask: (callback) => ipcRenderer.on('telegram-bot:delete-task', callback),


});
