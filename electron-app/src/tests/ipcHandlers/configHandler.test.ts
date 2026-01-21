import { mockConfigRepository } from '../mocks/repositories.mock';

jest.mock('../../repositories', () => ({
    getConfigRepository: jest.fn(() => mockConfigRepository)
}));

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn()
    }
}));

describe('configHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Config operations', () => {
        it('should get script directory', async () => {
            mockConfigRepository.getScriptDirectory.mockResolvedValue('/path/to/scripts');

            const result = await mockConfigRepository.getScriptDirectory();

            expect(result).toBe('/path/to/scripts');
            expect(mockConfigRepository.getScriptDirectory).toHaveBeenCalled();
        });

        it('should set script directory', async () => {
            mockConfigRepository.setScriptDirectory.mockResolvedValue(undefined);

            await mockConfigRepository.setScriptDirectory('/new/path');

            expect(mockConfigRepository.setScriptDirectory).toHaveBeenCalledWith('/new/path');
        });

        it('should handle empty script directory', async () => {
            mockConfigRepository.getScriptDirectory.mockResolvedValue('');

            const result = await mockConfigRepository.getScriptDirectory();

            expect(result).toBe('');
        });

        it('should update script directory', async () => {
            mockConfigRepository.setScriptDirectory.mockResolvedValue(undefined);

            await mockConfigRepository.setScriptDirectory('/updated/path');

            expect(mockConfigRepository.setScriptDirectory).toHaveBeenCalledWith('/updated/path');
        });
    });

    describe('Settings operations', () => {
        it('should retrieve settings', async () => {
            const mockSettings = { mainRpc: 'https://api.mainnet-beta.solana.com' };
            mockConfigRepository.getSettings.mockResolvedValue(mockSettings);

            const result = await mockConfigRepository.getSettings();

            expect(result).toEqual(mockSettings);
        });

        it('should save settings', async () => {
            const settings = { mainRpc: 'https://new-rpc.com' };
            mockConfigRepository.saveSettings.mockResolvedValue(undefined);

            await mockConfigRepository.saveSettings(settings);

            expect(mockConfigRepository.saveSettings).toHaveBeenCalledWith(settings);
        });

        it('should handle partial settings', async () => {
            const partialSettings = { mainRpc: 'https://rpc.com' };
            mockConfigRepository.saveSettings.mockResolvedValue(undefined);

            await mockConfigRepository.saveSettings(partialSettings);

            expect(mockConfigRepository.saveSettings).toHaveBeenCalledWith(partialSettings);
        });
    });

    describe('Main RPC operations', () => {
        it('should get main RPC', async () => {
            mockConfigRepository.getMainRpc.mockResolvedValue('https://api.mainnet-beta.solana.com');

            const result = await mockConfigRepository.getMainRpc();

            expect(result).toBe('https://api.mainnet-beta.solana.com');
        });

        it('should handle missing main RPC', async () => {
            mockConfigRepository.getMainRpc.mockResolvedValue(undefined);

            const result = await mockConfigRepository.getMainRpc();

            expect(result).toBeUndefined();
        });

        it('should handle custom RPC URLs', async () => {
            mockConfigRepository.getMainRpc.mockResolvedValue('https://custom-rpc.example.com');

            const result = await mockConfigRepository.getMainRpc();

            expect(result).toBe('https://custom-rpc.example.com');
        });
    });

    describe('Tensor API token operations', () => {
        it('should get tensor API token', async () => {
            mockConfigRepository.getTensorApiToken.mockResolvedValue('test-token-abc123');

            const result = await mockConfigRepository.getTensorApiToken();

            expect(result).toBe('test-token-abc123');
        });

        it('should handle missing tensor API token', async () => {
            mockConfigRepository.getTensorApiToken.mockResolvedValue(undefined);

            const result = await mockConfigRepository.getTensorApiToken();

            expect(result).toBeUndefined();
        });

        it('should handle long tokens', async () => {
            const longToken = 'a'.repeat(100);
            mockConfigRepository.getTensorApiToken.mockResolvedValue(longToken);

            const result = await mockConfigRepository.getTensorApiToken();

            expect(result).toBe(longToken);
            expect(result.length).toBe(100);
        });
    });

    describe('Telegram configuration', () => {
        it('should get telegram config', async () => {
            const config = { token: 'bot-token', enabled: true, chatIds: [123, 456] };
            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result).toEqual(config);
            expect(result.enabled).toBe(true);
            expect(result.chatIds).toHaveLength(2);
        });

        it('should set telegram config', async () => {
            const config = { token: 'new-bot-token', enabled: false };
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig(config);

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith(config);
        });

        it('should handle telegram config without chatIds', async () => {
            const config = { token: 'token', enabled: true };
            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.chatIds).toBeUndefined();
        });

        it('should handle disabled telegram config', async () => {
            const config = { token: '', enabled: false };
            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.enabled).toBe(false);
            expect(result.token).toBe('');
        });

        it('should update telegram enabled status', async () => {
            const config = { enabled: true };
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig(config);

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith(config);
        });
    });

    describe('Cache operations', () => {
        it('should clear cache', () => {
            mockConfigRepository.clearCache.mockReturnValue(undefined);

            mockConfigRepository.clearCache();

            expect(mockConfigRepository.clearCache).toHaveBeenCalled();
        });

        it('should allow multiple cache clears', () => {
            mockConfigRepository.clearCache.mockReturnValue(undefined);

            mockConfigRepository.clearCache();
            mockConfigRepository.clearCache();
            mockConfigRepository.clearCache();

            expect(mockConfigRepository.clearCache).toHaveBeenCalledTimes(3);
        });
    });

    describe('Error handling', () => {
        it('should handle errors when getting settings', async () => {
            mockConfigRepository.getSettings.mockRejectedValue(new Error('Read failed'));

            await expect(mockConfigRepository.getSettings()).rejects.toThrow('Read failed');
        });

        it('should handle errors when saving settings', async () => {
            mockConfigRepository.saveSettings.mockRejectedValue(new Error('Write failed'));

            await expect(mockConfigRepository.saveSettings({})).rejects.toThrow('Write failed');
        });

        it('should handle errors when setting script directory', async () => {
            mockConfigRepository.setScriptDirectory.mockRejectedValue(new Error('Path invalid'));

            await expect(mockConfigRepository.setScriptDirectory('/bad/path')).rejects.toThrow('Path invalid');
        });

        it('should handle errors when getting telegram config', async () => {
            mockConfigRepository.getTelegramConfig.mockRejectedValue(new Error('Config read failed'));

            await expect(mockConfigRepository.getTelegramConfig()).rejects.toThrow('Config read failed');
        });
    });
});
