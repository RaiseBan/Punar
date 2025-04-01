// electron/services/telegramBotService.js
const axios = require('axios');
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { getGlobalConfigDirectory } = require("../utils/wallet");

class TelegramBotService {
    constructor() {
        this.isActive = false;
        this.botToken = '';
        this.chatIds = [];
        this.pollInterval = null;
        this.lastUpdateId = 0;
        this.messageHandlers = new Map();
        this.isPolling = false;
        this.loadConfig();

        // Для отслеживания обработанных callback queries
        this.processedCallbacks = new Set();
    }

    async startStream() {
        if (this.isActive) return { success: false };

        try {
            this.isActive = true;
            this.startPolling();
            return { success: true };
        } catch (err) {
            console.error('Error starting stream:', err);
            this.isActive = false;
            return { success: false };
        }
    }

    async stopStream() {
        this.stopPolling();
        this.isActive = false;
        return { success: true };
    }

    getStatus() {
        return {
            isActive: this.isActive,
            lastActivity: new Date().toISOString()
        };
    }

    loadConfig() {
        try {
            const configPath = path.join(getGlobalConfigDirectory(), 'telegram-bot-config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.botToken = config.botToken || '';
                this.chatIds = config.chatIds || [];
            }
        } catch (error) {
            console.error('Ошибка загрузки конфигурации Telegram бота:', error);
        }
    }

    saveConfig() {
        try {
            const configPath = path.join(getGlobalConfigDirectory(), 'telegram-bot-config.json');
            fs.writeFileSync(configPath, JSON.stringify({
                botToken: this.botToken,
                chatIds: this.chatIds
            }));
        } catch (error) {
            console.error('Ошибка сохранения конфигурации Telegram бота:', error);
        }
    }

    async setBotToken(token) {
        this.stopPolling();

        this.botToken = token;
        this.saveConfig();

        if (this.botToken && this.isActive) {
            try {
                await axios.get(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`);
                this.startPolling();
            } catch (error) {
                console.error('Error clearing webhook:', error);
            }
        }

        return { success: true };
    }

    addChatId(chatId) {
        if (!this.chatIds.includes(chatId)) {
            this.chatIds.push(chatId);
            this.saveConfig();
        }
    }

    removeChatId(chatId) {
        this.chatIds = this.chatIds.filter(id => id !== chatId);
        this.saveConfig();
    }

    async startPolling() {
        if (this.isPolling || this.pollInterval) {
            console.log('Polling already in progress, skipping startPolling call');
            return;
        }

        this.isPolling = true;

        try {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }

            const me = await this.getMe();
            if (!me) {
                console.error('Failed to get bot info, invalid token?');
                this.isPolling = false;
                return;
            }

            const response = await axios.get(`https://api.telegram.org/bot${this.botToken}/getUpdates`, {
                params: { limit: 1, timeout: 5 }
            });

            const updates = response.data.result || [];
            if (updates.length > 0) {
                this.lastUpdateId = updates[updates.length - 1].update_id;
            }

            this.pollInterval = setInterval(() => {
                this.getUpdates().catch(err => {
                    console.error('Error in getUpdates:', err.message);
                });
            }, 3000);

            console.log('Polling started successfully');
        } catch (error) {
            console.error('Error initializing polling:', error);
        } finally {
            this.isPolling = false;
        }
    }

    stopPolling() {
        this.isPolling = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            console.log('Polling stopped');
        }
    }

    async getUpdates() {
        if (!this.botToken || !this.isActive || this.isPolling) return;

        this.isPolling = true;

        try {
            const response = await axios.get(`https://api.telegram.org/bot${this.botToken}/getUpdates`, {
                params: {
                    offset: this.lastUpdateId + 1,
                    timeout: 25
                }
            });

            const updates = response.data.result || [];
            if (updates.length > 0) {
                this.lastUpdateId = updates[updates.length - 1].update_id;

                updates.forEach(update => {
                    if (update.message) {
                        const chatId = update.message.chat.id;

                        this.addChatId(chatId.toString());

                        if (update.message.text) {
                            this.handleIncomingMessage(chatId, update.message);
                        }
                    } else if (update.callback_query) {
                        // Проверка на повторную обработку callback_query
                        if (this.processedCallbacks.has(update.callback_query.id)) {
                            console.log(`Callback query ${update.callback_query.id} уже обработан, пропускаем`);
                            return;
                        }

                        // Добавляем в обработанные
                        this.processedCallbacks.add(update.callback_query.id);

                        // Если набор слишком большой, очищаем старые записи
                        if (this.processedCallbacks.size > 1000) {
                            this.processedCallbacks.clear();
                        }

                        const chatId = update.callback_query.message.chat.id;
                        const callbackData = update.callback_query.data;

                        this.handleCallbackQuery(
                            chatId,
                            callbackData,
                            update.callback_query.message.message_id,
                            update.callback_query.id
                        );
                    }
                });
            }
        } catch (error) {
            if (error.response) {
                console.error(`Telegram API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);

                if (error.response.status === 409) {
                    console.log('Conflict detected, restarting polling...');
                    this.stopPolling();

                    setTimeout(() => {
                        if (this.isActive) {
                            console.log('Attempting to restart polling after conflict');
                            this.startPolling();
                        }
                    }, 10000);
                }
            } else {
                console.error('Error getting updates:', error.message);
            }
        } finally {
            this.isPolling = false;
        }
    }

    async sendMessage(chatId, text, options = {}) {
        if (!this.botToken) return;

        try {
            const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: options.parseMode || 'HTML',
                reply_markup: options.replyMarkup
            });
            return response.data;
        } catch (error) {
            console.error('Ошибка отправки сообщения Telegram:', error.message);
        }
    }

    async editMessageReplyMarkup(chatId, messageId, replyMarkup) {
        if (!this.botToken) return;

        try {
            const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/editMessageReplyMarkup`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: replyMarkup
            });
            return response.data;
        } catch (error) {
            console.error('Ошибка обновления клавиатуры сообщения:', error.message);
        }
    }

    // Добавляем метод для удаления сообщения
    async deleteMessage(chatId, messageId) {
        if (!this.botToken) return;

        try {
            const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/deleteMessage`, {
                chat_id: chatId,
                message_id: messageId
            });
            return response.data;
        } catch (error) {
            console.error('Ошибка удаления сообщения Telegram:', error.message);
        }
    }

    // Метод для ответа на callback query
    async answerCallbackQuery(callbackQueryId, text = null, showAlert = false) {
        if (!this.botToken) return;

        try {
            const data = {
                callback_query_id: callbackQueryId,
                show_alert: showAlert
            };

            if (text) {
                data.text = text;
            }

            const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, data);
            return response.data;
        } catch (error) {
            console.error('Ошибка ответа на callback query:', error.message);
        }
    }

    async sendTaskNotification(taskData) {
        const { taskId, rowIndex, rowId, token, volumeChange, volumeValue, allCells = [] } = taskData;

        const tokenAddress = token.toLowerCase();
        const dexScreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;

        let message = `🚨 <b>Новая MEV возможность</b>\n\n`;

        // Обновляем названия полей согласно реальным заголовкам
        const fieldNames = [
            "Token",
            "Changes",
            "Volume change",
            "PumpSwap volume",
            "Meteora volume",
            "Meteora liquidity"
        ];

        // Добавляем данные с правильными названиями полей
        for (let i = 0; i < allCells.length; i++) {
            if (i < fieldNames.length) {
                message += `<b>${fieldNames[i]}:</b> <code>${allCells[i]}</code>\n`;
            }
        }

        // Добавляем ссылку на DexScreener с более понятным форматированием
        message += `\n<a href="${dexScreenerUrl}">🔍 Посмотреть токен на DexScreener</a>\n\n`;

        // Добавляем призыв к действию
        message += `<b>Выберите действие:</b>`;

        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: "🚀 Запустить Raydium", callback_data: `run_${taskId}_${rowIndex}_raydium_${rowId || ''}` },
                    { text: "🚀 Запустить PumpSwap", callback_data: `run_${taskId}_${rowIndex}_pumpswap_${rowId || ''}` }
                ],
                [
                    { text: "❌ Игнорировать", callback_data: `delete_${taskId}_${rowIndex}_${rowId || ''}` }
                ]
            ]
        };

        for (const chatId of this.chatIds) {
            await this.sendMessage(chatId, message, { replyMarkup });
        }
    }

    handleIncomingMessage(chatId, message) {
        if (message.text.startsWith('/')) {
            const command = message.text.split(' ')[0].substring(1);
            switch (command) {
                case 'start':
                    this.sendMessage(chatId, 'Добро пожаловать в MEV бот! Вы будете получать уведомления о новых MEV возможностях.');
                    break;
                case 'help':
                    this.sendMessage(chatId, 'Команды:\n/start - Запустить бота\n/help - Показать это сообщение\n/tasks - Показать активные задачи');
                    break;
                case 'tasks':
                    this.handleTasksCommand(chatId);
                    break;
            }
            return;
        }
    }

    // Метод для получения задач через IPC
    async getTasks() {
        return new Promise((resolve, reject) => {
            try {
                const { ipcMain, BrowserWindow } = require('electron');
                const mainWindow = BrowserWindow.getAllWindows()[0];

                if (!mainWindow) {
                    console.error('[TG Bot Service] Main window not found for getTasks.');
                    return resolve([]);
                }

                console.log('[TG Bot Service] Setting up one-time listener for telegram-tasks-response...');

                let timeoutId = null;

                // Новый одноразовый обработчик для получения задач
                const responseListener = (event, tasks) => {
                    clearTimeout(timeoutId);
                    console.log(`[TG Bot Service] Received telegram-tasks-response. Tasks count: ${tasks.length}`);

                    if (tasks.length > 0) {
                        console.log('[TG Bot Service] First task received:', JSON.stringify(tasks[0], null, 2));
                    }

                    resolve(tasks);
                };

                // Регистрируем одноразовый слушатель
                ipcMain.once('telegram-tasks-response', responseListener);

                // Устанавливаем таймаут
                timeoutId = setTimeout(() => {
                    ipcMain.removeListener('telegram-tasks-response', responseListener);
                    console.error('[TG Bot Service] Timeout waiting for telegram-tasks-response.');
                    reject(new Error('Таймаут при получении задач'));
                }, 5000);

                // Отправляем запрос в renderer process
                console.log('[TG Bot Service] Sending get-tasks-from-redux to renderer...');
                mainWindow.webContents.send('get-tasks-from-redux');

            } catch (error) {
                console.error('[TG Bot Service] Error setting up IPC for getTasks:', error);
                reject(error);
            }
        });
    }

    // Теперь используем этот метод в handleTasksCommand
    async handleTasksCommand(chatId) {
        try {
            this.sendMessage(chatId, 'Получение списка задач...');

            const tasks = await this.getTasks();

            if (!tasks || tasks.length === 0) {
                this.sendMessage(chatId, 'В данный момент нет активных задач.');
                return;
            }

            // Группируем задачи по токену и изменению
            const groupedTasks = {};

            for (const task of tasks) {
                if (!task.name) continue;

                // Пытаемся извлечь информацию о токене и изменении из имени задачи
                let groupKey = '';

                if (task.name.includes('->')) {
                    // Если есть стрелка, вероятно это MEV задача
                    groupKey = task.name;
                } else {
                    // Иначе используем moduleName в качестве ключа группы
                    groupKey = task.moduleName || 'Другие задачи';
                }

                if (!groupedTasks[groupKey]) {
                    groupedTasks[groupKey] = [];
                }

                groupedTasks[groupKey].push(task);
            }

            // Для каждой группы отправляем одно сообщение
            for (const [groupKey, tasksInGroup] of Object.entries(groupedTasks)) {
                // Формируем сообщение для группы
                let message = `<b>Группа задач:</b>\n${groupKey}\n\n`;

                // Добавляем информацию о каждой задаче в группе
                for (const task of tasksInGroup) {
                    message += `<b>Задача #${task.id}</b>\n`;
                    message += `<b>Модуль:</b> ${task.moduleName}\n`;
                    message += `<b>Статус:</b> ${task.status}\n\n`;
                }

                // Получаем IDs всех задач в этой группе для кнопок
                const taskIdsInGroup = tasksInGroup.map(task => task.id).join(',');

                // Создаем клавиатуру с двумя кнопками для этой группы задач
                const replyMarkup = {
                    inline_keyboard: [
                        [
                            { text: "⏹️ Остановить все задачи", callback_data: `stop_tasks_${taskIdsInGroup}` }
                        ],
                        [
                            { text: "🗑️ Удалить все задачи", callback_data: `remove_tasks_${taskIdsInGroup}` }
                        ]
                    ]
                };

                // Отправляем сообщение для этой группы
                await this.sendMessage(chatId, message, { replyMarkup });
            }
        } catch (error) {
            console.error('[TG Bot Service] Ошибка при получении списка задач:', error);
            this.sendMessage(chatId, 'Произошла ошибка при получении списка задач: ' + error.message);
        }
    }

    handleCallbackQuery(chatId, callbackData, messageId, callbackQueryId) {
        if (callbackData === "noop") return;

        if (callbackData.startsWith('run_')) {
            const parts = callbackData.split('_');
            const taskId = parts[1];
            const rowIndex = parts[2];
            const strategy = parts[3];
            const rowId = parts[4] || undefined;

            console.log(`Telegram callback: run_${taskId}_${rowIndex}_${strategy}_${rowId || 'undefined'}`);

            // Сначала ответим на callback query
            this.answerCallbackQuery(callbackQueryId, "✅ Задача запускается...");

            // Удаляем исходное сообщение вместо изменения клавиатуры
            this.deleteMessage(chatId, messageId)
                .then(() => {
                    if (this.messageHandlers.has('runTask')) {
                        const parsedTaskId = parseInt(taskId);
                        const parsedRowIndex = parseInt(rowIndex);

                        this.messageHandlers.get('runTask')({
                            taskId: parsedTaskId,
                            rowIndex: parsedRowIndex,
                            strategy,
                            rowId: rowId
                        });
                    }

                    // Отправляем новое короткое сообщение
                    this.sendMessage(chatId, `✅ Задача запущена со стратегией ${strategy}.`);
                })
                .catch(err => {
                    console.error('Ошибка при обработке запуска задачи:', err);
                    // Если не удалось удалить, то изменяем клавиатуру
                    const newReplyMarkup = {
                        inline_keyboard: [
                            [
                                { text: "✅ Задача запущена", callback_data: "noop" }
                            ]
                        ]
                    };
                    this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup);
                });
        }
        else if (callbackData.startsWith('delete_')) {
            const parts = callbackData.split('_');
            const taskId = parts[1];
            const rowIndex = parts[2];
            const rowId = parts[3] || undefined;

            console.log(`Telegram callback: delete_${taskId}_${rowIndex}_${rowId || 'undefined'}`);

            // Сначала ответим на callback query
            this.answerCallbackQuery(callbackQueryId, "❌ Задача игнорируется...");

            // Удаляем исходное сообщение вместо изменения клавиатуры
            this.deleteMessage(chatId, messageId)
                .then(() => {
                    if (this.messageHandlers.has('deleteTask')) {
                        const parsedTaskId = parseInt(taskId);
                        const parsedRowIndex = parseInt(rowIndex);

                        this.messageHandlers.get('deleteTask')({
                            taskId: parsedTaskId,
                            rowIndex: parsedRowIndex,
                            rowId: rowId
                        });
                    }

                    // Отправляем новое короткое сообщение
                    this.sendMessage(chatId, `❌ Задача игнорирована.`);
                })
                .catch(err => {
                    console.error('Ошибка при обработке удаления задачи:', err);
                    // Если не удалось удалить, то изменяем клавиатуру
                    const newReplyMarkup = {
                        inline_keyboard: [
                            [
                                { text: "❌ Удалено", callback_data: "noop" }
                            ]
                        ]
                    };
                    this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup);
                });
        }
        // Добавляем обработку команды остановки задачи
        else if (callbackData.startsWith('stop_task_')) {
            const taskId = callbackData.split('_')[2];
            console.log(`Telegram callback: stop_task_${taskId}`);

            // Сначала ответим на callback query
            this.answerCallbackQuery(callbackQueryId, "⏹️ Останавливаем задачу...");

            // Обновляем клавиатуру текущего сообщения
            const newReplyMarkup = {
                inline_keyboard: [
                    [
                        { text: "⏹️ Задача остановлена", callback_data: "noop" }
                    ]
                ]
            };

            this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup)
                .then(() => {
                    if (this.messageHandlers.has('stopTask')) {
                        const parsedTaskId = parseInt(taskId);
                        this.messageHandlers.get('stopTask')({ taskId: parsedTaskId });
                    }

                    this.sendMessage(chatId, `⏹️ Задача ${taskId} остановлена.`);
                })
                .catch(err => {
                    console.error('Ошибка при остановке задачи:', err);
                });
        }
        // Обработка остановки группы задач
        else if (callbackData.startsWith('stop_tasks_')) {
            const taskIdsStr = callbackData.split('_')[2];
            const taskIds = taskIdsStr.split(',').map(id => parseInt(id));

            console.log(`Telegram callback: stop_tasks for IDs: ${taskIdsStr}`);

            // Ответим на callback query
            this.answerCallbackQuery(callbackQueryId, `⏹️ Останавливаем ${taskIds.length} задач...`);

            // Обновляем клавиатуру сообщения
            const newReplyMarkup = {
                inline_keyboard: [
                    [
                        { text: `⏹️ ${taskIds.length} задач остановлены`, callback_data: "noop" }
                    ]
                ]
            };

            this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup)
                .then(() => {
                    // Останавливаем каждую задачу в группе
                    if (this.messageHandlers.has('stopTask')) {
                        const stopHandler = this.messageHandlers.get('stopTask');
                        taskIds.forEach(taskId => {
                            stopHandler({ taskId });
                        });
                    }

                    this.sendMessage(chatId, `⏹️ Остановлено ${taskIds.length} задач.`);
                })
                .catch(err => {
                    console.error('Ошибка при остановке группы задач:', err);
                });
        }
        // Обработка удаления группы задач (остановка + удаление)
        else if (callbackData.startsWith('remove_tasks_')) {
            const taskIdsStr = callbackData.split('_')[2];
            const taskIds = taskIdsStr.split(',').map(id => parseInt(id));

            console.log(`Telegram callback: remove_tasks for IDs: ${taskIdsStr}`);

            // Ответим на callback query
            this.answerCallbackQuery(callbackQueryId, `🗑️ Удаляем ${taskIds.length} задач...`);

            // Обновляем клавиатуру сообщения
            const newReplyMarkup = {
                inline_keyboard: [
                    [
                        { text: `🗑️ ${taskIds.length} задач удалены`, callback_data: "noop" }
                    ]
                ]
            };

            this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup)
                .then(() => {
                    // Сначала останавливаем, потом удаляем каждую задачу
                    if (this.messageHandlers.has('stopTask') && this.messageHandlers.has('removeTask')) {
                        const stopHandler = this.messageHandlers.get('stopTask');
                        const removeHandler = this.messageHandlers.get('removeTask');

                        taskIds.forEach(taskId => {
                            // Сначала останавливаем
                            stopHandler({ taskId });
                            // Затем удаляем
                            removeHandler({ taskId });
                        });
                    }

                    this.sendMessage(chatId, `🗑️ Удалено ${taskIds.length} задач.`);
                })
                .catch(err => {
                    console.error('Ошибка при удалении группы задач:', err);
                });
        }
    }

    registerHandler(event, handler) {
        this.messageHandlers.set(event, handler);
    }

    onTaskRun(handler) {
        this.registerHandler('runTask', handler);
    }

    onTaskDelete(handler) {
        this.registerHandler('deleteTask', handler);
    }

    // Новый метод для регистрации обработчика остановки задачи
    onTaskStop(handler) {
        this.registerHandler('stopTask', handler);
    }

    // Новый метод для регистрации обработчика полного удаления задачи
    onTaskRemove(handler) {
        this.registerHandler('removeTask', handler);
    }

    async getMe() {
        if (!this.botToken) return null;

        try {
            const response = await axios.get(`https://api.telegram.org/bot${this.botToken}/getMe`);
            return response.data.result;
        } catch (error) {
            console.error('Ошибка при получении информации о боте:', error);
            return null;
        }
    }
}

const telegramBotService = new TelegramBotService();

ipcMain.handle('telegram-bot:set-token', (event, token) => {
    console.log(`telegramBotService.set-token`);
    return telegramBotService.setBotToken(token);
});

ipcMain.handle('telegram-bot:get-config', (event) => {
    console.log(`telegramBotService.get-config`);
    return {
        botToken: telegramBotService.botToken,
        chatIds: telegramBotService.chatIds
    };
});

ipcMain.handle('telegram-bot:send-task', (event, taskData) => {
    console.log(`telegramBotService.send-task`);
    return telegramBotService.sendTaskNotification(taskData);
});

ipcMain.handle('telegram-bot:get-status', (event) => {
    return telegramBotService.getStatus();
});

ipcMain.handle('telegram-bot:start-stream', (event) => {
    return telegramBotService.startStream();
});

ipcMain.handle('telegram-bot:stop-stream', (event) => {
    return telegramBotService.stopStream();
});

module.exports = telegramBotService;