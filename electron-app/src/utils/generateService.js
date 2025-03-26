const fs = require("fs");
const path = require("path");
const { updateIfNotExistsAndGet, getRaydiumPair} = require("./solanaUtils");
const TOML = require('@iarna/toml');

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
    let mint_config_list = [];
    if (config.strategy === "raydium"){
        const raydiumPair = await getRaydiumPair(config.main_rpc, tokenConfig.raydium_pairs)

        if (!raydiumPair){
            console.log(`correct raydium pair not found`);
            return;
        }

        mint_config_list = [
            {
                mint: tokenConfig.token_address,
                raydium_pool: raydiumPair,
                meteora_dlmm_pool_list: [],
                process_delay: 300
            }
        ]
    }else if (config.strategy === "pumpswap"){
        const pumpPairs = tokenConfig.pump_swap_pairs; // возможно стоит использовать только первую пару
        if (!pumpPairs){
            console.log(`ERROR: pumpPairs not found`);
            return;
        }

        mint_config_list = [
            {
                mint: tokenConfig.token_address,
                pump_pool_list: pumpPairs,
                meteora_dlmm_pool_list:[],
                process_delay: 300
            }
        ]
    }


    
    console.log(4);

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
            sending_rpc_url: config.main_rpc,
            compute_unit_price: 105,
            skip_preflight: true
        },
        jito: {
            enabled: useJito,
            block_engine_urls: [
                "http://localhost:8082/jitoNY/api/v1",
                "http://localhost:8082/jitoTOKIO/api/v1",
                "http://localhost:8082/jitoSLC/api/v1",
                "http://localhost:8082/jitoAMSTERDAM/api/v1",
                "http://localhost:8082/jitoFRANKFURT/api/v1"
            ],
            uuid: "",
            ip_addresses: [PRIMARY_IP],
            tip_config: {
                strategy: "Random",
                from: 10000,
                to: 100000,
                count: 3
            }
        },
        kamino_flashloan: {
            enabled: true
        },
        wallet: {}
    };
    console.log(`end format`)
    console.log(`mevConfig: ${mevConfig}`);

    // Добавляем meteora_pairs в зависимости от их количества
    console.log(meteoraPairs.length)
    if (meteoraPairs.length <= 3) {
        // Если не больше 3 пар, добавляем их в список
        mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [...meteoraPairs];
    } else {
        // Если больше 3 пар, получаем lookup таблицы
        const lookupTables = await updateIfNotExistsAndGet(config.main_rpc, meteoraPairs, config.private_key);

        if (!lookupTables) {
            console.error("Не удалось получить lookup таблицы");
            return;
        }

        mevConfig.routing.mint_config_list[0].lookup_table_accounts = lookupTables;

        // Оставляем meteora_dlmm_pool_list пустым
        mevConfig.routing.mint_config_list[0].meteora_dlmm_pool_list = [];
    }

    // Создаем директорию, если она не существует
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Формируем имя файла и путь для сохранения
    const tomlFileName = `${tokenConfig.token_address}_${value}.toml`;
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