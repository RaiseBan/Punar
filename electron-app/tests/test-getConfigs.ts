// getConfigsTest.ts
// Тесты для исходной функции getConfigs

// Определение типов
export type SignalWithMeta = {
    tokenAddress: string;
    meteoraPool: string;
    pumpSwapPool: string;
    timestamp: number;
    sourceProcessId: string;
    addedTime: number;
}

export type PairInfo = {
    activePools: string[];
    isNew: boolean;
};

export type UsageMeteoraPools = {
    pairs: Map<string, PairInfo>;
    hasFreeSingleSlot: boolean;
};

export type Pools = {
    meteora: string[];
    pump: string;
};

export type ProcessConfig = {
    token: string;
    meteoraPools: string[];
    pumpPool: string;
    jitoLowerBound: number;
};

export type ProcessesToManage = {
    configsToAdd: ProcessConfig[];
    processIdsToDelete: string[];
};

// Имитация вспомогательных функций и объектов
const logger = {
    LOG_MODULES: {
        MEV_LOAD_BALANCER: 'MEV_LOAD_BALANCER'
    },
    info: (module: string, message: string) => {
        console.log(`[${module}] ${message}`);
    }
};

// Функция для структурирования конфига
function structConfig(context: TestClass, token: string, meteoraPools: string[], pumpPool: string): ProcessConfig {
    return {
        token,
        meteoraPools,
        pumpPool,
        jitoLowerBound: context.userSettings?.jito_lower_bound || 0
    };
}

// Вспомогательные функции для вывода тестовых данных
function formatPairs(pairs: Map<string, PairInfo>): string {
    return JSON.stringify(Object.fromEntries(pairs), null, 2);
}

function formatUsage(usage: UsageMeteoraPools): string {
    return JSON.stringify({
        hasFreeSingleSlot: usage.hasFreeSingleSlot,
        pairs: Object.fromEntries(usage.pairs)
    }, null, 2);
}

// Тестовый класс с исходной функцией getConfigs
class TestClass {
    meteoraPoolsUsage: Map<string, UsageMeteoraPools> = new Map<string, UsageMeteoraPools>();
    userSettings?: { jito_lower_bound: number } = { jito_lower_bound: 100 };

    getMeteoraUsagePoolsByToken(token: string): UsageMeteoraPools | undefined {
        return this.meteoraPoolsUsage.get(token);
    }

    setMeteoraUsagePoolsByToken(token: string, usage: UsageMeteoraPools): void {
        this.meteoraPoolsUsage.set(token, usage);
    }

    generateProcessId(token: string, pools: string[], jitoLowerBound: number): string {
        return `${token}_${pools.join('_')}_${jitoLowerBound}`;
    }

    // ТОЧНАЯ КОПИЯ ИСХОДНОЙ ФУНКЦИИ
    getConfigs(validSignals: SignalWithMeta[]): ProcessesToManage | undefined {

        const groupPoolsByToken: Map<string, Pools> = new Map<string, Pools>();
        let configsToAdd: ProcessConfig[] = [];
        let configsToDelete: string[] = [];
        for (const signal of validSignals){
            if (groupPoolsByToken.has(signal.tokenAddress)){
                const pools: Pools = groupPoolsByToken.get(signal.tokenAddress)!;
                pools.meteora.push(signal.meteoraPool)
            }else{
                groupPoolsByToken.set(signal.tokenAddress, {
                    meteora: [signal.meteoraPool],
                    pump: signal.pumpSwapPool
                })
            }
        }
        for (const [token, pools] of groupPoolsByToken.entries()) {
            let meteoraUsageForToken: UsageMeteoraPools | undefined = this.getMeteoraUsagePoolsByToken(token);
            if (!meteoraUsageForToken){
                this.setMeteoraUsagePoolsByToken(token, {
                    pairs: new Map<string, PairInfo>(),
                    hasFreeSingleSlot: false
                })
                meteoraUsageForToken = this.getMeteoraUsagePoolsByToken(token);
                if (!meteoraUsageForToken){
                    return;
                }
            }

            // кол-во пулов токена для добавления
            let poolsDecrementable = [...pools.meteora];
            console.log("usage: ", JSON.stringify(meteoraUsageForToken, null, 2));
            console.log(meteoraUsageForToken.pairs)

            let skipShift = false;
            let itemBuffer: string = "";
            while (poolsDecrementable.length !== 0){
                let poolHasPlaced = false;
                let tookPool: string | undefined;
                if (!skipShift){
                    tookPool = poolsDecrementable.shift();
                }else{
                    tookPool = itemBuffer;
                }

                if (!tookPool){
                    logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `watafuk`);
                    return;
                }




                for (const [processId, pairInfo] of meteoraUsageForToken.pairs.entries()) {
                    if (pairInfo.activePools.length === 1) { // пока что сделали, что максиамльное кол-во пулов метеоры в одном конфиге - 2
                        console.log(1)
                        pairInfo.activePools.push(tookPool);
                        if (!pairInfo.isNew){
                            configsToDelete.push(processId);
                        }
                        console.log("BABY: ", pairInfo);
                        configsToAdd.push(structConfig(this, token, [...pairInfo.activePools], pools.pump));

                        meteoraUsageForToken.pairs.delete(processId);
                        meteoraUsageForToken.pairs.set(
                            this.generateProcessId(
                                token,
                                [...pairInfo.activePools],
                                this.userSettings?.jito_lower_bound!),
                            {
                                activePools: [...pairInfo.activePools],
                                // isModified: false, // потому что этот процесс уже не будет изменяться при этом проходе добавления
                                isNew: false
                            }
                        );
                        poolHasPlaced = true;
                        skipShift = false;
                        break;
                    }
                    if (pairInfo.activePools.length === 0) {
                        if (poolsDecrementable.length > 0){
                            console.log(`BIG BOY 000`)
                            pairInfo.activePools.push(tookPool);
                            // не нужно добавлять, потому что еще есть элементы
                            // configsToAdd.push(structConfig(this, token, [...pairInfo.activePools, tookPool], pools.pump));
                            console.log(pairInfo.activePools);
                            meteoraUsageForToken.pairs.delete(processId);
                            meteoraUsageForToken.pairs.set(
                                this.generateProcessId(
                                    token,
                                    [...pairInfo.activePools],
                                    this.userSettings?.jito_lower_bound!),
                                {
                                    activePools: [...pairInfo.activePools],
                                    isNew: true
                                }
                            );
                            console.log(meteoraUsageForToken.pairs)
                            console.log(`-----------`)
                            poolHasPlaced = true;
                            skipShift = false;
                            break;
                        }else if (poolsDecrementable.length === 0){
                            pairInfo.activePools.push(tookPool);
                            configsToAdd.push(structConfig(this, token, [...pairInfo.activePools], pools.pump));
                            meteoraUsageForToken.pairs.set(
                                this.generateProcessId(
                                    token,
                                    [...pairInfo.activePools],
                                    this.userSettings?.jito_lower_bound!),
                                {
                                    activePools: [...pairInfo.activePools],
                                    isNew: false
                                }
                            );
                            poolHasPlaced = true;
                            skipShift = false;
                            break;
                        }

                    }
                }

                if (!poolHasPlaced){
                    meteoraUsageForToken.pairs.set("stub", {
                        activePools: [],
                        isNew: true
                    })
                    skipShift = true
                    itemBuffer = tookPool;
                }

            }


        }

        return {
            configsToAdd: configsToAdd,
            processIdsToDelete: configsToDelete
        }
    }
}

// Запускаем тесты в самовызывающейся асинхронной функции
// (async () => {
//     console.log("=== Тестирование функции getConfigs ===");
//
//     // Создаем экземпляр тестового класса
//     const testInstance = new TestClass();
//
//     // Тест 1: Пустой список сигналов
//     console.log("\n--- Тест 1: Пустой список сигналов ---");
//     console.log("Входные данные:");
//     console.log("  validSignals: []");
//     console.log("  meteoraPoolsUsage: {}");
//
//     const testSignals1: SignalWithMeta[] = [];
//
//     const result1 = testInstance.getConfigs(testSignals1);
//     console.log("\nРезультат теста 1:");
//     console.log(JSON.stringify(result1, null, 2));
//
//
//
//     // Тест 2: Один токен с одним пулом (с предустановленными активными пулами)
//     console.log("\n--- Тест 2: Один токен с одним уже существующим пулом ---");
//     // Устанавливаем начальное состояние с одним активным пулом
//     const token2 = "token2";
//     const existingPool2 = "meteora2_existing";
//     const processId2 = testInstance.generateProcessId(token2, [existingPool2], 100);
//     const initialState2: UsageMeteoraPools = {
//         pairs: new Map([
//             [processId2, {
//                 activePools: [existingPool2],
//                 isNew: false
//             }]
//         ]),
//         hasFreeSingleSlot: false
//     };
//     testInstance.setMeteoraUsagePoolsByToken(token2, initialState2);
//
//     const testSignals2: SignalWithMeta[] = [
//         {
//             tokenAddress: token2,
//             meteoraPool: "meteora2_new",
//             pumpSwapPool: "pump2",
//             timestamp: Date.now(),
//             sourceProcessId: "source2",
//             addedTime: Date.now()
//         }
//     ];
//
//     console.log("Входные данные:");
//     console.log(`  validSignals: ${JSON.stringify(testSignals2, null, 2)}`);
//     console.log("  Начальное состояние meteoraPoolsUsage для токена token2:");
//     console.log(formatUsage(initialState2));
//
//     // Сохраняем состояние до вызова функции
//     const beforeState2 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     const result2 = testInstance.getConfigs(testSignals2);
//
//     // Сохраняем состояние после вызова функции
//     const afterState2 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//
//
//     console.log("\nРезультат теста 2:");
//     console.log("configsToAdd:");
//     console.log(JSON.stringify(result2?.configsToAdd, null, 2));
//     console.log("processIdsToDelete:");
//     console.log(JSON.stringify(result2?.processIdsToDelete, null, 2));
//
//     console.log("\nСостояние meteoraPoolsUsage после вызова функции:");
//     console.log(afterState2);
//
//
//
//     // Тест 3: Один токен с одним пулом (с пустыми активными пулами)
//     console.log("\n--- Тест 3: Один токен с одним пулом (с пустыми активными пулами) ---");
//     const token3 = "token3";
//     const initialState3: UsageMeteoraPools = {
//         pairs: new Map([
//             ["stub", {
//                 activePools: ["chiroPick"],
//                 isNew: false
//             }]
//         ]),
//         hasFreeSingleSlot: false
//     };
//     testInstance.setMeteoraUsagePoolsByToken(token3, initialState3);
//
//     const testSignals3: SignalWithMeta[] = [
//         {
//             tokenAddress: token3,
//             meteoraPool: "meteora3",
//             pumpSwapPool: "pump3",
//             timestamp: Date.now(),
//             sourceProcessId: "source3",
//             addedTime: Date.now()
//         }
//     ];
//
//     console.log("Входные данные:");
//     console.log(`  validSignals: ${JSON.stringify(testSignals3, null, 2)}`);
//     console.log("  Начальное состояние meteoraPoolsUsage для токена token3:");
//     console.log(formatUsage(initialState3));
//
//     // Сохраняем состояние до вызова функции
//     const beforeState3 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     const result3 = testInstance.getConfigs(testSignals3);
//
//     // Сохраняем состояние после вызова функции
//     const afterState3 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     console.log("\nРезультат теста 3:");
//     console.log("configsToAdd:");
//     console.log(JSON.stringify(result3?.configsToAdd, null, 2));
//     console.log("processIdsToDelete:");
//     console.log(JSON.stringify(result3?.processIdsToDelete, null, 2));
//
//     console.log("\nСостояние meteoraPoolsUsage после вызова функции:");
//     console.log(afterState3);
//
//     // Тест 4: Один токен с несколькими пулами
//     console.log("\n--- Тест 4: Один токен с несколькими пулами ---");
//     const token4 = "token4";
//     const initialState4: UsageMeteoraPools = {
//         pairs: new Map([
//             ["mev_1234_341", {
//                 activePools: ["chocolate"],
//                 isNew: false
//             }]
//         ]),
//         hasFreeSingleSlot: false
//     };
//     testInstance.setMeteoraUsagePoolsByToken(token4, initialState4);
//
//     const testSignals4: SignalWithMeta[] = [
//         {
//             tokenAddress: token4,
//             meteoraPool: "meteora4_1",
//             pumpSwapPool: "pump4",
//             timestamp: Date.now(),
//             sourceProcessId: "source4_1",
//             addedTime: Date.now()
//         },
//         {
//             tokenAddress: token4,
//             meteoraPool: "meteora4_2",
//             pumpSwapPool: "pump4",
//             timestamp: Date.now(),
//             sourceProcessId: "source4_2",
//             addedTime: Date.now()
//         },
//         {
//             tokenAddress: token4,
//             meteoraPool: "meteora4_3",
//             pumpSwapPool: "pump4",
//             timestamp: Date.now(),
//             sourceProcessId: "source4_3",
//             addedTime: Date.now()
//         }
//     ];
//
//     console.log("Входные данные:");
//     console.log(`  validSignals: ${JSON.stringify(testSignals4, null, 2)}`);
//     console.log("  Начальное состояние meteoraPoolsUsage для токена token4:");
//     console.log(formatUsage(initialState4));
//
//     // Сохраняем состояние до вызова функции
//     const beforeState4 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     const result4 = testInstance.getConfigs(testSignals4);
//
//     // Сохраняем состояние после вызова функции
//     const afterState4 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     console.log("\nРезультат теста 4:");
//     console.log("configsToAdd:");
//     console.log(JSON.stringify(result4?.configsToAdd, null, 2));
//     console.log("processIdsToDelete:");
//     console.log(JSON.stringify(result4?.processIdsToDelete, null, 2));
//
//     console.log("\nСостояние meteoraPoolsUsage после вызова функции:");
//     console.log(afterState4);
//
//     // Тест 5: Несколько токенов
//     console.log("\n--- Тест 5: Несколько токенов ---");
//     const token5_1 = "token5_1";
//     const token5_2 = "token5_2";
//     const initialState5_1: UsageMeteoraPools = {
//         pairs: new Map([
//             ["start_process", {
//                 activePools: [`start_pool`],
//                 isNew: false
//             }]
//         ]),
//         hasFreeSingleSlot: false
//     };
//     const initialState5_2: UsageMeteoraPools = {
//         pairs: new Map([
//             ["baby_mama", {
//                 activePools: [`chin_chopa_pool`],
//                 isNew: false
//             }]
//         ]),
//         hasFreeSingleSlot: false
//     };
//     testInstance.setMeteoraUsagePoolsByToken(token5_1, initialState5_1);
//     testInstance.setMeteoraUsagePoolsByToken(token5_2, initialState5_2);
//
//     const testSignals5: SignalWithMeta[] = [
//         {
//             tokenAddress: token5_1,
//             meteoraPool: "meteora5_1",
//             pumpSwapPool: "pump5_1",
//             timestamp: Date.now(),
//             sourceProcessId: "source5_1",
//             addedTime: Date.now()
//         },
//         {
//             tokenAddress: token5_2,
//             meteoraPool: "meteora5_2",
//             pumpSwapPool: "pump5_2",
//             timestamp: Date.now(),
//             sourceProcessId: "source5_2",
//             addedTime: Date.now()
//         }
//     ];
//
//     console.log("Входные данные:");
//     console.log(`  validSignals: ${JSON.stringify(testSignals5, null, 2)}`);
//     console.log("  Начальное состояние meteoraPoolsUsage для токена token5_1:");
//     console.log(formatUsage(initialState5_1));
//     console.log("  Начальное состояние meteoraPoolsUsage для токена token5_2:");
//     console.log(formatUsage(initialState5_2));
//
//     // Сохраняем состояние до вызова функции
//     const beforeState5 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     const result5 = testInstance.getConfigs(testSignals5);
//
//     // Сохраняем состояние после вызова функции
//     const afterState5 = JSON.stringify(
//         Object.fromEntries(testInstance.meteoraPoolsUsage),
//         (key, value) => value instanceof Map ? Object.fromEntries(value) : value,
//         2
//     );
//
//     console.log("\nРезультат теста 5:");
//     console.log("configsToAdd:");
//     console.log(JSON.stringify(result5?.configsToAdd, null, 2));
//     console.log("processIdsToDelete:");
//     console.log(JSON.stringify(result5?.processIdsToDelete, null, 2));
//
//     console.log("\nСостояние meteoraPoolsUsage после вызова функции:");
//     console.log(afterState5);
//
//     console.log("\n=== Все тесты завершены! ===");
// })();