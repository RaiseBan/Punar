/**
 * MEV LoadBalancer - Модуль балансировки нагрузки MEV процессов
 *
 * Отвечает за обнаружение сигналов MEV в логах процессов new-token-release,
 * запуск MEV процессов и распределение нагрузки между ними.
 */
import {app, ipcMain} from 'electron';
import path from 'path';
import {forceKillWindowsProcess, spawnProcess} from '../../utils/spawnProcess';
import {getSettings} from '../../utils/fsHelper';
import telegramBotService from '../telegramBotService';
import fs from 'fs';
import bs58 from "bs58";
import {createTokenAccount, getDetailedTokenAccounts, sleep} from '../../utils/solanaUtils';
import {Keypair} from "@solana/web3.js";
import logger from '../loggerService';
import axios from "axios";
import {
    AppSettings,
    CheckResult,
    MevProcess,
    PairInfo,
    Pools,
    ProcessConfig,
    ProcessesToManage,
    RAYDIUM_TYPE,
    Signal,
    SignalWithMeta,
    UsageMeteoraPools
} from "../../types/types";
import {formatUsage, structConfig} from "./meteoraPoolsService";


export class MevLoadBalancer {
    private mevProcesses: Map<string, MevProcess>;
    private meteoraPoolsByToken: Map<string, string[]>;
    private tokenReleaseProcesses: Map<string, boolean>;
    private userTokens: Map<string, string>;
    private USER: Keypair;
    private isActive: boolean;
    signalBuffer: SignalWithMeta[];
    processingSignals: boolean;
    processingTimer: any;
    liquidityCheckerTimer: any
    isCleaningProcesses: boolean;
    stats: any;
    settings: any;
    userSettings: AppSettings | null;
    private meteoraPoolsUsage: Map<string, UsageMeteoraPools> = new Map<string, UsageMeteoraPools>();
    private readonly DELAY_PERFORMANCE = {
        0: 670, // 0ms: 670 req/s
        1: 370, // 1ms: 370 req/s
        2: 263, // 2ms: 263 req/s
        3: 180, // 3ms: 180 req/s
        4: 160, // 4ms: 160 req/s
        5: 140  // Примерная оценка для 5ms
    };
    constructor() {
        // Карта для отслеживания MEV процессов
        // key = processId, value = { process, config, startTime, lastActivity, signals: [], status }
        this.mevProcesses = new Map();
        this.meteoraPoolsByToken = new Map();

        // Карта для отслеживания процессов токен-релиза
        // key = processId, value = true
        this.tokenReleaseProcesses = new Map();

        this.userTokens = new Map();

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
            notifyTelegram: true,        // Отправлять уведомления в Telegram
            processingInterval: 10000,    // Интервал обработки буфера сигналов (5 секунд)
            liquidityCheckInterval: 4 * 60 * 1000, // Интервал проверки ликвидности (20 минут)
            minimumLiquidity: 170,       // Минимальная ликвидность пула (USD)
            minProcessAgeForCleanup: 20 * 60 * 1000  // Минимальный возраст процесса для проверки очистки (20 минут)
        };

        // Настройки пользователя
        this.userSettings = null;

        // Инициализация
        this.init();
    }

    getMeteoraUsagePoolsByToken(token: string): UsageMeteoraPools | undefined {
        console.log(this.meteoraPoolsUsage);
        return this.meteoraPoolsUsage.get(token);
    }

    setMeteoraUsagePoolsByToken(token: string, usage: UsageMeteoraPools): void {
        this.meteoraPoolsUsage.set(token, usage);
    }

    async deleteMeteoraPoolFromProcess(processId: string, meteoraPool: string): Promise<boolean> {
        const mevProcess = this.mevProcesses.get(processId);
        if (!mevProcess) {
            return false;
        }
        // this.mevProcesses.delete()

        await this.stopProcess(processId);
        let meteoraPools = mevProcess.meteoraPools.filter(pool => pool !== meteoraPool);
        const processConfig: ProcessConfig = {
            tokenAddress: mevProcess.tokenAddress,
            meteoraPools: meteoraPools,
            pumpSwapPool: mevProcess.pumpSwapPool,
            type: mevProcess.config.type,
            raydiumPool: mevProcess.config.raydiumPool,
            main_rpc: mevProcess.config.main_rpc,
            useJito: mevProcess.config.useJito,
            jito_lower_bound: mevProcess.config.jito_lower_bound,
            jito_upper_bound: mevProcess.config.jito_upper_bound,
            process_delay: mevProcess.config.process_delay,
            task_name: mevProcess.config.task_name
        }
        await this.startMevProcess(processConfig, {
            isRestart: false,
            initialCreationTime: mevProcess.initialCreationTime
        })
        return true;

    }


    /**
     * Генерирует уникальный ID для процесса
     * @param token - Адрес токена
     * @param meteoraPools - Массив пулов Meteora
     * @param jito_lower_bound - Нижняя граница Jito
     * @param instanceNumber - Номер экземпляра процесса (для создания нескольких копий)
     * @returns Уникальный ID процесса
     */
    generateProcessId(token: string, meteoraPools: string[], jito_lower_bound: string, instanceNumber: number = 0): string {
        const tokenPart = token.substring(0, 4);

        // Обрабатываем пулы
        const meteoraPoolsPart = meteoraPools
            .map(pool => pool.substring(0, 4))
            .join('_');

        // Добавляем instanceNumber для разделения экземпляров одного процесса
        const instanceSuffix = instanceNumber > 0 ? `_inst${instanceNumber}` : '';

        return `mev_${tokenPart}_${meteoraPoolsPart}_${jito_lower_bound}${instanceSuffix}`;
    }


    /**
     * Инициализирует модуль MEV LoadBalancer
     */
    async init() {
        try {
            // Загружаем настройки пользователя
            this.userSettings = await getSettings();
            this.settings.minProcessAgeForCleanup = (Number(this.userSettings.min_process_age_for_cleanup) | 4) * 60 * 1000;
            this.settings.liquidityCheckInterval = (Number(this.userSettings.processes_check_interval) | 20) * 60 * 1000;
            // Инициализируем обработчики IPC
            this.initIpcHandlers();

            // Активируем балансировщик автоматически при запуске
            this.isActive = true;
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Балансировщик автоматически активирован при запуске');

            this.USER = Keypair.fromSecretKey(new Uint8Array(bs58.decode(this.userSettings!.migration_wallet!)));
            // кешируем токен аккаунты
            console.log(1)
            const tokenObjects = await getDetailedTokenAccounts(this.USER.publicKey.toBase58(), this.userSettings!.mainRpc!);
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
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при инициализации:', error.message);
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


    getConfigs(validSignals: SignalWithMeta[]): ProcessesToManage | undefined {

        const groupPoolsByToken: Map<string, Pools> = new Map<string, Pools>();
        let configsToAdd: ProcessConfig[] = [];
        let configsToDelete: string[] = [];
        for (const signal of validSignals) {
            if (groupPoolsByToken.has(signal.tokenAddress)) {
                const pools: Pools = groupPoolsByToken.get(signal.tokenAddress)!;
                pools.meteora.push(signal.meteoraPool)
            } else {
                groupPoolsByToken.set(signal.tokenAddress, {
                    meteora: [signal.meteoraPool],
                    pump: signal.pumpSwapPool,
                    raydium: signal.raydiumPool,
                    type: signal.type
                })
            }
        }
        for (const [token, pools] of groupPoolsByToken.entries()) {
            console.log(`token pools:`)
            console.log(token, pools)
            let meteoraUsageForToken: UsageMeteoraPools | undefined = this.getMeteoraUsagePoolsByToken(token);
            if (!meteoraUsageForToken) {
                this.setMeteoraUsagePoolsByToken(token, {
                    pairs: new Map<string, PairInfo>(),
                    hasFreeSingleSlot: false
                })
                meteoraUsageForToken = this.getMeteoraUsagePoolsByToken(token);
                if (!meteoraUsageForToken) {
                    return;
                }
            }

            // кол-во пулов токена для добавления
            let poolsDecrementable = [...pools.meteora];
            console.log("usage: ", formatUsage(meteoraUsageForToken));
            console.log(meteoraUsageForToken.pairs)

            let skipShift = false;
            let itemBuffer: string = "";
            console.log(`length: ${poolsDecrementable.length}`)
            while (poolsDecrementable.length !== 0) {
                console.log(1)
                let poolHasPlaced = false;
                let tookPool: string | undefined;
                if (!skipShift) {
                    console.log(2)
                    tookPool = poolsDecrementable.shift();
                } else {
                    console.log(3)
                    tookPool = itemBuffer;
                }

                if (!tookPool) {
                    logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `watafuk`);
                    return;
                }
                if (meteoraUsageForToken.pairs.size === 0) {


                    if (poolsDecrementable.length > 0) {
                        console.log(`BIG BOY 000`)
                        // не нужно добавлять, потому что еще есть элементы
                        // configsToAdd.push(structConfig(this, token, [...pairInfo.activePools, tookPool], pools.pump));
                        meteoraUsageForToken.pairs.set(
                            this.generateProcessId(
                                token,
                                [tookPool],
                                this.userSettings?.jito_lower_bound!),
                            {
                                activePools: [tookPool],
                                isNew: true
                            }
                        );
                        console.log(meteoraUsageForToken.pairs)
                        console.log(`-----------`)
                        poolHasPlaced = true;
                        skipShift = false;
                        continue
                    } else if (poolsDecrementable.length === 0) {
                        console.log(`MET 1: ${formatUsage(meteoraUsageForToken)}`);
                        this.setMeteoraUsagePoolsByToken(token, {
                            pairs: new Map<string, PairInfo>([
                                [this.generateProcessId(token, [tookPool], this.userSettings.jito_lower_bound), {
                                    activePools: [tookPool],
                                    isNew: false
                                }]
                            ]),
                            hasFreeSingleSlot: false
                        })
                        console.log(`MET 2: ${formatUsage(meteoraUsageForToken)}`);

                        configsToAdd.push(structConfig(this, token, [tookPool], pools.pump, pools.raydium, pools.type));
                        poolHasPlaced = true;
                        skipShift = false;
                        break;

                        // meteoraUsageForToken.pairs.set(
                        //     this.generateProcessId(
                        //         token,
                        //         [tookPool],
                        //         this.userSettings?.jito_lower_bound!),
                        //     {
                        //         activePools: [tookPool],
                        //         isNew: false
                        //     }
                        // );

                        // break;
                    }


                }

                for (const [processId, pairInfo] of meteoraUsageForToken.pairs.entries()) {
                    console.log(`entries: ${processId} ${pairInfo}`)
                    if (pairInfo.activePools.length === 1) { // пока что сделали, что максиамльное кол-во пулов метеоры в одном конфиге - 2
                        console.log(1)
                        pairInfo.activePools.push(tookPool);
                        if (!pairInfo.isNew) {
                            configsToDelete.push(processId);
                        }
                        console.log("BABY: ", pairInfo);
                        configsToAdd.push(structConfig(this, token, [...pairInfo.activePools], pools.pump, pools.raydium, pools.type));

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
                        console.log("salam")
                        if (poolsDecrementable.length > 0) {
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
                        } else if (poolsDecrementable.length === 0) {
                            console.log(`MET 1: ${formatUsage(meteoraUsageForToken)}`);

                            configsToAdd.push(structConfig(this, token, [tookPool], pools.pump, pools.raydium, pools.type));
                            meteoraUsageForToken.pairs.set(
                                this.generateProcessId(
                                    token,
                                    [tookPool],
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


                if (!poolHasPlaced) {
                    meteoraUsageForToken.pairs.set("stub", {
                        activePools: [],
                        isNew: true
                    })
                    skipShift = true
                    itemBuffer = tookPool;
                }

            }


        }
        console.log(JSON.stringify(this.meteoraPoolsUsage, null, 2));
        return {
            configsToAdd: configsToAdd,
            processIdsToDelete: configsToDelete
        }
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


    addSignalToBuffer(signal: Signal, sourceProcessId: string) {
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
        console.log("-------------------------BUFFER------------------------")
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
                return {success: true, status: 'already_running'};
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
                return {success: true, status: 'already_stopped'};
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


    getProcesses(): MevProcess[] {
        const processes: MevProcess[] = [];

        for (const [processId, processData] of this.mevProcesses.entries()) {
            processes.push({
                id: processId,
                pid: processData.process ? processData.process.pid : null,
                tokenAddress: processData.config ? processData.config.tokenAddress : 'unknown',
                meteoraPools: processData.config ? processData.config.meteoraPools : null,
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
     * Запускает MEV процесс
     * @param config - Конфигурация процесса
     * @param options - Дополнительные опции
     * @returns ID запущенного процесса или null в случае ошибки
     */
    /**
     * Запускает MEV процесс
     */
    async startMevProcess(config: ProcessConfig, options: {
        isRestart?: boolean,
        initialCreationTime?: number,
        instanceNumber?: number,
        signalId?: string
    } = {}) {
        try {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Проверка токена "${config.tokenAddress}"`);
            if (!this.userTokens.has(config.tokenAddress.trim())) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Токен не найден, создаем...`);
                this.userTokens.set(config.tokenAddress.trim(), (await createTokenAccount(this.userSettings?.mainRpc!, config.tokenAddress.trim(), this.USER, this.userTokens))!);
                await sleep(21000);
            }

            // Проверяем обязательные параметры
            const tokenAddress = config.tokenAddress;
            const meteoraPools = config.meteoraPools;
            let pumpSwapPool = config.pumpSwapPool || undefined;

            if (!tokenAddress || !meteoraPools) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Не указаны обязательные параметры токена или пула.`);
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Токен: ${tokenAddress}, пулs: ${meteoraPools}`);
                return null;
            }

            // Генерируем signalId если не передан
            const signalId = options.signalId || this.generateSignalId(tokenAddress, meteoraPools);

            // Используем номер инстанса для создания уникального ID
            const instanceNumber = options.instanceNumber || 0;
            const processId = this.generateProcessId(
                tokenAddress,
                meteoraPools,
                this.userSettings.jito_lower_bound,
                instanceNumber
            );

            // Формируем конфигурацию процесса
            const processConfig = {
                ...config,
                module_name: "mev_subtask",
                tokenAddress,
                meteoraPools,
                pumpSwapPool,
                task_name: config.task_name || `MEV Process ${processId}`,
            };

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Запуск MEV процесса [signalId: ${signalId}, инстанс: ${instanceNumber}] с задержкой ${config.process_delay}мс: ${JSON.stringify(processConfig)}`);

            // Отправка процесса на запуск
            const childProcess = await spawnProcess(processConfig, this.userSettings!);

            if (!childProcess) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Не удалось создать дочерний процесс для ${processId}`);
                return null;
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Успешно запущен MEV процесс ${processId}`);

            // Добавляем обработчики для логирования вывода процесса
            childProcess.stdout.on("data", (data: any) => {
                const output = data.toString().trim();
                if (output) {
                    this.writeProcessLog(processId, output, 'info');
                }
            });

            // Обработка ошибок (stderr)
            childProcess.stderr.on("data", (data) => {
                const output = data.toString().trim();
                if (output) {
                    this.writeProcessLog(processId, output, 'error');
                }
            });

            // Добавляем обработчик завершения процесса
            childProcess.on("exit", (code) => {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `MEV процесс ${processId} (PID: ${childProcess.pid}) завершился с кодом ${code}`);
                this.writeProcessLog(processId, `Процесс завершен с кодом ${code}`, code === 0 ? 'info' : 'error');
                this.handleProcessExit(processId, code);
            });

            // Определяем время создания
            const currentTime = Date.now();
            const initialCreationTime = options.isRestart ? options.initialCreationTime : currentTime;

            // Сохраняем информацию о процессе
            this.mevProcesses.set(processId, {
                pid: childProcess.pid,
                tokenAddress,
                meteoraPools,
                pumpSwapPool,
                process: childProcess,
                startTime: currentTime,
                initialCreationTime: initialCreationTime,
                status: 'running',
                lastActivity: currentTime,
                signals: [],
                config: processConfig,
                instanceNumber: instanceNumber,
                signalId: signalId // Сохраняем signalId для группировки
            });

            this.stats.totalProcesses++;

            return processId;
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при запуске MEV процесса:', error);
            return null;
        }
    }


    /**
     * Останавливает все процессы, связанные с указанным сигналом
     */
    async stopAllProcessesBySignalId(signalId: string, restart: boolean = false): Promise<{success: boolean, count: number}> {
        try {
            const processes = this.getProcessesBySignalId(signalId);
            if (processes.length === 0) {
                return {success: true, count: 0};
            }

            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Останавливаем все процессы (${processes.length}) для сигнала ${signalId}`);

            // Останавливаем каждый процесс
            for (let i = 0; i < processes.length; i++) {
                const process = processes[i];
                const isLast = i === processes.length - 1;

                // Для последнего процесса используем переданный флаг restart
                await this.stopProcess(process.id!, isLast && restart);
            }

            return {success: true, count: processes.length};
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ошибка при остановке процессов сигнала ${signalId}:`, error);
            return {success: false, count: 0};
        }
    }

    /**
     * Получает все процессы, связанные с указанным сигналом
     */
    getProcessesBySignalId(signalId: string): MevProcess[] {
        const processes: MevProcess[] = [];

        for (const [processId, processData] of this.mevProcesses.entries()) {
            if (processData.signalId === signalId) {
                processes.push({...processData, id: processId});
            }
        }

        return processes;
    }

    /**
     * Получает все уникальные signalId активных процессов
     */
    getActiveSignalIds(): string[] {
        const signalIds = new Set<string>();

        for (const process of this.mevProcesses.values()) {
            if (process.signalId) {
                signalIds.add(process.signalId);
            }
        }

        return Array.from(signalIds);
    }

    async checkLiquidity(pairs: string[]): Promise<CheckResult[]> {
        let checkResults: CheckResult[] = [];
        for (const pair of pairs) {
            const meteoraUrl = `https://dlmm-api.meteora.ag/pair/${pair}/analytic/swap_history?rows_to_take=1`;
            const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`;


            let meteoraVerdict = await this.checkMeteora(meteoraUrl);
            let dexscreenerVerdict = await this.checkDex(dexScreenerUrl);

            // meteoraVerdict || dexscreenerVerdict;
            checkResults.push({
                pool: pair,
                verdict: meteoraVerdict || dexscreenerVerdict
            })
        }

        return checkResults


    }

    async checkDex(dexScreenerUrl) {
        try {
            const dexData = (await axios.get(dexScreenerUrl)).data;
            logger.info(logger.LOG_MODULES.SYSTEM, `DEXSCREENER DATA: ${JSON.stringify(dexData, null, 2)}`);

            if (dexData.pair && dexData.pair.txns.m5) {
                const buys = dexData.pair.txns.m5.buys;
                const sells = dexData.pair.txns.m5.sells;
                return buys + sells !== 0;
            }
            return false;

        } catch (error) {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Error while check for DEX: ${error}`);
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Подробная ошибка fetch: ${error.message}`);
            if (error.cause) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Причина ошибки: ${error.cause}`);
            }
            // Можно добавить дополнительные проверки сетевых ошибок
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Сетевая ошибка: не удалось подключиться к серверу');
            }
            return false;
        }


    }

    async checkMeteora(meteoraUrl) {
        try {
            const meteoraData = await (await this.forwardRequest(meteoraUrl)).json();
            logger.info(logger.LOG_MODULES.SYSTEM, `METEOTA DATA: ${JSON.stringify(meteoraData, null, 2)}`);

            if (meteoraData[0].onchain_timestamp) {
                // Проверка, что timestamp был 20 минут назад
                const currentTimestamp = Math.floor(Date.now() / 1000);
                const twentyMinutesAgo = currentTimestamp - (20 * 60); // 20 минут в секундах


                return meteoraData[0].onchain_timestamp < twentyMinutesAgo;
            } else {
                return false;
            }

        } catch (error) {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Error while checking Meteora: ${error}`);
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Подробная ошибка fetch: ${error.message}`);
            if (error.cause) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Причина ошибки: ${error.cause}`);
            }
            // Можно добавить дополнительные проверки сетевых ошибок
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Сетевая ошибка: не удалось подключиться к серверу');
            }
            return false
        }

    }


    dexRequest(url) {

    }

    async forwardRequest(url) { // todo: переделать под разные параметры
        const resp = await fetch(
            `http://${this.userSettings!.proxy_server_ip}:${this.userSettings!.proxy_server_port}/forward`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    method: "GET",
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            }
        );
        if (resp.ok) {
            const errorText = await resp.text();
            throw new Error(`Ошибка HTTP: ${resp.status} ${resp.statusText}. Текст ответа: ${errorText}`);
        }
        return resp;
    }

    async addRaydiumPool(processId: string, pool: string, type: RAYDIUM_TYPE): Promise<string | undefined> {
        let mevProcess: MevProcess = this.mevProcesses.get(processId);
        if (!mevProcess) {
            logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Process with id ${processId} not found.`);
            return;
        }
        let mevConfig: ProcessConfig;
        if (type === RAYDIUM_TYPE.V4) {
            mevConfig = {
                ...mevProcess.config,
                type: "v4",
                raydiumPool: pool
            }
        } else if (type === RAYDIUM_TYPE.CLMM) {
            mevConfig = {
                ...mevProcess.config,
                type: "clmm",
                raydiumPool: pool
            }

        } else if (type === RAYDIUM_TYPE.CPMM) {
            mevConfig = {
                ...mevProcess.config,
                type: "cpmm",
                raydiumPool: pool
            }
        }
        const response = await this.stopProcess(processId, false);
        if (response.success) {
            return await this.startMevProcess(mevConfig, {
                isRestart: true,
                initialCreationTime: mevProcess.initialCreationTime
            })
        } else {
            return undefined
        }

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

            // Используем forceKillWindowsProcess вместо stopMevProcess
            let success = false;
            if (processData.process && processData.process.pid) {
                console.log(`[MEV LoadBalancer] Принудительное завершение процесса ${processId} с PID ${processData.process.pid} через forceKillWindowsProcess`);
                success = await forceKillWindowsProcess(processData.process.pid);
            } else {
                console.log(`[MEV LoadBalancer] Процесс ${processId} не имеет допустимого PID, пропускаем forceKillWindowsProcess`);
                success = true; // Считаем успешным, если процесса уже нет
            }

            // Обрабатываем результат остановки
            if (!success) {
                console.error(`[MEV LoadBalancer] Не удалось завершить процесс ${processId}`);
                return {
                    success: false,
                    error: "Не удалось завершить процесс",
                    processId
                };
            }

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
                fs.mkdirSync(logDir, {recursive: true});
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
        ipcMain.on('mev-process-exit', (event, {processId, exitCode, config}) => {
            this.handleProcessExit(processId, exitCode);
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

            const {processId, message, level, config} = logData;
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
            const signalData: Signal | null = this.parseLogForMevSignal(message);
            if (signalData) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Обнаружен MEV сигнал в логе процесса ${processId}, данные: ${JSON.stringify(signalData)}`);

                // Вместо непосредственной обработки, добавляем сигнал в буфер
                this.addSignalToBuffer(signalData, processId);
            } else {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `MEV сигнал НЕ обнаружен в логе`);
            }
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке лога процесса:', error);
        }
    }


    parseLogForMevSignal(logMessage: string) {
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


    extractSignalDataFromText(logMessage: string) {
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

            // Создаем результат
            const result: any = {
                tokenAddress,
                meteoraPool,
                timestamp: Date.now()
            };

            // Обрабатываем новый формат (4 параметра)
            if (parts.length >= 4) {
                const poolAddress = parts[2];
                const poolType = parts[3];

                // Определяем, к какому типу пула относится адрес (Raydium или PumpSwap)
                if (poolType.toLowerCase().includes('pumpswap')) {
                    result.pumpSwapPool = poolAddress;
                } else {
                    result.raydiumPool = poolAddress;
                }

                // Добавляем тип пула
                result.type = poolType;

                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER,
                    `Успешно извлечены данные: Токен=${tokenAddress}, MeteoraPуул=${meteoraPool}, ` +
                    `${result.pumpSwapPool ? 'PumpSwap' : 'Raydium'}=${poolAddress}, Тип=${poolType}`);
            }
            // Обрабатываем старый формат для обратной совместимости (3 параметра, где третий - пул pumpSwap)
            else if (parts.length === 3 && parts[2]) {
                result.pumpSwapPool = parts[2];
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER,
                    `Успешно извлечены данные (старый формат): Токен=${tokenAddress}, ` +
                    `Пул=${meteoraPool}, PumpSwap=${parts[2]}`);
            } else {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER,
                    `Успешно извлечены данные: Токен=${tokenAddress}, Пул=${meteoraPool}`);
            }

            if (!tokenAddress || !meteoraPool) {
                logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Не удалось извлечь токен или пул: ${tokenAddress} ${meteoraPool}`);
                return null;
            }

            return result;
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при извлечении данных из сигнала:', error);
            return null;
        }
    }


    /**
     * Рассчитывает оптимальное распределение задержек для максимального использования доступных ресурсов
     * @param totalProcesses - Общее количество процессов
     * @param requestsPerSecond - Максимальное количество запросов в секунду
     * @returns Массив задержек для каждого процесса
     */
    /**
     * Рассчитывает оптимальное распределение задержек для максимального использования доступных ресурсов
     */
    /**
     * Рассчитывает оптимальное количество процессов и их задержки для каждого сигнала
     * @param signalCount - Количество сигналов
     * @param totalRequestsPerSecond - Максимальное количество запросов в секунду
     * @returns Объект с количеством инстансов и массивом задержек
     */
    calculateOptimalProcessDistribution(signalCount: number, totalRequestsPerSecond: number): {
        instancesPerSignal: number;
        totalProcesses: number;
        delays: number[];
    } {
        // Если нет сигналов, возвращаем пустой результат
        if (signalCount <= 0) {
            return { instancesPerSignal: 0, totalProcesses: 0, delays: [] };
        }

        // Расчет максимального количества процессов, которые могут быть запущены
        // Начинаем с процессов с задержкой 0 мс (самые эффективные)
        let remainingCapacity = totalRequestsPerSecond;
        let processDelays: number[] = [];

        // Жадный алгоритм: добавляем процессы, начиная с самой низкой задержки
        const delays = [0, 1, 2, 3, 4, 5]; // Доступные задержки в порядке предпочтения

        // Продолжаем добавлять процессы, пока есть достаточно ресурсов
        let currentDelayIndex = 0;

        while (remainingCapacity > 0 && currentDelayIndex < delays.length) {
            const currentDelay = delays[currentDelayIndex];
            const reqsPerProcess = this.DELAY_PERFORMANCE[currentDelay] || 160; // Минимальное значение по умолчанию

            // Если текущая задержка использует слишком много ресурсов, переходим к следующей
            if (reqsPerProcess > remainingCapacity) {
                currentDelayIndex++;
                continue;
            }

            // Добавляем процесс с текущей задержкой
            processDelays.push(currentDelay);
            remainingCapacity -= reqsPerProcess;
        }

        // Количество созданных процессов
        const totalProcesses = processDelays.length;

        // Распределяем процессы между сигналами равномерно (минимум 1 на сигнал)
        let instancesPerSignal = Math.max(1, Math.floor(totalProcesses / signalCount));

        // Если сигналов больше, чем процессов, каждый сигнал получает 1 процесс
        if (signalCount > totalProcesses) {
            instancesPerSignal = 1;
        }

        // Корректируем общее количество процессов, чтобы вместить все сигналы
        const finalTotalProcesses = instancesPerSignal * signalCount;

        // Если нам нужно больше процессов, чем рассчитано, просто дублируем существующие
        // с более высокими задержками
        if (finalTotalProcesses > totalProcesses) {
            // Дублируем задержки, предпочитая более высокие
            while (processDelays.length < finalTotalProcesses) {
                // Если у нас закончились задержки, начинаем добавлять с самой высокой
                const delayToAdd = (delays.length - 1);
                processDelays.push(delayToAdd);
            }
        }

        // Если нам нужно меньше процессов, выбираем самые эффективные
        else if (finalTotalProcesses < totalProcesses) {
            processDelays = processDelays.slice(0, finalTotalProcesses);
        }

        // Рассчитываем итоговую производительность
        const totalPerformance = processDelays.reduce((sum, delay) => sum + this.DELAY_PERFORMANCE[delay], 0);
        const utilizationPercent = (totalPerformance / totalRequestsPerSecond * 100).toFixed(1);

        logger.info(
            logger.LOG_MODULES.MEV_LOAD_BALANCER,
            `Оптимизация: ${signalCount} сигналов, ${instancesPerSignal} инстансов на сигнал, ` +
            `всего ${finalTotalProcesses} процессов, ожидаемая производительность ${totalPerformance} req/s ` +
            `(${utilizationPercent}% от ${totalRequestsPerSecond} req/s)`
        );

        return {
            instancesPerSignal,
            totalProcesses: finalTotalProcesses,
            delays: processDelays
        };
    }
    /**
     * Генерирует уникальный ID для сигнала на основе токена и пулов
     */
    generateSignalId(tokenAddress: string, meteoraPools: string[]): string {
        const tokenPart = tokenAddress.substring(0, 8);

        // Сортируем и берем первый пул для краткости
        const sortedPools = [...meteoraPools].sort();
        const poolPart = sortedPools[0]?.substring(0, 8) || 'nopool';

        return `signal_${tokenPart}_${poolPart}`;
    }



    async addRaydiumSignal(token: string,
                           meteoraPools: string[],
                           rayPool: string,
                           type: RAYDIUM_TYPE
    ): Promise<string | undefined> {

        let procConfig: ProcessConfig = {
                tokenAddress: token,
                meteoraPools: meteoraPools,
                raydiumPool: rayPool,
                type: type,
                main_rpc: this.userSettings.mainRpc,
                useJito: true,
                jito_lower_bound: Number(this.userSettings.jito_lower_bound),
                jito_upper_bound: Number(this.userSettings.jito_upper_bound),
                process_delay: 5,
                task_name: `mev_task_${Date.now().toString().substring(8, 13)}`
            }
        return await this.startMevProcess(procConfig, {
            isRestart: true,
            initialCreationTime: Date.now()
        })

    }

    /**
     * Обрабатывает MEV сигналы
     * @param signals - Массив сигналов для обработки
     * @returns Результат обработки сигналов
     */
    async handleMevSignal(signals: SignalWithMeta[]) {
        try {
            // Проверяем, идет ли очистка процессов
            if (this.isCleaningProcesses) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Нельзя обработать сигналы: идет очистка процессов`);
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
                const {tokenAddress, meteoraPool} = signal;
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

            // Шаг 2: Получаем конфигурации для новых сигналов
            const processManageInfo: ProcessesToManage | undefined = this.getConfigs(validSignals);
            if (!processManageInfo) {
                throw new Error('Не удалось получить информацию о конфигурациях процессов');
            }

            // Шаг 3: Останавливаем и удаляем процессы, которые нужно удалить
            const deletedSignalIds = new Set<string>();
            for (const processId of processManageInfo.processIdsToDelete) {
                const process = this.mevProcesses.get(processId);
                if (process && process.signalId && !deletedSignalIds.has(process.signalId)) {
                    // Останавливаем все процессы этого сигнала
                    await this.stopAllProcessesBySignalId(process.signalId);
                    deletedSignalIds.add(process.signalId);
                } else {
                    // Если signalId нет или уже обработан, останавливаем отдельный процесс
                    await this.stopProcess(processId);
                }
            }

            // Шаг 4: Получаем все активные signalIds после удаления
            const activeSignalIds = this.getActiveSignalIds();

            // Шаг 5: Добавляем новые signalIds
            const newSignalIds: string[] = [];
            const newConfigs: Map<string, ProcessConfig> = new Map();

            for (const config of processManageInfo.configsToAdd) {
                const signalId = this.generateSignalId(config.tokenAddress, config.meteoraPools);
                if (!newSignalIds.includes(signalId) && !activeSignalIds.includes(signalId)) {
                    newSignalIds.push(signalId);
                    newConfigs.set(signalId, config);
                }
            }

            // Шаг 6: Объединяем существующие и новые signalIds
            const allSignalIds = [...activeSignalIds, ...newSignalIds];

            // Шаг 7: Рассчитываем оптимальное распределение инстансов и задержек
            const TOTAL_REQUESTS_PER_SECOND = Number(this.userSettings?.requests_per_second) || 2000;

// Рассчитываем оптимальное распределение процессов
            const distribution = this.calculateOptimalProcessDistribution(
                allSignalIds.length,
                TOTAL_REQUESTS_PER_SECOND
            );

            const instancesPerSignal = distribution.instancesPerSignal;
            const totalProcessesToLaunch = distribution.totalProcesses;
            const delays = distribution.delays;

// Рассчитываем суммарную производительность
            const expectedPerformance = delays.reduce((total, delay) => total + this.DELAY_PERFORMANCE[delay], 0);
            const performancePercent = (expectedPerformance / TOTAL_REQUESTS_PER_SECOND * 100).toFixed(1);

            logger.info(
                logger.LOG_MODULES.MEV_LOAD_BALANCER,
                `Оптимизация: ${allSignalIds.length} сигналов, ${instancesPerSignal} инстансов на сигнал, ` +
                `всего процессов: ${totalProcessesToLaunch}, ожидаемая производительность: ${expectedPerformance} req/s ` +
                `(${performancePercent}% от доступных ${TOTAL_REQUESTS_PER_SECOND} req/s)`
            );

            // Шаг 8: Останавливаем все существующие процессы для перераспределения
            for (const signalId of activeSignalIds) {
                await this.stopAllProcessesBySignalId(signalId);
            }

            // Шаг 9: Запускаем все процессы с новыми задержками
            let delayIndex = 0;
            const newProcesses: string[] = [];
            const signalInstances: Map<string, string[]> = new Map();

            // Функция для запуска процессов с оптимальными задержками
            const launchProcessesForSignal = async (signalId: string, config: ProcessConfig) => {
                const instanceIds: string[] = [];

                for (let i = 0; i < instancesPerSignal; i++) {
                    if (delayIndex >= delays.length) break;

                    const delay = delays[delayIndex++];
                    const processConfig = { ...config, process_delay: delay };

                    const processId = await this.startMevProcess(
                        processConfig,
                        {
                            isRestart: false,
                            instanceNumber: i,
                            signalId: signalId
                        }
                    );

                    if (processId) {
                        instanceIds.push(processId);
                        newProcesses.push(processId);
                    }

                    // Небольшая задержка между запусками
                    await sleep(50);
                }

                return instanceIds;
            };

            // Шаг 10: Запускаем существующие сигналы
            for (const signalId of activeSignalIds) {
                const processes = this.getProcessesBySignalId(signalId);
                if (processes.length > 0) {
                    const config = processes[0].config!;
                    const instanceIds = await launchProcessesForSignal(signalId, config);
                    signalInstances.set(signalId, instanceIds);
                }
            }

            // Шаг 11: Запускаем новые сигналы
            for (const signalId of newSignalIds) {
                const config = newConfigs.get(signalId)!;
                const instanceIds = await launchProcessesForSignal(signalId, config);
                signalInstances.set(signalId, instanceIds);
            }

            // Шаг 12: Обновляем статистику и отправляем уведомления
            this.stats.totalMevActions += validSignals.length;
            this.stats.successfulSignals += validSignals.length;

            // Вычисляем реальную производительность запущенных процессов
            const actualProcesses = newProcesses.map(id => this.mevProcesses.get(id))
                .filter(p => p !== undefined);
            const actualDelays = actualProcesses.map(p => p!.config!.process_delay || 0);
            const actualPerformance = actualDelays.reduce((total, delay) => total + this.DELAY_PERFORMANCE[delay], 0);
            const actualPercent = (actualPerformance / TOTAL_REQUESTS_PER_SECOND * 100).toFixed(1);

            // Отправляем уведомление в Telegram
            if (this.settings.notifyTelegram) {
                // Информация о распределении задержек
                const delayBreakdown = this.countDelays(actualDelays);
                const delayLines = Object.entries(delayBreakdown)
                    .map(([delay, count]) => `- ${count} процессов с задержкой ${delay}мс (${this.DELAY_PERFORMANCE[delay]} req/s)`)
                    .join('\n');

                // Информация о сигналах и инстансах
                const signalLines = Array.from(signalInstances.entries())
                    .map(([signalId, instanceIds]) => {
                        const process = this.getProcessesBySignalId(signalId)[0];
                        if (!process) return null;

                        // Собираем информацию о задержках для этого сигнала
                        const instanceDelays = instanceIds
                            .map(id => this.mevProcesses.get(id)?.config?.process_delay || 0)
                            .reduce((acc, delay) => {
                                acc[delay] = (acc[delay] || 0) + 1;
                                return acc;
                            }, {});

                        const delayInfo = Object.entries(instanceDelays)
                            .map(([delay, count]) => `${count}x${delay}мс`)
                            .join(', ');

                        return `- ${process.tokenAddress.substring(0, 8)}... (${instanceIds.length} инстансов: ${delayInfo})`;
                    })
                    .filter(line => line !== null)
                    .join('\n');

                const message = `🚀 Обработано ${validSignals.length} MEV сигналов\n\n` +
                    `✅ Результаты перераспределения ресурсов:\n` +
                    `- Всего активных сигналов: ${allSignalIds.length}\n` +
                    `- Инстансов на сигнал: ${instancesPerSignal}\n` +
                    `- Всего запущено процессов: ${newProcesses.length}\n` +
                    `- Суммарная производительность: ${actualPerformance} из ${TOTAL_REQUESTS_PER_SECOND} req/s (${actualPercent}%)\n\n` +
                    `📊 Распределение задержек:\n${delayLines}\n\n` +
                    `🔄 Активные сигналы:\n${signalLines}`;

                telegramBotService.sendSystemNotification(message);
            }

            return {
                success: true,
                totalSignals: allSignalIds.length,
                instancesPerSignal,
                totalProcesses: newProcesses.length,
                delays: this.countDelays(actualDelays),
                performance: {
                    actual: actualPerformance,
                    total: TOTAL_REQUESTS_PER_SECOND,
                    percent: actualPercent
                }
            };
        } catch (error) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, 'Ошибка при обработке MEV сигналов:', error);
            this.stats.failedSignals += signals.length;

            if (this.settings?.notifyTelegram) {
                telegramBotService.sendSystemNotification(
                    `❌ Ошибка обработки ${signals.length} MEV сигналов:\nОшибка: ${error.message}`
                );
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Подсчитывает количество процессов с каждой задержкой
     * @param delays - Массив задержек
     * @returns Объект, где ключи - это задержки, а значения - количество процессов с такой задержкой
     */

    countDelays(delays: number[]): {[key: string]: number} {
        const result: {[key: string]: number} = {};

        for (const delay of delays) {
            if (!result[delay]) {
                result[delay] = 0;
            }
            result[delay]++;
        }

        return result;
    }

    deleteProcesses(taskIds: string[]) {
        for (const taskId of taskIds) {
            this.mevProcesses.delete(taskId);
        }
    }

    /**
     * Перезапускает все активные процессы с новыми оптимальными задержками
     * @returns Результат перезапуска процессов
     */
    /**
     * Перезапускает все процессы с оптимальными задержками
     */
    /**
     * Перезапускает все процессы с оптимальными задержками
     */
    async restartProcesses() {
        try {
            const activeSignalIds = this.getActiveSignalIds();
            if (activeSignalIds.length === 0) {
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Нет активных сигналов для перезапуска`);
                return {
                    success: true,
                    message: 'Нет активных сигналов для перезапуска'
                };
            }

            // Рассчитываем оптимальное распределение
            const TOTAL_REQUESTS_PER_SECOND = Number(this.userSettings?.requests_per_second) || 2000;

            // Используем новый алгоритм для оптимального распределения процессов
            const distribution = this.calculateOptimalProcessDistribution(
                activeSignalIds.length,
                TOTAL_REQUESTS_PER_SECOND
            );

            const instancesPerSignal = distribution.instancesPerSignal;
            const totalProcessesToLaunch = distribution.totalProcesses;
            const delays = distribution.delays;

            // Рассчитываем суммарную производительность
            const expectedPerformance = delays.reduce((total, delay) => total + this.DELAY_PERFORMANCE[delay], 0);
            const performancePercent = (expectedPerformance / TOTAL_REQUESTS_PER_SECOND * 100).toFixed(1);

            logger.info(
                logger.LOG_MODULES.MEV_LOAD_BALANCER,
                `Перезапуск процессов: ${activeSignalIds.length} сигналов, ${instancesPerSignal} инстансов на сигнал, ` +
                `всего ${totalProcessesToLaunch} процессов, ожидаемая производительность: ${expectedPerformance} req/s ` +
                `(${performancePercent}% от доступных ${TOTAL_REQUESTS_PER_SECOND} req/s)`
            );

            // Останавливаем все процессы
            for (const signalId of activeSignalIds) {
                await this.stopAllProcessesBySignalId(signalId);
            }

            // Запускаем процессы с новыми задержками
            let delayIndex = 0;
            const newProcesses: string[] = [];
            const signalInstances: Map<string, string[]> = new Map();

            // Запускаем процессы для каждого сигнала
            for (const signalId of activeSignalIds) {
                const processes = this.getProcessesBySignalId(signalId);
                if (processes.length === 0) continue;

                // Берем первый процесс как шаблон
                const baseConfig = processes[0].config!;
                const instanceIds: string[] = [];

                // Запускаем инстансы с оптимальными задержками
                for (let i = 0; i < instancesPerSignal; i++) {
                    if (delayIndex >= delays.length) break;

                    const delay = delays[delayIndex++];
                    const processConfig = { ...baseConfig, process_delay: delay };

                    const processId = await this.startMevProcess(
                        processConfig,
                        {
                            isRestart: true,
                            initialCreationTime: processes[0].initialCreationTime,
                            instanceNumber: i,
                            signalId: signalId
                        }
                    );

                    if (processId) {
                        instanceIds.push(processId);
                        newProcesses.push(processId);
                    }

                    // Небольшая задержка между запусками
                    await sleep(50);
                }

                signalInstances.set(signalId, instanceIds);
            }

            // Отправляем уведомление в Telegram
            if (this.settings.notifyTelegram) {
                // Информация о распределении задержек
                const delayBreakdown = this.countDelays(delays);
                const delayLines = Object.entries(delayBreakdown)
                    .map(([delay, count]) => `- ${count} процессов с задержкой ${delay}мс (${this.DELAY_PERFORMANCE[delay]} req/s)`)
                    .join('\n');

                // Информация о сигналах
                const signalLines = Array.from(signalInstances.entries())
                    .map(([signalId, instanceIds]) => {
                        const process = this.getProcessesBySignalId(signalId)[0];
                        if (!process) return null;

                        // Собираем информацию о задержках для этого сигнала
                        const instanceDelays = instanceIds
                            .map(id => this.mevProcesses.get(id)?.config?.process_delay || '?')
                            .reduce((acc, delay) => {
                                acc[delay] = (acc[delay] || 0) + 1;
                                return acc;
                            }, {});

                        const delayInfo = Object.entries(instanceDelays)
                            .map(([delay, count]) => `${count}x${delay}мс`)
                            .join(', ');

                        return `- ${process.tokenAddress.substring(0, 8)}... (${instanceIds.length} инстансов: ${delayInfo})`;
                    })
                    .filter(line => line !== null)
                    .join('\n');

                // Добавляем информацию о суммарной производительности
                const message = `🔄 Перезапуск MEV процессов\n\n` +
                    `✅ Новое распределение ресурсов:\n` +
                    `- Всего активных сигналов: ${activeSignalIds.length}\n` +
                    `- Инстансов на сигнал: ${instancesPerSignal}\n` +
                    `- Всего запущено процессов: ${delayIndex}\n` +
                    `- Суммарная производительность: ${expectedPerformance} из ${TOTAL_REQUESTS_PER_SECOND} req/s (${performancePercent}%)\n\n` +
                    `📊 Распределение задержек:\n${delayLines}\n\n` +
                    `🔄 Активные сигналы:\n${signalLines}`;

                telegramBotService.sendSystemNotification(message);
            }

            return {
                success: true,
                newProcesses,
                totalProcesses: delayIndex,
                performance: {
                    actual: expectedPerformance,
                    total: TOTAL_REQUESTS_PER_SECOND,
                    percent: performancePercent
                },
                delays: this.countDelays(delays)
            };
        } catch (e) {
            logger.error(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Ошибка при перезапуске процессов: ${e}`);
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
            const processesToStop: any[] = [];

            // Проходим по всем процессам и проверяем ликвидность их пулов
            for (const [processId, processData] of this.mevProcesses.entries()) {
                try {
                    const meteoraPools = processData.meteoraPools || processData.config?.meteoraPools;

                    if (!meteoraPools) {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Пропуск проверки для процесса ${processId}: пулы не найдены`);
                        continue;
                    }

                    // Проверяем возраст процесса
                    const processAge = currentTime - (processData.initialCreationTime || processData.startTime);
                    if (processAge < this.settings.minProcessAgeForCleanup) {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Пропуск проверки для молодого процесса ${processId}: возраст ${Math.floor(processAge / 1000 / 60)} минут < ${Math.floor(this.settings.minProcessAgeForCleanup / 1000 / 60)} минут`);
                        continue;
                    }

                    logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Проверка ликвидности пулов ${meteoraPools} для процесса ${processId} (возраст: ${Math.floor(processAge / 1000 / 60)} минут)`);

                    // Проверяем ликвидность пула
                    const hasEnoughLiquidity: CheckResult[] = await this.checkLiquidity(meteoraPools);

                    // Если ликвидность ниже порогового значения, добавляем процесс в список на остановку
                    const count = hasEnoughLiquidity.filter(item => item.verdict === false).length;

                    if (count === meteoraPools.length) {
                        processesToStop.push(processId);
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `Процесс ${processId} будет остановлен: не удолетворены условия check...`);
                    } else if (count < meteoraPools.length && count !== 0) {
                        logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `удаляем нерабочие пулы`);
                        const deletePromises = hasEnoughLiquidity
                            .filter(item => item.verdict === false)
                            .map(item => this.deleteMeteoraPoolFromProcess(processId, item.pool));
                        await Promise.all(deletePromises)


                    } else if (count === 0) {
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


    handleExternalMevSignal(signal: Signal, sourceId = 'external') {
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
            console.log(JSON.stringify(tokenReleaseProcesses, null, 2));
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
export default mevLoadBalancer;