import * as fs from "fs";
import * as path from "path";
import {getFilteredPairs, sortPairsByParameter, updateIfNotExistsAndGet} from "./solanaUtils";
import TOML from '@iarna/toml';
import {PRIMARY_IP, METEORA_OWNER} from "./constants";
import logger from "../services/loggerService";
import {getSettings} from "../utils/fsHelper";

/**
 * Интерфейс для конфигурации задачи
 */
interface TaskConfig {
    rowData: string[];
    main_rpc: string;
    process_delay?: number;
    useJito?: boolean;
    jito_lower_bound?: number;
    jito_upper_bound?: number;
    taskId?: string | number;
}

/**
 * Интерфейс для токен-конфигурации
 */
interface TokenConfig {
    token_address: string;
    meteora_pairs: string[];
    pump_swap_pairs: string[];

    [key: string]: any;
}/**
 * Интерфейс для пользовательских настроек
 */


interface UserSettings {
    proxy_server_ip: string;
    proxy_server_port: string;
    primary_ip: string;
    jito_lower_bound?: number;
    jito_upper_bound?: number;
    compute_unit_limit?: number;
}

/**
 * Генерирует конфигурацию для MEV процесса
 * @param targetDir - Директория для сохранения конфига
 * @param tokensDirPath - Путь к папке с токенами
 * @param config - Конфигурация задачи
 * @param specificMeteoraPool - Опциональный параметр: конкретный пул Meteora для использования
 * @returns - Путь к сгенерированному файлу или undefined в случае ошибки
 */
export async function generateMevConfig(
    targetDir: string,
    tokensDirPath: string,
    config: TaskConfig,
    specificMeteoraPool: string | null = null
): Promise<string | undefined> {
    console.log(`generateMevParams: ${targetDir} | ${tokensDirPath} | ${JSON.stringify(config, null, 2)}`);
    console.log(`Using specific Meteora pool: ${specificMeteoraPool || 'Not specified'}`);

    const value = config.rowData[1].split("->")[1].trim().substring(1);
    const fileName = `${config.rowData[0]}_${value}.json`;
    const fullPath = path.join(tokensDirPath, fileName);
    console.log(`value: ${value}`);

    console.log(value, fileName, fullPath);

    if (!fs.existsSync(fullPath)) {
        console.log(`Файл конфигурации не найден: ${fullPath}`);
        return undefined;
    }
    console.log(1);
    const tokenConfig: TokenConfig = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    console.log(2);
    const meteoraPairs = tokenConfig.meteora_pairs;
    console.log(3);

    const sortedPairs = await sortPairsByParameter(config.main_rpc, tokenConfig.pump_swap_pairs, {
        parameter: 'volume',
        timeFrame: "h1",
        order: 'desc'
    });

    const pumpPairs = sortedPairs[0]?.pair;

    if (!pumpPairs) {
        console.log(`ERROR: pumpPairs not found`);
        return undefined;
    }

    // Используем переданный process_delay или значение по умолчанию (300 мс)
    const processDelay = config.process_delay || 300;

    let mint_config_list: any [] = [
        {
            mint: tokenConfig.token_address,
            pump_pool_list: [pumpPairs],
            meteora_dlmm_pool_list: [],
            process_delay: processDelay // Используем индивидуальную задержку для процесса
        }
    ];

    console.log(JSON.stringify(tokenConfig, null, 2));
    console.log(`format...`);
    // Формируем базовую структуру TOML файла
    const mevConfig = {
        routing: {
            mint_config_list: mint_config_list
        },
        rpc: {
            url: config.main_rpc
        },
        spam: {
            enabled: !config.useJito,
            sending_rpc_urls: [config.main_rpc],
            max_retries: 0,
            enable_simple_send: false,
            compute_unit_price: {
                strategy: "Random",
                from: 100,
                to: 100,
                count: 1
            }
        },
        jito: {
            enabled: config.useJito,
            block_engine_urls: [
                "http://localhost:8082/jitoNY/api/v1",
                "http://localhost:8082/jitoTOKIO/api/v1",
                "http://localhost:8082/jitoSLC/api/v1",
                "http://localhost:8082/jitoAMSTERDAM/api/v1",
                "http://localhost:8082/jitoFRANKFURT/api/v1",
                "http://localhost:8082/jitoLONDON/api/v1"
            ],
            uuid: "",
            ip_addresses: [PRIMARY_IP],
            tip_config: {
                strategy: "ExponentialRandom",
                from: 20_000,
                to: 50_000_000,
                count: 3
            }
        },
        kamino_flashloan: {
            enabled: true
        },
        bot: {
            compute_unit_limit: 650_000,
            merge_mints: false
        },
        wallet: {}
    };
    console.log(`end format`);
    console.log(`mevConfig: ${mevConfig}`);

    // Если предоставлен конкретный пул Meteora, используем его
    if (specificMeteoraPool) {
        console.log(`Using provided Meteora pool: ${specificMeteoraPool}`);
        mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [specificMeteoraPool];
    } else {
        // Иначе используем стандартную логику выбора пула
        console.log(meteoraPairs.length);

        const filteredMeteoraPairs = await getFilteredPairs(config.main_rpc, meteoraPairs, METEORA_OWNER);
        const sortedMeteoraPairs = await sortPairsByParameter(config.main_rpc, filteredMeteoraPairs, {
            parameter: 'volume',
            timeFrame: 'm5',
            order: 'desc'
        });
        const targetMeteoraPair = sortedMeteoraPairs[0]?.pair;

        if (!targetMeteoraPair) {
            console.log(`Meteora pairs with owner ${METEORA_OWNER} not found`);
            return undefined;
        }

        mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [targetMeteoraPair];
    }

    // Создаем директорию, если она не существует
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {recursive: true});
    }

    // Формируем имя файла и путь для сохранения
    // Добавляем taskId и delay в имя файла для уникальности
    const taskId = config.taskId || Date.now();
    const poolSuffix = specificMeteoraPool ? `_updated_${Date.now()}` : '';
    const delaySuffix = `_delay${processDelay}`;
    const tomlFileName = `${tokenConfig.token_address}_${value}_${config.useJito === true ? "jito" : "default"}_task${taskId}${poolSuffix}${delaySuffix}.toml`;
    const tomlFilePath = path.join(targetDir, tomlFileName);

    try {
        // Преобразуем конфигурацию в формат TOML
        //@ts-ignore
        const tomlString = TOML.stringify(mevConfig);

        // Записываем файл
        fs.writeFileSync(tomlFilePath, tomlString);
        console.log(`Файл конфигурации успешно создан: ${tomlFilePath}`);

        return tomlFilePath;
    } catch (error) {
        const err = error as Error;
        console.error(`Ошибка при создании TOML файла: ${err.message}`);
        return undefined;
    }
}


export async function generateSimpleMevConfig(
    botDir: string,
    config: any, // ProcessConfig
    tokenAddress: string,
    meteoraPools: string[],
    userSetting: UserSettings,
    pumpSwapPool: string | null = null
): Promise<string | null> {
    try {
        // Проверяем обязательные параметры
        if (!botDir || !tokenAddress || !meteoraPools) {
            console.error(`[TOML Generator] Ошибка: не указаны обязательные параметры для генерации TOML-файла`);
            console.error(`[TOML Generator] botDir: ${botDir}, token: ${tokenAddress}, pool: ${meteoraPools}`);
            return null;
        }

        // console.log(`[TOML Generator] Генерация TOML-файла конфигурации MEV для токена ${tokenAddress} и пула ${meteoraPools}`);
        // console.log(`PROCESS DELAY::::::::${config.process_delay}`)
        // Задержка между процессами (по умолчанию 300ms, если не указано)
        const processDelay = config.process_delay;

        // Основные данные RPC
        const main_rpc = config.main_rpc || "https://api.mainnet-beta.solana.com";

        // Параметры Jito
        const useJito = config.useJito !== undefined ? config.useJito : true;

        const updatedSettings = getSettings();


        const jito_lower_bound = Number(updatedSettings.jito_lower_bound) || 100000;
        const jito_upper_bound = Number(updatedSettings.jito_upper_bound) || 200000;

        // Формируем массив пулов







        // Формируем конфигурацию для mint_config_list
        logger.info(logger.LOG_MODULES.CONFIG_SERVICE, `format config with lookup tables: ${config.lookupTables}`);
        const mint_config_list = [
            {
                mint: tokenAddress,
                pump_pool_list: pumpSwapPool ? [pumpSwapPool] : [],
                meteora_dlmm_pool_list: meteoraPools,
                lookup_table_accounts: config.lookupTables,
                process_delay: processDelay,
                // This is the Raydium V4 AMM Pools
                raydium_pool_list: config.type === "v4" ? [config.raydiumPool] : [],

                // This is the Raydium CPMM Pools
                raydium_cp_pool_list: config.type === "cpmm" ? [config.raydiumPool] : [],

                // This is the Raydium CLMM(Centralized Liquidity) Pools
                raydium_clmm_pool_list: config.type === "clmm" ? [config.raydiumPool] : [],
                meteora_damm_pool_list: config.dammMeteoraPool? [config.dammMeteoraPool] : [],
            }
        ];

        // Формируем полную конфигурацию в соответствии с требуемым форматом
        const mevConfig = {
            routing: {
                mint_config_list: mint_config_list
            },
            rpc: {
                url: main_rpc
            },
            spam: {
                enabled: !useJito,
                sending_rpc_urls: [main_rpc],
                max_retries: 0,
                enable_simple_send: false,
                compute_unit_price: {
                    strategy: "Random",
                    from: 100,
                    to: 100,
                    count: 1
                }
            },
            jito: {
                enabled: useJito,
                block_engine_urls: [
                    `http://${userSetting.proxy_server_ip}:${userSetting.proxy_server_port}/sendTx/api/v1`
                ],
                uuid: "",
                ip_addresses: [userSetting.primary_ip],
                tip_config: {
                    strategy: updatedSettings.jito_strategy,
                    from: Number(updatedSettings.jito_lower_bound),
                    to: Number(updatedSettings.jito_upper_bound),
                    count: Number(updatedSettings.tx_count)
                },
                use_separate_tip_account: true,
                min_profit: 10000,
                use_min_profit: true,

            },
            flashloan: {
                enabled: true
            },
            bot: {
                compute_unit_limit: Number(userSetting.compute_unit_limit) || 650000,
                merge_mints: false
            },
            wallet: {}
        };

        // Создаем директорию, если она не существует
        const configDir = path.join(botDir, 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, {recursive: true});
        }

        // Формируем имя файла
        const taskId = config.taskId || Date.now();
        const shortMeteora = meteoraPools[0]?.substring(0, 8) || '';
        const shortPump = pumpSwapPool ? pumpSwapPool.substring(0, 8) : '';
        const tomlFileName = `${tokenAddress}_${useJito ? "jito" : "default"}_task${taskId}_meteora${shortMeteora}${pumpSwapPool ? `_pump${shortPump}` : ''}_delay${processDelay}.toml`;
        const configPath = path.join(configDir, tomlFileName);

        // Преобразуем конфигурацию в TOML используя библиотеку @iarna/toml
        const tomlString = TOML.stringify(mevConfig);

        // Записываем файл
        fs.writeFileSync(configPath, tomlString);
        // console.log(`[TOML Generator] TOML-файл конфигурации успешно создан: ${configPath}`);

        return configPath;
    } catch (error) {
        const err = error as Error;
        console.error(`[TOML Generator] Ошибка при генерации TOML-файла:`, err);
        return null;
    }
}