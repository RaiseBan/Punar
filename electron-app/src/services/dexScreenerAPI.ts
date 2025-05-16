import axios from "axios";
import logger from "@/services/loggerService";

export async function checkPairDex(pair: string ) {
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`;
    try {
        return (await axios.get(dexScreenerUrl)).data;


    } catch (error) {
        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Error while check for DEX: ${error}`);
        logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Подробная ошибка fetch: ${error.message}`);
        if (error.cause) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Причина ошибки: ${error.cause}`);
        }
        // Можно добавить дополнительные проверки сетевых ошибок
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Сетевая ошибка: не удалось подключиться к серверу');
        }
        return undefined;
    }


}

