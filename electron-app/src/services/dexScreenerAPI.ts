import axios from "axios";
import logger from "../services/loggerService";

export async function checkPairDex(pair: string) {
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`;
    try {
        return (await axios.get(dexScreenerUrl)).data;
    } catch (error) {
        // Типизация error для strict mode
        const err = error as Error & { cause?: unknown };

        logger.info(logger.LOG_MODULES.API, `Error while check for DEX: ${err}`);
        logger.error(logger.LOG_MODULES.API, `Подробная ошибка fetch 1: ${err.message}`);

        if (err.cause) {
            logger.error(logger.LOG_MODULES.API, `Причина ошибки: ${err.cause}`);
        }

        // Проверка сетевых ошибок
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            logger.error(logger.LOG_MODULES.API, 'Сетевая ошибка: не удалось подключиться к серверу');
        }

        return undefined;
    }
}