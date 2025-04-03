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

// Добавляем более надежную функцию для принудительного завершения процесса в Windows
async function forceKillWindowsProcess(pid) {
    if (!pid) {
        console.error("Невозможно убить процесс: PID не указан");
        return false;
    }

    return new Promise((resolve) => {
        try {
            console.log(`Принудительное завершение процесса с PID ${pid} через taskkill`);

            // Сначала пытаемся завершить с помощью tree-kill
            const treeKill = require('tree-kill');
            treeKill(pid, 'SIGKILL', (treeKillError) => {
                if (treeKillError) {
                    console.log(`tree-kill не завершил процесс ${pid}, пробуем taskkill: ${treeKillError}`);

                    // Если не удалось через tree-kill, пробуем через taskkill как резервный вариант
                    const { execSync } = require('child_process');
                    try {
                        // Используем /F для принудительного завершения и /T для завершения дерева процессов
                        execSync(`taskkill /pid ${pid} /T /F`);
                        console.log(`Процесс ${pid} успешно завершен через taskkill`);
                        resolve(true);
                    } catch (taskkillError) {
                        // Если taskkill не нашел процесс, это нормально
                        if (taskkillError.message.includes('не найден')) {
                            console.log(`Процесс ${pid} не найден, возможно уже завершен`);
                            resolve(true);
                        } else {
                            console.error(`Ошибка завершения процесса ${pid} через taskkill: ${taskkillError.message}`);
                            resolve(false);
                        }
                    }
                } else {
                    console.log(`Процесс ${pid} успешно завершен через tree-kill`);
                    resolve(true);
                }
            });
        } catch (error) {
            console.error(`Общая ошибка при завершении процесса ${pid}: ${error.message}`);
            resolve(false);
        }
    });
}

// Переменная для отслеживания идентификаторов процессов WSL
const wslProcessTracking = {
    pidMap: new Map(),  // Map taskId -> wsl PID
    registerProcess: function (taskId, childProcess) {
        // При создании процесса сохраняем его PID
        if (childProcess && childProcess.pid) {
            console.log(`WSL КОНТРОЛЬ: Регистрируем процесс для задачи ${taskId}, PID: ${childProcess.pid}`);
            this.pidMap.set(taskId, childProcess.pid);
        }
    },
    removeProcess: function (taskId) {
        // Удаляем процесс из отслеживания
        if (this.pidMap.has(taskId)) {
            console.log(`WSL КОНТРОЛЬ: Удаляем процесс из отслеживания для задачи ${taskId}`);
            this.pidMap.delete(taskId);
            return true;
        }
        return false;
    },
    getProcessPid: function (taskId) {
        return this.pidMap.get(taskId) || null;
    },
    getAllProcesses: function () {
        return Array.from(this.pidMap.entries()).map(([taskId, pid]) => ({ taskId, pid }));
    },
    updateProcess: function (taskId, newPid) {
        if (this.pidMap.has(taskId)) {
            console.log(`WSL КОНТРОЛЬ: Обновляем процесс для задачи ${taskId}, новый PID: ${newPid}`);
            this.pidMap.set(taskId, newPid);
            return true;
        }
        return false;
    }
};

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
        console.log(`МОНИТОРИНГ: Проверка лучшего пула Meteora для токена ${tokenAddress}, текущий пул: ${currentPairAddress}`);

        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);

        if (!response.data.pairs || response.data.pairs.length === 0) {
            console.log(`МОНИТОРИНГ: Пары не найдены для токена ${tokenAddress}`);
            return null;
        }

        // Фильтруем только пары из Meteora
        const meteoraPairs = response.data.pairs.filter(pair => pair.dexId === "meteora");

        if (meteoraPairs.length === 0) {
            console.log(`МОНИТОРИНГ: Пары Meteora не найдены для токена ${tokenAddress}`);
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
            console.log(`МОНИТОРИНГ: Не найдена лучшая пара Meteora для токена ${tokenAddress}`);
            return null;
        }

        // Проверяем, отличается ли лучшая пара от текущей
        if (bestPair.pairAddress !== currentPairAddress) {
            console.log(`МОНИТОРИНГ: Найдена лучшая пара Meteora: ${bestPair.pairAddress} с объемом ${maxVolume}, старая пара: ${currentPairAddress}`);
            return bestPair.pairAddress;
        } else {
            console.log(`МОНИТОРИНГ: Текущая пара Meteora ${currentPairAddress} остается лучшей, объем: ${maxVolume}`);
        }

        return null;
    } catch (error) {
        console.error(`МОНИТОРИНГ: Ошибка при проверке DexScreener API: ${error.message}`);
        return null;
    }
}

// Функция для остановки процесса
function stopMevProcess(taskId) {
    if (!taskId) {
        console.warn(`МОНИТОРИНГ: Вызов stopMevProcess без taskId!`);
        return;
    }

    // Получаем PID из карты отслеживания и пытаемся завершить процесс
    const pid = wslProcessTracking.getProcessPid(taskId);
    if (pid) {
        console.log(`МОНИТОРИНГ: Останавливаем WSL-процесс для задачи ${taskId}, PID: ${pid}`);
        forceKillWindowsProcess(pid)
            .then(success => {
                console.log(`МОНИТОРИНГ: Результат остановки процесса ${taskId}: ${success ? 'успешно' : 'не удалось'}`);
            })
            .catch(err => {
                console.error(`МОНИТОРИНГ: Ошибка при остановке процесса ${taskId}:`, err);
            });
    }

    // Удаляем процесс из отслеживания WSL
    wslProcessTracking.removeProcess(taskId);

    if (mevSubtaskProcesses.has(taskId)) {
        const processInfo = mevSubtaskProcesses.get(taskId);
        console.log(`МОНИТОРИНГ: Останавливаем мониторинг для задачи ${taskId}...`);

        // Останавливаем мониторинг
        if (processInfo.intervalId) {
            console.log(`МОНИТОРИНГ: Остановка интервала проверки для задачи ${taskId}`);
            clearInterval(processInfo.intervalId);
        }

        // Удаляем из карты отслеживания
        mevSubtaskProcesses.delete(taskId);

        console.log(`МОНИТОРИНГ: Мониторинг для задачи ${taskId} остановлен полностью`);
        return true;
    } else {
        console.log(`МОНИТОРИНГ: Процесс ${taskId} не найден в карте мониторинга`);
        return false;
    }
}

// Функция запуска дочернего процесса с конфигом
async function spawnProcess(taskConfig, userSettings) {

    if (!taskConfig.module_name || !taskConfig.task_name) {
        console.error("Ошибка: taskConfig должен содержать module_name и task_name");
        return null;
    }

    // Убедимся, что taskId доступен и корректен
    const taskId = taskConfig.taskId || (taskConfig.sourceTaskId ? taskConfig.sourceTaskId : Date.now());
    console.log(`ПРОЦЕСС: Используем taskId: ${taskId} для процесса ${taskConfig.module_name}/${taskConfig.task_name}`);

    // Сохраняем taskId в конфигурации, если его там нет
    taskConfig.taskId = taskId;

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
        child = spawn('wsl.exe', ['-e', program, "run", configFilePathWSL], {
            stdio: 'pipe',
            shell: false,
            detached: false,
            cwd: userSettings.mevBotDirectory,
        });

        // Проверяем, включен ли режим мониторинга
        if (updatedTaskConfig.enablePoolMonitoring === true) {
            console.log(`МОНИТОРИНГ: Включение мониторинга пулов для задачи ${taskId}`);

            // Получаем информацию о токене и текущем пуле Meteora
            const tokenAddress = updatedTaskConfig.rowData[0];

            // Получаем текущий пул Meteora из конфигурации
            // Парсим TOML-файл чтобы получить текущий пул
            const tomlContent = fs.readFileSync(configFilePath, 'utf8');
            // Используем регулярное выражение, так как TOML-библиотека не включена в контекст
            const meteoraPoolMatch = tomlContent.match(/meteora_dlmm_pool_list\s*=\s*\[\s*"([^"]+)"\s*\]/);
            const currentMeteoraPair = meteoraPoolMatch ? meteoraPoolMatch[1] : null;

            console.log(`МОНИТОРИНГ: Адрес токена: ${tokenAddress}, текущий пул Meteora: ${currentMeteoraPair}`);

            // Устанавливаем интервал проверки (по умолчанию 5 минут)
            const checkInterval = updatedTaskConfig.poolCheckInterval || 300000; // 5 минут в миллисекундах
            console.log(`МОНИТОРИНГ: Настройка интервала проверки ${checkInterval}ms для задачи ${taskId}`);

            // Создаем структуру для хранения информации о процессе
            const processInfo = {
                taskId: taskId,
                process: child,
                intervalId: null, // Заполним позже
                tokenAddress: tokenAddress,
                meteoraPairAddress: currentMeteoraPair,
                configFilePath: configFilePath,
                lastCheckTime: Date.now(),
                checkCount: 0
            };

            // Устанавливаем интервал
            const intervalId = setInterval(async () => {
                try {
                    const currentTime = Date.now();
                    processInfo.checkCount++;
                    console.log(`МОНИТОРИНГ: Выполняется проверка пула для задачи ${taskId} в ${new Date().toISOString()} [Проверка #${processInfo.checkCount}, прошло ${Math.floor((currentTime - processInfo.lastCheckTime) / 1000)}с]`);
                    processInfo.lastCheckTime = currentTime;

                    // Проверяем, если процесс завершен, останавливаем мониторинг
                    if (child.exitCode !== null) {
                        console.log(`МОНИТОРИНГ: Процесс ${taskId} уже завершен с кодом ${child.exitCode}, останавливаем мониторинг`);
                        stopMevProcess(taskId);
                        return;
                    }

                    // Проверяем лучший пул
                    const betterPairAddress = await findBestMeteoraPool(tokenAddress, currentMeteoraPair);

                    if (betterPairAddress) {
                        console.log(`МОНИТОРИНГ: Найден лучший пул Meteora для задачи ${taskId}, перегенерируем конфиг и перезапускаем процесс`);

                        try {
                            // Используем нашу новую функцию для надежного завершения процесса
                            if (child && child.pid) {
                                console.log(`МОНИТОРИНГ: Завершение процесса ${taskId} с PID ${child.pid} для перезапуска с новым пулом`);

                                // Принудительно завершаем процесс
                                await forceKillWindowsProcess(child.pid);

                                // Увеличиваем задержку перед запуском нового процесса до 5 секунд
                                // для гарантии полного завершения старого процесса и освобождения ресурсов
                                await new Promise(resolve => setTimeout(resolve, 5000));

                                console.log(`МОНИТОРИНГ: Текущий процесс ${taskId} остановлен`);
                            }
                        } catch (killError) {
                            console.error(`МОНИТОРИНГ: Ошибка при попытке остановить процесс ${taskId}:`, killError);

                            // Даже если была ошибка, даем немного времени для возможного завершения
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }

                        // Отправляем уведомление о смене пула через Telegram
                        try {
                            // Импортируем telegramBotService прямо здесь для прямого обращения
                            const telegramBotService = require('../services/telegramBotService');

                            // Формируем подробное сообщение о смене пула
                            const poolChangeMessage = `🔄 Обнаружена смена пула Meteora\n\n` +
                                `Задача ID: ${taskId}\n` +
                                `Модуль: ${updatedTaskConfig.module_name || 'mev_subtask'}\n` +
                                `Токен: ${tokenAddress}\n` +
                                `Старый пул: ${currentMeteoraPair}\n` +
                                `Новый пул: ${betterPairAddress}\n` +
                                `Время: ${new Date().toISOString()}\n\n` +
                                `Процесс будет перезапущен автоматически с новым пулом.`;

                            // Отправляем прямое уведомление с приоритетом
                            console.log(`МОНИТОРИНГ: Отправка подробного уведомления о смене пула для задачи ${taskId}`);
                            telegramBotService.sendSystemNotification(poolChangeMessage);

                            // Получаем BrowserWindow и отправляем события для UI
                            const { BrowserWindow } = require('electron');
                            const mainWindow = BrowserWindow.getAllWindows()[0];

                            if (mainWindow && !mainWindow.isDestroyed()) {
                                // Отправляем событие обновления, используя тот же taskId
                                console.log(`МОНИТОРИНГ: Отправка события process-started для обновления UI о перезапуске задачи ${taskId}`);

                                // Создаем объект с конфигурацией, похожий на тот, что использовался при первом запуске
                                const processConfig = {
                                    ...updatedTaskConfig,
                                    // Добавляем сведения о новом пуле для отображения в логах
                                    configUpdated: true,
                                    newMeteoraPairAddress: betterPairAddress,
                                    restartTime: new Date().toISOString()
                                };

                                // Отправляем событие process-started с тем же taskId для обновления UI
                                mainWindow.webContents.send("process-started", {
                                    taskId,
                                    config: processConfig
                                });

                                // Также отправляем дополнительное уведомление для логов в UI
                                mainWindow.webContents.send("process-output", {
                                    taskId,
                                    log: `[SYSTEM] Процесс перезапущен с новым пулом Meteora: ${betterPairAddress}`
                                });

                                // Дополнительно уведомляем UI о смене пула для обратной совместимости
                                console.log(`МОНИТОРИНГ: Отправка уведомления о смене пула для задачи ${taskId} через telegram-notify-pool-change`);
                                mainWindow.webContents.send('telegram-notify-pool-change', {
                                    taskId,
                                    oldPool: currentMeteoraPair,
                                    newPool: betterPairAddress,
                                    tokenAddress: tokenAddress
                                });
                            }
                        } catch (notifyError) {
                            console.error(`МОНИТОРИНГ: Ошибка при отправке уведомления:`, notifyError);
                        }

                        // Создаем новый конфиг с обновленным пулом Meteora
                        const newConfigFilePath = await generateMevConfig(
                            userSettings.mevBotDirectory,
                            path.join(pythonScriptPath, "tokens"),
                            updatedTaskConfig,
                            betterPairAddress // Передаем новый пул
                        );

                        if (!newConfigFilePath) {
                            console.error(`МОНИТОРИНГ: Не удалось создать новый конфиг с обновленным пулом Meteora для задачи ${taskId}`);
                            return;
                        }

                        console.log(`МОНИТОРИНГ: Новый конфиг создан для задачи ${taskId}: ${newConfigFilePath}`);

                        // Запускаем процесс с новым конфигом
                        const newConfigFilePathWSL = convertWindowsPathToWSL(newConfigFilePath);

                        const newChild = spawn('wsl.exe', ['-e', program, "run", newConfigFilePathWSL], {
                            stdio: 'pipe',
                            shell: false,
                            detached: false,
                            cwd: userSettings.mevBotDirectory
                        });

                        // Проверяем, что процесс успешно запущен
                        if (!newChild || !newChild.pid) {
                            console.error(`МОНИТОРИНГ: Не удалось запустить новый процесс для задачи ${taskId}`);
                            return;
                        }

                        // Устанавливаем обработчики для отслеживания состояния нового процесса
                        newChild.on('error', (err) => {
                            console.error(`МОНИТОРИНГ: Ошибка в новом процессе для задачи ${taskId}:`, err);
                        });

                        newChild.stdout.once('data', () => {
                            console.log(`МОНИТОРИНГ: Новый процесс ${taskId} начал работу - получены первые данные`);
                        });

                        newChild.on('exit', (code) => {
                            console.log(`МОНИТОРИНГ: Новый процесс ${taskId} завершился с кодом ${code}`);
                            stopMevProcess(taskId);
                        });

                        // Заменяем дочерний процесс в mevSubtaskProcesses
                        child = newChild;
                        console.log(`МОНИТОРИНГ: Новый процесс для задачи ${taskId} запущен успешно, PID: ${newChild.pid}`);

                        // Обновляем инфо о процессе в мапе
                        processInfo.process = newChild;
                        processInfo.meteoraPairAddress = betterPairAddress;
                        processInfo.configFilePath = newConfigFilePath;
                        console.log(`МОНИТОРИНГ: Обновлена информация о процессе ${taskId} в кэше`);

                        console.log(`МОНИТОРИНГ: Процесс задачи ${taskId} перезапущен с новым пулом Meteora: ${betterPairAddress}`);

                        // Обновляем процесс в wslProcessTracking с новым PID
                        wslProcessTracking.updateProcess(taskId, newChild.pid);
                    } else {
                        console.log(`МОНИТОРИНГ: Лучший пул не найден, сохраняем текущий пул для задачи ${taskId}`);
                    }
                } catch (error) {
                    console.error(`МОНИТОРИНГ: Ошибка в интервале мониторинга для задачи ${taskId}: ${error.message}`);
                }
            }, checkInterval);

            // Сохраняем ID интервала в processInfo
            processInfo.intervalId = intervalId;

            // Сохраняем информацию о процессе
            mevSubtaskProcesses.set(taskId, processInfo);

            console.log(`МОНИТОРИНГ: Мониторинг пулов запущен для задачи ${taskId}, интервал: ${checkInterval}ms`);
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
            console.log(`mev_subtask process ${taskId} exited with code ${code}, cleaning up monitoring`);

            // Даже если код равен null (принудительное завершение), мы должны корректно очистить ресурсы
            if (code === null) {
                console.log(`МОНИТОРИНГ: Процесс ${taskId} был завершен принудительно. Очищаем ресурсы.`);
            }

            stopMevProcess(taskId);
        });
    }

    // После создания процесса для mev_subtask, добавляем:
    wslProcessTracking.registerProcess(taskId, child);

    // Добавляем обработчики для корректного отслеживания состояния процесса
    child.on('error', (err) => {
        console.error(`ПРОЦЕСС ${taskId}: Ошибка процесса WSL:`, err.message);
        // Помечаем процесс как проблемный в трекере
        wslProcessTracking.removeProcess(taskId);
    });

    // Добавляем надежное отслеживание отключения процесса
    child.on('disconnect', () => {
        console.log(`ПРОЦЕСС ${taskId}: WSL процесс отключен`);
    });

    // В блоке mev_subtask, после запуска процесса и перед проверкой enablePoolMonitoring
    // добавляем код для проверки живости процесса периодически:

    // Добавляем периодическую проверку состояния процесса (каждые 30 секунд)
    const processCheckInterval = setInterval(() => {
        // Проверяем, что процесс все еще активен
        if (child.exitCode !== null || child.killed) {
            console.log(`ПРОЦЕСС ${taskId}: WSL процесс завершился или был убит, останавливаем проверку`);
            clearInterval(processCheckInterval);
            wslProcessTracking.removeProcess(taskId);
            return;
        }

        // Проверка, отвечает ли процесс
        try {
            // Отправляем сигнал 0 для проверки существования процесса
            const isRunning = process.kill(child.pid, 0);
            console.log(`ПРОЦЕСС ${taskId}: Проверка WSL процесса - ${isRunning ? 'активен' : 'неактивен'}`);
        } catch (e) {
            // Если возникла ошибка при проверке, процесс, вероятно, больше не существует
            console.error(`ПРОЦЕСС ${taskId}: Ошибка при проверке состояния WSL процесса:`, e.message);
            if (e.code === 'ESRCH') {
                console.log(`ПРОЦЕСС ${taskId}: WSL процесс не найден, очищаем`);
                clearInterval(processCheckInterval);
                wslProcessTracking.removeProcess(taskId);
            }
        }
    }, 30000); // Проверка каждые 30 секунд

    // Когда задача завершается, не забываем очистить интервал проверки
    child.on('exit', () => {
        if (processCheckInterval) {
            clearInterval(processCheckInterval);
        }
    });

    return child;
}

// Экспортируем функции
module.exports = {
    spawnProcess,
    stopMevProcess,
    forceKillWindowsProcess
};
