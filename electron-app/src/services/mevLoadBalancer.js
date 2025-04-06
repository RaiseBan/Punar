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
const { sleep } = require('../utils/solanaUtils');

class MevLoadBalancer {
  constructor() {
    // Карта для отслеживания MEV процессов
    // key = processId, value = { process, config, startTime, lastActivity, signals: [], status }
    this.mevProcesses = new Map();

    // Карта для отслеживания процессов токен-релиза
    // key = processId, value = true
    this.tokenReleaseProcesses = new Map();

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
      console.log(`FROM IPC HANDLER`)
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
   * @returns {Promise<string|null>} - ID процесса или null в случае ошибки
   */
  async startMevProcess(config) {
    try {
      // Проверяем обязательные параметры
      const tokenAddress = config.tokenAddress;
      const meteoraPool = config.meteoraPool || config.poolAddress;
      let pumpSwapPool = config.pumpSwapPool || null;

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

      // Отправка процесса на запуск - передаем userSettings
      const childProcess = await spawnProcess(processConfig, this.userSettings);

      if (!childProcess) {
        console.error(`[MEV LoadBalancer] Не удалось создать дочерний процесс для ${processId}`);
        return null;
      }

      console.log(`[MEV LoadBalancer] Успешно запущен MEV процесс ${processId}`);

      // Добавляем обработчики для логирования вывода процесса (ПОТОМ УБРАТЬ консольный вывод)
      console.log(`[MEV LoadBalancer] (ПОТОМ УБРАТЬ) Настраиваем перехват вывода для процесса ${processId}`);

      // Обработка стандартного вывода (stdout)
      childProcess.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          // // Временно выводим в консоль для отладки (ПОТОМ УБРАТЬ)
          console.log(`[MEV LoadBalancer] (ПОТОМ УБРАТЬ) MEV ПРОЦЕСС ${processId} (PID: ${childProcess.pid}) STDOUT: ${output}`);

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
        console.log(`[MEV LoadBalancer] (ПОТОМ УБРАТЬ) MEV ПРОЦЕСС ${processId} (PID: ${childProcess.pid}) завершился с кодом ${code}`);

        // Записываем информацию о завершении в лог
        this.writeProcessLog(processId, `Процесс завершен с кодом ${code}`, code === 0 ? 'info' : 'error');

        // Обновляем статус процесса
        this.handleProcessExit(processId, code);
      });

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

      // Создаем числовой ID для React UI
      const numericTaskId = Date.now() + Math.floor(Math.random() * 1000);

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

        console.log(`[MEV LoadBalancer] Все слушатели событий удалены для процесса ${processId} после завершения`);
      } catch (listenerError) {
        console.error(`[MEV LoadBalancer] Ошибка при удалении слушателей для процесса ${processId}:`, listenerError);
      }
    }

    // Обновляем статус процесса
    processData.status = 'stopped';
    processData.exitCode = code;
    processData.exitTime = Date.now();

    // Удаляем процесс из карты MEV процессов сразу
    this.mevProcesses.delete(processId);
    console.log(`[MEV LoadBalancer] Информация о MEV процессе ${processId} удалена`);
  }

  /**
   * Записывает логи процесса в файл
   * @param {string} processId - Идентификатор процесса
   * @param {string} message - Сообщение для записи
   * @param {string} level - Уровень логирования (info, error, warning)
   */
  writeProcessLog(processId, message, level = 'info') {
    try {
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

      // Для отладки (ПОТОМ УБРАТЬ)
      console.log(`[MEV LoadBalancer] (ПОТОМ УБРАТЬ) Записана запись в лог ${processId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    } catch (error) {
      console.error(`[MEV LoadBalancer] Ошибка при записи лога для процесса ${processId}:`, error);
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
        console.log(`[MEV LoadBalancer] Файл логов не найден для процесса ${processId}: ${logFilePath}`);
        return [];
      }

      // Читаем содержимое файла
      const content = fs.readFileSync(logFilePath, 'utf8');

      // Разбиваем на строки и фильтруем пустые
      const lines = content.split('\n').filter(line => line.trim());

      // Возвращаем последние N строк
      return lines.slice(-lineCount);
    } catch (error) {
      console.error(`[MEV LoadBalancer] Ошибка при получении логов процесса ${processId}:`, error);
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
    const TOTAL_REQUESTS_PER_SECOND = 170;

    // Расчет запросов в секунду на процесс
    const requestsPerProcess = TOTAL_REQUESTS_PER_SECOND / processCount;

    // Расчет задержки по формуле: Math.ceil(1000 / requestsPerProcess) + 1
    const delay = Math.ceil(1000 / requestsPerProcess) + 1;

    console.log(`[MEV LoadBalancer] Расчет задержки: ${TOTAL_REQUESTS_PER_SECOND} req/s / ${processCount} процессов = ${requestsPerProcess} req/s на процесс`);
    console.log(`[MEV LoadBalancer] Итоговая задержка: ${delay}ms`);

    return delay;
  }

  /**
   * Обрабатывает MEV сигнал
   * @param {Object} signal - Данные сигнала (tokenAddress, meteoraPool, pumpSwapPool)
   * @param {string} sourceProcessId - ID процесса, от которого получен сигнал
   * @returns {Promise<Object>} - Результат обработки сигнала
   */
  async handleMevSignal(signal, sourceProcessId) {
    try {
      console.log(`[MEV LoadBalancer] =====================================================`);
      console.log(`[MEV LoadBalancer] НАЧАЛО ОБРАБОТКИ MEV сигнала от процесса ${sourceProcessId}`);
      console.log(`[MEV LoadBalancer] Данные сигнала:`, JSON.stringify(signal));
      console.log(`[MEV LoadBalancer] =====================================================`);

      // Увеличиваем счетчик обработанных сигналов
      this.stats.processedSignals++;

      // Шаг 1: Получаем данные из сигнала
      const tokenAddress = signal.tokenAddress;
      const meteoraPool = signal.meteoraPool;
      const pumpSwapPool = signal.pumpSwapPool || null;

      if (!tokenAddress || !meteoraPool) {
        console.error('[MEV LoadBalancer] Сигнал не содержит необходимых данных (tokenAddress или meteoraPool)');
        this.stats.failedSignals++;
        return {
          success: false,
          error: 'Неполные данные сигнала'
        };
      }

      console.log(`[MEV LoadBalancer] Обработка сигнала: token=${tokenAddress}, meteoraPool=${meteoraPool}, pumpSwapPool=${pumpSwapPool || 'не указан'}`);

      // Шаг 2: Сохраняем текущие процессы для последующего перезапуска
      const currentProcesses = Array.from(this.mevProcesses.entries());
      console.log(`[MEV LoadBalancer] Текущее количество процессов: ${currentProcesses.length}`);

      // Шаг 3: Рассчитываем новую задержку для всех процессов (текущие + новый)
      const newProcessCount = currentProcesses.length + 1;
      const processDelay = this.calculateProcessDelay(newProcessCount);
      console.log(`[MEV LoadBalancer] Рассчитана новая задержка ${processDelay}ms для ${newProcessCount} процессов`);

      // Шаг 4: Сохраняем конфигурации текущих процессов
      const processConfigs = [];
      for (const [processId, processData] of currentProcesses) {
        // Сохраняем конфигурацию процесса с обновленной задержкой
        const config = { ...processData.config, process_delay: processDelay };
        processConfigs.push({ processId, config });

        // Останавливаем текущий процесс
        console.log(`[MEV LoadBalancer] Останавливаем процесс ${processId} для перезапуска с новой задержкой`);
        await this.stopProcess(processId);
        await sleep(10000);
      }

      // Шаг 5: Базовая конфигурация для нового MEV процесса
      const baseConfig = {
        tokenAddress: tokenAddress,
        main_rpc: this.userSettings?.rpcUrl || "https://api.mainnet-beta.solana.com",
        useJito: true,
        jito_lower_bound: 100000,
        jito_upper_bound: 200000,
        process_delay: processDelay
      };

      // Шаг 6: Создаем конфиг для нового процесса
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

      // Шаг 8: Перезапускаем все сохраненные процессы с новой задержкой
      const restartedProcesses = [];
      for (const { config } of processConfigs) {
        console.log(`[MEV LoadBalancer] Перезапуск процесса с обновленной задержкой ${processDelay}ms`);
        const restartedProcessId = await this.startMevProcess(config);
        if (restartedProcessId) {
          restartedProcesses.push(restartedProcessId);
        }
      }

      console.log(`[MEV LoadBalancer] Перезапущено ${restartedProcesses.length} из ${processConfigs.length} процессов`);

      // Статистика и уведомления
      this.stats.totalMevActions++;

      if (this.settings.notifyTelegram) {
        // Информация о процессах
        let processesInfo = `Новый процесс: ${newProcessId}\n`;

        if (restartedProcesses.length > 0) {
          processesInfo += `Перезапущенные процессы: ${restartedProcesses.join(', ')}\n`;
        }

        processesInfo += `Всего процессов: ${newProcessCount}\n`;
        processesInfo += `Пул Meteora: ${meteoraPool}\n`;
        if (pumpSwapPool) {
          processesInfo += `Пул PumpSwap: ${pumpSwapPool}\n`;
        }

        const message = `🚀 MEV сигнал обработан:\n` +
          `Токен: ${tokenAddress}\n` +
          `\n⚖️ Параметры:\n` +
          `Задержка: ${processDelay}ms\n` +
          `\n📊 Процессы:\n${processesInfo}`;

        telegramBotService.sendSystemNotification(message);
      }

      this.stats.successfulSignals++;
      return {
        success: true,
        newProcessId,
        processDelay,
        restartedProcesses
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

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Отправляет задачу в обработчик
   * @param {Object} taskConfig - Конфигурация задачи
   * @returns {Promise<boolean>} - Успешность отправки
   */
  async sendTaskToHandler(taskConfig) {
    console.log('[MEV LoadBalancer] Отправка задачи в обработчик:', taskConfig);
    // Реализация опущена для примера
    return true;
  }
}

// Создаем и экспортируем экземпляр MEV LoadBalancer
const mevLoadBalancer = new MevLoadBalancer();
module.exports = mevLoadBalancer;