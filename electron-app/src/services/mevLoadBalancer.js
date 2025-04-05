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
const fs = require('fs');

class MevLoadBalancer {
  constructor() {
    // Карта для отслеживания MEV процессов
    // key = processId, value = { process, config, startTime, lastActivity, signals: [], status }
    this.mevProcesses = new Map();

    // Карта для отслеживания процессов токен-релиза
    // key = processId, value = true
    this.tokenReleaseProcesses = new Map();

    // Карта для отслеживания связи между токенами и процессами
    // key = tokenAddress, value = [processIds]
    this.tokenProcessMap = new Map();

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

      // Активируем балансировщик автоматически при запуске
      this.isActive = true;
      console.log('[MEV LoadBalancer] Балансировщик автоматически активирован при запуске');

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

    // Тестовый обработчик для проверки обработки сигналов
    ipcMain.handle('mev-loadbalancer:test-signal', async (event, testSignal) => {
      return this.testProcessSignal(testSignal);
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
      console.log(`[MEV LoadBalancer] Запуск MEV процесса с конфигурацией:`, JSON.stringify(config));

      // Получаем данные токена и пула
      const tokenAddress = config.tokenAddress;

      // Поддержка обратной совместимости (poolAddress -> meteoraPool)
      const meteoraPool = config.meteoraPool || config.poolAddress;
      const pumpSwapPool = config.pumpSwapPool;

      if (!tokenAddress || !meteoraPool) {
        throw new Error('Не указан адрес токена или пула Meteora в конфигурации');
      }

      // Проверяем ограничение на количество процессов для одного токена
      const existingProcesses = this.getProcessesForToken(tokenAddress);
      const isRestart = config.isRestart || config.isRestarted;

      // Проверяем, не превышено ли максимальное количество процессов для токена
      const MAX_PROCESSES_PER_TOKEN = 10;
      if (existingProcesses.length >= MAX_PROCESSES_PER_TOKEN && !isRestart) {
        console.warn(`[MEV LoadBalancer] Достигнут лимит процессов (${MAX_PROCESSES_PER_TOKEN}) для токена ${tokenAddress}`);
      }

      // Создаем уникальный ID для процесса
      const processId = `mev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      let mevConfig;
      let tomlFilePath = config.tomlFilePath;

      // Если предоставлен готовый TOML файл, используем его
      if (tomlFilePath) {
        console.log(`[MEV LoadBalancer] Используем предоставленный TOML файл: ${tomlFilePath}`);
        mevConfig = {
          tomlFilePath,
          taskId: processId
        };
      } else {
        // Иначе генерируем TOML файл с использованием новой или старой функции
        console.log(`[MEV LoadBalancer] Генерируем новый TOML файл`);

        // Определяем путь для сохранения TOML файла
        const targetDir = path.join(app.getPath("userData"), "mev-configs");
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Определяем, какую функцию использовать для генерации конфига
        if (config.meteoraPool !== undefined) {
          // Если есть meteoraPool, используем новую функцию
          const { generateSimpleMevConfig } = require('../utils/generateService');
          tomlFilePath = await generateSimpleMevConfig(
            targetDir,
            config,
            tokenAddress,
            meteoraPool,
            pumpSwapPool
          );
        } else {
          // Иначе пытаемся использовать старую функцию (для совместимости)
          const { generateMevConfig } = require('../utils/generateService');

          // Проверяем, есть ли у нас необходимые данные для старой функции
          // Если нет rowData, создаем заглушку
          if (!config.rowData && config.poolAddress) {
            console.log(`[MEV LoadBalancer] Используем совместимый режим для старой функции`);
            // Заглушка для совместимости со старой функцией
            config.tokensDirPath = config.tokensDirPath || path.join(app.getPath("userData"), "tokens");
            if (!fs.existsSync(config.tokensDirPath)) {
              fs.mkdirSync(config.tokensDirPath, { recursive: true });
            }
            throw new Error('Невозможно сгенерировать конфиг через старую функцию без rowData');
          }

          // Генерируем конфиг старым способом
          tomlFilePath = await generateMevConfig(
            targetDir,
            config.tokensDirPath || path.join(app.getPath("userData"), "tokens"),
            config,
            config.poolAddress
          );
        }

        if (!tomlFilePath) {
          throw new Error('Не удалось сгенерировать TOML файл для MEV конфигурации');
        }

        mevConfig = {
          tomlFilePath,
          taskId: processId
        };
      }

      // Запускаем MEV процесс с подготовленным конфигом
      console.log(`[MEV LoadBalancer] Запуск MEV процесса ${processId} с конфигом: ${JSON.stringify(mevConfig)}`);

      // Проверяем наличие userSettings
      if (!this.userSettings) {
        this.userSettings = await getSettings();
      }

      // Запускаем сам процесс
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
          ...mevConfig,
          meteoraPool, // обеспечиваем стандартизованные свойства
          pumpSwapPool
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
   * Обрабатывает логи процессов, ищет MEV сигналы
   * @param {Object} logData - Данные лога (processId, message, level)
   */
  handleProcessLog(logData) {
    try {
      if (!this.isActive) {
        console.log('[MEV LoadBalancer] Балансировщик неактивен, пропускаем лог');
        return;
      }

      const { processId, message, level, config } = logData;
      if (!processId || !message) {
        console.log('[MEV LoadBalancer] Получен некорректный лог без processId или message');
        return;
      }

      // Проверяем, принадлежит ли лог модулю MEV Module и стратегии check_migration
      if (config && (config.module_name !== 'MEV Module' || config.globalStrategy !== 'check_migration')) {
        // Лог от другого модуля или стратегии, игнорируем
        return;
      }

      console.log(`[MEV LoadBalancer] ПОЛУЧЕН ЛОГ от ${processId}: ${message.substring(0, 100)}...`);

      // Пропускаем логи от MEV процессов, чтобы избежать бесконечного цикла
      if (this.mevProcesses.has(processId)) {
        // Обновляем время последней активности процесса
        const processData = this.mevProcesses.get(processId);
        if (processData) {
          processData.lastActivity = Date.now();
        }
        console.log(`[MEV LoadBalancer] Это лог от MEV процесса ${processId}, пропускаем`);
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
        console.log(`[MEV LoadBalancer] Лог от процесса токен-релиза ${processId}: ${message.substring(0, 100)}...`);
      }

      // Проверяем наличие MEV сигнала в логе
      console.log(`[MEV LoadBalancer] Проверяем наличие MEV сигнала в логе: ${message.substring(0, 100)}...`);
      const signalData = this.parseLogForMevSignal(message);
      if (signalData) {
        console.log(`[MEV LoadBalancer] Обнаружен MEV сигнал в логе процесса ${processId}, данные:`, JSON.stringify(signalData));
        this.handleMevSignal(signalData, processId);
      } else {
        console.log(`[MEV LoadBalancer] MEV сигнал НЕ обнаружен в логе`);
      }
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при обработке лога процесса:', error);
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
      console.log(`[MEV LoadBalancer] Проверка на наличие '[PERFORM_MEV_ACTION]' в логе`);

      // Исследуем, какие строки вообще приходят
      if (logMessage.includes('[')) {
        const matches = logMessage.match(/\[(.*?)\]/g);
        if (matches && matches.length > 0) {
          console.log(`[MEV LoadBalancer] Найдены квадратные скобки в логе: ${JSON.stringify(matches)}`);
        }
      }

      if (!logMessage.includes('[PERFORM_MEV_ACTION]')) {
        console.log(`[MEV LoadBalancer] Маркер '[PERFORM_MEV_ACTION]' не найден в логе`);
        return null;
      }

      console.log(`[MEV LoadBalancer] Обнаружен возможный MEV сигнал: ${logMessage}`);

      // Извлекаем данные из сигнала
      return this.extractSignalDataFromText(logMessage);
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при парсинге лога:', error);
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

      console.log(`[MEV LoadBalancer] Ищем маркеры в сообщении, длина: ${logMessage.length}`);
      console.log(`[MEV LoadBalancer] Полный текст сообщения: ${logMessage}`);

      // Проверяем наличие маркеров в любом порядке и положении
      let startIndex = logMessage.indexOf(startMarker);
      let endIndex = logMessage.indexOf(endMarker, startIndex);

      // Если маркеры не найдены, пробуем искать без учёта регистра
      if (startIndex === -1) {
        console.log('[MEV LoadBalancer] Маркер PERFORM_MEV_ACTION не найден, пробуем искать без учёта регистра');
        startIndex = logMessage.toLowerCase().indexOf(startMarker.toLowerCase());
      }

      if (endIndex === -1) {
        console.log('[MEV LoadBalancer] Маркер END не найден, ищем до конца сообщения');
        endIndex = logMessage.length;
      }

      console.log(`[MEV LoadBalancer] Индексы маркеров: startIndex=${startIndex}, endIndex=${endIndex}`);

      if (startIndex === -1) {
        console.error('[MEV LoadBalancer] Не найден маркер начала сигнала в сообщении');
        return null;
      }

      // Извлекаем содержимое и удаляем лишние пробелы
      const content = logMessage
        .substring(startIndex + startMarker.length, endIndex)
        .trim();

      console.log(`[MEV LoadBalancer] Извлечено содержимое: "${content}"`);

      // Разделяем по символу | 
      const parts = content.split('|').map(s => s.trim());
      console.log(`[MEV LoadBalancer] Разделено по |: ${JSON.stringify(parts)}`);

      // Проверяем количество частей
      if (parts.length < 2) {
        console.error('[MEV LoadBalancer] Недостаточно параметров в сигнале, ожидается как минимум 2 (токен и пул)');
        return null;
      }

      // Извлекаем основные параметры
      const tokenAddress = parts[0];
      const meteoraPool = parts[1];

      // Извлекаем опциональный третий параметр (пул pumpSwap), если он есть
      const pumpSwapPool = parts.length > 2 ? parts[2] : null;

      console.log(`[MEV LoadBalancer] После обработки: tokenAddress="${tokenAddress}", meteoraPool="${meteoraPool}", pumpSwapPool="${pumpSwapPool || 'не указан'}"`);

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Не удалось извлечь токен или пул:', { tokenAddress, meteoraPool });
        return null;
      }

      console.log(`[MEV LoadBalancer] Успешно извлечены данные: Токен=${tokenAddress}, Пул=${meteoraPool}, PumpSwap=${pumpSwapPool || 'не указан'}`);

      return {
        tokenAddress,
        meteoraPool,
        pumpSwapPool,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при извлечении данных из сигнала:', error, error.stack);
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
      console.log(`[MEV LoadBalancer] =====================================================`);
      console.log(`[MEV LoadBalancer] НАЧАЛО ОБРАБОТКИ MEV сигнала от процесса ${sourceProcessId}`);
      console.log(`[MEV LoadBalancer] Данные сигнала:`, JSON.stringify(signal));
      console.log(`[MEV LoadBalancer] =====================================================`);

      // Увеличиваем счетчик обработанных сигналов
      this.stats.processedSignals++;

      // Проверяем необходимые данные в сигнале
      const tokenAddress = signal.tokenAddress;
      const meteoraPool = signal.meteoraPool || signal.poolAddress; // Поддержка обратной совместимости
      const pumpSwapPool = signal.pumpSwapPool || null;

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Сигнал не содержит необходимых данных (tokenAddress или meteoraPool/poolAddress)');
        this.stats.failedSignals++;
        return;
      }

      // Проверяем, есть ли существующие процессы для этого токена и сохраняем их конфигурации
      const existingProcesses = this.getProcessesForToken(tokenAddress);
      const savedConfigs = [];

      if (existingProcesses.length > 0) {
        console.log(`[MEV LoadBalancer] Найдены существующие процессы для токена ${tokenAddress}: ${existingProcesses.length} процессов`);

        for (const processId of existingProcesses) {
          if (this.mevProcesses.has(processId)) {
            const processData = this.mevProcesses.get(processId);

            // Сохраняем конфигурацию процесса
            savedConfigs.push({
              ...processData.config,
              originalProcessId: processId
            });

            // Останавливаем процесс
            await this.stopProcess(processId);
          }
        }

        console.log(`[MEV LoadBalancer] Остановлено ${savedConfigs.length} существующих процессов для токена ${tokenAddress}`);
      } else {
        console.log(`[MEV LoadBalancer] Не найдены существующие процессы для токена ${tokenAddress}`);
      }

      // Общее количество процессов, которые будут запущены
      const totalProcesses = savedConfigs.length + 1; // +1 для нового процесса

      // Расчет параметров балансировки нагрузки
      const MAX_REQUESTS_PER_SECOND = 170; // Максимальное количество запросов в секунду
      const requestsPerProcess = MAX_REQUESTS_PER_SECOND / totalProcesses;

      // Рассчитываем задержку для каждого процесса по формуле round(1000/requestsPerProcess) + 1
      const processDelay = Math.ceil(1000 / requestsPerProcess) + 1;

      console.log(`[MEV LoadBalancer] Расчет задержки: всего процессов ${totalProcesses}, запросов на процесс ${requestsPerProcess.toFixed(2)}, задержка ${processDelay}мс`);

      // Массив для хранения ID новых процессов
      const newProcessesIds = [];

      try {
        // Создаем директорию для TOML-файлов, если она не существует
        const targetDir = path.join(app.getPath("userData"), "mev-configs");
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Базовая конфигурация для MEV процесса
        const baseConfig = {
          tokenAddress,
          process_delay: processDelay,
          main_rpc: this.userSettings.rpcUrl || "http://rpc-lax-a.thornode.io/e711fbc80050bff888e8584d9e2521ca",
          useJito: true,
          jito_lower_bound: 100000,
          jito_upper_bound: 300000,
          taskId: Date.now() + "_" + Math.floor(Math.random() * 1000)
        };

        // Создаем новую конфигурацию процесса с НОВЫМ пулом и рассчитанной задержкой
        const newConfig = {
          ...baseConfig,
          meteoraPool,  // используем пул Meteora из сигнала
          pumpSwapPool, // используем пул PumpSwap из сигнала если он есть
          process_delay: processDelay  // Устанавливаем рассчитанную задержку
        };

        // Используем новую функцию для генерации конфига
        console.log(`[MEV LoadBalancer] Генерация конфига для нового процесса с пулами Meteora=${meteoraPool}, PumpSwap=${pumpSwapPool || 'не указан'}`);

        // Используем generateSimpleMevConfig для генерации конфига
        const { generateSimpleMevConfig } = require('../utils/generateService');
        const tomlFilePath = await generateSimpleMevConfig(
          targetDir,
          newConfig,
          tokenAddress,
          meteoraPool,
          pumpSwapPool
        );

        if (!tomlFilePath) {
          throw new Error('Не удалось сгенерировать TOML файл для MEV конфигурации');
        }

        // Запускаем новый MEV процесс с сгенерированным конфигом
        const newProcessId = await this.startMevProcess({
          ...newConfig,
          tomlFilePath
        });

        newProcessesIds.push(newProcessId);

        console.log(`[MEV LoadBalancer] Создан новый процесс ${newProcessId} для токена ${tokenAddress} с пулом ${meteoraPool}, задержка ${processDelay}мс`);

        // Перезапускаем существующие процессы с обновленной задержкой для балансировки нагрузки
        for (let i = 0; i < savedConfigs.length; i++) {
          const config = savedConfigs[i];

          // Используем оригинальный пул, но обновляем задержку
          const restartConfig = {
            ...baseConfig,
            meteoraPool: config.meteoraPool || config.poolAddress, // совместимость со старым форматом
            pumpSwapPool: config.pumpSwapPool, // может быть undefined
            process_delay: processDelay
          };

          console.log(`[MEV LoadBalancer] Генерация конфига для перезапуска процесса с оригинальным пулом: ${restartConfig.meteoraPool}`);

          // Также используем generateSimpleMevConfig для перезапуска
          const restartTomlFilePath = await generateSimpleMevConfig(
            targetDir,
            restartConfig,
            tokenAddress,
            restartConfig.meteoraPool,
            restartConfig.pumpSwapPool
          );

          if (!restartTomlFilePath) {
            console.error(`[MEV LoadBalancer] Не удалось сгенерировать TOML для перезапуска процесса`);
            continue;
          }

          // Запускаем процесс с обновленной конфигурацией
          const restartedProcessId = await this.startMevProcess({
            ...restartConfig,
            tomlFilePath: restartTomlFilePath
          });

          newProcessesIds.push(restartedProcessId);

          console.log(`[MEV LoadBalancer] Перезапущен процесс ${restartedProcessId} для токена ${tokenAddress} с оригинальным пулом, задержка ${processDelay}мс`);
        }

        // Отправляем уведомление в Telegram о всех запущенных процессах
        if (this.settings?.notifyTelegram) {
          // Детальная информация о балансировке
          const loadBalanceInfo =
            `Всего ${totalProcesses} процессов\n` +
            `Макс. запросов/сек: ${MAX_REQUESTS_PER_SECOND}\n` +
            `Запросов на процесс: ${requestsPerProcess.toFixed(2)}/сек\n` +
            `Задержка: ${processDelay}мс`;

          // Формируем информацию о запущенных процессах
          const newProcessInfo = `Создан новый процесс: ${newProcessesIds[0]}\n` +
            `Пул Meteora: ${meteoraPool}\n` +
            (pumpSwapPool ? `Пул PumpSwap: ${pumpSwapPool}\n` : '');

          // Формируем информацию о перезапущенных процессах с их оригинальными пулами
          let restartedProcessesInfo = '';
          if (savedConfigs.length > 0) {
            restartedProcessesInfo = `\nПерезапущены процессы с оригинальными пулами:\n`;
            for (let i = 0; i < savedConfigs.length; i++) {
              const processId = newProcessesIds[i + 1];
              const originalPool = savedConfigs[i].meteoraPool || savedConfigs[i].poolAddress || 'неизвестный пул';
              restartedProcessesInfo += `${processId} (пул: ${originalPool})\n`;
            }
          }

          const message = `🚀 MEV сигнал обработан:\n` +
            `Токен: ${tokenAddress}\n` +
            `Пул Meteora: ${meteoraPool}\n` +
            (pumpSwapPool ? `Пул PumpSwap: ${pumpSwapPool}\n` : '') +
            `\n⚖️ Балансировка нагрузки:\n${loadBalanceInfo}\n\n` +
            `🔄 Запущенные процессы:\n${newProcessInfo}${restartedProcessesInfo}`;

          telegramBotService.sendSystemNotification(message);
        }

        this.stats.successfulSignals++;
        this.stats.totalMevActions += totalProcesses;
      } catch (error) {
        console.error(`[MEV LoadBalancer] Ошибка при запуске процессов для токена ${tokenAddress}:`, error);
        this.stats.failedSignals++;

        // Отправляем уведомление об ошибке в Telegram
        if (this.settings?.notifyTelegram) {
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