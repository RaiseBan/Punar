/**
 * LoggerService - унифицированный сервис логирования для electron-приложения
 *
 * Поддерживает разные модули и уровни логирования.
 * Выводит информацию в консоль с временной меткой и цветовым форматированием.
 */

import { EventBus, PROCESS_EVENTS, SYSTEM_EVENTS, SystemErrorEvent } from '../../../shared/eventBus';

// Константы для уровней логирования
const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
};

// Константы для модулей
const LOG_MODULES = {
    SYSTEM: 'SYSTEM',
    MEV_LOAD_BALANCER: 'MEV_LOAD_BALANCER',
    TELEGRAM_SERVICE: 'TELEGRAM_SERVICE',
    SPAWN_PROCESS: 'SPAWN_PROCESS',
    WEB_SERVER: 'WEB_SERVER',
    ELECTRON: 'ELECTRON',
    TOKEN_RELEASE: 'TOKEN_RELEASE',
    API_SERVICE: 'API_SERVICE',
    CONFIG_SERVICE: 'CONFIG_SERVICE',
    JITO: "JITO",
    CLEANING_POOLS: "CLEANING_POOLS",
    EVENT_BUS: "EVENT_BUS" // Новый модуль для EventBus
};

// Расширенная цветовая палитра для консоли
const COLORS = {
    // Базовые цвета
    RESET: '\x1b[0m',
    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',

    // Яркие цвета
    BRIGHT_BLACK: '\x1b[90m',
    BRIGHT_RED: '\x1b[91m',
    BRIGHT_GREEN: '\x1b[92m',
    BRIGHT_YELLOW: '\x1b[93m',
    BRIGHT_BLUE: '\x1b[94m',
    BRIGHT_MAGENTA: '\x1b[95m',
    BRIGHT_CYAN: '\x1b[96m',
    BRIGHT_WHITE: '\x1b[97m',

    // Фоновые цвета
    BG_BLACK: '\x1b[40m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    BG_WHITE: '\x1b[47m',

    // Стили текста
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m',
    UNDERLINE: '\x1b[4m',

    // Цвета для разных уровней логирования
    LEVEL: {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m', // Red
        FATAL: '\x1b[91m', // Bright Red
    },

    // Цвета для разных модулей
    MODULE: {
        SYSTEM: '\x1b[35m',              // Magenta
        MEV_LOAD_BALANCER: '\x1b[94m',   // Bright Blue
        TELEGRAM_SERVICE: '\x1b[96m',    // Bright Cyan
        SPAWN_PROCESS: '\x1b[93m',       // Bright Yellow
        WEB_SERVER: '\x1b[92m',          // Bright Green
        ELECTRON: '\x1b[95m',            // Bright Magenta
        TOKEN_RELEASE: '\x1b[36m',       // Cyan
        API_SERVICE: '\x1b[34m',         // Blue
        CONFIG_SERVICE: '\x1b[33m',      // Yellow
        JITO: '\x1b[91m',                // Bright Red
        CLEANING_POOLS: '\x1b[32m',      // Green
        EVENT_BUS: '\x1b[96m',           // Bright Cyan
    }
};

// Минимальный уровень логирования (по умолчанию все логи выводятся)
let minimumLogLevel = LOG_LEVELS.DEBUG;

// Шаблоны для форматирования
const TEMPLATES = {
    timestamp: (timestamp: any) => `${COLORS.BRIGHT_BLACK}[${timestamp}]${COLORS.RESET}`,
    level: (level: any) => `${COLORS.LEVEL[level]}[${level}]${COLORS.RESET}`,
    module: (module: any) => `${COLORS.MODULE[module]}[${module}]${COLORS.RESET}`,
    success: (msg: any) => `${COLORS.BRIGHT_GREEN}✓ ${msg}${COLORS.RESET}`,
    failure: (msg: any) => `${COLORS.BRIGHT_RED}✗ ${msg}${COLORS.RESET}`,
    highlight: (msg: any) => `${COLORS.BOLD}${msg}${COLORS.RESET}`,
    value: (val: any) => `${COLORS.BRIGHT_CYAN}${val}${COLORS.RESET}`
};

class LoggerService {
    LOG_LEVELS = LOG_LEVELS;
    LOG_MODULES = LOG_MODULES;
    TEMPLATES = TEMPLATES;
    COLORS = COLORS;

    private eventBusInitialized = false;

    constructor() {}

    /**
     * Инициализация подписок на EventBus
     * Вызывается один раз при старте приложения
     */
    initializeEventBusListeners(): void {
        if (this.eventBusInitialized) {
            this.warn(LOG_MODULES.EVENT_BUS, 'EventBus listeners уже инициализированы');
            return;
        }

        this.info(LOG_MODULES.EVENT_BUS, 'Инициализация подписок на события EventBus...');

        // Подписываемся на события запуска процессов
        EventBus.on(PROCESS_EVENTS.STARTED, (data) => {
            // Type assertion для доступа к специфичным свойствам ProcessStartedEvent
            const eventData = data as any;
            this.info(
                LOG_MODULES.EVENT_BUS,
                `▶️ Процесс запущен: Task ${TEMPLATES.value(eventData.taskId)}, Модуль: ${TEMPLATES.highlight(eventData.moduleName)}`
            );
        });

        // Подписываемся на события остановки процессов
        EventBus.on(PROCESS_EVENTS.STOPPED, (data) => {
            const eventData = data as any;
            const exitCodeColor = eventData.exitCode === 0 ? COLORS.BRIGHT_GREEN : COLORS.BRIGHT_RED;
            this.info(
                LOG_MODULES.EVENT_BUS,
                `⏹️ Процесс остановлен: Task ${TEMPLATES.value(eventData.taskId)}, Код: ${exitCodeColor}${eventData.exitCode}${COLORS.RESET}`
            );
        });

        // Подписываемся на события краша процессов
        EventBus.on(PROCESS_EVENTS.CRASHED, (data) => {
            const eventData = data as any;
            this.error(
                LOG_MODULES.EVENT_BUS,
                `💥 Процесс упал: Task ${TEMPLATES.value(eventData.taskId)}`
            );
        });

        // Подписываемся на системные ошибки
        EventBus.on(SYSTEM_EVENTS.ERROR_OCCURRED, (data) => {
            // Type assertion для SystemErrorEvent
            const errorData = data as SystemErrorEvent;
            this.error(
                LOG_MODULES.EVENT_BUS,
                `Системная ошибка [${errorData.code}]: ${errorData.message}`,
                errorData.details
            );
        });

        // Подписываемся на предупреждения
        EventBus.on(SYSTEM_EVENTS.WARNING_OCCURRED, (data) => {
            // Type assertion для SystemErrorEvent (WARNING использует ту же структуру)
            const warningData = data as SystemErrorEvent;
            this.warn(
                LOG_MODULES.EVENT_BUS,
                `Предупреждение [${warningData.code}]: ${warningData.message}`,
                warningData.details
            );
        });

        this.eventBusInitialized = true;
        this.success(LOG_MODULES.EVENT_BUS, 'Подписки на EventBus успешно инициализированы');
    }

    /**
     * Устанавливает минимальный уровень логирования
     * @param {string} level - Уровень логирования из LOG_LEVELS
     */
    setMinimumLogLevel(level: any): void {
        if (LOG_LEVELS[level]) {
            minimumLogLevel = LOG_LEVELS[level];
            this.info(LOG_MODULES.SYSTEM, `Установлен минимальный уровень логирования: ${TEMPLATES.highlight(minimumLogLevel)}`);
        } else {
            this.warn(LOG_MODULES.SYSTEM, `Некорректный уровень логирования: ${level}`);
        }
    }

    /**
     * Проверяет, должно ли логироваться сообщение данного уровня
     * @param {string} level - Проверяемый уровень
     * @returns {boolean} - true, если сообщение должно быть залогировано
     */
    private shouldLog(level: any): boolean {
        const levels = Object.values(LOG_LEVELS);
        const currentLevelIndex = levels.indexOf(level);
        const minLevelIndex = levels.indexOf(minimumLogLevel);

        return currentLevelIndex >= minLevelIndex;
    }

    /**
     * Основная функция логирования
     * @param {string} level - Уровень из LOG_LEVELS
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение для логирования
     * @param {Object} [data] - Дополнительные данные для вывода
     */
    private log(level: any, module: any, message: string, data: any = null): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const formattedTimestamp = TEMPLATES.timestamp(timestamp);
        const formattedLevel = TEMPLATES.level(level);
        const formattedModule = TEMPLATES.module(module);

        const logMessage = `${formattedTimestamp} ${formattedLevel} ${formattedModule} ${message}`;
        console.log(logMessage);

        if (data !== null) {
            console.log(`${COLORS.DIM}Data:${COLORS.RESET}`, data);
        }
    }

    /**
     * Вывод отладочной информации
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    debug(module: any, message: string, data: any = null): void {
        this.log(LOG_LEVELS.DEBUG, module, message, data);
    }

    /**
     * Вывод информационного сообщения
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    info(module: any, message: string, data: any = null): void {
        this.log(LOG_LEVELS.INFO, module, message, data);
    }

    /**
     * Вывод предупреждения
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    warn(module: any, message: string, data: any = null): void {
        this.log(LOG_LEVELS.WARN, module, message, data);
    }

    /**
     * Вывод сообщения об ошибке
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    error(module: any, message: string, data: any = null): void {
        this.log(LOG_LEVELS.ERROR, module, message, data);
    }

    /**
     * Вывод сообщения о критической ошибке
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    fatal(module: any, message: string, data: any = null): void {
        this.log(LOG_LEVELS.FATAL, module, message, data);
    }

    /**
     * Вывод сообщения о успешном выполнении операции
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    success(module: any, message: string, data: any = null): void {
        this.info(module, TEMPLATES.success(message), data);
    }

    /**
     * Вывод сообщения о неудачном выполнении операции
     * @param {string} module - Модуль из LOG_MODULES
     * @param {string} message - Сообщение
     * @param {Object} [data] - Дополнительные данные
     */
    failure(module: any, message: string, data: any = null): void {
        this.error(module, TEMPLATES.failure(message), data);
    }
}

// Создаем и экспортируем единый экземпляр сервиса
const logger = new LoggerService();
export default logger;