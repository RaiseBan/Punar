import { EventBus } from '../../../shared/eventBus';
import { PROCESS_EVENTS } from '../../../shared/types';

export const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL',
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

export const LOG_MODULES = {
    SYSTEM: 'SYSTEM',
    EVENT_BUS: 'EVENT_BUS',
    PROCESS: 'PROCESS',
    IPC: 'IPC',
    API: 'API',
    TELEGRAM: 'TELEGRAM',
    CONFIG: 'CONFIG',
    WALLET: 'WALLET',
    NETWORK: 'NETWORK',
    DATABASE: 'DATABASE',
    JITO: 'JITO',
    CLEANING_POOLS: 'CLEANING_POOLS',
    SPAWN_PROCESS: 'SPAWN_PROCESS'
} as const;

export type LogModule = typeof LOG_MODULES[keyof typeof LOG_MODULES];

export const COLORS = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    UNDERSCORE: '\x1b[4m',
    BLINK: '\x1b[5m',
    REVERSE: '\x1b[7m',
    HIDDEN: '\x1b[8m',

    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',

    BG_BLACK: '\x1b[40m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    BG_WHITE: '\x1b[47m',

    BRIGHT_BLACK: '\x1b[90m',
    BRIGHT_RED: '\x1b[91m',
    BRIGHT_GREEN: '\x1b[92m',
    BRIGHT_YELLOW: '\x1b[93m',
    BRIGHT_BLUE: '\x1b[94m',
    BRIGHT_MAGENTA: '\x1b[95m',
    BRIGHT_CYAN: '\x1b[96m',
    BRIGHT_WHITE: '\x1b[97m',

    BOLD: '\x1b[1m',
} as const;

const TEMPLATES = {
    timestamp: (ts: string): string =>
        `${COLORS.DIM}[${ts}]${COLORS.RESET}`,

    level: (level: LogLevel): string => {
        const colors: Record<LogLevel, string> = {
            [LOG_LEVELS.DEBUG]: COLORS.BRIGHT_BLUE,
            [LOG_LEVELS.INFO]: COLORS.BRIGHT_GREEN,
            [LOG_LEVELS.WARN]: COLORS.BRIGHT_YELLOW,
            [LOG_LEVELS.ERROR]: COLORS.BRIGHT_RED,
            [LOG_LEVELS.FATAL]: COLORS.BRIGHT_MAGENTA,
        };
        return `${colors[level]}[${level.padEnd(5)}]${COLORS.RESET}`;
    },

    module: (module: LogModule): string =>
        `${COLORS.CYAN}[${module}]${COLORS.RESET}`,

    success: (msg: string): string =>
        `${COLORS.BRIGHT_GREEN}✓ ${msg}${COLORS.RESET}`,

    failure: (msg: string): string =>
        `${COLORS.BRIGHT_RED}✗ ${msg}${COLORS.RESET}`,

    highlight: (msg: string): string =>
        `${COLORS.BOLD}${msg}${COLORS.RESET}`,

    value: (val: string | number): string =>
        `${COLORS.BRIGHT_CYAN}${val}${COLORS.RESET}`,
};

let minimumLogLevel: LogLevel = LOG_LEVELS.DEBUG;

class LoggerService {
    public readonly LOG_LEVELS = LOG_LEVELS;
    public readonly LOG_MODULES = LOG_MODULES;
    public readonly TEMPLATES = TEMPLATES;
    public readonly COLORS = COLORS;

    private eventBusInitialized = false;

    constructor() {}

    initializeEventBusListeners(): void {
        if (this.eventBusInitialized) {
            this.warn(LOG_MODULES.EVENT_BUS, 'EventBus listeners уже инициализированы');
            return;
        }

        this.info(LOG_MODULES.EVENT_BUS, 'Инициализация подписок на события EventBus...');

        EventBus.on(PROCESS_EVENTS.STARTED, (data) => {
            const eventData = data as { taskId: string | number; moduleName: string };
            this.info(
                LOG_MODULES.EVENT_BUS,
                `▶️ Процесс запущен: Task ${TEMPLATES.value(eventData.taskId)}, Модуль: ${TEMPLATES.highlight(eventData.moduleName)}`
            );
        });

        EventBus.on(PROCESS_EVENTS.STOPPED, (data) => {
            const eventData = data as { taskId: string | number; exitCode: number | null };
            const exitCodeColor =
                eventData.exitCode === 0
                    ? COLORS.BRIGHT_GREEN
                    : COLORS.BRIGHT_RED;
            this.info(
                LOG_MODULES.EVENT_BUS,
                `⏹️ Процесс остановлен: Task ${TEMPLATES.value(eventData.taskId)}, ` +
                `Exit code: ${exitCodeColor}${eventData.exitCode}${COLORS.RESET}`
            );
        });

        this.eventBusInitialized = true;
        this.success(LOG_MODULES.EVENT_BUS, 'Подписки на EventBus успешно инициализированы');
    }

    setMinimumLogLevel(level: LogLevel): void {
        if (Object.values(LOG_LEVELS).includes(level)) {
            minimumLogLevel = level;
            this.info(
                LOG_MODULES.SYSTEM,
                `Установлен минимальный уровень логирования: ${TEMPLATES.highlight(minimumLogLevel)}`
            );
        } else {
            this.warn(LOG_MODULES.SYSTEM, `Некорректный уровень логирования: ${level}`);
        }
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = Object.values(LOG_LEVELS);
        const currentLevelIndex = levels.indexOf(level);
        const minLevelIndex = levels.indexOf(minimumLogLevel);

        return currentLevelIndex >= minLevelIndex;
    }

    private log(
        level: LogLevel,
        module: LogModule,
        message: string,
        data: unknown = null
    ): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const formattedTimestamp = TEMPLATES.timestamp(timestamp);
        const formattedLevel = TEMPLATES.level(level);
        const formattedModule = TEMPLATES.module(module);

        const logMessage = `${formattedTimestamp} ${formattedLevel} ${formattedModule} ${message}`;
        console.log(logMessage);

        if (data !== null && data !== undefined) {
            console.log(`${COLORS.DIM}Data:${COLORS.RESET}`, data);
        }
    }

    debug(module: LogModule, message: string, data: unknown = null): void {
        this.log(LOG_LEVELS.DEBUG, module, message, data);
    }

    info(module: LogModule, message: string, data: unknown = null): void {
        this.log(LOG_LEVELS.INFO, module, message, data);
    }

    warn(module: LogModule, message: string, data: unknown = null): void {
        this.log(LOG_LEVELS.WARN, module, message, data);
    }

    error(module: LogModule, message: string, data: unknown = null): void {
        this.log(LOG_LEVELS.ERROR, module, message, data);
    }

    fatal(module: LogModule, message: string, data: unknown = null): void {
        this.log(LOG_LEVELS.FATAL, module, message, data);
    }

    success(module: LogModule, message: string, data: unknown = null): void {
        this.info(module, TEMPLATES.success(message), data);
    }

    failure(module: LogModule, message: string, data: unknown = null): void {
        this.error(module, TEMPLATES.failure(message), data);
    }
}

const logger = new LoggerService();
export default logger;