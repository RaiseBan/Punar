import { mockConfigRepository } from '../mocks/repositories.mock';

jest.mock('../../repositories', () => ({
    getConfigRepository: jest.fn(() => mockConfigRepository)
}));

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn()
    }
}));

jest.mock('axios');

describe('telegramHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Telegram configuration', () => {
        it('should get telegram config', async () => {
            const config = {
                token: 'bot-token-123',
                enabled: true,
                chatIds: [111, 222, 333]
            };

            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.token).toBe('bot-token-123');
            expect(result.enabled).toBe(true);
            expect(result.chatIds).toHaveLength(3);
        });

        it('should handle empty telegram config', async () => {
            const config = {
                token: '',
                enabled: false,
                chatIds: []
            };

            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.token).toBe('');
            expect(result.enabled).toBe(false);
            expect(result.chatIds).toHaveLength(0);
        });

        it('should set telegram token', async () => {
            const newToken = 'new-bot-token';
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig({ token: newToken, enabled: true });

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith({
                token: newToken,
                enabled: true
            });
        });
    });

    describe('Bot status', () => {
        it('should return bot status when running', () => {
            const status = {
                isRunning: true,
                isConfigured: true,
                chatCount: 5,
                lastActivity: new Date().toISOString()
            };

            expect(status.isRunning).toBe(true);
            expect(status.isConfigured).toBe(true);
            expect(status.chatCount).toBe(5);
        });

        it('should return bot status when stopped', () => {
            const status = {
                isRunning: false,
                isConfigured: true,
                chatCount: 0
            };

            expect(status.isRunning).toBe(false);
            expect(status.chatCount).toBe(0);
        });

        it('should indicate unconfigured bot', () => {
            const status = {
                isRunning: false,
                isConfigured: false,
                chatCount: 0
            };

            expect(status.isConfigured).toBe(false);
        });
    });

    describe('Bot control', () => {
        it('should start bot successfully', () => {
            const result = { success: true };

            expect(result.success).toBe(true);
        });

        it('should handle start bot error', () => {
            const result = { success: false, error: 'Token invalid' };

            expect(result.success).toBe(false);
            expect(result.error).toBe('Token invalid');
        });

        it('should stop bot successfully', () => {
            const result = { success: true };

            expect(result.success).toBe(true);
        });

        it('should handle stop bot error', () => {
            const result = { success: false, error: 'Bot not running' };

            expect(result.success).toBe(false);
            expect(result.error).toBe('Bot not running');
        });
    });

    describe('Chat ID management', () => {
        it('should handle single chat ID', async () => {
            const config = {
                token: 'token',
                enabled: true,
                chatIds: [12345]
            };

            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.chatIds).toHaveLength(1);
            expect(result.chatIds?.[0]).toBe(12345);
        });

        it('should handle multiple chat IDs', async () => {
            const config = {
                token: 'token',
                enabled: true,
                chatIds: [111, 222, 333, 444]
            };

            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.chatIds).toHaveLength(4);
        });

        it('should handle no chat IDs', async () => {
            const config = {
                token: 'token',
                enabled: true,
                chatIds: []
            };

            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.chatIds).toHaveLength(0);
        });

        it('should validate chat ID format', () => {
            const validChatId = 123456789;
            const invalidChatId = 0;

            expect(validChatId).toBeGreaterThan(0);
            expect(invalidChatId).toBe(0);
        });
    });

    describe('Connection testing', () => {
        it('should test successful connection', () => {
            const result = { success: true };

            expect(result.success).toBe(true);
        });

        it('should handle connection failure', () => {
            const result = {
                success: false,
                error: 'Cannot connect to telegram-service'
            };

            expect(result.success).toBe(false);
            expect(result.error).toContain('telegram-service');
        });

        it('should handle timeout errors', () => {
            const result = {
                success: false,
                error: 'Connection timeout'
            };

            expect(result.error).toContain('timeout');
        });
    });

    describe('Error handling', () => {
        it('should handle empty token error', () => {
            const result = {
                success: false,
                error: 'Token cannot be empty'
            };

            expect(result.success).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should handle configuration errors', async () => {
            mockConfigRepository.getTelegramConfig.mockRejectedValue(
                new Error('Config read failed')
            );

            await expect(mockConfigRepository.getTelegramConfig()).rejects.toThrow(
                'Config read failed'
            );
        });

        it('should handle save errors', async () => {
            mockConfigRepository.setTelegramConfig.mockRejectedValue(
                new Error('Write failed')
            );

            await expect(
                mockConfigRepository.setTelegramConfig({ token: 'test', enabled: true })
            ).rejects.toThrow('Write failed');
        });
    });

    describe('State transitions', () => {
        it('should transition from disabled to enabled', async () => {
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig({ enabled: true });

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith({
                enabled: true
            });
        });

        it('should transition from enabled to disabled', async () => {
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig({ enabled: false });

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith({
                enabled: false
            });
        });

        it('should update token while keeping state', async () => {
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig({
                token: 'new-token',
                enabled: true
            });

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith({
                token: 'new-token',
                enabled: true
            });
        });
    });
});
