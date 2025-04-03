// preload.js
const { contextBridge, ipcRenderer } = require("electron");

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
    resumeProcess: (taskId, config) => ipcRenderer.send("resume-process", { taskId, config }),
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

    // Метод для получения логов из файлов
    invoke: (channel, data) => {
        // Разрешаем только безопасные каналы
        const validChannels = ['get-task-logs'];
        if (!validChannels.includes(channel)) {
            console.error(`Попытка вызвать неразрешенный канал: ${channel}`);
            return Promise.reject(new Error(`Неразрешенный канал: ${channel}`));
        }
        return ipcRenderer.invoke(channel, data);
    },

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

    // Добавляем метод для отправки статуса задачи в Telegram
    sendTaskStatus: (taskId) => ipcRenderer.invoke('telegram-bot:send-task-status', taskId),

    // Event listeners
    onTelegramRunTask: (callback) => ipcRenderer.on('telegram-bot:run-task', callback),
    onTelegramDeleteTask: (callback) => ipcRenderer.on('telegram-bot:delete-task', callback),

    getTelegramBotStatus: () => ipcRenderer.invoke('telegram-bot:get-status'),
    startTelegramBotStream: () => ipcRenderer.invoke('telegram-bot:start-stream'),
    stopTelegramBotStream: () => ipcRenderer.invoke('telegram-bot:stop-stream'),

    // Добавляем в объект electronAPI
    onTelegramStopTask: (callback) => ipcRenderer.on('telegram-bot:stop-task', callback),

    // Новый метод для полного удаления задачи
    onTelegramRemoveTask: (callback) => ipcRenderer.on('telegram-bot:remove-task', callback),

    // Новый метод для возобновления задачи
    onTelegramResumeTask: (callback) => ipcRenderer.on('telegram-bot:resume-task', callback),

    // Новые методы для работы с задачами через IPC
    listenForTasks: (callback) => {
        const wrappedCallback = (event) => {
            console.log('[Preload] Received get-tasks-from-redux request from main, forwarding to renderer');
            callback();
        };

        // Сохраняем обертку, чтобы потом можно было удалить слушатель
        ipcRenderer._tasksListener = wrappedCallback;

        // Регистрируем слушатель
        ipcRenderer.on('get-tasks-from-redux', wrappedCallback);
    },

    removeTasksListener: () => {
        if (ipcRenderer._tasksListener) {
            ipcRenderer.removeListener('get-tasks-from-redux', ipcRenderer._tasksListener);
            ipcRenderer._tasksListener = null;
        }
    },

    // Метод для отправки задач в main process
    sendToMain: (channel, data) => {
        if (channel === 'telegram-tasks-response') {
            console.log(`[Preload] Sending ${data.length} tasks to main process`);
            ipcRenderer.send(channel, data);
        }
    },

    // Добавляем новые методы для работы с уведомлениями о смене пула
    onPoolChanged: (callback) => {
        ipcRenderer.on('telegram-notify-pool-change', (event, data) => callback(data));
    },
});

ipcRenderer.on('telegram-get-tasks', () => {
    const tasksState = document.getElementById('redux-store-data');
    let tasks = [];

    if (tasksState) {
        try {
            const state = JSON.parse(tasksState.textContent);
            tasks = state.tasks.tasks;
        } catch (e) {
            console.error('Error parsing tasks:', e);
        }
    }

    // Вместо invoke используем send 
    ipcRenderer.send('telegram-tasks-response', tasks);
});

// Добавляем новый обработчик для запроса задач
ipcRenderer.on('get-tasks-from-redux', (event) => {
    // Log: Request received
    console.log('[Preload] Received get-tasks-from-redux request from main.');
    try {
        // === Проверка перед вызовом ===
        if (typeof window.getReduxState === 'function') {
            // Log: Before getting state
            console.log('[Preload] window.getReduxState function found. Attempting to get Redux state...');
            const state = window.getReduxState();

            // Log: After getting state - show the structure if possible
            if (state && state.tasks) {
                console.log(`[Preload] Got state.tasks. Keys: ${Object.keys(state.tasks)}`);
            } else {
                console.warn('[Preload] Redux state or state.tasks is missing after calling getReduxState.');
            }

            const tasks = state?.tasks?.tasks || [];

            // Log: Extracted tasks
            console.log(`[Preload] Extracted tasks. Is Array: ${Array.isArray(tasks)}, Length: ${tasks.length}`);
            if (tasks.length > 0) {
                console.log('[Preload] First task being sent:', JSON.stringify(tasks[0], null, 2));
            }

            // Log: Before sending response
            console.log('[Preload] Sending tasks-from-redux response back to main.');
            ipcRenderer.send('tasks-from-redux', tasks);
        } else {
            // === Функция еще не готова ===
            console.warn('[Preload] window.getReduxState is not available or not a function yet. Renderer might still be initializing.');
            console.log('[Preload] Sending empty array back to main process.');
            ipcRenderer.send('tasks-from-redux', []); // Отправляем пустой массив
        }
    } catch (error) {
        // Log: Error during processing
        console.error('[Preload] Error getting/sending tasks from Redux:', error);
        // Send empty array in case of error to avoid main process hanging
        console.log('[Preload] Sending empty array due to error.');
        ipcRenderer.send('tasks-from-redux', []);
    }
});
