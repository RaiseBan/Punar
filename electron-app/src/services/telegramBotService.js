// electron/services/telegramBotService.js
const axios = require('axios');
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { getGlobalConfigDirectory } = require("../utils/wallet");
const logger = require('../services/loggerService');

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

        // Хранилище для соответствия групп и задач
        this.groupToTasksMap = {};

        // Очередь сообщений для асинхронной отправки
        this.messageQueue = [];
        this.processing = false;

        // Флаги для отслеживания процессов, чтобы избежать дублирования уведомлений
        this.processStatusTracking = new Map();

        // Добавляем хранилище для пользовательских команд
        this.customCommands = new Map();
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

            // Создаем интервал с безопасной функцией
            this.pollInterval = setInterval(() => {
                // Простая синхронная функция в setInterval
                if (this.isActive && !this.isPolling) {
                    this.getUpdates().catch(err => {
                        console.error('Error in getUpdates:', err.message);
                    });
                }
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

                // Обрабатываем каждое обновление без asynchronous
                for (const update of updates) {
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
                            continue;
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
                }
            }
        } catch (error) {
            if (error.response) {
                console.error(`Telegram API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);

                if (error.response.status === 409) {
                    console.log('Conflict detected, restarting polling...');
                    this.stopPolling();

                    // Запускаем через стандартный setTimeout с нормальной функцией
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


        // Константа для лимита сообщения Telegram
        const TELEGRAM_MESSAGE_LIMIT = 4096;

        // Если сообщение короче лимита, отправляем как обычно
        if (!text || text.length <= TELEGRAM_MESSAGE_LIMIT) {
            try {
                // Логируем отправляемый текст для отладки
                console.log(`[TG Bot] Отправка сообщения в чат ${chatId}, длина: ${text?.length || 0} символов`);

                const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                    chat_id: chatId,
                    text,
                    parse_mode: options.parseMode || 'HTML',
                    reply_markup: options.replyMarkup
                });
                return response.data;
            } catch (error) {
                // Расширенное логирование ошибок
                console.error(`[TG Bot] Ошибка отправки сообщения Telegram: ${error.message}`);

                if (error.response) {
                    console.error(`[TG Bot] Статус ошибки: ${error.response.status}`);
                    console.error(`[TG Bot] Ответ API Telegram: ${JSON.stringify(error.response.data)}`);

                    // Если проблема с форматированием HTML
                    if (error.response.data?.description?.includes('can\'t parse entities')) {
                        // Пробуем отправить без HTML-форматирования
                        try {
                            console.log('[TG Bot] Пробуем отправить сообщение без HTML-разметки');
                            const plainResponse = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                                chat_id: chatId,
                                text,
                                parse_mode: '',  // Без форматирования
                                reply_markup: options.replyMarkup
                            });
                            console.log('[TG Bot] Сообщение успешно отправлено без HTML-разметки');
                            return plainResponse.data;
                        } catch (plainError) {
                            console.error(`[TG Bot] Не удалось отправить даже без HTML-разметки: ${plainError.message}`);
                        }
                    }
                }

                // Записываем текст сообщения, вызвавшего ошибку (первые 200 символов для понимания)
                if (text) {
                    const preview = text.substring(0, 200) + (text.length > 200 ? '...' : '');
                    console.error(`[TG Bot] Содержимое сообщения, вызвавшего ошибку (первые 200 символов):\n${preview}`);
                }
            }
        }
        // Если сообщение длиннее лимита, разбиваем на части по строкам
        else {
            console.log(`[TG Bot] Отправка длинного сообщения в чат ${chatId}, длина: ${text.length} символов (будет разбито)`);

            // Разбиваем на части по строкам
            const lines = text.split('\n');
            const messageParts = [];
            let currentPart = '';

            // Собираем строки в части, не превышающие лимит
            for (const line of lines) {
                // Если добавление строки не превысит лимит
                if ((currentPart + line + '\n').length <= TELEGRAM_MESSAGE_LIMIT) {
                    currentPart += line + '\n';
                }
                // Если текущая строка сама по себе превышает лимит
                else if (line.length > TELEGRAM_MESSAGE_LIMIT) {
                    // Если в текущей части что-то есть, добавляем её
                    if (currentPart.length > 0) {
                        messageParts.push(currentPart);
                        currentPart = '';
                    }

                    // Разбиваем длинную строку на несколько частей
                    let remainingLine = line;
                    while (remainingLine.length > 0) {
                        const chunkSize = Math.min(remainingLine.length, TELEGRAM_MESSAGE_LIMIT);
                        messageParts.push(remainingLine.substring(0, chunkSize));
                        remainingLine = remainingLine.substring(chunkSize);
                    }
                }
                // Если добавление превысит лимит, начинаем новую часть
                else {
                    messageParts.push(currentPart);
                    currentPart = line + '\n';
                }
            }

            // Добавляем последнюю часть, если она не пуста
            if (currentPart.length > 0) {
                messageParts.push(currentPart);
            }

            // Отправляем каждую часть
            const responses = [];
            for (let i = 0; i < messageParts.length; i++) {
                const part = messageParts[i];
                console.log(`[TG Bot] Отправка части ${i+1}/${messageParts.length}, длина: ${part.length} символов`);

                try {
                    const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: part,
                        parse_mode: options.parseMode || 'HTML',
                        reply_markup: i === messageParts.length - 1 ? options.replyMarkup : undefined
                    });
                    responses.push(response.data);

                    // Небольшая задержка между отправками
                    if (i < messageParts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } catch (error) {
                    console.error(`[TG Bot] Ошибка отправки части ${i+1}: ${error.message}`);

                    // Если проблема с форматированием HTML
                    if (error.response?.data?.description?.includes('can\'t parse entities')) {
                        try {
                            console.log('[TG Bot] Пробуем отправить часть без HTML-разметки');
                            const plainResponse = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: part,
                                parse_mode: '',
                                reply_markup: i === messageParts.length - 1 ? options.replyMarkup : undefined
                            });
                            responses.push(plainResponse.data);
                        } catch (plainError) {
                            console.error(`[TG Bot] Не удалось отправить часть даже без HTML-разметки: ${plainError.message}`);
                        }
                    }

                    // Записываем проблемный текст
                    const preview = part.substring(0, 200) + (part.length > 200 ? '...' : '');
                    console.error(`[TG Bot] Часть сообщения, вызвавшая ошибку (первые 200 символов):\n${preview}`);
                }
            }

            console.log(`[TG Bot] Отправлено ${responses.length}/${messageParts.length} частей сообщения`);
            return responses.length > 0 ? responses : null;
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

    // Функция для фильтрации логов, чтобы выводить только важные
    filterLogs(logs) {
        if (!Array.isArray(logs) || logs.length === 0) {
            return [];
        }

        // Оставляем только важные логи: ошибки, предупреждения и системные сообщения
        return logs.filter(log => {
            // Проверяем на наличие ключевых слов
            return log.includes("ERROR") ||
                log.includes("error") ||
                log.includes("Warning") ||
                log.includes("warning") ||
                log.includes("[INFO]") ||
                log.includes("[TABLE_DATA]") ||
                log.includes("Starting") ||
                log.includes("Completed") ||
                log.includes("Pool") ||
                log.includes("MONITOR");
        }).slice(-10); // Берем последние 10 записей
    }

    // Экранирование HTML для безопасного вывода в Telegram
    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // Модифицируем sendSystemNotification для работы с очередью
    async sendSystemNotification(message) {
        if (!this.botToken || !this.isActive || this.chatIds.length === 0) {
            return false;
        }

        try {
            // Проверяем, содержит ли сообщение информацию об остановке процесса
            if (message.includes('Процесс остановлен вручную') || message.includes('Задача ID:')) {
                // Извлечем taskId из сообщения, чтобы создать уникальный ключ
                const taskIdMatch = message.match(/Задача ID:\s*(\d+)/i) || message.match(/ID:\s*(\d+)/i);
                const taskId = taskIdMatch ? taskIdMatch[1] : null;

                if (taskId) {
                    // Создаем ключ для отслеживания статуса процесса
                    const statusKey = `task_${taskId}_stopped`;

                    // Если уже отправили уведомление об остановке этого процесса
                    if (this.processStatusTracking.get(statusKey)) {
                        console.log(`Пропускаем дублирующее уведомление об остановке для задачи ${taskId}`);
                        return true; // Пропускаем дублирующее сообщение
                    }

                    // Отмечаем, что отправляем уведомление об остановке
                    this.processStatusTracking.set(statusKey, true);

                    // Очищаем флаг через некоторое время
                    setTimeout(() => {
                        this.processStatusTracking.delete(statusKey);
                    }, 10000); // 10 секунд
                }
            }

            // Отправка сообщения во все разрешенные чаты
            for (const chatId of this.chatIds) {
                await this.sendMessage(chatId, message);
            }
            return true;
        } catch (error) {
            console.error('Error sending system notification:', error);
            return false;
        }
    }

    // Функция для добавления сообщения в очередь
    addMessageToQueue(messageData) {
        this.messageQueue.push(messageData);

        // Запускаем обработку очереди, если она еще не запущена
        if (!this.processing) {
            this.processMessageQueue();
        }
    }

    // Функция для обработки очереди сообщений
    async processMessageQueue() {
        if (this.processing || this.messageQueue.length === 0) {
            return;
        }

        this.processing = true;

        try {
            // Берем сообщение из начала очереди
            const messageData = this.messageQueue.shift();

            console.log(`[TG Bot Queue] Отправка сообщения, осталось в очереди: ${this.messageQueue.length}`);

            // Отправляем сообщение с учетом типа
            if (messageData.type === 'text') {
                await this.sendMessage(
                    messageData.chatId,
                    messageData.text,
                    messageData.options || {}
                );
            } else if (messageData.type === 'notification') {
                // Отправка системного уведомления всем чатам
                if (this.chatIds && this.chatIds.length > 0) {
                    for (const chatId of this.chatIds) {
                        try {
                            await this.sendMessage(chatId, messageData.text);
                            // Небольшая пауза между отправками сообщений
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error(`[TG Bot Queue] Ошибка при отправке уведомления в чат ${chatId}:`, error.message);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[TG Bot Queue] Ошибка при обработке очереди сообщений:', error);
        } finally {
            this.processing = false;

            // Делаем паузу между сообщениями, чтобы не блокировать API
            await new Promise(resolve => setTimeout(resolve, 300));

            // Если в очереди остались сообщения, продолжаем обработку
            if (this.messageQueue.length > 0) {
                this.processMessageQueue();
            }
        }
    }

    /**
     * Обрабатывает входящее сообщение
     * @param {number} chatId - ID чата
     * @param {Object} message - Объект сообщения
     */
    async handleIncomingMessage(chatId, message) {
        try {
            // Проверка авторизации: теперь всегда проверяем, есть ли chatId в списке разрешенных
            const chatIdStr = chatId.toString();
            if (!this.chatIds.includes(chatIdStr)) {
                // Если ID не в списке разрешенных, отправляем сообщение о запрете доступа
                await this.sendMessage(chatId, '⛔ Доступ запрещен. Ваш ID не авторизован для использования бота.');
                console.log(`Попытка неавторизованного доступа к боту с ID ${chatIdStr}`);
                return;
            }

            if (message.text.startsWith('/')) {
                const parts = message.text.split(' ');
                const command = parts[0].substring(1);
                const args = parts.slice(1);

                // Проверяем наличие пользовательской команды
                if (this.customCommands.has(command)) {
                    console.log(`[TG Bot] Вызов пользовательской команды: /${command}`);
                    try {
                        await this.customCommands.get(command)(chatId, args);
                    } catch (error) {
                        console.error(`[TG Bot] Ошибка при выполнении команды /${command}:`, error);
                        await this.sendMessage(chatId, `❌ Ошибка выполнения команды /${command}: ${error.message}`);
                    }
                    return;
                }

                // Стандартные команды
                switch (command) {
                    case 'start':
                        await this.sendMessage(chatId, 'Добро пожаловать в MEV бот! Вы будете получать уведомления о новых MEV возможностях.');
                        break;
                    case 'help':
                        // Формируем список всех доступных команд
                        let helpText = 'Доступные команды:\n';
                        helpText += '/start - Запустить бота\n';
                        helpText += '/help - Показать это сообщение\n';
                        helpText += '/tasks - Показать активные задачи\n';
                        helpText += '/status [taskId] - Показать статус задачи\n';

                        // Добавляем пользовательские команды в справку
                        if (this.customCommands.size > 0) {
                            helpText += '\nКоманды MEV LoadBalancer:\n';
                            helpText += '/mev_status - Статус MEV LoadBalancer\n';
                            helpText += '/mev_start - Запустить MEV LoadBalancer\n';
                            helpText += '/mev_stop - Остановить MEV LoadBalancer\n';
                            helpText += '/mev_processes - Список активных MEV процессов\n';
                            helpText += '/mev_stop_process [processId] - Остановить MEV процесс по ID\n';
                            helpText += '/mev_logs [processId] [lineCount] - Просмотр логов MEV процесса\n';
                            helpText += '/mev_clear_logs [processId] - Очистить логи MEV процесса\n';

                            // Добавляем остальные пользовательские команды
                            const mevCommands = ['mev_status', 'mev_start', 'mev_stop', 'mev_processes', 'mev_stop_process', 'mev_logs', 'mev_clear_logs'];

                            let otherCommands = '';
                            for (const cmd of this.customCommands.keys()) {
                                // Пропускаем команды MEV, которые мы уже добавили выше
                                if (mevCommands.includes(cmd)) continue;

                                otherCommands += `/${cmd} - `;
                                otherCommands += 'Пользовательская команда';
                                otherCommands += '\n';
                            }

                            // Добавляем другие команды только если они есть
                            if (otherCommands) {
                                helpText += '\nДругие пользовательские команды:\n';
                                helpText += otherCommands;
                            }
                        }

                        console.log(`[TG Bot] Сформирован текст справки длиной ${helpText.length} символов`);

                        // Проверяем, что сообщение не превышает максимальную длину
                        if (helpText.length > 3000) {
                            console.log('[TG Bot] Сообщение /help слишком длинное, разбиваем на части');
                            const chunks = this.splitIntoChunks(helpText, 3000);
                            console.log(`[TG Bot] Сообщение разбито на ${chunks.length} частей`);

                            for (let i = 0; i < chunks.length; i++) {
                                try {
                                    const chunkMessage = (i > 0 ? `Продолжение (${i + 1}/${chunks.length}):\n` : '') + chunks[i];
                                    console.log(`[TG Bot] Отправка части ${i + 1}/${chunks.length} длиной ${chunkMessage.length} символов`);

                                    // Отправляем в текстовом формате для избежания проблем с HTML-тегами
                                    await this.sendMessage(chatId, chunkMessage, { parseMode: '' });

                                    // Небольшая задержка между отправкой сообщений, чтобы не превысить лимиты API
                                    if (i < chunks.length - 1) {
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    }
                                } catch (error) {
                                    console.error(`[TG Bot] Ошибка при отправке части ${i + 1} справки: ${error.message}`);
                                }
                            }
                        } else {
                            // Отправляем в текстовом формате для избежания проблем с HTML-тегами
                            await this.sendMessage(chatId, helpText, { parseMode: '' });
                        }
                        break;
                    case 'tasks':
                        await this.handleTasksCommand(chatId);
                        break;
                    case 'status':
                        // Проверяем, есть ли параметр taskId
                        if (args.length > 0) {
                            const taskId = args[0].trim();
                            if (taskId && !isNaN(parseInt(taskId))) {
                                await this.sendMessage(chatId, `Получение статуса задачи #${taskId}...`);
                                await this.sendTaskStatus(taskId);
                            } else {
                                await this.sendMessage(chatId, 'Пожалуйста, укажите корректный ID задачи, например: /status 123');
                            }
                        } else {
                            await this.sendMessage(chatId, 'Пожалуйста, укажите ID задачи, например: /status 123');
                        }
                        break;
                    default:
                        await this.sendMessage(chatId, `Неизвестная команда: /${command}. Введите /help для получения списка команд.`);
                }
                return;
            }
        } catch (error) {
            console.error(`[TG Bot] Ошибка при обработке сообщения: ${error.message}`);
            try {
                await this.sendMessage(chatId, `❌ Произошла ошибка при обработке вашего сообщения: ${error.message}`);
            } catch (sendError) {
                console.error(`[TG Bot] Не удалось отправить сообщение об ошибке: ${sendError.message}`);
            }
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

                // Сначала очищаем предыдущие слушатели, чтобы избежать конфликтов
                ipcMain.removeAllListeners('telegram-tasks-response');

                let timeoutId = null;

                // Новый одноразовый обработчик для получения задач
                const responseListener = (event, tasks) => {
                    clearTimeout(timeoutId);
                    console.log(`[TG Bot Service] Received telegram-tasks-response. Tasks count: ${tasks.length}`);
                    resolve(tasks);
                };

                // Регистрируем одноразовый слушатель
                ipcMain.once('telegram-tasks-response', responseListener);

                // Устанавливаем таймаут (увеличен до 15 секунд)
                timeoutId = setTimeout(() => {
                    ipcMain.removeListener('telegram-tasks-response', responseListener);
                    console.error('[TG Bot Service] Timeout waiting for telegram-tasks-response.');

                    // Вместо отклонения промиса, возвращаем пустой массив
                    console.log('[TG Bot Service] Returning empty array due to timeout');
                    resolve([]);
                }, 15000); // Увеличено с 5000 до 15000 мс

                // Отправляем запрос в renderer process асинхронно с высоким приоритетом
                setImmediate(() => {
                    console.log('[TG Bot Service] Sending get-tasks-from-redux to renderer...');
                    try {
                        mainWindow.webContents.send('get-tasks-from-redux');
                    } catch (sendError) {
                        clearTimeout(timeoutId);
                        console.error('[TG Bot Service] Error sending get-tasks-from-redux:', sendError);
                        resolve([]);
                    }
                });

            } catch (error) {
                console.error('[TG Bot Service] Error setting up IPC for getTasks:', error);
                resolve([]); // Возвращаем пустой массив вместо отклонения промиса
            }
        });
    }

    // Теперь используем этот метод в handleTasksCommand
    async handleTasksCommand(chatId) {
        try {
            await this.sendMessage(chatId, 'Получение списка задач...');

            const tasks = await this.getTasks();

            // console.log('[TG Bot Tasks] Received tasks:', JSON.stringify(tasks));

            if (!tasks || tasks.length === 0) {
                console.log('[TG Bot Tasks] No tasks found');
                await this.sendMessage(chatId, 'В данный момент нет активных задач.');
                return;
            }

            console.log(`[TG Bot Tasks] Total tasks received: ${tasks.length}`);

            // Группируем задачи по токену и изменению
            const groupedTasks = {};
            // Храним соответствие между группами и задачами для callback_data
            const groupToTasksMap = {};
            let groupCounter = 0;

            for (const task of tasks) {
                if (!task.name) {
                    console.log(`[TG Bot Tasks] Task with ID ${task.id} has no name, using moduleName`);
                    continue;
                }

                // Пытаемся извлечь информацию о токене и изменении из имени задачи
                let groupKey = '';

                console.log(`[TG Bot Tasks] Processing task ID ${task.id}, name: "${task.name}"`);

                if (task.name.includes('->')) {
                    // Если есть стрелка, берем ТОЛЬКО часть ДО "->" как ключ группы
                    groupKey = task.name.split('->')[0].trim();
                    console.log(`[TG Bot Tasks] Task has "->", extracted group key: "${groupKey}"`);
                } else {
                    // Иначе используем moduleName в качестве ключа группы
                    groupKey = task.moduleName || 'Другие задачи';
                    console.log(`[TG Bot Tasks] Task has no "->", using moduleName as key: "${groupKey}"`);
                }

                // Если группа с этим ключом еще не создана
                if (!groupedTasks[groupKey]) {
                    groupedTasks[groupKey] = [];
                    // Создаем уникальный идентификатор для этой группы и сохраняем в маппинге
                    const groupId = `g${groupCounter}`;
                    groupToTasksMap[groupId] = {
                        key: groupKey,
                        tasks: []
                    };
                    console.log(`[TG Bot Tasks] Created new group: "${groupKey}" with ID ${groupId}`);
                    groupCounter++;
                }

                // Добавляем задачу в группу
                groupedTasks[groupKey].push(task);

                // Ищем идентификатор группы по ключу группы
                const groupId = Object.keys(groupToTasksMap).find(id =>
                    groupToTasksMap[id].key === groupKey);

                // Добавляем ID задачи в список задач этой группы
                if (groupId) {
                    groupToTasksMap[groupId].tasks.push(task.id);
                    console.log(`[TG Bot Tasks] Added task ${task.id} to group "${groupKey}" (ID: ${groupId}), now ${groupedTasks[groupKey].length} tasks in this group`);
                } else {
                    console.error(`[TG Bot Tasks] Failed to find groupId for group "${groupKey}"`);
                }
            }

            console.log(`[TG Bot Tasks] Groups formed: ${Object.keys(groupedTasks).length}`, Object.keys(groupedTasks));

            // Сохраняем карту групп в памяти для использования в callback_query
            this.groupToTasksMap = {};
            for (const groupId in groupToTasksMap) {
                this.groupToTasksMap[groupId] = groupToTasksMap[groupId].tasks;
            }

            // Для каждой группы отправляем одно сообщение
            let groupIndex = 0;
            for (const [groupKey, tasksInGroup] of Object.entries(groupedTasks)) {
                // Формируем сообщение для группы
                let message = `<b>Группа задач:</b>\n${groupKey}\n\n`;

                // Добавляем информацию о каждой задаче в группе
                for (const task of tasksInGroup) {
                    message += `<b>Задача #${task.id}</b>\n`;
                    message += `<b>Модуль:</b> ${task.moduleName}\n`;
                    message += `<b>Статус:</b> ${task.status}\n\n`;
                }

                // Используем компактный идентификатор группы для callback_data
                const groupId = `g${groupIndex}`;

                // Проверяем, все ли задачи в группе остановлены
                const allTasksStopped = tasksInGroup.every(task => task.status === "Stopped");

                // Создаем клавиатуру с кнопками для этой группы задач
                let inlineKeyboard = [];

                // Если все задачи остановлены, добавляем кнопку запуска
                if (allTasksStopped) {
                    inlineKeyboard.push([
                        { text: "▶️ Запустить все задачи", callback_data: `resume_g_${groupId}` }
                    ]);
                }

                // Всегда добавляем кнопки остановки и удаления
                inlineKeyboard.push([
                    { text: "⏹️ Остановить все задачи", callback_data: `stop_g_${groupId}` }
                ]);
                inlineKeyboard.push([
                    { text: "🗑️ Удалить все задачи", callback_data: `remove_g_${groupId}` }
                ]);

                const replyMarkup = {
                    inline_keyboard: inlineKeyboard
                };

                // Отправляем сообщение для этой группы
                console.log(`[TG Bot Tasks] Sending message for group "${groupKey}" with ${tasksInGroup.length} tasks, using groupId ${groupId}`);
                try {
                    await this.sendMessage(chatId, message, { replyMarkup });
                    console.log(`[TG Bot Tasks] Message sent successfully for group "${groupKey}"`);
                } catch (error) {
                    console.error(`[TG Bot Tasks] Error sending message for group "${groupKey}":`, error.message);
                    // Если сообщение слишком длинное, отправляем упрощенную версию
                    if (error.response && error.response.status === 400) {
                        let shortMessage = `<b>Группа задач:</b>\n${groupKey}\n\n`;
                        shortMessage += `<b>Содержит ${tasksInGroup.length} задач</b>\n`;

                        try {
                            await this.sendMessage(chatId, shortMessage, { replyMarkup });
                            console.log(`[TG Bot Tasks] Shortened message sent successfully for group "${groupKey}"`);
                        } catch (err) {
                            console.error(`[TG Bot Tasks] Failed to send even shortened message:`, err.message);
                        }
                    }
                }

                groupIndex++;
            }
        } catch (error) {
            console.error('[TG Bot Service] Ошибка при получении списка задач:', error);
            await this.sendMessage(chatId, 'Произошла ошибка при получении списка задач: ' + error.message);
        }
    }

    handleCallbackQuery(chatId, callbackData, messageId, callbackQueryId) {
        // Обрабатываем callback запрос приоритетно
        setImmediate(async () => {
            try {
                if (callbackData === "noop") return;

                // Сразу отвечаем на callback, чтобы убрать часы загрузки в Telegram
                try {
                    await this.answerCallbackQuery(callbackQueryId, "⏳ Обработка запроса...");
                } catch (error) {
                    console.error('[TG Bot] Ошибка при ответе на callback query:', error);
                    // Продолжаем выполнение даже если не смогли ответить
                }

                // Далее оставляем логику обработки в зависимости от типа запроса
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
                // Обработка запуска группы задач
                else if (callbackData.startsWith('resume_g_')) {
                    const groupId = callbackData.split('_')[2];

                    if (!this.groupToTasksMap || !this.groupToTasksMap[groupId]) {
                        console.error(`[TG Bot] Group ${groupId} not found in groupToTasksMap`);
                        this.answerCallbackQuery(callbackQueryId, "❌ Ошибка: группа не найдена");
                        return;
                    }

                    const taskIds = this.groupToTasksMap[groupId];
                    console.log(`Telegram callback: resume_g_${groupId} for tasks:`, taskIds);

                    // Ответим на callback query
                    this.answerCallbackQuery(callbackQueryId, `▶️ Запускаем ${taskIds.length} задач...`);

                    // Обновляем клавиатуру сообщения
                    const newReplyMarkup = {
                        inline_keyboard: [
                            [
                                { text: `▶️ ${taskIds.length} задач запущены`, callback_data: "noop" }
                            ]
                        ]
                    };

                    this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup)
                        .then(() => {
                            // Запускаем каждую задачу в группе
                            if (this.messageHandlers.has('resumeTask')) {
                                const resumeHandler = this.messageHandlers.get('resumeTask');
                                taskIds.forEach(taskId => {
                                    resumeHandler({ taskId });
                                });
                            }

                            this.sendMessage(chatId, `▶️ Запущено ${taskIds.length} задач.`);
                        })
                        .catch(err => {
                            console.error('Ошибка при запуске группы задач:', err);
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
                // Обработка остановки группы задач по ID группы
                else if (callbackData.startsWith('stop_g_')) {
                    const groupId = callbackData.split('_')[2];

                    if (!this.groupToTasksMap || !this.groupToTasksMap[groupId]) {
                        console.error(`[TG Bot] Group ${groupId} not found in groupToTasksMap`);
                        this.answerCallbackQuery(callbackQueryId, "❌ Ошибка: группа не найдена");
                        return;
                    }

                    const taskIds = this.groupToTasksMap[groupId];
                    console.log(`Telegram callback: stop_g_${groupId} for tasks:`, taskIds);

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
                // Обработка удаления группы задач по ID группы
                else if (callbackData.startsWith('remove_g_')) {
                    const groupId = callbackData.split('_')[2];

                    if (!this.groupToTasksMap || !this.groupToTasksMap[groupId]) {
                        console.error(`[TG Bot] Group ${groupId} not found in groupToTasksMap`);
                        this.answerCallbackQuery(callbackQueryId, "❌ Ошибка: группа не найдена");
                        return;
                    }

                    const taskIds = this.groupToTasksMap[groupId];
                    console.log(`Telegram callback: remove_g_${groupId} for tasks:`, taskIds);

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
                // Обработка остановки группы задач (старый метод, для обратной совместимости)
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
                // Обработка удаления группы задач (старый метод, для обратной совместимости)
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
                // Обработка возобновления одиночной задачи
                else if (callbackData.startsWith('resume_task_')) {
                    const taskId = callbackData.split('_')[2];
                    console.log(`Telegram callback: resume_task_${taskId}`);

                    // Сначала ответим на callback query
                    this.answerCallbackQuery(callbackQueryId, "▶️ Запускаем задачу...");

                    // Обновляем клавиатуру текущего сообщения
                    const newReplyMarkup = {
                        inline_keyboard: [
                            [
                                { text: "▶️ Задача запущена", callback_data: "noop" }
                            ]
                        ]
                    };

                    this.editMessageReplyMarkup(chatId, messageId, newReplyMarkup)
                        .then(() => {
                            if (this.messageHandlers.has('resumeTask')) {
                                const parsedTaskId = parseInt(taskId);
                                this.messageHandlers.get('resumeTask')({ taskId: parsedTaskId });
                            }

                            this.sendMessage(chatId, `▶️ Задача ${taskId} запущена.`)
                                .then(() => {
                                    // Обновляем статус задачи после запуска
                                    setTimeout(() => {
                                        if (typeof this.sendTaskStatus === 'function') {
                                            this.sendTaskStatus(taskId);
                                        }
                                    }, 3000); // Даем время на запуск
                                });
                        })
                        .catch(err => {
                            console.error('Ошибка при запуске задачи:', err);
                        });
                }
            } catch (error) {
                console.error('[TG Bot] Ошибка в обработке callback запроса:', error);
            }
        });
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

    // Новый метод для регистрации обработчика запуска задачи
    onTaskResume(handler) {
        this.registerHandler('resumeTask', handler);
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

    // Добавляем метод регистрации пользовательских команд
    registerCommand(command, handler) {
        if (!command || typeof handler !== 'function') {
            console.error('[TG Bot] Ошибка регистрации команды: неверные параметры');
            return false;
        }

        console.log(`[TG Bot] Регистрация новой команды: /${command}`);
        this.customCommands.set(command, handler);
        return true;
    }

    /**
     * Разбивает текст на части с учетом ограничений Telegram
     * @param {string} text - Текст для разбиения
     * @param {number} maxLength - Максимальная длина части (по умолчанию 3000)
     * @returns {string[]} - Массив частей текста
     */
    splitIntoChunks(text, maxLength = 3000) {
        if (!text) return [];
        if (text.length <= maxLength) return [text];

        const chunks = [];
        let currentChunk = '';

        // Разбиваем по строкам для сохранения целостности команд
        const lines = text.split('\n');

        for (const line of lines) {
            // Если текущая строка слишком длинная, разбиваем её дополнительно
            if (line.length > maxLength) {
                // Если в текущем куске уже что-то есть, завершаем его
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }

                // Разбиваем длинную строку на части
                let remainingLine = line;
                while (remainingLine.length > 0) {
                    const chunkSize = Math.min(maxLength, remainingLine.length);
                    chunks.push(remainingLine.substring(0, chunkSize));
                    remainingLine = remainingLine.substring(chunkSize);
                }
                continue;
            }

            // Если добавление строки превысит лимит, начинаем новый кусок
            if (currentChunk.length + line.length + 1 > maxLength) {
                chunks.push(currentChunk);
                currentChunk = line;
            } else {
                // Иначе добавляем к текущему куску
                if (currentChunk) currentChunk += '\n';
                currentChunk += line;
            }
        }

        // Добавляем последний кусок, если он есть
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Инициализирует команды для работы с MEV через Telegram
     * @param {Object} mevLoadBalancer - Экземпляр класса MevLoadBalancer
     */
    initMevCommands(mevLoadBalancer) {
        console.log('[TG Bot] Инициализация команд для работы с MEV LoadBalancer');

        if (!mevLoadBalancer) {
            console.error('[TG Bot] Ошибка инициализации MEV команд: mevLoadBalancer не передан');
            return;
        }

        // Команда для получения статуса MEV LoadBalancer
        this.registerCommand('mev_status', async (chatId) => {
            try {
                const status = mevLoadBalancer.getStatus();
                let statusMessage = '📊 <b>Статус MEV LoadBalancer</b>\n\n';
                statusMessage += `Активен: ${status.isActive ? '✅' : '❌'}\n`;
                statusMessage += `Всего процессов: ${status.processCount}\n`;
                // statusMessage += `Активных процессов: ${status.activeProcesses}\n`;
                // statusMessage += `Найдено сигналов: ${status.mevSignals}\n`;

                this.sendMessage(chatId, statusMessage);
            } catch (error) {
                console.error('[TG Bot] Ошибка при получении статуса MEV LoadBalancer:', error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда для запуска MEV LoadBalancer
        this.registerCommand('mev_start', async (chatId) => {
            try {
                const result = mevLoadBalancer.start();
                this.sendMessage(chatId, result.success
                    ? '✅ MEV LoadBalancer успешно запущен'
                    : `❌ Ошибка запуска MEV LoadBalancer: ${result.error}`);
            } catch (error) {
                console.error('[TG Bot] Ошибка при запуске MEV LoadBalancer:', error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда для остановки MEV LoadBalancer
        this.registerCommand('mev_stop', async (chatId) => {
            try {
                const result = mevLoadBalancer.stop();
                this.sendMessage(chatId, result.success
                    ? '✅ MEV LoadBalancer успешно остановлен'
                    : `❌ Ошибка остановки MEV LoadBalancer: ${result.error}`);
            } catch (error) {
                console.error('[TG Bot] Ошибка при остановке MEV LoadBalancer:', error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда для получения списка активных MEV процессов
        this.registerCommand('mev_processes', async (chatId) => {
            try {
                const processes = mevLoadBalancer.getProcesses();

                if (processes.length === 0) {
                    this.sendMessage(chatId, '📊 Активные MEV процессы отсутствуют');
                    return;
                }

                let message = '📊 <b>Активные MEV процессы</b>\n\n';
                let i = 1;
                for (const proc of processes) {
                    const runtime = Math.floor((Date.now() - proc.startTime) / 1000 / 60); // в минутах

                    message += `<b>${i}. ID:</b> <code>${proc.id}</code> (PID: ${proc.pid || 'неизвестно'})\n`;
                    message += `<b>${i}. Token:</b> <code>${proc.tokenAddress}</code>\n`;
                    message += `<b>${i}. Meteora pool:</b> <code>${proc.meteoraPool ? proc.meteoraPool : 'N/A'}</code>\n`;
                    message += `<b>${i}. Pumpswap pool:</b> <code>${proc.pumpSwapPool ? proc.pumpSwapPool : 'N/A'}</code>\n`;
                    message += `<b>${i}. Uptime:</b> ${runtime} min.\n`;
                    message += `<b>${i}. DELETE:</b> <code>/mev_stop_process ${proc.id}</code>\n`;
                    message += `<b>============================================</b>\n`;

                    i++;

                }

                this.sendMessage(chatId, message);
            } catch (error) {
                console.error('[TG Bot] Ошибка при получении списка MEV процессов:', error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        this.registerCommand('get_add_dump', async (chatId) => {
            try{
                const processes = mevLoadBalancer.getProcesses();


                if (processes.length === 0) {
                    this.sendMessage(chatId, '📊 Активные MEV процессы отсутствуют');
                    return;
                }
                let message = '📊 <b>___COMMANDS___</b>\n\n';
                let i = 1;
                for (const proc of processes){
                    message += `${i}. <b>ID:</b> <code>${proc.id}</code> (PID: ${proc.pid || 'неизвестно'})\n`;
                    message += `${i}. <code>/mev_add_signal ${proc.tokenAddress} ${proc.meteoraPool} ${proc.pumpSwapPool}</code>\n`;
                    message += `<b>============================================</b>\n`;
                    i++;
                }


            }catch(error){
                console.error('[TG Bot] Ошибка:', error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда для остановки MEV процесса по ID
        this.registerCommand('mev_stop_process', async (chatId, args) => {
            if (!args || args.length === 0) {
                this.sendMessage(chatId, '❌ Необходимо указать ID процесса. Пример: /mev_stop_process abc123');
                return;
            }

            const processId = args[0];

            try {
                logger.info(logger.LOG_MODULES.TELEGRAM_SERVICE, `Остановка MEV процесса ${processId} по запросу из Telegram`);
                const result = await mevLoadBalancer.stopProcess(processId, true);

                if (result.success) {
                    logger.success(logger.LOG_MODULES.TELEGRAM_SERVICE, `MEV процесс ${processId} успешно остановлен`);
                    this.sendMessage(chatId, `✅ MEV процесс ${processId} успешно остановлен`);
                } else {
                    logger.error(logger.LOG_MODULES.TELEGRAM_SERVICE, `Ошибка остановки MEV процесса: ${result.error}`, { processId });
                    this.sendMessage(chatId, `❌ Ошибка остановки MEV процесса: ${result.error}`);
                }
            } catch (error) {
                logger.error(logger.LOG_MODULES.TELEGRAM_SERVICE, `Ошибка при остановке MEV процесса ${processId}`, error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда для просмотра логов MEV процесса
        this.registerCommand('mev_logs', async (chatId, args) => {
            if (!args || args.length === 0) {
                this.sendMessage(chatId, '❌ Необходимо указать ID процесса. Пример: /mev_logs abc123 [количество_строк]');
                return;
            }

            const processId = args[0];
            const lineCount = args[1] ? parseInt(args[1]) : 100;

            try {
                console.log(`[TG Bot] Запрос логов для процесса ${processId}, количество строк: ${lineCount}`);

                // Получаем путь к директории логов для отладки
                const logDir = path.join(app.getPath('userData'), 'logs');
                const logFilePath = path.join(logDir, `mev_${processId}.log`);

                console.log(`[TG Bot] Путь к файлу логов: ${logFilePath}`);

                // Проверяем существование директории логов
                if (!fs.existsSync(logDir)) {
                    console.log(`[TG Bot] Директория логов не существует, создаём: ${logDir}`);
                    fs.mkdirSync(logDir, { recursive: true });
                }

                // Проверяем существование файла логов
                const fileExists = fs.existsSync(logFilePath);
                console.log(`[TG Bot] Файл логов ${fileExists ? 'существует' : 'не существует'}`);

                if (!fileExists) {
                    this.sendMessage(chatId, `⚠️ Лог-файл для процесса ${processId} не найден (путь: ${logFilePath})`);
                    return;
                }

                const logs = await mevLoadBalancer.getProcessLogs(processId, lineCount);

                if (!logs || logs.length === 0) {
                    this.sendMessage(chatId, `📜 Логи для процесса ${processId} отсутствуют или файл пуст`);
                    return;
                }

                let message = `📜 <b>Логи процесса ${processId}</b> (последние ${logs.length} строк):\n\n`;
                message += logs.join('\n');

                // Разбиваем на части, если сообщение слишком длинное
                const chunks = this.splitIntoChunks(message);

                for (let i = 0; i < chunks.length; i++) {
                    const prefix = chunks.length > 1 ? `Часть ${i + 1}/${chunks.length}: ` : '';
                    await this.sendMessage(chatId, prefix + chunks[i]);
                }
            } catch (error) {
                console.error(`[TG Bot] Ошибка при получении логов процесса ${processId}:`, error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда для очистки логов MEV процесса
        this.registerCommand('mev_clear_logs', async (chatId, args) => {
            if (!args || args.length === 0) {
                this.sendMessage(chatId, '❌ Необходимо указать ID процесса. Пример: /mev_clear_logs abc123');
                return;
            }

            const processId = args[0];

            try {
                const logDir = path.join(app.getPath('userData'), 'logs');
                const logFilePath = path.join(logDir, `mev_${processId}.log`);

                if (!fs.existsSync(logFilePath)) {
                    this.sendMessage(chatId, `⚠️ Лог-файл для процесса ${processId} не найден`);
                    return;
                }

                // Очищаем файл логов
                fs.writeFileSync(logFilePath, '', 'utf8');

                this.sendMessage(chatId, `✅ Логи процесса ${processId} успешно очищены`);
            } catch (error) {
                console.error(`[TG Bot] Ошибка при очистке логов процесса ${processId}:`, error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });


        // Команда для добавления MEV сигнала
        this.registerCommand('mev_add_signal', async (chatId, args) => {
            if (!args || args.length < 2) {
                this.sendMessage(chatId, '❌ Неверный формат команды. Использование: \n/mev_add_signal <token_address> <meteora_pool> [pumpswap_pool]');
                return;
            }

            const tokenAddress = args[0];
            const meteoraPool = args[1];
            const pumpSwapPool = args.length > 2 ? args[2] : null;

            try {
                logger.info(logger.LOG_MODULES.TELEGRAM_SERVICE, `[TG Bot] Добавление MEV сигнала: ${tokenAddress}, ${meteoraPool}${pumpSwapPool ? ', ' + pumpSwapPool : ''}`);

                const signal = {
                    tokenAddress,
                    meteoraPool,
                    pumpSwapPool,
                    timestamp: Date.now()
                };

                const result = mevLoadBalancer.handleExternalMevSignal(signal, 'telegram_' + chatId);

                if (result.success) {
                    this.sendMessage(chatId, `✅ MEV сигнал успешно добавлен в буфер (общий размер буфера: ${result.bufferSize || 'неизвестно'})`);
                } else {
                    this.sendMessage(chatId, `❌ Ошибка добавления MEV сигнала: ${result.error}`);
                }
            } catch (error) {
                logger.error(logger.LOG_MODULES.TELEGRAM_SERVICE, '[TG Bot] Ошибка при добавлении MEV сигнала:', error);
                this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        logger.info(logger.LOG_MODULES.TELEGRAM_SERVICE, '[TG Bot] MEV команды успешно инициализированы');
    }
}

// Создаем и экспортируем экземпляр
const telegramBotService = new TelegramBotService();
module.exports = telegramBotService;

// Восстанавливаем метод sendTaskStatus, но с безопасной обработкой ошибок
// Функция отправки статуса задачи
async function sendTaskStatus(taskId) {
    try {
        console.log(`[TG Bot] Отправка статуса для задачи ${taskId}`);

        const tasks = await telegramBotService.getTasks();

        if (!tasks || tasks.length === 0) {
            console.log(`[TG Bot] Задачи не найдены при отправке статуса`);
            return;
        }

        const task = tasks.find(t => t.id === parseInt(taskId));

        if (!task) {
            console.log(`[TG Bot] Задача ${taskId} не найдена для отправки статуса`);
            return;
        }

        // Фильтруем логи, чтобы показать только важные
        const filteredLogs = telegramBotService.filterLogs(task.logs);

        // Формируем сообщение
        let message = `📊 <b>Статус задачи #${task.id}</b>\n\n`;
        message += `<b>Название:</b> ${telegramBotService.escapeHtml(task.name)}\n`;
        message += `<b>Модуль:</b> ${telegramBotService.escapeHtml(task.moduleName)}\n`;
        message += `<b>Статус:</b> ${task.status}\n\n`;

        if (filteredLogs.length > 0) {
            message += `<b>Последние важные события:</b>\n`;
            for (const log of filteredLogs) {
                // Ограничиваем длину лога для читаемости
                const trimmedLog = log.length > 100 ? log.substring(0, 97) + '...' : log;
                message += `• ${telegramBotService.escapeHtml(trimmedLog)}\n`;
            }
        } else {
            message += `<i>Нет важных логов для отображения</i>\n`;
        }

        // Добавляем кнопки управления
        const replyMarkup = {
            inline_keyboard: [
                [
                    {
                        text: task.status === "Running" ? "⏹️ Остановить" : "▶️ Запустить",
                        callback_data: task.status === "Running" ? `stop_task_${task.id}` : `resume_task_${task.id}`
                    }
                ],
                [
                    { text: "🗑️ Удалить", callback_data: `remove_g_${task.id}` }
                ]
            ]
        };

        // Отправка сообщения всем чатам асинхронно
        if (telegramBotService.chatIds && telegramBotService.chatIds.length > 0) {
            for (const chatId of telegramBotService.chatIds) {
                try {
                    await telegramBotService.sendMessage(chatId, message, { replyMarkup });
                    console.log(`[TG Bot] Статус задачи ${taskId} отправлен в чат ${chatId}`);
                } catch (chatError) {
                    console.error(`[TG Bot] Ошибка при отправке статуса в чат ${chatId}:`, chatError);
                }
            }
        }

        return true;
    } catch (error) {
        console.error(`[TG Bot] Ошибка при отправке статуса задачи ${taskId}:`, error);
        return false;
    }
}

// Добавляем метод sendTaskStatus к сервису
telegramBotService.sendTaskStatus = sendTaskStatus;

// Восстанавливаем обработчики IPC
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

ipcMain.handle('telegram-bot:send-task-status', (event, taskId) => {
    console.log(`telegramBotService.send-task-status для задачи ${taskId}`);
    return telegramBotService.sendTaskStatus(taskId);
});