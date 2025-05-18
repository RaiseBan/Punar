import {PairInfo, Pools, ProcessConfig, ProcessesToManage, SignalWithMeta, UsageMeteoraPools} from "@/types/types";
import {MevLoadBalancer} from "./mevLoadBalancer";
import logger from "../loggerService";
import {checkPairDex} from "../../services/dexScreenerAPI";

export async function structConfig<T extends MevLoadBalancer>(
    target: T,
    tokenAddress: string,
    meteoraPools: string[],
    pumpSwapPool?: string,
    raydiumPool?: string,
    dammMeteora?: string,
    type?: string
): Promise<ProcessConfig> {
    // Создаем копию массива, чтобы не модифицировать исходный
    const updatedMeteoraPools = [...meteoraPools];

    // Если у нас только один пул Meteora, пробуем добавить самый ликвидный пул из существующих
    if (updatedMeteoraPools.length === 1) {
        try {
            // Получаем все существующие пулы для данного токена, исключая текущий пул
            const existingPools = getAllMeteoraPoolsForToken(target, tokenAddress, updatedMeteoraPools[0]);

            if (existingPools.length > 0) {
                logger.info(
                    logger.LOG_MODULES.MEV_LOAD_BALANCER,
                    `Найдено ${existingPools.length} существующих пулов Meteora для токена ${tokenAddress}`
                );

                // Находим самый ликвидный пул
                const mostLiquidPool = await findMostLiquidPool(existingPools);

                if (mostLiquidPool) {
                    // Добавляем к копии массива, а не к оригиналу
                    updatedMeteoraPools.push(mostLiquidPool.pool);

                    logger.info(
                        logger.LOG_MODULES.MEV_LOAD_BALANCER,
                        `Добавляем самый ликвидный пул ${mostLiquidPool.pool} (ликвидность: ${mostLiquidPool.liquidity} USD) к конфигурации для токена ${tokenAddress}`
                    );
                }
            } else {
                logger.info(
                    logger.LOG_MODULES.MEV_LOAD_BALANCER,
                    `Не найдено других пулов Meteora для токена ${tokenAddress}`
                );
            }
        } catch (error) {
            logger.error(
                logger.LOG_MODULES.MEV_LOAD_BALANCER,
                `Ошибка при поиске дополнительного ликвидного пула: ${error.message}`
            );
        }
    }

    // Формируем и возвращаем конфигурацию с обновленным массивом пулов
    const struct = {
        tokenAddress,
        meteoraPools: updatedMeteoraPools, // Используем обновленную копию
        pumpSwapPool: pumpSwapPool ? pumpSwapPool : undefined,
        raydiumPool: raydiumPool ? raydiumPool : undefined,
        dammMeteoraPool: dammMeteora ? dammMeteora : undefined,
        type: type,
        main_rpc: target.userSettings?.mainRpc || "https://api.mainnet-beta.solana.com",
        useJito: true,
        jito_lower_bound: Number(target.userSettings!.jito_lower_bound), // deprecated
        jito_upper_bound: Number(target.userSettings!.jito_upper_bound), // deprecated
        process_delay: null,
        task_name: `mev_task_${Date.now().toString().substring(8, 13)}`
    };

    logger.info(logger.LOG_MODULES.CONFIG_SERVICE, `STRUCT CONFIG::: ${JSON.stringify(struct, null, 2)}`);
    return struct;
}


function getAllMeteoraPoolsForToken<T extends MevLoadBalancer>(
    target: T,
    tokenAddress: string,
    excludePool: string
): string[] {
    // Получаем структуру с пулами для токена
    const meteoraUsageForToken = target.getMeteoraUsagePoolsByToken(tokenAddress);
    if (!meteoraUsageForToken) {
        return [];
    }

    // Собираем все пулы Meteora из всех процессов
    const allPools: string[] = [];
    for (const pairInfo of meteoraUsageForToken.pairs.values()) {
        // Добавляем только те пулы, которые не совпадают с исключаемым
        for (const pool of pairInfo.activePools) {
            if (pool !== excludePool && !allPools.includes(pool)) {
                allPools.push(pool);
            }
        }
    }

    return allPools;
}




async function findMostLiquidPool(pools: string[]): Promise<{pool: string, liquidity: number} | null> {
    if (pools.length === 0) {
        return null;
    }

    try {
        // Получаем информацию о ликвидности для каждого пула
        const poolsWithLiquidity = await Promise.all(
            pools.map(async (pool) => {
                try {
                    const data = await checkPairDex(pool);
                    const liquidity = data?.pair?.liquidity?.usd || 0;
                    return { pool, liquidity };
                } catch (error) {
                    logger.error(
                        logger.LOG_MODULES.MEV_LOAD_BALANCER,
                        `Ошибка при получении ликвидности для пула ${pool}: ${error.message}`
                    );
                    return { pool, liquidity: 0 };
                }
            })
        );

        // Находим пул с максимальной ликвидностью
        let maxLiquidityPool = poolsWithLiquidity[0];
        for (const item of poolsWithLiquidity) {
            if (item.liquidity > maxLiquidityPool.liquidity) {
                maxLiquidityPool = item;
            }
        }

        // Если ликвидность нигде не указана, возвращаем первый пул
        if (maxLiquidityPool.liquidity === 0 && pools.length > 0) {
            logger.info(
                logger.LOG_MODULES.MEV_LOAD_BALANCER,
                `Не удалось получить информацию о ликвидности, возвращаем первый пул: ${pools[0]}`
            );
            return { pool: pools[0], liquidity: 0 };
        }

        return maxLiquidityPool;
    } catch (error) {
        logger.error(
            logger.LOG_MODULES.MEV_LOAD_BALANCER,
            `Ошибка при поиске самого ликвидного пула: ${error.message}`
        );
        if (pools.length > 0) {
            return { pool: pools[0], liquidity: 0 };
        }
        return null;
    }
}





export function formatUsage(usage: UsageMeteoraPools): string {
    return JSON.stringify({
        hasFreeSingleSlot: usage.hasFreeSingleSlot,
        pairs: Object.fromEntries(usage.pairs)
    }, null, 2);
}



