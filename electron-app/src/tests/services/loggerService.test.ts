import logger from '../../services/loggerService';

describe('LoggerService', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('Basic logging', () => {
        it('should log debug messages', () => {
            logger.debug(logger.LOG_MODULES.SYSTEM, 'Test debug message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log info messages', () => {
            logger.info(logger.LOG_MODULES.SYSTEM, 'Test info message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log warn messages', () => {
            logger.warn(logger.LOG_MODULES.SYSTEM, 'Test warn message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log error messages', () => {
            logger.error(logger.LOG_MODULES.SYSTEM, 'Test error message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log fatal messages', () => {
            logger.fatal(logger.LOG_MODULES.SYSTEM, 'Test fatal message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log success messages', () => {
            logger.success(logger.LOG_MODULES.SYSTEM, 'Test success message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log failure messages', () => {
            logger.failure(logger.LOG_MODULES.SYSTEM, 'Test failure message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('Log levels', () => {
        it('should have correct log level constants', () => {
            expect(logger.LOG_LEVELS.DEBUG).toBe('DEBUG');
            expect(logger.LOG_LEVELS.INFO).toBe('INFO');
            expect(logger.LOG_LEVELS.WARN).toBe('WARN');
            expect(logger.LOG_LEVELS.ERROR).toBe('ERROR');
            expect(logger.LOG_LEVELS.FATAL).toBe('FATAL');
        });
    });

    describe('Log modules', () => {
        it('should have all module constants', () => {
            expect(logger.LOG_MODULES.SYSTEM).toBe('SYSTEM');
            expect(logger.LOG_MODULES.IPC).toBe('IPC');
            expect(logger.LOG_MODULES.PROCESS).toBe('PROCESS');
            expect(logger.LOG_MODULES.WALLET).toBe('WALLET');
            expect(logger.LOG_MODULES.CONFIG).toBe('CONFIG');
            expect(logger.LOG_MODULES.API).toBe('API');
            expect(logger.LOG_MODULES.TELEGRAM).toBe('TELEGRAM');
            expect(logger.LOG_MODULES.EVENT_BUS).toBe('EVENT_BUS');
        });

        it('should use different modules', () => {
            logger.info(logger.LOG_MODULES.SYSTEM, 'System message');
            expect(consoleLogSpy).toHaveBeenCalled();

            consoleLogSpy.mockClear();
            logger.info(logger.LOG_MODULES.API, 'API message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('Logging with data', () => {
        it('should log messages with data', () => {
            const testData = { key: 'value', number: 123 };
            logger.info(logger.LOG_MODULES.SYSTEM, 'Test message', testData);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log messages with null', () => {
            logger.info(logger.LOG_MODULES.SYSTEM, 'Test message', null);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log messages with undefined', () => {
            logger.info(logger.LOG_MODULES.SYSTEM, 'Test message', undefined);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log complex data structures', () => {
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: { a: 'b' }
                }
            };
            logger.info(logger.LOG_MODULES.SYSTEM, 'Complex data', complexData);
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('EventBus integration', () => {
        it('should have initializeEventBusListeners method', () => {
            expect(typeof logger.initializeEventBusListeners).toBe('function');
        });

        it('should initialize EventBus listeners without errors', () => {
            expect(() => logger.initializeEventBusListeners()).not.toThrow();
        });
    });

    describe('Templates and Colors', () => {
        it('should have template functions', () => {
            expect(typeof logger.TEMPLATES.timestamp).toBe('function');
            expect(typeof logger.TEMPLATES.level).toBe('function');
            expect(typeof logger.TEMPLATES.module).toBe('function');
            expect(typeof logger.TEMPLATES.success).toBe('function');
            expect(typeof logger.TEMPLATES.failure).toBe('function');
        });

        it('should have color constants', () => {
            expect(logger.COLORS.RESET).toBeDefined();
            expect(logger.COLORS.BRIGHT_CYAN).toBeDefined();
            expect(logger.COLORS.BRIGHT_GREEN).toBeDefined();
            expect(logger.COLORS.BRIGHT_RED).toBeDefined();
        });

        it('should format strings with templates', () => {
            const formatted = logger.TEMPLATES.success('Test');
            expect(typeof formatted).toBe('string');
            expect(formatted).toContain('Test');
        });

        it('should format timestamps', () => {
            const timestamp = new Date().toISOString();
            const formatted = logger.TEMPLATES.timestamp(timestamp);
            expect(typeof formatted).toBe('string');
        });

        it('should format log levels', () => {
            const formatted = logger.TEMPLATES.level(logger.LOG_LEVELS.INFO);
            expect(typeof formatted).toBe('string');
        });

        it('should format modules', () => {
            const formatted = logger.TEMPLATES.module(logger.LOG_MODULES.SYSTEM);
            expect(typeof formatted).toBe('string');
        });
    });

    describe('Multiple log calls', () => {
        it('should handle multiple sequential logs', () => {
            logger.info(logger.LOG_MODULES.SYSTEM, 'First');
            logger.info(logger.LOG_MODULES.SYSTEM, 'Second');
            logger.info(logger.LOG_MODULES.SYSTEM, 'Third');
            expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
        });

        it('should handle different log levels', () => {
            consoleLogSpy.mockClear();
            logger.debug(logger.LOG_MODULES.SYSTEM, 'Debug');
            logger.info(logger.LOG_MODULES.SYSTEM, 'Info');
            logger.warn(logger.LOG_MODULES.SYSTEM, 'Warn');
            logger.error(logger.LOG_MODULES.SYSTEM, 'Error');
            expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
        });
    });
});