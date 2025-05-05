import telegramBotService from './telegramBotService';
import mevLoadBalancer from './mevLoadBalancer/mevLoadBalancer';

// Инициализируем команды MEV в Telegram боте
telegramBotService.initMevCommands(mevLoadBalancer);

export {
    telegramBotService,
    mevLoadBalancer
};