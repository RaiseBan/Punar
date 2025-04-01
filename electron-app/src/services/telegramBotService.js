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
                        const chatId = update.callback_query.message.chat.id;
                        const callbackData = update.callback_query.data;

                        this.handleCallbackQuery(chatId, callbackData, update.callback_query.message.message_id);
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

    async sendTaskNotification(taskData) {
        const { taskId, rowIndex, token, volumeChange, volumeValue, allCells = [] } = taskData;

        const tokenAddress = token.toLowerCase();

        const dexScreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;

        let message = `🚨 <b>Новая MEV возможность</b>\n\n`;

        message += `Токен: <code>${token}</code>\n`;
        message += `Изменение объема: ${volumeChange}\n`;
        message += `Значение объема: ${volumeValue}\n\n`;

        if (allCells.length > 0) {
            message += "<b>Все данные:</b>\n";
            allCells.forEach((cell, index) => {
                if (cell && cell.trim()) {
                    message += `${index + 1}. <code>${cell}</code>\n`;
                }
            });
            message += "\n";
        }

        message += `<a href="${dexScreenerUrl}">Открыть в DexScreener</a>\n\n`;

        message += `Что хотите сделать?`;

        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: "Запустить - Raydium", callback_data: `run_${taskId}_${rowIndex}_raydium` },
                    { text: "Запустить - PumpSwap", callback_data: `run_${taskId}_${rowIndex}_pumpswap` }
                ],
                [
                    { text: "Игнорировать/Удалить", callback_data: `delete_${taskId}_${rowIndex}` }
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
                    this.sendMessage(chatId, 'Команды:\n/start - Запустить бота\n/help - Показать это сообщение');
                    break;
            }
            return;
        }
    }

    handleCallbackQuery(chatId, callbackData, messageId) {
        if (callbackData.startsWith('run_')) {
            const [_, taskId, rowIndex, strategy] = callbackData.split('_');

            const newReplyMarkup = {
                inline_keyboard: [
                    [
                        { text: "✅ Задача запущена", callback_data: "noop" }
                    ]
                ]
            };

            this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup);

            if (this.messageHandlers.has('runTask')) {
                this.messageHandlers.get('runTask')({
                    taskId: parseInt(taskId),
                    rowIndex: parseInt(rowIndex),
                    strategy
                });
            }

            this.sendMessage(chatId, `Задача ${taskId} запущена со стратегией ${strategy}.`);
        } else if (callbackData.startsWith('delete_')) {
            const [_, taskId, rowIndex] = callbackData.split('_');
            console.log(`Telegram callback: delete_${taskId}_${rowIndex}`);

            const parsedTaskId = parseInt(taskId);
            const parsedRowIndex = parseInt(rowIndex);

            if (isNaN(parsedTaskId) || isNaN(parsedRowIndex)) {
                console.error(`Invalid taskId or rowIndex: ${taskId}, ${rowIndex}`);
                return;
            }

            if (this.messageHandlers.has('deleteTask')) {
                console.log(`Calling deleteTask handler with taskId=${parsedTaskId}, rowIndex=${parsedRowIndex}`);

                this.messageHandlers.get('deleteTask')({
                    taskId: parsedTaskId,
                    rowIndex: parsedRowIndex
                });

                const newReplyMarkup = {
                    inline_keyboard: [
                        [
                            { text: "❌ Удалено", callback_data: "noop" }
                        ]
                    ]
                };

                this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup);
                this.sendMessage(chatId, `Строка ${rowIndex} удалена из задачи ${taskId}.`);
            }
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