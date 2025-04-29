/**
 * MEV LoadBalancer - Модуль балансировки нагрузки MEV процессов
 *
 * Отвечает за обнаружение сигналов MEV в логах процессов new-token-release,
 * запуск MEV процессов и распределение нагрузки между ними.
 */
const { ipcMain } = require('electron');
const path = require('path');
const { app } = require('electron');
const { spawnProcess, stopMevProcess, forceKillWindowsProcess } = require('../utils/spawnProcess');
const { generateMevConfig } = require('../utils/generateService');
const { getSettings } = require('../utils/fsHelper');
const telegramBotService = require('./telegramBotService');
const fs = require('fs');
const bs58 = require("bs58");
const { sleep, getDetailedTokenAccounts, createTokenAccount } = require('../utils/solanaUtils');
const { Keypair } = require("@solana/web3.js");
const logger = require('../services/loggerService');


class MevLoadBalancer {
    constructor() {
        // Карта для отслеживания MEV процессов
        // key = processId, value = { process, config, startTime, lastActivity, signals: [], status }
        this.mevProcesses = new Map();

        // Карта для отслеживания процессов токен-релиза
        // key = processId, value = true
        this.tokenReleaseProcesses = new Map();

        this.userTokens = new Map();
        this.USER;

        // Флаг активации балансировщика
        this.isActive = false;

        // Буфер для MEV сигналов
        this.signalBuffer = [];
        this.processingSignals = false;
        this.processingTimer = null;

        // Таймер проверки ликвидности пулов
        this.liquidityCheckerTimer = null;

        // Флаг блокировки очистки процессов
        this.isCleaningProcesses = false;

        // Статистика
        this.stats = {
            processedSignals: 0,
            successfulSignals: 0,
            failedSignals: 0,
            totalMevActions: 0
        };

        // Настройки
        this.settings = {
            maxSignalsPerProcess: 50,    // Максимальное количество сигналов на процесс
            notifyTelegram: true,        // Отправлять уведомления в Telegram
            processingInterval: 10000,    // Интервал обработки буфера сигналов (5 секунд)
            liquidityCheckInterval: 30 * 60 * 1000, // Интервал проверки ликвидности (20 минут)
            minimumLiquidity: 170,       // Минимальная ликвидность пула (USD)
            minProcessAgeForCleanup: 25 * 60 * 1000  // Минимальный возраст процесса для проверки очистки (20 минут)
        };

        // Настройки пользователя
        this.userSettings = null;

        // Инициализация
        this.init();
    }

    /**
     * Инициализирует модуль MEV LoadBalancer
     */
    async init() {
        try {
            // Загружаем настройки пользователя
            this.userSettings = await getSettings();

            // Инициализируем обработчики IPC
            this.initIpcHandlers();

            // Активируем балансировщик автоматически при запуске
            this.isActive = true;
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Балансировщик автоматически активирован при запуске');

            this.USER = Keypair.fromSecretKey(new Uint8Array(bs58.default.decode(this.userSettings.migration_wallet)));
            // кешируем токен аккаунты
            console.log(1)
            const tokenObjects = await getDetailedTokenAccounts(this.USER.publicKey, this.userSettings.mainRpc);
            console.log(2)
            tokenObjects.forEach(tokenFields => {
                this.userTokens.set(tokenFields.mint, tokenFields.address);
            })
            console.log(3)

            // Запускаем таймер обработки сигналов
            this.startProcessingTimer();

            // Запускаем таймер проверки ликвидности пулов
            this.startPoolLiquidityChecker();

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Инициализация завершена');
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при инициализации:', error);
        }
    }

    /**
     * Запускает таймер обработки сигналов
     */
    startProcessingTimer() {
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
        }

        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Запуск таймера обработки сигналов (интервал: ${this.settings.processingInterval}мс)`);

        this.processingTimer = setInterval(() => {
            this.processSignalBuffer();

        }, this.settings.processingInterval);
    }

    /**
     * Останавливает таймер обработки сигналов
     */
    stopProcessingTimer() {
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
            this.processingTimer = null;
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Таймер обработки сигналов остановлен');
        }
    }

    /**
     * Запускает таймер проверки ликвидности пулов
     */
    startPoolLiquidityChecker() {
        // Останавливаем предыдущий таймер, если он был
        if (this.liquidityCheckerTimer) {
            clearInterval(this.liquidityCheckerTimer);
        }

        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Запуск таймера проверки ликвидности пулов (интервал: ${this.settings.liquidityCheckInterval}мс)`);

        // Запускаем новый таймер
        this.liquidityCheckerTimer = setInterval(() => {
            this.checkAndCleanProcessesByLiquidity();
        }, this.settings.liquidityCheckInterval);
    }

    /**
     * Останавливает таймер проверки ликвидности пулов
     */
    stopPoolLiquidityChecker() {
        if (this.liquidityCheckerTimer) {
            clearInterval(this.liquidityCheckerTimer);
            this.liquidityCheckerTimer = null;
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Таймер проверки ликвидности пулов остановлен');
        }
    }

    /**
     * Добавляет MEV сигнал в буфер для последующей обработки
     * @param {Object} signal - Данные сигнала (tokenAddress, meteoraPool, pumpSwapPool)
     * @param {string} sourceProcessId - ID процесса, от которого получен сигнал
     * @returns {Object} - Результат добавления в буфер
     */
    addSignalToBuffer(signal, sourceProcessId) {
        try {
            if (!this.isActive) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Балансировщик неактивен, сигнал игнорируется');
                return {
                    success: false,
                    error: 'Балансировщик неактивен'
                };
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Добавление сигнала в буфер от процесса ${sourceProcessId}`);

            // Добавляем сигнал в буфер с метаданными
            this.signalBuffer.push({
                ...signal,
                sourceProcessId,
                addedTime: Date.now()
            });

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Сигнал добавлен в буфер (всего в буфере: ${this.signalBuffer.length})`);

            return {
                success: true,
                bufferSize: this.signalBuffer.length
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при добавлении сигнала в буфер:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Обрабатывает буфер MEV сигналов
     */
    async processSignalBuffer() {
        // Если уже обрабатываем сигналы или буфер пуст, выходим
        if (this.processingSignals || this.signalBuffer.length === 0) {
            return;
        }

        try {
            // Устанавливаем флаг обработки
            this.processingSignals = true;

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Начало обработки буфера сигналов (${this.signalBuffer.length} сигналов)`);

            // Копируем буфер и очищаем его
            const signalsToProcess = [...this.signalBuffer];
            this.signalBuffer = [];

            // Отправляем уведомление о начале обработки
            if (this.settings.notifyTelegram) {
                telegramBotService.sendSystemNotification(
                    `🔄 Начало обработки ${signalsToProcess.length} MEV сигналов из буфера`
                );
            }

            // Проверяем, идет ли очистка процессов
            if (this.isCleaningProcesses) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Обнаружена активная очистка процессов, откладываем обработку сигналов`);
                // Возвращаем сигналы обратно в буфер
                this.signalBuffer.push(...signalsToProcess);

                if (this.settings.notifyTelegram) {
                    telegramBotService.sendSystemNotification(
                        `⏱️ Обработка ${signalsToProcess.length} MEV сигналов отложена: идет очистка процессов`
                    );
                }

                return;
            }

            // Обрабатываем все сигналы одним вызовом
            const result = await this.handleMevSignal(signalsToProcess);

            if (!result.success) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке буфера сигналов:', result.error);
            }

        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке буфера сигналов:', error);
        } finally {
            // Сбрасываем флаг обработки
            this.processingSignals = false;
        }
    }

    /**
     * Запускает MEV LoadBalancer
     * @returns {Promise<Object>} - Результат запуска
     */
    async start() {
        try {
            if (this.isActive) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Балансировщик уже запущен');
                return { success: true, status: 'already_running' };
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Запуск MEV LoadBalancer');

            // Получаем глобальные настройки пользователя
            this.userSettings = await getSettings();

            this.isActive = true;

            // Сбрасываем статистику
            this.resetStats();

            // Запускаем таймер обработки сигналов
            this.startProcessingTimer();

            // Уведомляем о запуске в Telegram
            if (this.settings.notifyTelegram) {
                telegramBotService.sendSystemNotification('✅ MEV LoadBalancer запущен');
            }

            return {
                success: true,
                status: 'running',
                message: 'MEV LoadBalancer успешно запущен'
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при запуске:', error);
            this.isActive = false;

            return {
                success: false,
                error: error.message,
                message: 'Не удалось запустить MEV LoadBalancer'
            };
        }
    }

    /**
     * Останавливает MEV LoadBalancer
     * @returns {Promise<Object>} - Результат остановки
     */
    async stop() {
        try {
            if (!this.isActive) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Балансировщик уже остановлен');
                return { success: true, status: 'already_stopped' };
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Остановка MEV LoadBalancer');

            // Останавливаем таймер обработки сигналов
            this.stopProcessingTimer();

            // Останавливаем таймер проверки ликвидности
            this.stopPoolLiquidityChecker();

            // Очищаем буфер сигналов
            this.signalBuffer = [];

            // Останавливаем все MEV процессы
            const processes = this.getProcesses();
            for (const process of processes) {
                await this.stopProcess(process.id);
            }

            this.isActive = false;

            // Уведомляем об остановке в Telegram
            if (this.settings.notifyTelegram) {
                telegramBotService.sendSystemNotification('❌ MEV LoadBalancer остановлен');
            }

            return {
                success: true,
                status: 'stopped',
                message: 'MEV LoadBalancer успешно остановлен'
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при остановке:', error);

            return {
                success: false,
                error: error.message,
                message: 'Не удалось остановить MEV LoadBalancer'
            };
        }
    }

    /**
     * Возвращает текущий статус балансировщика
     * @returns {Object} - Статус балансировщика
     */
    getStatus() {
        return {
            isActive: this.isActive,
            processCount: this.mevProcesses.size,
            tokenReleaseProcessCount: this.tokenReleaseProcesses.size,
            stats: this.getStats(),
            settings: this.settings
        };
    }

    /**
     * Возвращает статистику балансировщика
     * @returns {Object} - Статистика
     */
    getStats() {
        return {
            ...this.stats
        };
    }

    /**
     * Сбрасывает статистику
     */
    resetStats() {
        this.stats = {
            processedSignals: 0,
            successfulSignals: 0,
            failedSignals: 0,
            totalMevActions: 0
        };
    }

    /**
     * Обновляет настройки балансировщика
     * @param {Object} settings - Новые настройки
     * @returns {Object} - Результат обновления
     */
    updateSettings(settings) {
        try {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Обновление настроек:', settings);

            // Обновляем настройки
            this.settings = {
                ...this.settings,
                ...settings
            };

            return {
                success: true,
                settings: this.settings,
                message: 'Настройки успешно обновлены'
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обновлении настроек:', error);

            return {
                success: false,
                error: error.message,
                message: 'Не удалось обновить настройки'
            };
        }
    }

    /**
     * Проверяет, является ли процесс процессом new-token-release
     * @param {string} processId - Идентификатор процесса
     * @returns {boolean} - true, если процесс является процессом new-token-release
     */
    isTokenReleaseProcess(processId) {
        return this.tokenReleaseProcesses.has(processId);
    }


    /**
     * Регистрирует процесс как процесс new-token-release
     * @param {string} processId - Идентификатор процесса
     */
    registerTokenReleaseProcess(processId) {
        if (!this.tokenReleaseProcesses.has(processId)) {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Регистрация процесса ${processId} как процесса new-token-release`);
            this.tokenReleaseProcesses.set(processId, true);
        }
    }

    /**
     * Получает информацию о процессах
     * @returns {Array} - Список MEV процессов
     */
    getProcesses() {
        const processes = [];

        for (const [processId, processData] of this.mevProcesses.entries()) {
            processes.push({
                id: processId,
                pid: processData.process ? processData.process.pid : null,
                tokenAddress: processData.config ? processData.config.tokenAddress : 'unknown',
                meteoraPool: processData.config ? processData.config.meteoraPool : null,
                pumpSwapPool: processData.config ? processData.config.pumpSwapPool : null,
                status: processData.status,
                startTime: processData.startTime,
                lastActivity: processData.lastActivity,
                signals: processData.signals ? processData.signals.length : 0
            });
        }

        return processes;
    }

    /**
     * Запускает новый MEV процесс
     * @param {Object} config - Конфигурация процесса
     * @param {Object} options - Дополнительные параметры
     * @param {boolean} options.isRestart - Флаг, указывающий, что это перезапуск существующего процесса
     * @param {number} options.initialCreationTime - Исходное время создания процесса (для перезапуска)
     * @returns {Promise<string|null>} - ID процесса или null в случае ошибки
     */
    async startMevProcess(config, options = {}) {
        try {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `ckeck token exists on "${config.tokenAddress}"`);
            if (!this.userTokens.has(config.tokenAddress.trim())) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `NO TOKEN ACCOUNT, CREATING...`);
                this.userTokens.set(config.tokenAddress.trim(), await createTokenAccount(this.userSettings.mainRpc, config.tokenAddress.trim(), this.USER, this.userTokens));
                await sleep(21000);
            }


            // Проверяем обязательные параметры
            const tokenAddress = config.tokenAddress;
            const meteoraPool = config.meteoraPool || config.poolAddress;
            let pumpSwapPool = config.pumpSwapPool || null;

            if (!tokenAddress || !meteoraPool) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Не указаны обязательные параметры токена или пула.`);
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Токен: ${tokenAddress}, пул: ${meteoraPool}`);
                return null;
            }

            // Генерируем уникальный ID для процесса
            const processId = `mev_${tokenAddress.substring(0, 4)}_${meteoraPool.substring(0, 4)}_${config.jito_lower_bound}`; // TODO: возможно по другому id задать

            // Формируем конфигурацию процесса
            const processConfig = {
                ...config,
                module_name: "mev_subtask",
                tokenAddress,
                meteoraPool,
                pumpSwapPool,
                task_name: config.task_name || `MEV Process ${processId}`,
            };

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Запуск MEV процесса с конфигурацией:`, JSON.stringify(processConfig));

            // Отправка процесса на запуск - передаем userSettings
            const childProcess = await spawnProcess(processConfig, this.userSettings);

            if (!childProcess) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Не удалось создать дочерний процесс для ${processId}`);
                return null;
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Успешно запущен MEV процесс ${processId}`);

            // Добавляем обработчики для логирования вывода процесса (ПОТОМ УБРАТЬ консольный вывод)
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `(ПОТОМ УБРАТЬ) Настраиваем перехват вывода для процесса ${processId}`);

            // Обработка стандартного вывода (stdout)
            childProcess.stdout.on("data", (data) => {
                const output = data.toString().trim();
                if (output) {
                    // // Временно выводим в консоль для отладки (ПОТОМ УБРАТЬ)
                    // console.log(`[MEV LoadBalancer] (ПОТОМ УБРАТЬ) MEV ПРОЦЕСС ${processId} (PID: ${childProcess.pid}) STDOUT: ${output}`);

                    // Записываем лог в файл
                    this.writeProcessLog(processId, output, 'info');
                }
            });

            // Обработка ошибок (stderr)
            childProcess.stderr.on("data", (data) => {
                const output = data.toString().trim();
                if (output) {
                    // // Временно выводим в консоль для отладки (ПОТОМ УБРАТЬ)
                    // console.error(`[MEV LoadBalancer] (ПОТОМ УБРАТЬ) MEV ПРОЦЕСС ${processId} (PID: ${childProcess.pid}) STDERR: ${output}`);

                    // Записываем лог в файл
                    this.writeProcessLog(processId, output, 'error');
                }
            });

            // Добавляем обработчик завершения процесса
            childProcess.on("exit", (code) => {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `(ПОТОМ УБРАТЬ) MEV ПРОЦЕСС ${processId} (PID: ${childProcess.pid}) завершился с кодом ${code}`);

                // Записываем информацию о завершении в лог
                this.writeProcessLog(processId, `Процесс завершен с кодом ${code}`, code === 0 ? 'info' : 'error');

                // Обновляем статус процесса
                this.handleProcessExit(processId, code);
            });

            // Определяем время создания
            const currentTime = Date.now();
            // Если это перезапуск - используем оригинальное время создания, иначе - текущее
            const initialCreationTime = options.isRestart ? options.initialCreationTime : currentTime;

            // Сохраняем информацию о процессе
            this.mevProcesses.set(processId, {
                pid: childProcess.pid,
                tokenAddress,
                meteoraPool,
                pumpSwapPool,
                process: childProcess,
                startTime: currentTime,
                initialCreationTime: initialCreationTime, // Сохраняем оригинальное время создания
                status: 'running',
                lastActivity: currentTime,
                signals: [],
                config: processConfig,
            });

            // Создаем числовой ID для React UI
            const numericTaskId = Date.now() + Math.floor(Math.random() * 1000);

            this.stats.totalProcesses++;

            return processId;
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при запуске MEV процесса:', error, error.stack);
            return null;
        }
    }

    async checkLiquidity(pair) {

        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`);
                const data = await response.json();
                const pairData = data.pair;
                const liquidity = pairData.liquidity.usd;
                return liquidity >= this.settings.minimumLiquidity;
            } catch (e) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Error while checkLiquidity: ${e}`);
                await sleep(1500);

            }
        }
        return false;


    }

    /**
     * Останавливает MEV процесс
     * @param {string} processId - Идентификатор процесса
     * @param {boolean} restart - Идентификатор процесса
     * @returns {Promise<Object>} - Результат остановки процесса
     */
    async stopProcess(processId, restart = false) {
        try {
            if (!this.mevProcesses.has(processId)) {
                console.warn(`[MEV LoadBalancer] Процесс ${processId} не найден`);
                return {
                    success: false,
                    error: 'Процесс не найден'
                };
            }

            const processData = this.mevProcesses.get(processId);

            console.log(`[MEV LoadBalancer] Остановка MEV процесса ${processId}`);

            // Очищаем таймер процесса, если он существует
            if (processData.processTimer) {
                clearInterval(processData.processTimer);
                console.log(`[MEV LoadBalancer] Таймер для процесса ${processId} очищен`);
            }

            // Перед остановкой удаляем все слушатели событий
            if (processData.process) {
                try {
                    // Удаляем слушатели stdout
                    if (processData.process.stdout) {
                        processData.process.stdout.removeAllListeners('data');
                    }

                    // Удаляем слушатели stderr
                    if (processData.process.stderr) {
                        processData.process.stderr.removeAllListeners('data');
                    }

                    // Удаляем слушатели exit
                    processData.process.removeAllListeners('exit');
                } catch (listenerError) {
                    console.error(`[MEV LoadBalancer] Ошибка при удалении слушателей для процесса ${processId}:`, listenerError);
                }
            }

            let success = false;
            console.log(`[MEV LoadBalancer] Принудительное завершение процесса ${processId} с PID ${processData.process.pid} через forceKillWindowsProcess`);
            success = await forceKillWindowsProcess(processData.process.pid);
            // if (processData.process && processData.process.pid) {
            //     console.log(`[MEV LoadBalancer] Принудительное завершение процесса ${processId} с PID ${processData.process.pid} через forceKillWindowsProcess`);
            //     success = await forceKillWindowsProcess(processData.process.pid);
            // } else {
            //     console.log(`[MEV LoadBalancer] Процесс ${processId} не имеет допустимого PID, пропускаем forceKillWindowsProcess`);
            //     success = true; // Считаем успешным, если процесса уже нет
            // }

            // Обрабатываем результат остановки
            if (!success) {
                console.error(`[MEV LoadBalancer] Не удалось завершить процесс ${processId}`);
                return {
                    success: false,
                    error: "Не удалось завершить процесс",
                    processId
                };
            }
            try {
                console.log(JSON.stringify(processData, null, 2));
            }catch (e){
                console.log(e)
            }
            console.log(processData);

            // Если процесс успешно остановлен, удаляем его из списка процессов
            this.mevProcesses.delete(processId);

            console.log(`[MEV LoadBalancer] Процесс ${processId} успешно остановлен и удален из списка`);
            if (restart) {
                await this.restartProcesses();
            }

            return {
                success: true,
                processId,
                message: 'Процесс успешно остановлен'
            };
        } catch (error) {
            console.error(`[MEV LoadBalancer] Ошибка при остановке MEV процесса ${processId}:`, error);
            return {
                success: false,
                error: error.message,
                processId
            };
        }
    }

    /**
     * Обрабатывает завершение MEV процесса
     * @param {string} processId - Идентификатор процесса
     * @param {number} code - Код завершения процесса
     */
    handleProcessExit(processId, code) {
        if (!this.mevProcesses.has(processId)) return;

        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `MEV процесс ${processId} завершился с кодом ${code}`);

        const processData = this.mevProcesses.get(processId);

        // Удаляем все слушатели событий
        if (processData.process) {
            try {
                // Удаляем слушатели stdout
                if (processData.process.stdout) {
                    processData.process.stdout.removeAllListeners('data');
                }

                // Удаляем слушатели stderr
                if (processData.process.stderr) {
                    processData.process.stderr.removeAllListeners('data');
                }

                // Удаляем слушатели exit
                processData.process.removeAllListeners('exit');

                logger.success(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Все слушатели событий удалены для процесса ${processId} после завершения`);
            } catch (listenerError) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ошибка при удалении слушателей для процесса ${processId}:`, listenerError);
            }
        }

        // Обновляем статус процесса
        processData.status = 'stopped';
        processData.exitCode = code;
        processData.exitTime = Date.now();

        // Удаляем процесс из карты MEV процессов сразу
        this.mevProcesses.delete(processId);
        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Информация о MEV процессе ${processId} удалена`);
    }

    /**
     * Записывает логи процесса в файл
     * @param {string} processId - Идентификатор процесса
     * @param {string} message - Сообщение для записи
     * @param {string} level - Уровень логирования (info, error, warning)
     */
    writeProcessLog(processId, message, level = 'info') {
        try {
            // Записываем в файл только ошибки (сообщения, начинающиеся с "Error")
            if (level !== 'error' && !message.trim().startsWith('Error')) {
                return; // Не записываем не-ошибки
            }

            // Создаем директорию для логов, если она еще не существует
            const logDir = path.join(app.getPath('userData'), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Формируем путь к файлу логов для указанного процесса
            const logFilePath = path.join(logDir, `mev_${processId}.log`);

            // Получаем текущую временную метку
            const timestamp = new Date().toISOString();

            // Форматируем запись лога
            const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

            // Асинхронно добавляем запись в файл
            fs.appendFileSync(logFilePath, logEntry);

            // console.log(`[MEV LoadBalancer] Записана ошибка в лог ${processId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ошибка при записи лога для процесса ${processId}:`, error);
        }
    }

    /**
     * Получает последние N строк логов процесса
     * @param {string} processId - Идентификатор процесса
     * @param {number} lineCount - Количество строк для получения
     * @returns {Promise<string[]>} - Массив строк логов
     */
    async getProcessLogs(processId, lineCount = 100) {
        try {
            const logDir = path.join(app.getPath('userData'), 'logs');
            const logFilePath = path.join(logDir, `mev_${processId}.log`);

            // Проверяем, существует ли файл логов
            if (!fs.existsSync(logFilePath)) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Файл логов не найден для процесса ${processId}: ${logFilePath}`);
                return [];
            }

            // Читаем содержимое файла
            const content = fs.readFileSync(logFilePath, 'utf8');

            // Разбиваем на строки и фильтруем пустые
            const lines = content.split('\n').filter(line => line.trim());

            // Возвращаем последние N строк
            return lines.slice(-lineCount);
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ошибка при получении логов процесса ${processId}:`, error);
            return [];
        }
    }

    /**
     * Инициализирует обработчики IPC событий
     */
    initIpcHandlers() {
        // Обработчик для логов процессов
        ipcMain.on('process-log', async (event, data) => {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `FROM IPC HANDLER`);
            this.handleProcessLog(data);
        });

        // Обработчики для управления балансировщиком
        ipcMain.handle('mev-loadbalancer:start', async () => {
            return this.start();
        });

        ipcMain.handle('mev-loadbalancer:stop', async () => {
            return this.stop();
        });

        ipcMain.handle('mev-loadbalancer:status', async () => {
            return this.getStatus();
        });

        ipcMain.handle('mev-loadbalancer:processes', async () => {
            return this.getProcesses();
        });

        ipcMain.handle('mev-loadbalancer:stop-process', async (event, processId) => {
            return this.stopProcess(processId);
        });

        ipcMain.handle('mev-loadbalancer:update-settings', async (event, settings) => {
            return this.updateSettings(settings);
        });

        // Добавляем обработчик события завершения процесса
        ipcMain.on('mev-process-exit', (event, { processId, exitCode, config }) => {
            this.handleProcessExit(processId, exitCode);
        });

        // Тестовый обработчик для проверки обработки сигналов
        ipcMain.handle('mev-loadbalancer:test-signal', async (event, testSignal) => {
            return this.testProcessSignal(testSignal);
        });

        // Новый обработчик для ручного запуска обработки буфера сигналов
        ipcMain.handle('mev-loadbalancer:process-buffer', async () => {
            if (!this.isActive) {
                return { success: false, message: 'Балансировщик неактивен' };
            }

            if (this.signalBuffer.length === 0) {
                return { success: true, message: 'Буфер сигналов пуст' };
            }

            await this.processSignalBuffer();
            return { success: true, message: 'Запущена обработка буфера сигналов' };
        });
    }

    /**
     * Обрабатывает логи процессов, ищет MEV сигналы
     * @param {Object} logData - Данные лога (processId, message, level)
     */
    handleProcessLog(logData) {
        try {
            if (!this.isActive) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Балансировщик неактивен, пропускаем лог');
                return;
            }

            const { processId, message, level, config } = logData;
            if (!processId || !message) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Получен некорректный лог без processId или message');
                return;
            }

            // Проверяем, принадлежит ли лог модулю MEV Module и стратегии check_migration
            if (config && (config.module_name !== 'MEV Module' || config.globalStrategy !== 'check_migration')) {
                // Лог от другого модуля или стратегии, игнорируем
                return;
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `ПОЛУЧЕН ЛОГ от ${processId}: ${message.substring(0, 100)}...`);

            // Пропускаем логи от MEV процессов, чтобы избежать бесконечного цикла
            if (this.mevProcesses.has(processId)) {
                // Обновляем время последней активности процесса
                const processData = this.mevProcesses.get(processId);
                if (processData) {
                    processData.lastActivity = Date.now();
                }
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Это лог от MEV процесса ${processId}, пропускаем`);
                return;
            }

            // Автоматически регистрируем процессы, которые отправляют логи, как процессы токен-релиза,
            // если сообщение содержит 'new-token-release' или другие ключевые слова
            if (message.includes('new-token-release') || message.includes('token-release') ||
                message.includes('token detection') || message.includes('[TOKEN]')) {
                this.registerTokenReleaseProcess(processId);
            }

            // Обновляем время последней активности процесса токен-релиза
            if (this.isTokenReleaseProcess(processId)) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Лог от процесса токен-релиза ${processId}: ${message.substring(0, 100)}...`);
            }

            // Проверяем наличие MEV сигнала в логе
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Проверяем наличие MEV сигнала в логе: ${message.substring(0, 100)}...`);
            const signalData = this.parseLogForMevSignal(message);
            if (signalData) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Обнаружен MEV сигнал в логе процесса ${processId}, данные:`, JSON.stringify(signalData));

                // Вместо непосредственной обработки, добавляем сигнал в буфер
                this.addSignalToBuffer(signalData, processId);
            } else {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `MEV сигнал НЕ обнаружен в логе`);
            }
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке лога процесса:', error);
        }
    }

    /**
     * Анализирует лог на наличие MEV сигнала
     * @param {string} logMessage - Сообщение лога
     * @returns {Object|null} - Объект с данными о сигнале или null, если сигнал не обнаружен
     */
    parseLogForMevSignal(logMessage) {
        try {
            // Проверяем, содержит ли сообщение MEV сигнал
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Проверка на наличие '[PERFORM_MEV_ACTION]' в логе`);

            // Исследуем, какие строки вообще приходят
            if (logMessage.includes('[')) {
                const matches = logMessage.match(/\[(.*?)\]/g);
                if (matches && matches.length > 0) {
                    logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Найдены квадратные скобки в логе: ${JSON.stringify(matches)}`);
                }
            }

            if (!logMessage.includes('[PERFORM_MEV_ACTION]')) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Маркер '[PERFORM_MEV_ACTION]' не найден в логе`);
                return null;
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Обнаружен возможный MEV сигнал: ${logMessage}`);

            // Извлекаем данные из сигнала
            return this.extractSignalDataFromText(logMessage);
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при парсинге лога:', error);
            return null;
        }
    }

    /**
     * Извлекает данные о токене и пуле из текста сигнала
     * @param {string} logMessage - Сообщение с сигналом
     * @returns {Object|null} - Объект с данными сигнала или null при ошибке парсинга
     */
    extractSignalDataFromText(logMessage) {
        try {
            // Находим содержимое между [PERFORM_MEV_ACTION] и [END]
            const startMarker = '[PERFORM_MEV_ACTION]';
            const endMarker = '[END]';

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ищем маркеры в сообщении, длина: ${logMessage.length}`);
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Полный текст сообщения: ${logMessage}`);

            // Проверяем наличие маркеров в любом порядке и положении
            let startIndex = logMessage.indexOf(startMarker);
            let endIndex = logMessage.indexOf(endMarker, startIndex);

            // Если маркеры не найдены, пробуем искать без учёта регистра
            if (startIndex === -1) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Маркер PERFORM_MEV_ACTION не найден, пробуем искать без учёта регистра');
                startIndex = logMessage.toLowerCase().indexOf(startMarker.toLowerCase());
            }

            if (endIndex === -1) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Маркер END не найден, ищем до конца сообщения');
                endIndex = logMessage.length;
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Индексы маркеров: startIndex=${startIndex}, endIndex=${endIndex}`);

            if (startIndex === -1) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Не найден маркер начала сигнала в сообщении');
                return null;
            }

            // Извлекаем содержимое и удаляем лишние пробелы
            const content = logMessage
                .substring(startIndex + startMarker.length, endIndex)
                .trim();

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Извлечено содержимое: "${content}"`);

            // Разделяем по символу |
            const parts = content.split('|').map(s => s.trim());
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Разделено по |: ${JSON.stringify(parts)}`);

            // Проверяем количество частей
            if (parts.length < 2) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Недостаточно параметров в сигнале, ожидается как минимум 2 (токен и пул)');
                return null;
            }

            // Извлекаем основные параметры
            const tokenAddress = parts[0];
            const meteoraPool = parts[1];

            // Извлекаем опциональный третий параметр (пул pumpSwap), если он есть
            const pumpSwapPool = parts.length > 2 ? parts[2] : null;

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `После обработки: tokenAddress="${tokenAddress}", meteoraPool="${meteoraPool}", pumpSwapPool="${pumpSwapPool || 'не указан'}"`);

            if (!tokenAddress || !meteoraPool) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Не удалось извлечь токен или пул:', { tokenAddress, meteoraPool });
                return null;
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Успешно извлечены данные: Токен=${tokenAddress}, Пул=${meteoraPool}, PumpSwap=${pumpSwapPool || 'не указан'}`);

            return {
                tokenAddress,
                meteoraPool,
                pumpSwapPool,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при извлечении данных из сигнала:', error, error.stack);
            return null;
        }
    }

    /**
     * Рассчитывает задержку для процессов на основе их количества
     * @param {number} processCount - Количество процессов
     * @returns {number} - Задержка в миллисекундах
     */
    calculateProcessDelay(processCount) {
        // Проверяем входные данные
        if (!processCount || processCount <= 0) {
            processCount = 1;
        }

        // Общая нагрузка - 170 запросов в секунду
        const TOTAL_REQUESTS_PER_SECOND = Number(this.userSettings.requests_per_second);

        // Расчет запросов в секунду на процесс
        const requestsPerProcess = TOTAL_REQUESTS_PER_SECOND / processCount;

        // Расчет задержки по формуле: Math.ceil(1000 / requestsPerProcess) + 1
        let delay = Math.ceil(1000 / requestsPerProcess) + 1;

        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Расчет задержки: ${TOTAL_REQUESTS_PER_SECOND} req/s / ${processCount} процессов = ${requestsPerProcess} req/s на процесс`);
        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Итоговая задержка: ${delay}ms`);
        return delay;
    }

    /**
     * Обрабатывает MEV сигналы
     * @param {Array} signals - Массив сигналов для обработки
     * @returns {Promise<Object>} - Результат обработки сигналов
     */
    async handleMevSignal(signals) {
        try {
            // Проверяем, идет ли очистка процессов
            if (this.isCleaningProcesses) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Нельзя обработать сигналы: идет очистка процессов`);
                // Возвращаем сигналы обратно в буфер
                this.signalBuffer.push(...signals);
                return {
                    success: false,
                    error: 'Операция отложена, идёт очистка процессов с низкой ликвидностью'
                };
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `=====================================================`);
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `НАЧАЛО ОБРАБОТКИ ${signals.length} MEV сигналов`);
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `=====================================================`);

            // Увеличиваем счетчик обработанных сигналов
            this.stats.processedSignals += signals.length;

            // Шаг 1: Проверяем все сигналы на валидность
            const validSignals = signals.filter(signal => {
                const { tokenAddress, meteoraPool } = signal;
                if (!tokenAddress || !meteoraPool) {
                    logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Сигнал не содержит необходимых данных (tokenAddress или meteoraPool)`);
                    this.stats.failedSignals++;
                    return false;
                }
                return true;
            });

            if (validSignals.length === 0) {
                throw new Error('Нет валидных сигналов для обработки');
            }

            const jitoValues = [
                {
                    jito_lower_bound: 10_000,
                    jito_upper_bound: 1_000_000,
                }
            ]

            // Шаг 2: Сохраняем текущие процессы для последующего перезапуска
            const currentProcesses = Array.from(this.mevProcesses.entries());
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Текущее количество процессов: ${currentProcesses.length}`);

            // Шаг 3: Рассчитываем новую задержку для всех процессов (текущие + новые)
            const newProcessCount = currentProcesses.length + validSignals.length * jitoValues.length;
            const processDelay = this.calculateProcessDelay(newProcessCount);
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Рассчитана новая задержка ${processDelay}ms для ${newProcessCount} процессов`);

            // Шаг 4: Сохраняем конфигурации текущих процессов с временем их создания
            const processConfigs = [];
            for (const [processId, processData] of currentProcesses) {
                // Сохраняем конфигурацию процесса с обновленной задержкой
                const config = { ...processData.config, process_delay: processDelay };
                // Сохраняем также время первоначального создания процесса
                const initialCreationTime = processData.initialCreationTime || processData.startTime;

                processConfigs.push({
                    processId,
                    config,
                    initialCreationTime
                });

                // Останавливаем текущий процесс
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Останавливаем процесс ${processId} для перезапуска с новой задержкой`);
                await this.stopProcess(processId);
            }

            let newProcessConfigs = [];

            for (const signal of validSignals) {
                const { tokenAddress, meteoraPool, pumpSwapPool } = signal;
                for (let i = 0; i < jitoValues.length; i++) {
                    newProcessConfigs.push({
                        tokenAddress,
                        meteoraPool,
                        pumpSwapPool,
                        main_rpc: this.userSettings?.mainRpc || "https://api.mainnet-beta.solana.com",
                        useJito: true,
                        jito_lower_bound: jitoValues[i].jito_lower_bound,
                        jito_upper_bound: jitoValues[i].jito_upper_bound,
                        process_delay: processDelay,
                        task_name: `mev_task_${Date.now().toString().substring(8, 13)}`
                    })
                }
            }

            // Шаг 7: Перезапускаем все сохраненные процессы с новой задержкой
            const restartedProcesses = [];
            for (const { config, initialCreationTime } of processConfigs) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Перезапуск процесса с обновленной задержкой ${processDelay}ms, сохраняем время создания: ${new Date(initialCreationTime).toISOString()}`);
                // Передаем флаг, что это перезапуск и оригинальное время создания
                const restartedProcessId = await this.startMevProcess(config, {
                    isRestart: true,
                    initialCreationTime: initialCreationTime
                });
                if (restartedProcessId) {
                    restartedProcesses.push(restartedProcessId);
                }
                // await sleep(1000);
            }

            // Шаг 6: Запускаем все новые процессы
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Запуск ${newProcessConfigs.length} новых MEV процессов`);
            const newProcesses = [];
            for (const config of newProcessConfigs) {
                // Для новых процессов не передаем флаг перезапуска
                const processId = await this.startMevProcess(config);
                if (processId) {
                    newProcesses.push(processId);
                }
                await sleep(1000);
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Перезапущено ${restartedProcesses.length} из ${processConfigs.length} процессов`);

            // Статистика и уведомления
            this.stats.totalMevActions += validSignals.length;
            this.stats.successfulSignals += validSignals.length;

            if (this.settings.notifyTelegram) {
                // Информация о процессах
                let processesInfo = `Новые процессы: ${newProcesses.join(', ')}\n`;

                if (restartedProcesses.length > 0) {
                    processesInfo += `Перезапущенные процессы: ${restartedProcesses.join(', ')}\n`;
                }

                processesInfo += `Всего процессов: ${newProcessCount}\n`;
                processesInfo += `Задержка: ${processDelay}ms\n`;

                const message = `🚀 Обработано ${validSignals.length} MEV сигналов:\n` +
                    `\n⚖️ Параметры:\n` +
                    `Задержка: ${processDelay}ms\n` +
                    `\n📊 Процессы:\n${processesInfo}`;

                telegramBotService.sendSystemNotification(message);
            }

            return {
                success: true,
                newProcesses,
                restartedProcesses,
                processDelay,
                totalProcesses: newProcessCount
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке MEV сигналов:', error);
            this.stats.failedSignals += signals.length;

            // Отправляем уведомление об ошибке в Telegram
            if (this.settings?.notifyTelegram) {
                const errorMessage = `❌ Ошибка обработки ${signals.length} MEV сигналов:\n` +
                    `Ошибка: ${error.message}`;

                telegramBotService.sendSystemNotification(errorMessage);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    async restartProcesses() {
        try {
            const currentProcesses = Array.from(this.mevProcesses.entries());

            const newProcessCount = currentProcesses.length;
            const processDelay = this.calculateProcessDelay(newProcessCount);
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Рассчитана новая задержка ${processDelay}ms для ${newProcessCount} процессов`);

            const processConfigs = [];
            for (const [processId, processData] of currentProcesses) {
                // Сохраняем конфигурацию процесса с обновленной задержкой
                const config = { ...processData.config, process_delay: processDelay };
                // Сохраняем также время первоначального создания процесса
                const initialCreationTime = processData.initialCreationTime || processData.startTime;

                processConfigs.push({
                    processId,
                    config,
                    initialCreationTime
                });

                // Останавливаем текущий процесс
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Останавливаем процесс ${processId} для перезапуска с новой задержкой`);
                await this.stopProcess(processId);
            }

            const restartedProcesses = [];
            for (const { config, initialCreationTime } of processConfigs) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Перезапуск процесса с обновленной задержкой ${processDelay}ms, сохраняем время создания: ${new Date(initialCreationTime).toISOString()}`);
                const restartedProcessId = await this.startMevProcess(config, {
                    isRestart: true,
                    initialCreationTime: initialCreationTime
                });
                if (restartedProcessId) {
                    restartedProcesses.push(restartedProcessId);
                }
                // await sleep(1000);
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Перезапущено ${restartedProcesses.length} из ${processConfigs.length} процессов`);


            if (this.settings.notifyTelegram) {
                // Информация о процессах
                let processesInfo = "";

                if (restartedProcesses.length > 0) {
                    processesInfo += `Перезапущенные процессы: ${restartedProcesses.join(', ')}\n`;
                }
                processesInfo += `Задержка: ${processDelay}ms\n`;

                const message = `🔄 Перезапуск MEV процессов:\n` +
                    `\n⚖️ Параметры:\n` +
                    `Задержка: ${processDelay}ms\n` +
                    `\n📊 Процессы:\n${processesInfo}`;

                telegramBotService.sendSystemNotification(message);
                return {
                    success: true,
                    restartedProcesses,
                    processDelay,
                };
            }
        } catch (e) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Error while restring: ${e}`);
            return {
                success: false,
                error: e.message
            };
        }


    }

    /**
     * Проверяет ликвидность пулов всех процессов и удаляет процессы с низкой ликвидностью
     */
    async checkAndCleanProcessesByLiquidity() {
        // Проверяем, что очистка уже не запущена и не идёт обработка сигналов
        if (this.isCleaningProcesses || this.processingSignals) {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Пропуск проверки ликвидности: уже выполняется другая операция с процессами');
            return;
        }

        if (!this.isActive || this.mevProcesses.size === 0) {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Пропуск проверки ликвидности: балансировщик неактивен или нет процессов');
            return;
        }

        try {
            // Устанавливаем блокировку на время операции
            this.isCleaningProcesses = true;

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Начало проверки ликвидности пулов для ${this.mevProcesses.size} процессов`);

            // Текущее время для проверки возраста процессов
            const currentTime = Date.now();

            // Собираем процессы, которые нужно остановить
            const processesToStop = [];

            // Проходим по всем процессам и проверяем ликвидность их пулов
            for (const [processId, processData] of this.mevProcesses.entries()) {
                try {
                    const meteoraPool = processData.meteoraPool || processData.config?.meteoraPool;

                    if (!meteoraPool) {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Пропуск проверки для процесса ${processId}: пул не найден`);
                        continue;
                    }

                    // Проверяем возраст процесса
                    const processAge = currentTime - (processData.initialCreationTime || processData.startTime);
                    if (processAge < this.settings.minProcessAgeForCleanup) {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Пропуск проверки для молодого процесса ${processId}: возраст ${Math.floor(processAge / 1000 / 60)} минут < ${Math.floor(this.settings.minProcessAgeForCleanup / 1000 / 60)} минут`);
                        continue;
                    }

                    logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Проверка ликвидности пула ${meteoraPool} для процесса ${processId} (возраст: ${Math.floor(processAge / 1000 / 60)} минут)`);

                    // Проверяем ликвидность пула
                    const hasEnoughLiquidity = await this.checkLiquidity(meteoraPool);

                    // Если ликвидность ниже порогового значения, добавляем процесс в список на остановку
                    if (!hasEnoughLiquidity) {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Процесс ${processId} будет остановлен: ликвидность пула ${meteoraPool} ниже ${this.settings.minimumLiquidity} USD`);
                        processesToStop.push(processId);
                    } else {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Процесс ${processId} продолжит работу: ликвидность пула достаточна`);
                    }
                } catch (error) {
                    logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ошибка при проверке ликвидности для процесса ${processId}:`, error);
                }
            }

            // Если есть процессы для остановки, останавливаем их
            if (processesToStop.length > 0) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Найдено ${processesToStop.length} процессов с низкой ликвидностью для остановки`);

                // Уведомляем в Telegram о начале очистки
                if (this.settings.notifyTelegram) {
                    telegramBotService.sendSystemNotification(
                        `🧹 Начало очистки ${processesToStop.length} MEV процессов с низкой ликвидностью`
                    );
                }

                // Останавливаем все процессы, кроме последнего
                for (let i = 0; i < processesToStop.length - 1; i++) {
                    await this.stopProcess(processesToStop[i], false);
                }

                // Останавливаем последний процесс с флагом restart=true
                if (processesToStop.length > 0) {
                    const lastProcessId = processesToStop[processesToStop.length - 1];
                    await this.stopProcess(lastProcessId, true);

                    // Уведомляем об окончании процесса очистки
                    if (this.settings.notifyTelegram) {
                        telegramBotService.sendSystemNotification(
                            `✅ Завершена очистка ${processesToStop.length} MEV процессов с низкой ликвидностью.\nЗапущен перерасчет и перезапуск оставшихся процессов.`
                        );
                    }
                }
            } else {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Процессы с низкой ликвидностью не найдены');
            }
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при проверке и очистке процессов с низкой ликвидностью:', error);
        } finally {
            // Снимаем блокировку в любом случае, даже при ошибке
            this.isCleaningProcesses = false;
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Завершена проверка ликвидности пулов');
        }
    }

    /**
     * Отправляет задачу в обработчик
     * @param {Object} taskConfig - Конфигурация задачи
     * @returns {Promise<boolean>} - Успешность отправки
     */
    async sendTaskToHandler(taskConfig) {
        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Отправка задачи в обработчик:', taskConfig);
        // Реализация опущена для примера
        return true;
    }

    /**
     * Получает информацию о всех процессах токен-релиза
     * @returns {Array} - Массив ID процессов токен-релиза
     */
    getTokenReleaseProcesses() {
        return Array.from(this.tokenReleaseProcesses.keys());
    }

    /**
     * Обрабатывает MEV сигнал из внешнего источника
     * @param {Object} signal - Данные сигнала (tokenAddress, meteoraPool, pumpSwapPool)
     * @param {string} sourceId - ID источника сигнала (например, 'telegram')
     * @returns {Object} - Результат добавления сигнала в буфер
     */
    handleExternalMevSignal(signal, sourceId = 'external') {
        try {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Получен внешний MEV сигнал от ${sourceId}: ${JSON.stringify(signal)}`);

            // Проверяем наличие обязательных полей
            if (!signal.tokenAddress || !signal.meteoraPool) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Некорректный формат внешнего сигнала: ${JSON.stringify(signal)}`);
                return {
                    success: false,
                    error: 'Недостаточно данных в сигнале (требуется tokenAddress и meteoraPool)'
                };
            }

            // Получаем ID процесса токен-релиза для использования в качестве источника
            const tokenReleaseProcesses = this.getTokenReleaseProcesses();
            console.log(tokenReleaseProcesses);
            console.log(JSON.stringify(tokenReleaseProcesses, null ,2));
            let processId;

            if (tokenReleaseProcesses.length > 0) {
                // Берем первый процесс из списка, если они есть
                processId = tokenReleaseProcesses[0];
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Используем процесс токен-релиза ${processId} в качестве источника сигнала`);
            } else {
                // Если процессов нет, используем переданный sourceId
                processId = `external_${sourceId}`;
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Активные процессы токен-релиза не найдены, используем ${processId}`);
            }

            // Добавляем сигнал в буфер, используя ID процесса токен-релиза
            return this.addSignalToBuffer(signal, processId);
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке внешнего MEV сигнала:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Создаем и экспортируем экземпляр MEV LoadBalancer
const mevLoadBalancer = new MevLoadBalancer();
module.exports = mevLoadBalancer;