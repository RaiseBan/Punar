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

    let mint_config_list = [
        {
            mint: tokenConfig.token_address,
            pump_pool_list: [pumpPairs],
            meteora_dlmm_pool_list: [],
            process_delay: 300
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
    // Добавляем taskId в имя файла для уникальности
    const taskId = config.taskId || Date.now();
    const poolSuffix = specificMeteoraPool ? `_updated_${Date.now()}` : '';
    const tomlFileName = `${tokenConfig.token_address}_${value}_${config.useJito === true ? "jito" : "default"}_task${taskId}${poolSuffix}.toml`;
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

module.exports = { generateMevConfig };