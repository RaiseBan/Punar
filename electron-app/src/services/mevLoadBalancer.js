/**
 * MEV LoadBalancer - Модуль балансировки нагрузки MEV процессов
 * 
 * Отвечает за обнаружение сигналов MEV в логах процессов new-token-release,
 * запуск MEV процессов и распределение нагрузки между ними.
 */
const { ipcMain } = require('electron');
const path = require('path');
const { app } = require('electron');
const { spawnProcess, stopMevProcess } = require('../utils/spawnProcess');
const { generateMevConfig } = require('../utils/generateService');
const { getSettings } = require('../utils/fsHelper');
const telegramBotService = require('./telegramBotService');

class MevLoadBalancer {
  constructor() {
    // Карта для отслеживания MEV процессов
    // key = processId, value = { process, config, signals, status }
    this.mevProcesses = new Map();

    // Карта для отслеживания процессов new-token-release
    // key = processId, value = true
    this.tokenReleaseProcesses = new Map();

    // Карта для отслеживания связи между токенами и процессами
    // key = tokenAddress, value = [processIds]
    this.tokenProcessMap = new Map();

    // Регулярные выражения для обнаружения MEV сигналов
    this.mevSignalRegex = /\[PERFORM_MEV_ACTION\]\s*(\{.*\})/;
    this.tokenInfoRegex = /Token:\s*([^\s,]+).*Address:\s*([^\s,]+)/;
    this.poolInfoRegex = /Pool:\s*([^\s,]+)/;
    this.volumeRegex = /Volume:\s*([^\s,]+)/;

    // Флаг активации балансировщика
    this.isActive = false;

    // Статистика
    this.stats = {
      processedSignals: 0,
      successfulSignals: 0,
      failedSignals: 0,
      totalMevActions: 0
    };

    // Настройки
    this.settings = {
      maxProcessesPerToken: 3,     // Максимальное количество процессов на токен
      maxSignalsPerProcess: 50,    // Максимальное количество сигналов на процесс
      notifyTelegram: true,        // Отправлять уведомления в Telegram
      autoStopIdleTime: 30 * 60 * 1000  // 30 минут неактивности до остановки процесса
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

      console.log('[MEV LoadBalancer] Инициализация завершена');
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при инициализации:', error);
    }
  }

  /**
   * Инициализирует обработчики IPC событий
   */
  initIpcHandlers() {
    // Обработчик для логов процессов
    ipcMain.on('process-log', async (event, data) => {
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
  }

  /**
   * Запускает MEV LoadBalancer
   * @returns {Promise<Object>} - Результат запуска
   */
  async start() {
    try {
      if (this.isActive) {
        console.log('[MEV LoadBalancer] Балансировщик уже запущен');
        return { success: true, status: 'already_running' };
      }

      console.log('[MEV LoadBalancer] Запуск MEV LoadBalancer');

      this.isActive = true;

      // Сбрасываем статистику
      this.resetStats();

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
      console.error('[MEV LoadBalancer] Ошибка при запуске:', error);
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
        console.log('[MEV LoadBalancer] Балансировщик уже остановлен');
        return { success: true, status: 'already_stopped' };
      }

      console.log('[MEV LoadBalancer] Остановка MEV LoadBalancer');

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
      console.error('[MEV LoadBalancer] Ошибка при остановке:', error);

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
    // Добавляем текущую информацию о процессах
    const processStats = {
      totalMevProcesses: this.mevProcesses.size,
      totalTokenReleaseProcesses: this.tokenReleaseProcesses.size,
      activeTokens: this.tokenProcessMap.size
    };

    return {
      ...this.stats,
      ...processStats
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
      console.log('[MEV LoadBalancer] Обновление настроек:', settings);

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
      console.error('[MEV LoadBalancer] Ошибка при обновлении настроек:', error);

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
      console.log(`[MEV LoadBalancer] Регистрация процесса ${processId} как процесса new-token-release`);
      this.tokenReleaseProcesses.set(processId, true);
    }
  }

  /**
   * Возвращает список всех MEV процессов
   * @returns {Array} - Массив информации о процессах
   */
  getProcesses() {
    const processes = [];

    for (const [processId, processData] of this.mevProcesses.entries()) {
      processes.push({
        id: processId,
        config: processData.config,
        status: processData.status,
        signals: processData.signals || [],
        startTime: processData.startTime,
        lastActivity: processData.lastActivity || processData.startTime
      });
    }

    return processes;
  }

  /**
   * Возвращает список MEV процессов для указанного токена
   * @param {string} tokenAddress - Адрес токена
   * @returns {Array} - Массив идентификаторов процессов
   */
  getProcessesForToken(tokenAddress) {
    if (!tokenAddress) return [];

    return this.tokenProcessMap.get(tokenAddress) || [];
  }

  /**
   * Запускает новый MEV процесс
   * @param {Object} config - Конфигурация процесса
   * @returns {Promise<string>} - Идентификатор запущенного процесса
   */
  async startMevProcess(config) {
    try {
      // Проверяем, загружены ли настройки пользователя
      if (!this.userSettings) {
        this.userSettings = await getSettings();
      }

      // Проверяем лимит процессов для токена
      const tokenAddress = config.tokenAddress;

      if (!tokenAddress) {
        throw new Error('Не указан адрес токена в конфигурации');
      }

      const tokenProcesses = this.getProcessesForToken(tokenAddress);

      if (tokenProcesses.length >= this.settings.maxProcessesPerToken && !config.isRestarted) {
        console.warn(`[MEV LoadBalancer] Достигнут лимит процессов для токена ${tokenAddress}`);
      }

      // Генерируем идентификатор процесса
      const processId = `mev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Формируем конфигурацию для MEV процесса
      const mevConfig = {
        taskId: processId,
        module_name: 'mev_subtask',
        task_name: `mev_${tokenAddress.slice(0, 8)}`,
        tokenAddress: tokenAddress,
        poolAddress: config.poolAddress,
        value: config.volume || 'unknown',
        main_rpc: this.userSettings.mainRpc || 'https://api.mainnet-beta.solana.com',
        useJito: true, // Всегда используем Jito для MEV процессов
        jito_lower_bound: 100000,
        jito_upper_bound: 300000,
        enablePoolMonitoring: true,
        poolCheckInterval: 10000,
        // Учитываем переданную задержку для процесса или используем дефолтную (300)
        process_delay: config.process_delay || 300
      };

      console.log(`[MEV LoadBalancer] Запуск MEV процесса для токена ${tokenAddress}, пула ${config.poolAddress}, задержка: ${mevConfig.process_delay}мс`);

      // Генерируем MEV конфиг
      const targetDir = this.userSettings.mevBotDirectory;
      const tokensDirPath = path.join(targetDir, 'tokens');

      // Создаем MEV конфиг с указанными токеном и пулом
      const configPath = await generateMevConfig(
        targetDir,
        tokensDirPath,
        mevConfig,
        config.poolAddress
      );

      if (!configPath) {
        throw new Error('Не удалось создать конфиг для MEV процесса');
      }

      console.log(`[MEV LoadBalancer] MEV конфиг создан: ${configPath}`);

      // Запускаем процесс
      const childProcess = await spawnProcess(mevConfig, this.userSettings);

      if (!childProcess) {
        throw new Error('Не удалось запустить MEV процесс');
      }

      console.log(`[MEV LoadBalancer] MEV процесс запущен с PID ${childProcess.pid}`);

      // Сохраняем информацию о процессе
      this.mevProcesses.set(processId, {
        process: childProcess,
        config: {
          ...config,
          ...mevConfig
        },
        signals: [],
        status: 'running',
        startTime: Date.now(),
        lastActivity: Date.now(),
        pid: childProcess.pid
      });

      // Добавляем процесс в карту токенов
      if (!this.tokenProcessMap.has(tokenAddress)) {
        this.tokenProcessMap.set(tokenAddress, []);
      }

      this.tokenProcessMap.get(tokenAddress).push(processId);

      return processId;
    } catch (error) {
      console.error(`[MEV LoadBalancer] Ошибка при запуске MEV процесса:`, error);
      throw error;
    }
  }

  /**
   * Останавливает MEV процесс
   * @param {string} processId - Идентификатор процесса
   * @returns {Promise<Object>} - Результат остановки процесса
   */
  async stopProcess(processId) {
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

      // Останавливаем процесс
      await stopMevProcess(processId, processData.process);

      // Удаляем процесс из карты токенов
      if (processData.config && processData.config.tokenAddress) {
        const tokenAddress = processData.config.tokenAddress;

        if (this.tokenProcessMap.has(tokenAddress)) {
          const tokenProcesses = this.tokenProcessMap.get(tokenAddress);

          const index = tokenProcesses.indexOf(processId);

          if (index !== -1) {
            tokenProcesses.splice(index, 1);

            if (tokenProcesses.length === 0) {
              this.tokenProcessMap.delete(tokenAddress);
            }
          }
        }
      }

      // Удаляем процесс из карты MEV процессов
      this.mevProcesses.delete(processId);

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

    console.log(`[MEV LoadBalancer] MEV процесс ${processId} завершился с кодом ${code}`);

    const processData = this.mevProcesses.get(processId);

    // Обновляем статус процесса
    processData.status = 'stopped';
    processData.exitCode = code;
    processData.exitTime = Date.now();

    // Удаляем процесс из карты токенов
    if (processData.config && processData.config.tokenAddress) {
      const tokenAddress = processData.config.tokenAddress;

      if (this.tokenProcessMap.has(tokenAddress)) {
        const tokenProcesses = this.tokenProcessMap.get(tokenAddress);

        const index = tokenProcesses.indexOf(processId);

        if (index !== -1) {
          tokenProcesses.splice(index, 1);

          if (tokenProcesses.length === 0) {
            this.tokenProcessMap.delete(tokenAddress);
          }
        }
      }
    }

    // Удаляем процесс из карты MEV процессов через 5 секунд (чтобы успеть получить логи)
    setTimeout(() => {
      this.mevProcesses.delete(processId);
      console.log(`[MEV LoadBalancer] Информация о MEV процессе ${processId} удалена`);
    }, 5000);
  }

  /**
   * Обрабатывает лог процесса для поиска MEV сигналов
   * @param {Object} logData - Данные лога
   */
  handleProcessLog(logData) {
    if (!this.isActive) return;

    try {
      const { processId, level, message } = logData;

      // Проверяем, является ли процесс процессом выпуска токенов
      if (message && message.includes('new-token-release') &&
        (message.includes('starting') || message.includes('Starting'))) {
        this.registerTokenReleaseProcess(processId);
      }

      // Проверяем, является ли процесс процессом выпуска токенов
      if (this.isTokenReleaseProcess(processId)) {
        // Проверяем лог на наличие MEV сигнала
        const signal = this.parseLogForMevSignal(message);

        if (signal) {
          console.log(`[MEV LoadBalancer] Обнаружен MEV сигнал в логе процесса ${processId}`);
          this.handleMevSignal(signal, processId);
        }
      }
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при обработке лога:', error);
    }
  }

  /**
   * Парсит лог и ищет сигнал для MEV действия
   * @param {string} logMessage - Сообщение лога
   * @returns {Object|null} - Объект с данными сигнала или null, если сигнал не найден
   */
  parseLogForMevSignal(logMessage) {
    if (!logMessage) return null;

    try {
      // Проверяем, содержит ли лог сигнал MEV
      const signalMatch = logMessage.match(this.mevSignalRegex);

      if (signalMatch) {
        console.log('[MEV LoadBalancer] Обнаружен MEV сигнал в логе');

        try {
          // Пытаемся распарсить JSON из сигнала
          const jsonData = JSON.parse(signalMatch[1]);

          // Если JSON успешно распарсен, возвращаем его
          return {
            tokenAddress: jsonData.tokenAddress,
            poolAddress: jsonData.poolAddress,
            tokenSymbol: jsonData.tokenSymbol,
            volume: jsonData.volume,
            timestamp: jsonData.timestamp || Date.now(),
            rawData: jsonData
          };
        } catch (jsonError) {
          console.warn('[MEV LoadBalancer] Не удалось распарсить JSON из сигнала MEV:', jsonError);

          // Если JSON не распарсился, пытаемся извлечь данные через регулярные выражения
          return this.extractSignalDataFromText(logMessage);
        }
      }

      return null;
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при парсинге лога:', error);
      return null;
    }
  }

  /**
   * Извлекает данные сигнала из текста, если JSON не распарсился
   * @param {string} logMessage - Сообщение лога
   * @returns {Object|null} - Объект с данными сигнала или null, если данные не найдены
   */
  extractSignalDataFromText(logMessage) {
    try {
      // Извлекаем информацию о токене
      const tokenMatch = logMessage.match(this.tokenInfoRegex);
      if (!tokenMatch) return null;

      const tokenSymbol = tokenMatch[1];
      const tokenAddress = tokenMatch[2];

      // Извлекаем информацию о пуле
      const poolMatch = logMessage.match(this.poolInfoRegex);
      const poolAddress = poolMatch ? poolMatch[1] : '';

      // Извлекаем информацию об объеме
      const volumeMatch = logMessage.match(this.volumeRegex);
      const volume = volumeMatch ? volumeMatch[1] : '';

      return {
        tokenAddress,
        poolAddress,
        tokenSymbol,
        volume,
        timestamp: Date.now(),
        rawText: logMessage
      };
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при извлечении данных из текста:', error);
      return null;
    }
  }

  /**
   * Обрабатывает MEV сигнал
   * @param {Object} signal - Данные сигнала
   * @param {string} sourceProcessId - Идентификатор исходного процесса
   */
  async handleMevSignal(signal, sourceProcessId) {
    try {
      console.log(`[MEV LoadBalancer] Обработка MEV сигнала от процесса ${sourceProcessId}`);

      // Увеличиваем счетчик обработанных сигналов
      this.stats.processedSignals++;

      // Проверяем необходимые данные в сигнале
      const tokenAddress = signal.tokenAddress;
      const poolAddress = signal.poolAddress;

      if (!tokenAddress || !poolAddress) {
        console.error('[MEV LoadBalancer] Сигнал не содержит необходимых данных (tokenAddress или poolAddress)');
        this.stats.failedSignals++;
        return;
      }

      // Проверяем, есть ли существующие процессы для этого токена и сохраняем их конфигурации
      const existingProcesses = this.getProcessesForToken(tokenAddress);
      const savedConfigs = [];

      // Сохраняем конфигурации существующих процессов перед их остановкой
      if (existingProcesses && existingProcesses.length > 0) {
        console.log(`[MEV LoadBalancer] Найдены ${existingProcesses.length} существующих процессов для токена ${tokenAddress}. Сохраняем их конфигурации.`);

        for (const processId of existingProcesses) {
          if (this.mevProcesses.has(processId)) {
            const processData = this.mevProcesses.get(processId);
            savedConfigs.push({
              ...processData.config,
              originalProcessId: processId
            });
          }
        }

        // Останавливаем все существующие процессы для этого токена
        for (const processId of existingProcesses) {
          try {
            await this.stopProcess(processId);
            console.log(`[MEV LoadBalancer] Остановлен существующий процесс ${processId} для токена ${tokenAddress}`);
          } catch (stopError) {
            console.error(`[MEV LoadBalancer] Ошибка при остановке процесса ${processId}:`, stopError);
          }
        }
      }

      // Общее количество процессов, которые будут запущены
      // +1 - это новый процесс, остальные - перезапускаемые
      const totalProcesses = savedConfigs.length + 1;

      // Максимальное количество запросов в секунду, которое может выдержать прокси-сервер
      const MAX_REQUESTS_PER_SECOND = 170;

      // Распределяем запросы между процессами
      const requestsPerProcess = MAX_REQUESTS_PER_SECOND / totalProcesses;

      // Рассчитываем задержку для каждого процесса по формуле round(1000/requestsPerProcess) + 1
      const processDelay = Math.ceil(1000 / requestsPerProcess) + 1;

      console.log(`[MEV LoadBalancer] Расчет задержки: всего процессов ${totalProcesses}, запросов на процесс ${requestsPerProcess.toFixed(2)}, задержка ${processDelay}мс`);

      // Массив для хранения ID новых процессов
      const newProcessesIds = [];

      try {
        // Создаем новую конфигурацию процесса с НОВЫМ пулом и рассчитанной задержкой
        const newConfig = {
          tokenAddress,
          poolAddress, // используем пул из сигнала
          volume: signal.volume || 'unknown',
          tokenSymbol: signal.tokenSymbol,
          process_delay: processDelay  // Устанавливаем рассчитанную задержку
        };

        // Запускаем новый MEV процесс
        const newProcessId = await this.startMevProcess(newConfig);
        newProcessesIds.push(newProcessId);

        console.log(`[MEV LoadBalancer] Создан новый процесс ${newProcessId} для токена ${tokenAddress} с пулом ${poolAddress}, задержка ${processDelay}мс`);

        // Перезапускаем существующие процессы с их ИСХОДНЫМИ пулами, но с обновленной задержкой
        for (const savedConfig of savedConfigs) {
          // Создаем обновленную конфигурацию с ОРИГИНАЛЬНЫМ пулом и обновленной задержкой
          const updatedConfig = {
            ...savedConfig,
            process_delay: processDelay,  // обновляем только задержку
            isRestarted: true  // помечаем как перезапущенный процесс
          };

          // Запускаем процесс с обновленной конфигурацией
          const restartedProcessId = await this.startMevProcess(updatedConfig);
          newProcessesIds.push(restartedProcessId);

          // Получаем информацию о пуле для логов
          const originalPool = savedConfig.poolAddress || 'неизвестный пул';
          console.log(`[MEV LoadBalancer] Перезапущен процесс ${restartedProcessId} для токена ${tokenAddress} с оригинальным пулом ${originalPool}, задержка обновлена до ${processDelay}мс`);
        }

        // Отправляем уведомление в Telegram о всех запущенных процессах
        if (this.settings.notifyTelegram) {
          const tokenSymbol = signal.tokenSymbol || 'Неизвестный токен';
          const volume = signal.volume || 'не указан';

          // Детальная информация о балансировке
          const loadBalanceInfo =
            `Всего ${totalProcesses} процессов\n` +
            `Макс. запросов/сек: ${MAX_REQUESTS_PER_SECOND}\n` +
            `Запросов на процесс: ${requestsPerProcess.toFixed(2)}/сек\n` +
            `Задержка: ${processDelay}мс`;

          // Формируем информацию о запущенных процессах
          const newProcessInfo = `Создан новый процесс: ${newProcessesIds[0]} (пул: ${poolAddress})`;

          // Формируем информацию о перезапущенных процессах с их оригинальными пулами
          let restartedProcessesInfo = '';
          if (savedConfigs.length > 0) {
            restartedProcessesInfo = `\nПерезапущены процессы с оригинальными пулами:\n`;
            for (let i = 0; i < savedConfigs.length; i++) {
              const processId = newProcessesIds[i + 1];
              const originalPool = savedConfigs[i].poolAddress || 'неизвестный пул';
              restartedProcessesInfo += `${processId} (пул: ${originalPool})\n`;
            }
          }

          const message = `🚀 MEV сигнал обработан:\n` +
            `Токен: ${tokenSymbol} (${tokenAddress})\n` +
            `Пул сигнала: ${poolAddress}\n` +
            `Объем: ${volume}\n\n` +
            `⚖️ Балансировка нагрузки:\n${loadBalanceInfo}\n\n` +
            `🔄 Запущенные процессы:\n${newProcessInfo}${restartedProcessesInfo}`;

          telegramBotService.sendSystemNotification(message);
        }

        this.stats.successfulSignals++;
        this.stats.totalMevActions += totalProcesses;
      } catch (error) {
        console.error(`[MEV LoadBalancer] Ошибка при запуске процессов для токена ${tokenAddress}:`, error);
        this.stats.failedSignals++;

        // Отправляем уведомление об ошибке в Telegram
        if (this.settings.notifyTelegram) {
          const errorMessage = `❌ Ошибка обработки MEV сигнала:\n` +
            `Токен: ${tokenAddress}\n` +
            `Ошибка: ${error.message}`;

          telegramBotService.sendSystemNotification(errorMessage);
        }
      }
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при обработке MEV сигнала:', error);
      this.stats.failedSignals++;
    }
  }
}

// Создаем и экспортируем экземпляр MEV LoadBalancer
const mevLoadBalancer = new MevLoadBalancer();
module.exports = mevLoadBalancer;
