// getConfigsTest.ts
// Тесты для исходной функции getConfigs

// Определение типов
import {MevLoadBalancer} from "../src/services/mevLoadBalancer/mevLoadBalancer";

export type SignalWithMeta = {
    tokenAddress: string;
    meteoraPool: string;
    pumpSwapPool: string;
    raydiumPool?: string;
    type: string;
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
    raydium: string;
    type: string;
};

export type ProcessConfig = {
    tokenAddress: string;
    meteoraPools: string[];
    pumpSwapPool?: string;
    raydiumPool?: string;
    // Raydium pools:
    type: string;

    main_rpc: string;
    useJito: boolean;
    jito_lower_bound: number;
    jito_upper_bound: number;
    process_delay: number | null;
    task_name: string;
}

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
function structConfig<T extends MevLoadBalancer>(
                                                 tokenAddress: string,
                                                 meteoraPools: string[],
                                                 pumpSwapPool?: string,
                                                 raydiumPool?: string,
                                                 type?: string
): ProcessConfig{

    return {
        tokenAddress,
        meteoraPools: meteoraPools,
        pumpSwapPool: pumpSwapPool ? pumpSwapPool : undefined,
        raydiumPool: raydiumPool ? raydiumPool : undefined,
        type: type,
        main_rpc: "https://api.mainnet-beta.solana.com",
        useJito: true,
        jito_lower_bound:  111, // deprecated
        jito_upper_bound: 111, // deprecated
        process_delay: null,
        task_name: `mev_task_${Date.now().toString().substring(8, 13)}`
    }
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
    /**
     * Группирует пулы по токенам и создает конфигурации для процессов
     * @param validSignals - Валидные сигналы для обработки
     * @returns Конфигурации для добавления и идентификаторы процессов для удаления
     */
    getConfigs(validSignals: SignalWithMeta[]): ProcessesToManage | undefined {
        try {
            // Группируем пулы по токенам
            const groupPoolsByToken = new Map<string, Pools>();
            const configsToAdd: ProcessConfig[] = [];
            const configsToDelete: string[] = [];

            // Шаг 1: Группируем все пулы по токенам
            for (const signal of validSignals) {
                if (groupPoolsByToken.has(signal.tokenAddress)) {
                    // Если токен уже есть, добавляем новый пул Meteora
                    const pools = groupPoolsByToken.get(signal.tokenAddress)!;
                    // Добавляем только уникальные пулы
                    if (!pools.meteora.includes(signal.meteoraPool)) {
                        pools.meteora.push(signal.meteoraPool);
                    }
                } else {
                    // Создаем новую запись для токена
                    groupPoolsByToken.set(signal.tokenAddress, {
                        meteora: [signal.meteoraPool],
                        pump: signal.pumpSwapPool,
                        raydium: signal.raydiumPool,
                        type: signal.type
                    });
                }
            }

            // Шаг 2: Для каждого токена распределяем пулы по процессам
            for (const [token, pools] of groupPoolsByToken.entries()) {
                logger.info(
                    logger.LOG_MODULES.MEV_LOAD_BALANCER,
                    `Распределение пулов для токена ${token}: ${pools.meteora.length} пулов Meteora`
                );

                // Получаем или создаем структуру для отслеживания пулов токена
                let meteoraUsageForToken = this.getMeteoraUsagePoolsByToken(token);
                if (!meteoraUsageForToken) {
                    this.setMeteoraUsagePoolsByToken(token, {
                        pairs: new Map<string, PairInfo>(),
                        hasFreeSingleSlot: false
                    });
                    meteoraUsageForToken = this.getMeteoraUsagePoolsByToken(token);
                    if (!meteoraUsageForToken) {
                        logger.error(
                            logger.LOG_MODULES.MEV_LOAD_BALANCER,
                            `Не удалось создать структуру распределения пулов для токена ${token}`
                        );
                        return undefined;
                    }
                }

                // Копируем список пулов, чтобы не изменять оригинал
                const poolsToDistribute = [...pools.meteora];

                // Шаг 2.1: Сначала пытаемся добавить пулы к существующим процессам с одним пулом
                for (const [processId, pairInfo] of meteoraUsageForToken.pairs.entries()) {
                    // Пропускаем stub и процессы, которые уже имеют 2 пула
                    if (processId === "stub" || pairInfo.activePools.length >= 2) {
                        continue;
                    }

                    // Если у процесса 1 пул и есть пулы для распределения
                    if (pairInfo.activePools.length === 1 && poolsToDistribute.length > 0) {
                        // Берем первый пул из списка
                        const poolToAdd = poolsToDistribute.shift()!;

                        // Добавляем пул к существующему процессу
                        pairInfo.activePools.push(poolToAdd);

                        // Если процесс не новый, помечаем его для удаления и последующего пересоздания
                        if (!pairInfo.isNew) {
                            configsToDelete.push(processId);
                        }

                        // Создаем новую конфигурацию с обновленным списком пулов
                        configsToAdd.push(structConfig(
                            token,
                            [...pairInfo.activePools],
                            pools.pump,
                            pools.raydium,
                            pools.type
                        ));

                        // Обновляем запись в структуре с новым ID процесса
                        meteoraUsageForToken.pairs.delete(processId);
                        const newProcessId = this.generateProcessId(
                            token,
                            [...pairInfo.activePools],
                            this.userSettings?.jito_lower_bound!
                        );

                        meteoraUsageForToken.pairs.set(newProcessId, {
                            activePools: [...pairInfo.activePools],
                            isNew: false
                        });

                        logger.info(
                            logger.LOG_MODULES.MEV_LOAD_BALANCER,
                            `Добавлен пул ${poolToAdd} к существующему процессу ${processId} -> ${newProcessId}`
                        );
                    }
                }

                // Шаг 2.2: Создаем новые процессы для оставшихся пулов
                while (poolsToDistribute.length > 0) {
                    // Определяем, сколько пулов добавить в процесс (1 или 2)
                    const poolsForProcess: string[] = [];

                    // Добавляем первый пул
                    poolsForProcess.push(poolsToDistribute.shift()!);

                    // Если есть еще пулы, добавляем второй
                    if (poolsToDistribute.length > 0) {
                        poolsForProcess.push(poolsToDistribute.shift()!);
                    }

                    // Создаем новую конфигурацию
                    configsToAdd.push(structConfig(
                        token,
                        poolsForProcess,
                        pools.pump,
                        pools.raydium,
                        pools.type
                    ));

                    // Добавляем запись в структуру
                    const processId = this.generateProcessId(
                        token,
                        poolsForProcess,
                        this.userSettings?.jito_lower_bound!
                    );

                    meteoraUsageForToken.pairs.set(processId, {
                        activePools: poolsForProcess,
                        isNew: false
                    });

                    logger.info(
                        logger.LOG_MODULES.MEV_LOAD_BALANCER,
                        `Создан новый процесс ${processId} с ${poolsForProcess.length} пулами: ${poolsForProcess.join(', ')}`
                    );
                }
            }

            logger.info(
                logger.LOG_MODULES.MEV_LOAD_BALANCER,
                `Результат распределения пулов: ${configsToAdd.length} процессов для создания, ${configsToDelete.length} для удаления`
            );

            return {
                configsToAdd,
                processIdsToDelete: configsToDelete
            };
        } catch (error) {
            logger.info(
                logger.LOG_MODULES.MEV_LOAD_BALANCER,
                `Ошибка при распределении пулов: ${error.message}`
            );
            return undefined;
        }
    }
}

(async () => {
    console.log("=== НАЧАЛО ТЕСТИРОВАНИЯ ФУНКЦИИ getConfigs ===");

    // Создаем экземпляр тестового класса
    const testInstance = new TestClass();

    // Вспомогательная функция для логирования начального состояния
    function logInitialState(testName) {
        console.log(`\n\n${"=".repeat(80)}`);
        console.log(`ТЕСТ: ${testName}`);
        console.log(`${"=".repeat(80)}`);
        console.log("\nНачальное состояние meteoraPoolsUsage:");

        const allTokens = Array.from(testInstance.meteoraPoolsUsage.keys());
        if (allTokens.length === 0) {
            console.log("Пусто (нет токенов)");
        } else {
            for (const token of allTokens) {
                const usage = testInstance.getMeteoraUsagePoolsByToken(token);
                console.log(`- Токен ${token}:`, formatUsage(usage));
            }
        }
    }

    // Вспомогательная функция для логирования результатов теста
    function logTestResult(result, expectedResult) {
        console.log("\nПолученный результат:", JSON.stringify(result, null, 2));
        console.log("\nОжидаемый результат:", JSON.stringify(expectedResult, null, 2));

        // Специальная проверка для учета динамических значений
        let isEqual = true;

        if (!result || !expectedResult) {
            isEqual = result === expectedResult;
        } else if (result.configsToAdd && expectedResult.configsToAdd) {
            if (result.configsToAdd.length !== expectedResult.configsToAdd.length) {
                isEqual = false;
            } else {
                // Сравниваем каждый элемент configsToAdd
                for (let i = 0; i < result.configsToAdd.length; i++) {
                    const resultConfig = result.configsToAdd[i];
                    const expectedConfig = expectedResult.configsToAdd[i];

                    // Пропускаем проверку task_name, т.к. она содержит timestamp
                    for (const key in expectedConfig) {
                        if (key === "task_name") continue;
                        if (JSON.stringify(resultConfig[key]) !== JSON.stringify(expectedConfig[key])) {
                            isEqual = false;
                            break;
                        }
                    }
                }
            }

            // Сравниваем processIdsToDelete
            if (JSON.stringify(result.processIdsToDelete) !== JSON.stringify(expectedResult.processIdsToDelete)) {
                isEqual = false;
            }
        } else {
            isEqual = JSON.stringify(result) === JSON.stringify(expectedResult);
        }

        if (isEqual) {
            console.log("\n✅ УСПЕХ: Результат соответствует ожидаемому");
        } else {
            console.log("\n❌ ОШИБКА: Результат не соответствует ожидаемому");
        }

        // Конечное состояние после теста
        console.log("\nКонечное состояние meteoraPoolsUsage:");
        const allTokens = Array.from(testInstance.meteoraPoolsUsage.keys());
        if (allTokens.length === 0) {
            console.log("Пусто (нет токенов)");
        } else {
            for (const token of allTokens) {
                const usage = testInstance.getMeteoraUsagePoolsByToken(token);
                console.log(`- Токен ${token}:`, formatUsage(usage));
            }
        }
    }

    // Вспомогательная функция для создания тестового сигнала
    function createSignal(tokenAddress, meteoraPool, pumpSwapPool = undefined, raydiumPool = undefined, type = "default") {
        return {
            tokenAddress,
            meteoraPool,
            pumpSwapPool: pumpSwapPool || "default_pump_pool",
            raydiumPool: raydiumPool,
            type: type,
            timestamp: Date.now(),
            sourceProcessId: "test_process",
            addedTime: Date.now()
        };
    }

    // Сбрасываем состояние перед каждым тестом
    function resetState() {
        testInstance.meteoraPoolsUsage = new Map();
    }

    // ===== ТЕСТОВЫЕ СЛУЧАИ =====

    // Тест 1: Пустой массив сигналов
    resetState();
    logInitialState("Пустой массив сигналов");
    console.log("\nВходные данные: Пустой массив сигналов []");
    let result1 = testInstance.getConfigs([]);
    logTestResult(result1, {
        configsToAdd: [],
        processIdsToDelete: []
    });

    // Тест 2: Один сигнал для одного токена
    resetState();
    logInitialState("Один сигнал для одного токена");
    const signals2 = [
        createSignal("token1", "meteora_pool1")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals2, null, 2));
    let result2 = testInstance.getConfigs(signals2);
    logTestResult(result2, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 3: Два сигнала для одного токена (два пула в одном процессе)
    resetState();
    logInitialState("Два сигнала для одного токена (два пула в одном процессе)");
    const signals3 = [
        createSignal("token1", "meteora_pool1"),
        createSignal("token1", "meteora_pool2")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals3, null, 2));
    let result3 = testInstance.getConfigs(signals3);
    logTestResult(result3, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 4: Три сигнала для одного токена (два процесса: с двумя и с одним пулом)
    resetState();
    logInitialState("Три сигнала для одного токена (два процесса: с двумя и с одним пулом)");
    const signals4 = [
        createSignal("token1", "meteora_pool1"),
        createSignal("token1", "meteora_pool2"),
        createSignal("token1", "meteora_pool3")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals4, null, 2));
    let result4 = testInstance.getConfigs(signals4);
    logTestResult(result4, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool3"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 5: Четыре сигнала для одного токена (два процесса: оба с двумя пулами)
    resetState();
    logInitialState("Четыре сигнала для одного токена (два процесса: оба с двумя пулами)");
    const signals5 = [
        createSignal("token1", "meteora_pool1"),
        createSignal("token1", "meteora_pool2"),
        createSignal("token1", "meteora_pool3"),
        createSignal("token1", "meteora_pool4")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals5, null, 2));
    let result5 = testInstance.getConfigs(signals5);
    logTestResult(result5, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool3", "meteora_pool4"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 6: Сигналы для разных токенов
    resetState();
    logInitialState("Сигналы для разных токенов");
    const signals6 = [
        createSignal("token1", "meteora_pool1"),
        createSignal("token2", "meteora_pool2"),
        createSignal("token3", "meteora_pool3")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals6, null, 2));
    let result6 = testInstance.getConfigs(signals6);
    logTestResult(result6, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token2",
                meteoraPools: ["meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token3",
                meteoraPools: ["meteora_pool3"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 7: Дублирующиеся пулы одного токена (не должны дублироваться)
    resetState();
    logInitialState("Дублирующиеся пулы одного токена (не должны дублироваться)");
    const signals7 = [
        createSignal("token1", "meteora_pool1"),
        createSignal("token1", "meteora_pool1"), // Дубликат
        createSignal("token1", "meteora_pool2")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals7, null, 2));
    console.log("\nОбратите внимание: пул meteora_pool1 дублируется в сигналах");
    let result7 = testInstance.getConfigs(signals7);
    logTestResult(result7, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 8: Сигналы с разными дополнительными параметрами (raydiumPool и type)
    resetState();
    logInitialState("Сигналы с разными дополнительными параметрами (raydiumPool и type)");
    const signals8 = [
        createSignal("token1", "meteora_pool1", "pump_pool1", "raydium_pool1", "type1"),
        createSignal("token1", "meteora_pool2", "pump_pool1", "raydium_pool1", "type1")
    ];
    console.log("\nВходные данные:", JSON.stringify(signals8, null, 2));
    let result8 = testInstance.getConfigs(signals8);
    logTestResult(result8, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "pump_pool1",
                raydiumPool: "raydium_pool1",
                type: "type1",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 9: Добавление новых пулов к существующим процессам с одним пулом
    resetState();
    logInitialState("Добавление новых пулов к существующим процессам с одним пулом");

    // Сначала добавляем один пул и выводим состояние
    console.log("\nШаг 1: Добавляем первый сигнал с пулом meteora_pool1");
    testInstance.getConfigs([createSignal("token1", "meteora_pool1")]);
    console.log("\nСостояние после первого добавления:");
    const allTokens9_1 = Array.from(testInstance.meteoraPoolsUsage.keys());
    for (const token of allTokens9_1) {
        const usage = testInstance.getMeteoraUsagePoolsByToken(token);
        console.log(`- Токен ${token}:`, formatUsage(usage));
    }

    // Теперь добавляем еще один пул для того же токена
    console.log("\nШаг 2: Добавляем второй сигнал с пулом meteora_pool2");
    console.log("\nВходные данные:", JSON.stringify([createSignal("token1", "meteora_pool2")], null, 2));
    const expectedProcessId = testInstance.generateProcessId("token1", ["meteora_pool1"], 100);
    let result9 = testInstance.getConfigs([createSignal("token1", "meteora_pool2")]);
    logTestResult(result9, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: [expectedProcessId]
    });

    // Тест 10: Большое количество пулов для одного токена
    resetState();
    logInitialState("Большое количество пулов для одного токена");
    const signals10 = [];
    for (let i = 1; i <= 7; i++) {
        signals10.push(createSignal("token1", `meteora_pool${i}`));
    }
    console.log("\nВходные данные: 7 сигналов для токена token1 с пулами meteora_pool1-7");
    let result10 = testInstance.getConfigs(signals10);
    logTestResult(result10, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool1", "meteora_pool2"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool3", "meteora_pool4"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool5", "meteora_pool6"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            },
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool7"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 11: Добавление нового пула, когда все существующие процессы уже имеют по 2 пула
    resetState();
    logInitialState("Добавление нового пула, когда все существующие процессы уже имеют по 2 пула");

    // Сначала добавляем два пула и выводим состояние
    console.log("\nШаг 1: Добавляем два сигнала с пулами meteora_pool1 и meteora_pool2");
    testInstance.getConfigs([
        createSignal("token1", "meteora_pool1"),
        createSignal("token1", "meteora_pool2")
    ]);
    console.log("\nСостояние после добавления первых двух пулов:");
    const allTokens11_1 = Array.from(testInstance.meteoraPoolsUsage.keys());
    for (const token of allTokens11_1) {
        const usage = testInstance.getMeteoraUsagePoolsByToken(token);
        console.log(`- Токен ${token}:`, formatUsage(usage));
    }

    // Теперь добавляем еще один пул
    console.log("\nШаг 2: Добавляем новый сигнал с пулом meteora_pool3");
    console.log("\nВходные данные:", JSON.stringify([createSignal("token1", "meteora_pool3")], null, 2));
    let result11 = testInstance.getConfigs([createSignal("token1", "meteora_pool3")]);
    logTestResult(result11, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool3"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    // Тест 12: Многократное последовательное добавление пулов
    resetState();
    logInitialState("Многократное последовательное добавление пулов");

    // Первое добавление
    console.log("\nШаг 1: Добавляем сигнал с пулом meteora_pool1");
    testInstance.getConfigs([createSignal("token1", "meteora_pool1")]);
    console.log("\nСостояние после первого добавления:");
    let usage12_1 = testInstance.getMeteoraUsagePoolsByToken("token1");
    console.log(`- Токен token1:`, formatUsage(usage12_1));

    // Второе добавление
    console.log("\nШаг 2: Добавляем сигнал с пулом meteora_pool2");
    testInstance.getConfigs([createSignal("token1", "meteora_pool2")]);
    console.log("\nСостояние после второго добавления:");
    let usage12_2 = testInstance.getMeteoraUsagePoolsByToken("token1");
    console.log(`- Токен token1:`, formatUsage(usage12_2));

    // Третье добавление
    console.log("\nШаг 3: Добавляем сигнал с пулом meteora_pool3");
    testInstance.getConfigs([createSignal("token1", "meteora_pool3")]);
    console.log("\nСостояние после третьего добавления:");
    let usage12_3 = testInstance.getMeteoraUsagePoolsByToken("token1");
    console.log(`- Токен token1:`, formatUsage(usage12_3));

    // Четвертое добавление
    console.log("\nШаг 4: Добавляем сигнал с пулом meteora_pool4");
    console.log("\nВходные данные:", JSON.stringify([createSignal("token1", "meteora_pool4")], null, 2));
    let result13 = testInstance.getConfigs([createSignal("token1", "meteora_pool4")]);
    logTestResult(result13, {
        configsToAdd: [
            {
                tokenAddress: "token1",
                meteoraPools: ["meteora_pool4"],
                pumpSwapPool: "default_pump_pool",
                raydiumPool: undefined,
                type: "default",
                main_rpc: "https://api.mainnet-beta.solana.com",
                useJito: true,
                jito_lower_bound: 111,
                jito_upper_bound: 111,
                process_delay: null,
                task_name: "dummy_value" // Будет пропущено при сравнении
            }
        ],
        processIdsToDelete: []
    });

    console.log("\n=== ЗАВЕРШЕНИЕ ТЕСТИРОВАНИЯ ===");
})();