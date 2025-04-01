const fs = require("fs");
const path = require("path");
const { updateIfNotExistsAndGet, getRaydiumPair, getFilteredPairs, sortPairsByParameter } = require("./solanaUtils");
const TOML = require('@iarna/toml');
const { PRIMARY_IP, RAYDIUM_OWNER, METEORA_OWNER, RAYDIUM_AMM_OWNER, RAYDIUM_CPMM_OWNER } = require("./constants");

async function generateMevConfig(targetDir, tokensDirPath, config) {
    console.log(`generateMevParams: ${targetDir} | ${tokensDirPath} | ${JSON.stringify(config, null, 2)}`);
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


    // const raydiumPair = tokenConfig.raydium_pairs[0];


    // const raydiumPairsAMM = await getFilteredPairs(config.main_rpc, tokenConfig.raydium_pairs, RAYDIUM_AMM_OWNER);
    // if (raydiumPairsAMM.length === 0) {
    //     console.log(`[RAYDIUM AMM] no such pools with owner: ${RAYDIUM_AMM_OWNER}`);
    // }

    // const raydiumPairsCPMM = await getFilteredPairs(config.main_rpc, tokenConfig.raydium_pairs, RAYDIUM_CPMM_OWNER);
    // if (raydiumPairsCPMM.length === 0) {
    //     console.log(`[RAYDIUM CPMM] no such pools with owner: ${RAYDIUM_CPMM_OWNER}`);
    // }

    // const raydiumPairAMMToUse = (await sortPairsByParameter(config.main_rpc, raydiumPairsAMM, {
    //     parameter: 'volume',
    //     timeFrame: 'h1',
    //     order: 'desc'
    // }))[0].pair;

    // const raydiumPairCPMMToUse = (await sortPairsByParameter(config.main_rpc, raydiumPairsCPMM, {
    //     parameter: 'volume',
    //     timeFrame: "h1",
    //     order: 'desc'
    // }))[0].pair;

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
            sending_rpc_url: [config.main_rpc],
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
            compute_unit_limit: 290_000,
            merge_mints: false
        },
        wallet: {}
    };
    console.log(`end format`)
    console.log(`mevConfig: ${mevConfig}`);

    // Добавляем meteora_pairs в зависимости от их количества
    console.log(meteoraPairs.length)

    const filteredMeteoraPairs = await getFilteredPairs(config.main_rpc, meteoraPairs, METEORA_OWNER);
    const targetMeteoraPair = (await sortPairsByParameter(config.main_rpc, filteredMeteoraPairs, {
        parameter: 'volume',
        timeFrame: 'm5',
        order: 'desc'
    }))[0].pair;

    if (!targetMeteoraPair) { // было filteredMeteoraPairs
        console.log(`Meteora pairs with owner ${METEORA_OWNER} not found`);
        return;
    }

    mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [targetMeteoraPair];

    // if (filteredMeteoraPairs.length === 1) {
    //     // Если не больше 1 пары, добавляем их в список
    //     mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [targetMeteoraPair];
    // } else {
    //     mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [targetMeteoraPair];
    //     // Если больше 1 пары, получаем lookup таблицы
    //     const lookupTables = await updateIfNotExistsAndGet(config.main_rpc, filteredMeteoraPairs, config.private_key);

    //     if (!lookupTables) {
    //         console.error("Не удалось получить lookup таблицы");
    //         return;
    //     }

    //     mevConfig.routing.mint_config_list[0].lookup_table_accounts = lookupTables;

    //     // Оставляем meteora_dlmm_pool_list пустым
    //     // mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [];
    // }

    // Создаем директорию, если она не существует
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Формируем имя файла и путь для сохранения
    const tomlFileName = `${tokenConfig.token_address}_${value}_${config.useJito === true ? "jito" : "default"}.toml`;
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