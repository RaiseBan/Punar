/**
 * MEV LoadBalancer - Модуль балансировки нагрузки MEV процессов
 * 
 * Отвечает за обнаружение сигналов MEV в логах процессов, 
 * запуск MEV процессов и распределение нагрузки между ними.
 * Основной способ взаимодействия - через Telegram.
 */
const { ipcMain } = require('electron');
const path = require('path');
const { app } = require('electron');
const { spawnProcess, stopMevProcess } = require('../utils/spawnProcess');
const { generateSimpleMevConfig } = require('../utils/generateService');
const { getSettings } = require('../utils/fsHelper');
const telegramBotService = require('./telegramBotService');
const fs = require('fs');

// Директория для хранения логов
const LOG_DIR = path.join(app.getPath('userData'), 'logs');

// Создаем директорию для логов, если она не существует
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class MevLoadBalancer {
  constructor() {
    // Карта для отслеживания MEV процессов
    // key = processId, value = { process, config, startTime, lastActivity, status }
    this.mevProcesses = new Map();

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
      maxRequestsPerSecond: 170,  // Максимальное количество запросов в секунду
      notifyTelegram: true,        // Отправлять уведомления в Telegram
      autoStopIdleTime: 30 * 60 * 1000,  // 30 минут неактивности до остановки процесса
      logEnabled: true,            // Включить запись логов в файлы
      maxLogSizeInMB: 10           // Максимальный размер файла логов в МБ
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

      // Уведомляем о запуске в Telegram
      if (this.settings.notifyTelegram) {
        telegramBotService.sendSystemNotification('✅ MEV LoadBalancer запущен и готов к обработке сигналов');
      }

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
    ipcMain.handle('process-log', async (event, data) => {
      return this.handleProcessLog(data);
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
    ipcMain.on('mev-process-exit', (event, { processId, exitCode }) => {
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

      // Получаем глобальные настройки пользователя
      this.userSettings = await getSettings();

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
      activeTokens: this.tokenProcessMap.size,
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
        startTime: processData.startTime,
        lastActivity: processData.lastActivity || processData.startTime,
        tokenAddress: processData.config?.tokenAddress,
        meteoraPool: processData.config?.meteoraPool
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
      // Проверяем обязательные параметры
      const tokenAddress = config.tokenAddress;
      const meteoraPool = config.meteoraPool;
      const pumpSwapPool = config.pumpSwapPool || null;

      if (!tokenAddress || !meteoraPool) {
        console.error(`[MEV LoadBalancer] Не указаны обязательные параметры токена или пула.`);
        console.error(`[MEV LoadBalancer] Токен: ${tokenAddress}, пул: ${meteoraPool}`);
        return null;
      }

      // Генерируем уникальный ID для процесса
      const processId = `mev_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString().substring(8, 13)}`;

      // Формируем конфигурацию процесса
      const processConfig = {
        ...config,
        module_name: "mev_subtask",
        tokenAddress,
        meteoraPool,
        pumpSwapPool,
        task_name: config.task_name || `MEV Process ${processId}`,
      };

      console.log(`[MEV LoadBalancer] Запуск MEV процесса с конфигурацией:`, JSON.stringify(processConfig));

      // Путь к директории с MEV ботом
      const botDir = this.userSettings?.botDir || path.join(app.getPath('userData'), 'mev_bot');

      // Создаем TOML конфиг для MEV процесса
      const configPath = await generateSimpleMevConfig(
        botDir,
        processConfig,
        tokenAddress,
        meteoraPool,
        pumpSwapPool
      );

      if (!configPath) {
        console.error(`[MEV LoadBalancer] Не удалось создать конфигурационный файл для процесса ${processId}`);
        return null;
      }

      console.log(`[MEV LoadBalancer] Создан конфигурационный файл: ${configPath}`);

      // Отправка процесса на запуск
      const childProcess = await spawnProcess(processConfig, this.userSettings);

      if (!childProcess) {
        console.error(`[MEV LoadBalancer] Не удалось создать дочерний процесс для ${processId}`);
        return null;
      }

      console.log(`[MEV LoadBalancer] Успешно запущен MEV процесс ${processId}, PID: ${childProcess.pid}`);

      // Сохраняем информацию о процессе
      this.mevProcesses.set(processId, {
        pid: childProcess.pid,
        process: childProcess,
        startTime: Date.now(),
        status: 'running',
        lastActivity: Date.now(),
        config: processConfig
      });

      // Добавляем процесс в карту токенов
      if (!this.tokenProcessMap.has(tokenAddress)) {
        this.tokenProcessMap.set(tokenAddress, []);
      }

      this.tokenProcessMap.get(tokenAddress).push(processId);
      console.log(`[MEV LoadBalancer] Процесс ${processId} добавлен в карту токенов для ${tokenAddress}`);

      // Отправляем уведомление в Telegram
      if (this.settings.notifyTelegram) {
        const message = `🚀 Запущен MEV процесс\n` +
          `ID: ${processId}\n` +
          `Токен: ${tokenAddress}\n` +
          `Пул Meteora: ${meteoraPool}\n` +
          (pumpSwapPool ? `Пул PumpSwap: ${pumpSwapPool}\n` : '') +
          `Задержка: ${processConfig.process_delay}ms`;

        telegramBotService.sendSystemNotification(message);
      }

      return processId;
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при запуске MEV процесса:', error);

      if (this.settings.notifyTelegram) {
        telegramBotService.sendSystemNotification(`❌ Ошибка запуска MEV процесса: ${error.message}`);
      }

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
      await stopMevProcess(processId);

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

      // Отправляем уведомление в Telegram
      if (this.settings.notifyTelegram) {
        const message = `🛑 Процесс остановлен\n` +
          `ID: ${processId}\n` +
          (processData.config?.tokenAddress ? `Токен: ${processData.config.tokenAddress}\n` : '') +
          (processData.config?.meteoraPool ? `Пул: ${processData.config.meteoraPool}\n` : '') +
          `Время работы: ${Math.floor((Date.now() - processData.startTime) / 1000)}с`;

        telegramBotService.sendSystemNotification(message);
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

    // Отправляем уведомление в Telegram
    if (this.settings.notifyTelegram) {
      const runTime = Math.floor((processData.exitTime - processData.startTime) / 1000);
      const message = `⚠️ Процесс завершился\n` +
        `ID: ${processId}\n` +
        (processData.config?.tokenAddress ? `Токен: ${processData.config.tokenAddress}\n` : '') +
        `Код завершения: ${code}\n` +
        `Время работы: ${runTime}с`;

      telegramBotService.sendSystemNotification(message);
    }

    // Удаляем процесс из карты MEV процессов через 5 секунд (чтобы успеть получить логи)
    setTimeout(() => {
      this.mevProcesses.delete(processId);
      console.log(`[MEV LoadBalancer] Информация о MEV процессе ${processId} удалена`);
    }, 5000);
  }

  /**
   * Записывает лог процесса в файл
   * @param {string} processId - ID процесса
   * @param {string} message - Сообщение лога
   * @param {string} level - Уровень лога (info, error, warning)
   */
  writeProcessLog(processId, message, level = 'info') {
    try {
      // Если логирование отключено, выходим
      if (!this.settings.logEnabled) return;

      // Формируем имя файла логов
      const logFile = path.join(LOG_DIR, `mev_${processId}.log`);

      // Проверяем размер файла логов, чтобы предотвратить слишком большие файлы
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        const fileSizeInMB = stats.size / (1024 * 1024);

        // Если файл больше установленного лимита, обрезаем его или создаем новый
        if (fileSizeInMB > this.settings.maxLogSizeInMB) {
          // Создаем архивный файл с временной меткой
          const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
          const archiveFile = path.join(LOG_DIR, `mev_${processId}_${timestamp}.log.bak`);

          // Перемещаем текущий файл в архив
          fs.renameSync(logFile, archiveFile);

          // Запись о ротации логов
          const rotationMessage = `[${new Date().toISOString()}] [SYSTEM] Предыдущий файл логов превысил ${this.settings.maxLogSizeInMB}MB и был перемещен в ${archiveFile}\n`;
          fs.writeFileSync(logFile, rotationMessage, 'utf8');
        }
      }

      // Формируем строку лога с временной меткой
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

      // Записываем в файл
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error(`[MEV LoadBalancer] Ошибка при записи лога процесса ${processId}:`, error);
    }
  }

  /**
   * Возвращает последние N строк логов процесса
   * @param {string} processId - ID процесса
   * @param {number} lineCount - Количество строк для чтения (по умолчанию 100)
   * @returns {Promise<string[]>} Массив строк логов
   */
  async getProcessLogs(processId, lineCount = 100) {
    try {
      const logFile = path.join(LOG_DIR, `mev_${processId}.log`);

      if (!fs.existsSync(logFile)) {
        return [];
      }

      // Читаем весь файл и разбиваем на строки
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Возвращаем последние N строк
      return lines.slice(-lineCount);
    } catch (error) {
      console.error(`[MEV LoadBalancer] Ошибка при чтении логов процесса ${processId}:`, error);
      return [];
    }
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

      const { processId, message, level } = logData;
      if (!processId || !message) {
        return;
      }

      // Записываем лог в файл
      this.writeProcessLog(processId, message, level || 'info');

      // Пропускаем логи от MEV процессов, чтобы избежать бесконечного цикла
      if (this.mevProcesses.has(processId)) {
        // Обновляем время последней активности процесса
        const processData = this.mevProcesses.get(processId);
        if (processData) {
          processData.lastActivity = Date.now();

          // Если в логе есть ошибка, записываем её отдельно и уведомляем
          if (level === 'error' || message.includes('ERROR') || message.includes('error')) {
            this.writeProcessLog(processId, message, 'error');

            // Уведомляем об ошибке в Telegram, если это важно
            if (this.settings.notifyTelegram &&
              (message.includes('CRITICAL') || message.includes('FATAL'))) {
              telegramBotService.sendSystemNotification(
                `⚠️ Ошибка в процессе ${processId}:\n${message.substring(0, 200)}...`
              );
            }
          }
        }
        return;
      }

      // Проверяем наличие MEV сигнала в логе
      const signalData = this.parseLogForMevSignal(message);
      if (signalData) {
        console.log(`[MEV LoadBalancer] Обнаружен MEV сигнал в логе процесса ${processId}, данные:`, JSON.stringify(signalData));
        this.handleMevSignal(signalData, processId);
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
      if (!logMessage.includes('[PERFORM_MEV_ACTION]')) {
        return null;
      }

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

      let startIndex = logMessage.indexOf(startMarker);
      let endIndex = logMessage.indexOf(endMarker, startIndex);

      // Если маркер конца не найден, ищем до конца сообщения
      if (endIndex === -1) {
        endIndex = logMessage.length;
      }

      if (startIndex === -1) {
        return null;
      }

      // Извлекаем содержимое и удаляем лишние пробелы
      const content = logMessage
        .substring(startIndex + startMarker.length, endIndex)
        .trim();

      // Разделяем по символу | 
      const parts = content.split('|').map(s => s.trim());

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

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Не удалось извлечь токен или пул:', { tokenAddress, meteoraPool });
        return null;
      }

      return {
        tokenAddress,
        meteoraPool,
        pumpSwapPool,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при извлечении данных из сигнала:', error);
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

      // Шаг 1: Парсим данные сигнала
      const tokenAddress = signal.tokenAddress;
      const meteoraPool = signal.meteoraPool;
      const pumpSwapPool = signal.pumpSwapPool || null;

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Сигнал не содержит необходимых данных (tokenAddress или meteoraPool)');
        this.stats.failedSignals++;
        return;
      }

      // Шаг 2: Получаем список существующих процессов для данного токена
      const existingProcesses = this.getProcessesForToken(tokenAddress);
      console.log(`[MEV LoadBalancer] Найдено ${existingProcesses.length} существующих процессов для токена ${tokenAddress}`);

      // Сохраняем конфигурации существующих процессов для последующего перезапуска
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

      // Шаг 3: Останавливаем все существующие процессы для данного токена
      for (const processId of existingProcesses) {
        console.log(`[MEV LoadBalancer] Останавливаем существующий процесс ${processId} для токена ${tokenAddress}`);
        await this.stopProcess(processId);
      }

      // Шаг 4: Рассчитываем параметр задержки для новой конфигурации процессов
      const maxRequestsPerSecond = this.settings.maxRequestsPerSecond; // 170 по умолчанию
      const totalProcesses = existingConfigs.length + 1; // Существующие + новый процесс
      const requestsPerProcess = Math.floor(maxRequestsPerSecond / totalProcesses);

      // Рассчитываем задержку по формуле: round(1000/requestsPerProcess) + 1
      const processDelay = Math.ceil(1000 / requestsPerProcess) + 1;

      console.log(`[MEV LoadBalancer] Расчет задержки: totalProcesses=${totalProcesses}, requestsPerProcess=${requestsPerProcess}, processDelay=${processDelay}ms`);

      // Шаг 5: Создаем базовую конфигурацию для MEV процессов
      const baseConfig = {
        tokenAddress: tokenAddress,
        main_rpc: this.userSettings?.rpcUrl || "https://api.mainnet-beta.solana.com",
        useJito: true, // Используем Jito по умолчанию
        jito_lower_bound: 100000,
        jito_upper_bound: 200000,
        process_delay: processDelay // Используем рассчитанную задержку
      };

      // Шаг 6: Создаем новую конфигурацию для нового процесса с новым пулом
      const newConfig = {
        ...baseConfig,
        meteoraPool,
        pumpSwapPool,
        task_name: `MEV_${tokenAddress.substring(0, 6)}_${Date.now().toString().substring(8, 13)}`
      };

      // Шаг 7: Запускаем новый процесс
      console.log(`[MEV LoadBalancer] Запускаем новый MEV процесс с параметрами:`, JSON.stringify(newConfig));
      const newProcessId = await this.startMevProcess(newConfig);

      if (!newProcessId) {
        throw new Error('Не удалось запустить новый MEV процесс');
      }

      console.log(`[MEV LoadBalancer] Успешно запущен новый MEV процесс: ${newProcessId}`);

      // Шаг 8: Перезапускаем существующие процессы с обновленными конфигами (обновленная задержка)
      const restartedProcessIds = [];
      for (const config of existingConfigs) {
        // Обновляем только параметр задержки, сохраняя остальные настройки
        const restartConfig = {
          ...config,
          process_delay: processDelay,
          task_name: `MEV_${tokenAddress.substring(0, 6)}_restart_${Date.now().toString().substring(8, 13)}`
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

      // Шаг 9: Обновляем статистику и отправляем уведомление в Telegram
      this.stats.totalMevActions += totalProcesses;
      this.stats.successfulSignals++;

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

        const message = `🚀 MEV сигнал обработан\n` +
          `Токен: ${tokenAddress}\n` +
          `\n⚖️ Параметры балансировки:\n` +
          `Всего процессов: ${totalProcesses}\n` +
          `Задержка: ${processDelay}ms\n` +
          `Запросы/сек на процесс: ${requestsPerProcess}\n` +
          `\n📊 Процессы:\n${processInfo}${restartedInfo}`;

        telegramBotService.sendSystemNotification(message);
      }

      return {
        newProcessId,
        restartedProcessIds: restartedProcessIds.map(x => x.processId),
        processDelay
      };
    } catch (error) {
      console.error('[MEV LoadBalancer] Ошибка при обработке MEV сигнала:', error);
      this.stats.failedSignals++;

      // Отправляем уведомление об ошибке в Telegram
      if (this.settings.notifyTelegram) {
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