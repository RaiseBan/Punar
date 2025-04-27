const telegramBotService = require('./telegramBotService');
const mevLoadBalancer = require('./mevLoadBalancer');

// Инициализируем команды MEV в Telegram боте
telegramBotService.initMevCommands(mevLoadBalancer);

module.exports = {
    telegramBotService,
    mevLoadBalancer
}; 