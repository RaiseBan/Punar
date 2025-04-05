const fs = require("fs");
const path = require("path");
const { updateIfNotExistsAndGet, getRaydiumPair, getFilteredPairs, sortPairsByParameter } = require("./solanaUtils");
const TOML = require('@iarna/toml');
const { PRIMARY_IP, RAYDIUM_OWNER, METEORA_OWNER, RAYDIUM_AMM_OWNER, RAYDIUM_CPMM_OWNER } = require("./constants");

/**
 * Генерирует конфигурацию для MEV процесса
 * @param {string} targetDir - Директория для сохранения конфига
 * @param {string} tokensDirPath - Путь к папке с токенами
 * @param {Object} config - Конфигурация задачи
 * @param {string|null} specificMeteoraPool - Опциональный параметр: конкретный пул Meteora для использования
 * @returns {Promise<string|undefined>} - Путь к сгенерированному файлу или undefined в случае ошибки
 */
async function generateMevConfig(targetDir, tokensDirPath, config, specificMeteoraPool = null) {
    console.log(`generateMevParams: ${targetDir} | ${tokensDirPath} | ${JSON.stringify(config, null, 2)}`);
    console.log(`Using specific Meteora pool: ${specificMeteoraPool || 'Not specified'}`);

    const value = config.rowData[1].split("->")[1].trim().substring(1);
    const fileName = `${config.rowData[0]}_${value}.json`;
    const fullPath = path.join(tokensDirPath, fileName);
    console.log(`value: ${value}`)

    console.log(value, fileName, fullPath)

    if (!fs.existsSync(fullPath)) {
        console.log(`Файл конфигурации не найден: ${fullPath}`);
        return;
    }
    console.log(1);
    const tokenConfig = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    console.log(2);
    const meteoraPairs = tokenConfig.meteora_pairs;
    console.log(3);

    const pumpPairs = (await sortPairsByParameter(config.main_rpc, tokenConfig.pump_swap_pairs, {
        parameter: 'volume',
        timeFrame: "h1",
        order: 'desc'
    }))[0].pair;

    if (!pumpPairs) {
        console.log(`ERROR: pumpPairs not found`);
        return;
    }

    // Используем переданный process_delay или значение по умолчанию (300 мс)
    const processDelay = config.process_delay || 300;

    let mint_config_list = [
        {
            mint: tokenConfig.token_address,
            pump_pool_list: [pumpPairs],
            meteora_dlmm_pool_list: [],
            process_delay: processDelay // Используем индивидуальную задержку для процесса
        }
    ]

    console.log(JSON.stringify(tokenConfig, null, 2));
    console.log(`format...`)
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
            compute_unit_price: 105,
            max_retries: 0,
            enable_simple_send: false
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
                strategy: "Random",
                from: config.jito_lower_bound,
                to: config.jito_upper_bound,
                count: 1
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
    console.log(`end format`)
    console.log(`mevConfig: ${mevConfig}`);

    // Если предоставлен конкретный пул Meteora, используем его
    if (specificMeteoraPool) {
        console.log(`Using provided Meteora pool: ${specificMeteoraPool}`);
        mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [specificMeteoraPool];
    } else {
        // Иначе используем стандартную логику выбора пула
        console.log(meteoraPairs.length);

        const filteredMeteoraPairs = await getFilteredPairs(config.main_rpc, meteoraPairs, METEORA_OWNER);
        const targetMeteoraPair = (await sortPairsByParameter(config.main_rpc, filteredMeteoraPairs, {
            parameter: 'volume',
            timeFrame: 'm5',
            order: 'desc'
        }))[0].pair;

        if (!targetMeteoraPair) {
            console.log(`Meteora pairs with owner ${METEORA_OWNER} not found`);
            return;
        }

        mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [targetMeteoraPair];
    }

    // Создаем директорию, если она не существует
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
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
        const tomlString = TOML.stringify(mevConfig);

        // Записываем файл
        fs.writeFileSync(tomlFilePath, tomlString);
        console.log(`Файл конфигурации успешно создан: ${tomlFilePath}`);

        return tomlFilePath;
    } catch (error) {
        console.error(`Ошибка при создании TOML файла: ${error.message}`);
        return;
    }
}

/**
 * Генерирует упрощенный TOML-файл настройки MEV для запуска процесса
 * @param {string} botDir - Директория с MEV ботом
 * @param {Object} config - Конфигурация задачи
 * @param {string} tokenAddress - Адрес токена
 * @param {string} meteoraPool - Адрес пула Meteora
 * @param {string} pumpSwapPool - Адрес пула PumpSwap (опционально)
 * @returns {Promise<string>} - Путь к созданному TOML-файлу
 */
async function generateSimpleMevConfig(botDir, config, tokenAddress, meteoraPool, pumpSwapPool = null) {
    try {
        const sanitize = require('sanitize-filename');

        // Проверяем обязательные параметры
        if (!botDir || !tokenAddress || !meteoraPool) {
            console.error(`[TOML Generator] Ошибка: не указаны обязательные параметры для генерации TOML-файла`);
            console.error(`[TOML Generator] botDir: ${botDir}, token: ${tokenAddress}, pool: ${meteoraPool}`);
            return null;
        }

        console.log(`[TOML Generator] Генерация TOML-файла конфигурации MEV для токена ${tokenAddress} и пула ${meteoraPool}`);

        // Задержка между процессами (по умолчанию 300ms, если не указано)
        const processDelay = config.process_delay || 300;

        // Основные данные RPC
        const main_rpc = config.main_rpc || "https://api.mainnet-beta.solana.com";

        // Параметры Jito
        const useJito = config.useJito !== undefined ? config.useJito : true;
        const jito_lower_bound = config.jito_lower_bound || 100000;
        const jito_upper_bound = config.jito_upper_bound || 200000;

        // Создаем токенизированное имя файла
        const shortTokenAddr = tokenAddress.substring(0, 8);
        const timestamp = Date.now().toString().substring(8, 13);
        const fileName = sanitize(`${shortTokenAddr}_${timestamp}_${processDelay}.toml`);

        // Путь для сохранения конфига
        const configDir = path.join(botDir, 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const configPath = path.join(configDir, fileName);

        // Формируем содержимое TOML-файла
        let poolsList = [meteoraPool];
        const mint_config_list = [
            {
                mint_address: tokenAddress,
                delay_ms: processDelay,
                pool_address: meteoraPool
            }
        ];

        // Формируем базовую конфигурацию
        let tomlContent = `
# MEV Bot Configuration File
# Автоматически сгенерировано для токена ${tokenAddress}

[system]
main_rpc = "${main_rpc}"
enable_transaction_checks = true
default_keypair_path = "~/.config/solana/id.json"

[mint_addresses]
addresses = ["${tokenAddress}"]

[meteora]
meteora_dlmm_pool_list = ["${meteoraPool}"]
`;

        // Добавляем PumpSwap пул, если он указан
        if (pumpSwapPool) {
            tomlContent += `
[pumpswap]
pumpswap_pool_list = ["${pumpSwapPool}"]
`;
        }

        // Добавляем настройки Jito, если они включены
        if (useJito) {
            tomlContent += `
[jito]
use_jito = true
jito_auth_keypair_path = "./keys/jito_auth.json"
jito_connection_url = "https://mainnet.block-engine.jito.io/api/v1/bundles"
jito_lower_bound = ${jito_lower_bound}
jito_upper_bound = ${jito_upper_bound}
`;
        }

        // Добавляем настройки отдельных процессов
        mint_config_list.forEach((mintConfig, index) => {
            tomlContent += `
[[mint_config]]
mint_address = "${mintConfig.mint_address}"
delay_ms = ${mintConfig.delay_ms}
pool_address = "${mintConfig.pool_address}"
`;
        });

        // Записываем TOML-файл
        fs.writeFileSync(configPath, tomlContent);
        console.log(`[TOML Generator] TOML-файл конфигурации успешно создан: ${configPath}`);

        return configPath;
    } catch (error) {
        console.error(`[TOML Generator] Ошибка при генерации TOML-файла:`, error);
        return null;
    }
}

module.exports = { generateMevConfig, generateSimpleMevConfig };