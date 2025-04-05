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
   * @returns {Promise<string|null>} - ID процесса или null в случае ошибки
   */
  async startMevProcess(config) {
    try {
      const { tokenAddress, meteoraPool, pumpSwapPool, process_delay = 300 } = config;

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Не указаны обязательные параметры для MEV процесса', { tokenAddress, meteoraPool });
        return null;
      }

      // Создаем уникальный ID для процесса
      const processId = `mev_${tokenAddress.substring(0, 8)}_${Date.now().toString().substring(8, 13)}`;

      console.log(`[MEV LoadBalancer] Инициализация MEV процесса ${processId} с задержкой ${process_delay}ms`);

      // Проверяем наличие userSettings
      if (!this.userSettings) {
        console.log('[MEV LoadBalancer] Загружаем userSettings');
        this.userSettings = await getSettings();
      }

      if (!this.userSettings) {
        console.error('[MEV LoadBalancer] Не удалось загрузить настройки пользователя');
        return null;
      }

      // Формируем конфигурацию для процесса
      const processConfig = {
        module_name: "mev_subtask",
        task_name: config.task_name || `mev_task_${Date.now().toString().substring(8, 13)}`,
        tokenAddress: tokenAddress,
        meteoraPool: meteoraPool,
        pumpSwapPool: pumpSwapPool,
        process_delay: process_delay,
        main_rpc: config.main_rpc || this.userSettings?.rpcUrl || "https://api.mainnet-beta.solana.com",
        useJito: config.useJito !== undefined ? config.useJito : true,
        jito_lower_bound: config.jito_lower_bound || 100000,
        jito_upper_bound: config.jito_upper_bound || 200000
      };

      console.log(`[MEV LoadBalancer] Запуск MEV процесса с конфигурацией:`, JSON.stringify(processConfig));

      // Отправка процесса на запуск - передаем userSettings
      const childProcess = await spawnProcess(processConfig, this.userSettings);

      if (!childProcess) {
        console.error(`[MEV LoadBalancer] Не удалось создать дочерний процесс для ${processId}`);
        return null;
      }

      console.log(`[MEV LoadBalancer] Успешно запущен MEV процесс ${processId}`);

      // Сохраняем информацию о процессе
      this.mevProcesses.set(processId, {
        pid: childProcess.pid,
        tokenAddress,
        meteoraPool,
        pumpSwapPool,
        process: childProcess,
        startTime: Date.now(),
        status: 'running',
        lastActivity: Date.now(),
        signals: [],
        config: processConfig
      });

      // Добавляем процесс в карту токенов
      if (!this.tokenProcessMap.has(tokenAddress)) {
        this.tokenProcessMap.set(tokenAddress, []);
      }

      this.tokenProcessMap.get(tokenAddress).push(processId);
      console.log(`[MEV LoadBalancer] Процесс ${processId} добавлен в карту токенов для ${tokenAddress}`);

      // Если отслеживаем в окне, отправляем уведомление о запуске процесса
      try {
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("process-started", {
            taskId: processId,
            config: processConfig
          });
          console.log(`[MEV LoadBalancer] Отправлено уведомление о запуске процесса ${processId} в окно приложения`);
        }
      } catch (notifyError) {
        console.error(`[MEV LoadBalancer] Ошибка при отправке уведомления:`, notifyError);
      }

      this.stats.totalProcesses++;

      return processId;
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при запуске MEV процесса:', error, error.stack);
      return null;
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

      // Шаг 1: Получить сигнал - уже получен

      // Шаг 2: Парсим 3 значения
      const tokenAddress = signal.tokenAddress;
      const meteoraPool = signal.meteoraPool;
      const pumpSwapPool = signal.pumpSwapPool || null;

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Сигнал не содержит необходимых данных (tokenAddress или meteoraPool)');
        this.stats.failedSignals++;
        return;
      }

      console.log(`[MEV LoadBalancer] Обработка сигнала: token=${tokenAddress}, meteoraPool=${meteoraPool}, pumpSwapPool=${pumpSwapPool || 'не указан'}`);

      // Шаг 3: Останавливаем все связанные процессы
      // Собираем существующие конфигурации для последующего перезапуска
      const existingProcesses = this.getProcessesForToken(tokenAddress);
      console.log(`[MEV LoadBalancer] Найдено ${existingProcesses.length} существующих процессов для токена ${tokenAddress}`);

      // Сохраняем конфигурации существующих процессов
      const existingConfigs = [];
      for (const processId of existingProcesses) {
        if (this.mevProcesses.has(processId)) {
          const processData = this.mevProcesses.get(processId);
          existingConfigs.push({
            ...processData.config,
            originalProcessId: processId
          });
        }
      }

      // Останавливаем все существующие процессы для этого токена
      for (const processId of existingProcesses) {
        console.log(`[MEV LoadBalancer] Останавливаем существующий процесс ${processId} для токена ${tokenAddress}`);
        await this.stopProcess(processId);
      }

      // Шаг 4: Пересчитываем параметр задержки
      const maxRequestsPerSecond = 170; // Максимальное количество запросов в секунду для всех процессов вместе

      // Общее количество процессов, которые будут запущены (существующие + новый)
      const totalProcesses = existingConfigs.length + 1;

      // Расчитываем запросы и задержку для каждого процесса
      const requestsPerProcess = Math.ceil(maxRequestsPerSecond / totalProcesses);
      const processDelay = Math.ceil(1000 / requestsPerProcess) + 1;

      console.log(`[MEV LoadBalancer] Расчет задержки: totalProcesses=${totalProcesses}, requestsPerProcess=${requestsPerProcess}, processDelay=${processDelay}ms`);

      // Базовая конфигурация для MEV процесса
      const baseConfig = {
        tokenAddress: tokenAddress,
        main_rpc: this.userSettings?.rpcUrl || "https://api.mainnet-beta.solana.com",
        useJito: true,
        jito_lower_bound: 100000,
        jito_upper_bound: 200000,
        process_delay: processDelay
      };

      // Шаг 6: Создаем конфиг для НОВОГО процесса
      const newConfig = {
        ...baseConfig,
        meteoraPool,
        pumpSwapPool,
        task_name: `mev_task_${Date.now().toString().substring(8, 13)}`
      };

      // Шаг 7: Запускаем новый процесс
      console.log(`[MEV LoadBalancer] Запускаем новый MEV процесс с параметрами:`, JSON.stringify(newConfig));
      const newProcessId = await this.startMevProcess(newConfig);

      if (!newProcessId) {
        throw new Error('Не удалось запустить новый MEV процесс');
      }

      console.log(`[MEV LoadBalancer] Успешно запущен новый MEV процесс: ${newProcessId}`);

      // Шаг 5 и 7: Перезапускаем существующие процессы с обновленными конфигами
      const restartedProcessIds = [];
      for (const config of existingConfigs) {
        // Меняем только параметр задержки, сохраняя все остальные настройки
        const restartConfig = {
          ...config,
          process_delay: processDelay,
          task_name: `mev_restart_${Date.now().toString().substring(8, 13)}`
        };

        console.log(`[MEV LoadBalancer] Перезапускаем процесс с оригинальным пулом: ${restartConfig.meteoraPool}`);
        const restartedProcessId = await this.startMevProcess(restartConfig);
        if (restartedProcessId) {
          restartedProcessIds.push({
            processId: restartedProcessId,
            meteoraPool: restartConfig.meteoraPool || "Неизвестно"
          });
        }
      }

      // Статистика и уведомления
      this.stats.totalMevActions += totalProcesses;

      if (this.settings.notifyTelegram) {
        // Информация о новом процессе
        let processInfo = `Новый процесс: ${newProcessId}\n` +
          `Пул Meteora: ${meteoraPool}\n` +
          (pumpSwapPool ? `Пул PumpSwap: ${pumpSwapPool}\n` : '');

        // Информация о перезапущенных процессах
        let restartedInfo = '';
        if (restartedProcessIds.length > 0) {
          restartedInfo = `\nПерезапущенные процессы (${restartedProcessIds.length}):\n`;
          for (const { processId, meteoraPool } of restartedProcessIds) {
            restartedInfo += `- ${processId} (пул: ${meteoraPool})\n`;
          }
        }

        const message = `🚀 MEV сигнал обработан:\n` +
          `Токен: ${tokenAddress}\n` +
          `\n⚖️ Параметры балансировки:\n` +
          `Всего процессов: ${totalProcesses}\n` +
          `Задержка: ${processDelay}ms\n` +
          `Запросы/сек на процесс: ${requestsPerProcess}\n` +
          `\n📊 Процессы:\n${processInfo}${restartedInfo}`;

        telegramBotService.sendSystemNotification(message);
      }

      this.stats.successfulSignals++;
      return {
        newProcessId,
        restartedProcessIds: restartedProcessIds.map(x => x.processId),
        processDelay
      };
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при обработке MEV сигнала:', error);
      this.stats.failedSignals++;

      // Отправляем уведомление об ошибке в Telegram
      if (this.settings?.notifyTelegram) {
        const errorMessage = `❌ Ошибка обработки MEV сигнала:\n` +
          `Ошибка: ${error.message}`;

        telegramBotService.sendSystemNotification(errorMessage);
      }

      throw error;
    }
  }

}

// Создаем и экспортируем экземпляр MEV LoadBalancer
const mevLoadBalancer = new MevLoadBalancer();
module.exports = mevLoadBalancer;