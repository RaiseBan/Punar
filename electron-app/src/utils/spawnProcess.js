const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const axios = require("axios");
const { updateConfigCollectionId } = require("./updateService");
const { generateMevConfig } = require("./generateService");
const { convertWindowsPathToWSL } = require("./fsHelper");  // Получаем доступ к Electron API

// Карта для отслеживания процессов mev_subtask
const mevSubtaskProcesses = new Map();

// Функция для получения директории конфигов, с учетом работы в dev и prod
function getConfigDirectory() {
    if (process.env.NODE_ENV === "production") {
        // В продакшн-режиме берем директорию из ресурсов приложения
        return path.join(app.getPath("userData"), "configs");
    } else {
        // В девелоперском режиме сохраняем в текущей рабочей директории
        return path.join(__dirname, "../configs");
    }
}

// Функция для замены проблемных символов в имени файла
function sanitizeFileName(name) {
    return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "_");
}

// Функция для проверки лучшего пула Meteora для токена
async function findBestMeteoraPool(tokenAddress, currentPairAddress) {
    try {
        console.log(`Checking best Meteora pool for token ${tokenAddress}, current pool: ${currentPairAddress}`);

        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);

        if (!response.data.pairs || response.data.pairs.length === 0) {
            console.log(`No pairs found for token ${tokenAddress}`);
            return null;
        }

        // Фильтруем только пары из Meteora
        const meteoraPairs = response.data.pairs.filter(pair => pair.dexId === "meteora");

        if (meteoraPairs.length === 0) {
            console.log(`No Meteora pairs found for token ${tokenAddress}`);
            return null;
        }

        // Находим пару с максимальным объемом за 5 минут
        let bestPair = null;
        let maxVolume = -1;

        for (const pair of meteoraPairs) {
            const volume5m = pair.volume?.m5 || 0;
            if (volume5m > maxVolume) {
                maxVolume = volume5m;
                bestPair = pair;
            }
        }

        if (!bestPair) {
            console.log(`No best Meteora pair found for token ${tokenAddress}`);
            return null;
        }

        // Проверяем, отличается ли лучшая пара от текущей
        if (bestPair.pairAddress !== currentPairAddress) {
            console.log(`Found better Meteora pair: ${bestPair.pairAddress} with volume ${maxVolume}`);
            return bestPair.pairAddress;
        } else {
            console.log(`Current Meteora pair ${currentPairAddress} is already the best`);
        }

        return null;
    } catch (error) {
        console.error(`Error checking DexScreener API: ${error.message}`);
        return null;
    }
}

// Функция для остановки процесса
function stopMevProcess(taskId) {
    if (mevSubtaskProcesses.has(taskId)) {
        const processInfo = mevSubtaskProcesses.get(taskId);

        // Останавливаем мониторинг
        if (processInfo.intervalId) {
            clearInterval(processInfo.intervalId);
        }

        // Удаляем из карты отслеживания
        mevSubtaskProcesses.delete(taskId);

        console.log(`Monitoring for task ${taskId} has been stopped`);
    }
}

// Функция запуска дочернего процесса с конфигом
async function spawnProcess(taskConfig, userSettings) {

    if (!taskConfig.module_name || !taskConfig.task_name) {
        console.error("Ошибка: taskConfig должен содержать module_name и task_name");
        return null;
    }

    // Получаем правильную директорию конфигов
    const configDir = getConfigDirectory();

    // Создаем папку, если её нет
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    // Формируем имя файла из module_name и task_name
    const moduleName = sanitizeFileName(taskConfig.module_name);
    const taskName = sanitizeFileName(taskConfig.task_name);
    const configFileName = `${moduleName}_${taskName}.json`;
    const configPath = path.join(configDir, configFileName);
    console.log(JSON.stringify(taskConfig, null, 2));
    let updatedTaskConfig;
    if (taskConfig.module_name === "Tensor sniper (SDK)" || taskConfig.module_name === "Tensor reprice") {
        updatedTaskConfig = await updateConfigCollectionId(taskConfig);
    } else {
        updatedTaskConfig = taskConfig;
    }
    if (!updatedTaskConfig) {
        return;
    }

    // Записываем конфиг в файл
    fs.writeFileSync(configPath, JSON.stringify(updatedTaskConfig, null, 2), "utf-8");
    console.log(`Конфигурация сохранена: ${configPath}`);
    // Запускаем дочерний процесс с заданным рабочим каталогом (cwd) и переменными окружения
    console.log(JSON.stringify(userSettings, null, 2));
    console.log(`scriptsDirectoryPath: ${userSettings.scriptDirectory}`)
    console.log(`start process: \nPath: ${path.join(userSettings.scriptDirectory, "src", "index.ts")} \nConfigPath: ${configPath}`);
    let moduleDir = ""
    let fileToExecute = "index.ts";
    if (updatedTaskConfig.module_name === "Tensor sniper (SDK)") {
        moduleDir = "tensor-nft-sdk";
    } else if (updatedTaskConfig.module_name === "Tensor reprice") {
        moduleDir = "tensor_reprice";
    } else if (updatedTaskConfig.module_name === "LaunchMyNft") {
        moduleDir = "mint";
        fileToExecute = "starter.ts";
    } else if (updatedTaskConfig.module_name === "Meteora DLMM") {
        moduleDir = "meteora";
    } else if (updatedTaskConfig.module_name === "MEV Module") {
        moduleDir = "mev";
    } else if (updatedTaskConfig.module_name === "mev_subtask") {
        moduleDir = "mev_subtask";
        fileToExecute = "smb-onchain"
    } else {
        console.log(`bullshit`)
        return;
    }

    let child;
    if (moduleDir === "mev") {
        const pythonScriptPath = path.join(userSettings.scriptDirectory, moduleDir);
        const venvPath = path.join(pythonScriptPath, '.venv');

        // 1. Активируем переменные окружения вручную
        const env = {
            ...process.env,
            VIRTUAL_ENV: venvPath,
            PATH: `${path.join(venvPath, 'Scripts')};${process.env.PATH}`, // Для Windows
            PYTHONUNBUFFERED: '1',
            CONFIG_PATH: configPath
        };

        // 2. Путь к Python в виртуальном окружении
        const pythonExecutable = path.join(venvPath, 'Scripts', 'python.exe');

        // 3. Аргументы для запуска
        const args = [
            path.join(pythonScriptPath, "patch.py"),
            `--volume-threshold=${taskConfig.volume_threshold}`,
            `--check-interval=${taskConfig.check_interval}`,
            `--max-attempts=${taskConfig.max_attempts}`,
            `--threads=${taskConfig.thread_workers}`
        ];

        // 4. Запуск процесса
        child = spawn(pythonExecutable, args, {
            stdio: 'pipe',
            shell: true,
            cwd: pythonScriptPath,
            env: env
        });

    } else if (moduleDir === "mev_subtask") {
        console.log(`start mev_subtask processing`)
        // const pythonScriptPath = "C:\\Users\\user\\PycharmProjects\\fuckCloudFlare" // test
        const pythonScriptPath = path.join(userSettings.scriptDirectory, "mev") // test
        let configFilePath = await generateMevConfig(
            userSettings.mevBotDirectory,
            // path.join(userSettings.scriptDirectory, "mev", "tokens"),
            path.join(pythonScriptPath, "tokens"),
            updatedTaskConfig
        );
        console.log(`toml file path: ${configFilePath}`);
        const wslPath = convertWindowsPathToWSL(configFilePath);
        console.log(`wslPath: ${wslPath}`);
        const program = `${convertWindowsPathToWSL(userSettings.mevBotDirectory)}/${fileToExecute}`
        const configFilePathWSL = convertWindowsPathToWSL(configFilePath);
        // const wslCommand = `${fileToExecute} ${configFilePath}`;
        console.log(`full command: wsl ${program} ${configFilePathWSL}`);
        child = spawn('wsl', [program, "run",configFilePathWSL], {
            stdio: 'pipe', // или 'inherit', если нужно выводить логи в терминал
            shell: true, // Используем shell для корректного выполнения
            detached: false,
            cwd: userSettings.mevBotDirectory, // Устанавливаем рабочую директорию для процесса
        });

        // Проверяем, включен ли режим мониторинга
        if (updatedTaskConfig.enablePoolMonitoring === true) {
            console.log(`Enabling pool monitoring for mev_subtask ${updatedTaskConfig.taskId}`);

            // Получаем информацию о токене и текущем пуле Meteora
            const tokenAddress = updatedTaskConfig.rowData[0];

            // Получаем текущий пул Meteora из конфигурации
            // Парсим TOML-файл чтобы получить текущий пул
            const tomlContent = fs.readFileSync(configFilePath, 'utf8');
            // Используем регулярное выражение, так как TOML-библиотека не включена в контекст
            const meteoraPoolMatch = tomlContent.match(/meteora_dlmm_pool_list\s*=\s*\[\s*"([^"]+)"\s*\]/);
            const currentMeteoraPair = meteoraPoolMatch ? meteoraPoolMatch[1] : null;

            console.log(`Token address: ${tokenAddress}, current Meteora pool: ${currentMeteoraPair}`);

            // Устанавливаем интервал проверки (по умолчанию 5 минут)
            const checkInterval = updatedTaskConfig.poolCheckInterval || 300000; // 5 минут в миллисекундах

            const intervalId = setInterval(async () => {
                try {
                    // Проверяем, если процесс завершен, останавливаем мониторинг
                    if (child.exitCode !== null) {
                        console.log(`Process already exited with code ${child.exitCode}, stopping monitoring`);
                        stopMevProcess(updatedTaskConfig.taskId);
                        return;
                    }

                    // Проверяем лучший пул
                    const betterPairAddress = await findBestMeteoraPool(tokenAddress, currentMeteoraPair);

                    if (betterPairAddress) {
                        console.log(`Better Meteora pool found, regenerating config and restarting process`);

                        // Останавливаем текущий процесс
                        child.kill();

                        // Создаем новый конфиг с обновленным пулом Meteora
                        const newConfigFilePath = await generateMevConfig(
                            userSettings.mevBotDirectory,
                            path.join(pythonScriptPath, "tokens"),
                            updatedTaskConfig,
                            betterPairAddress // Передаем новый пул
                        );

                        if (!newConfigFilePath) {
                            console.error(`Failed to generate new config with updated Meteora pool`);
                            return;
                        }

                        console.log(`New config generated at: ${newConfigFilePath}`);

                        // Запускаем процесс с новым конфигом
                        const newConfigFilePathWSL = convertWindowsPathToWSL(newConfigFilePath);

                        const newChild = spawn('wsl', [program, "run", newConfigFilePathWSL], {
                            stdio: 'pipe',
                            shell: true,
                            detached: false,
                            cwd: userSettings.mevBotDirectory
                        });

                        // Заменяем дочерний процесс в mevSubtaskProcesses
                        child = newChild;

                        // Обновляем инфо о процессе в мапе
                        const processInfo = mevSubtaskProcesses.get(updatedTaskConfig.taskId);
                        if (processInfo) {
                            processInfo.process = newChild;
                            processInfo.meteoraPairAddress = betterPairAddress;
                            processInfo.configFilePath = newConfigFilePath;
                        }

                        console.log(`Process restarted with new Meteora pool: ${betterPairAddress}`);
                    }
                } catch (error) {
                    console.error(`Error in monitoring interval: ${error.message}`);
                }
            }, checkInterval);

            // Сохраняем информацию о процессе
            mevSubtaskProcesses.set(updatedTaskConfig.taskId, {
                taskId: updatedTaskConfig.taskId,
                process: child,
                intervalId: intervalId,
                tokenAddress: tokenAddress,
                meteoraPairAddress: currentMeteoraPair,
                configFilePath: configFilePath
            });

            console.log(`Pool monitoring started for task ${updatedTaskConfig.taskId}, interval: ${checkInterval}ms`);
        }
    } else {
        child = spawn("npx", ["tsx", path.join(userSettings.scriptDirectory, moduleDir, "src", fileToExecute)], {
            stdio: "pipe", // или 'inherit', если нужно выводить логи в терминал
            shell: true, // Используем shell для корректного выполнения
            detached: false,
            cwd: userSettings.scriptDirectory, // Устанавливаем рабочую директорию для процесса
            env: { ...process.env, NODE_ENV: process.env.NODE_ENV, CONFIG_PATH: configPath } // Передаем CONFIG_PATH в переменные окружения
        });
    }

    console.log(`after child`)
    // // Обработка стандартного вывода (stdout)
    // child.stdout.on("data", (data) => {
    //     console.log(`STDOUT: ${data}`);
    // });

    // // Обработка ошибок в stderr
    // child.stderr.on("data", (data) => {
    //     console.error(`STDERR: ${data}`);
    // });
    //
    // // Обработка завершения процесса
    // child.on("exit", (code) => {
    //     console.log(`Процесс завершен с кодом: ${code}`);
    // });

    // Добавляем обработчик завершения для mev_subtask процессов
    if (updatedTaskConfig.module_name === "mev_subtask" && updatedTaskConfig.enablePoolMonitoring) {
        child.on("exit", (code) => {
            console.log(`mev_subtask process exited with code ${code}, cleaning up monitoring`);
            stopMevProcess(updatedTaskConfig.taskId);
        });
    }

    return child;
}

// Экспортируем функции
module.exports = {
    spawnProcess,
    stopMevProcess
};
