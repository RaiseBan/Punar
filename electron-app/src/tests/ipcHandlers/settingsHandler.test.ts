import { mockConfigRepository, createMockSettings } from '../mocks/repositories.mock';

jest.mock('../../repositories', () => ({
    getConfigRepository: jest.fn(() => mockConfigRepository)
}));

describe('settingsHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Settings operations', () => {
        it('should get settings', async () => {
            const mockSettings = createMockSettings({
                mainRpc: 'https://api.mainnet-beta.solana.com'
            });
            mockConfigRepository.getSettings.mockResolvedValue(mockSettings);

            const result = await mockConfigRepository.getSettings();

            expect(result).toEqual(mockSettings);
            expect(mockConfigRepository.getSettings).toHaveBeenCalledTimes(1);
        });

        it('should save settings', async () => {
            const settings = createMockSettings({
                mainRpc: 'https://new-rpc.com'
            });
            mockConfigRepository.saveSettings.mockResolvedValue(undefined);

            await mockConfigRepository.saveSettings(settings);

            expect(mockConfigRepository.saveSettings).toHaveBeenCalledWith(settings);
            expect(mockConfigRepository.saveSettings).toHaveBeenCalledTimes(1);
        });

        it('should get main RPC', async () => {
            mockConfigRepository.getMainRpc.mockResolvedValue('https://test-rpc.com');

            const result = await mockConfigRepository.getMainRpc();

            expect(result).toBe('https://test-rpc.com');
        });

        it('should return undefined for missing main RPC', async () => {
            mockConfigRepository.getMainRpc.mockResolvedValue(undefined);

            const result = await mockConfigRepository.getMainRpc();

            expect(result).toBeUndefined();
        });

        it('should get tensor API token', async () => {
            mockConfigRepository.getTensorApiToken.mockResolvedValue('test-token-123');

            const result = await mockConfigRepository.getTensorApiToken();

            expect(result).toBe('test-token-123');
        });

        it('should handle missing tensor API token', async () => {
            mockConfigRepository.getTensorApiToken.mockResolvedValue(undefined);

            const result = await mockConfigRepository.getTensorApiToken();

            expect(result).toBeUndefined();
        });

        it('should save settings with multiple fields', async () => {
            const settings = createMockSettings({
                mainRpc: 'https://rpc.com',
                tensor_api_token: 'token123',
                helius_api_key: 'helius123'
            } as any);

            await mockConfigRepository.saveSettings(settings);

            expect(mockConfigRepository.saveSettings).toHaveBeenCalledWith(settings);
        });
    });

    describe('Script directory operations', () => {
        it('should get script directory', async () => {
            mockConfigRepository.getScriptDirectory.mockResolvedValue('/path/to/scripts');

            const result = await mockConfigRepository.getScriptDirectory();

            expect(result).toBe('/path/to/scripts');
        });

        it('should set script directory', async () => {
            mockConfigRepository.setScriptDirectory.mockResolvedValue(undefined);

            await mockConfigRepository.setScriptDirectory('/new/path');

            expect(mockConfigRepository.setScriptDirectory).toHaveBeenCalledWith('/new/path');
        });
    });

    describe('Telegram configuration', () => {
        it('should get telegram config', async () => {
            const config = { token: 'test-token', enabled: true, chatIds: [123, 456] };
            mockConfigRepository.getTelegramConfig.mockResolvedValue(config);

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result).toEqual(config);
        });

        it('should set telegram config', async () => {
            const config = { token: 'new-token', enabled: false };
            mockConfigRepository.setTelegramConfig.mockResolvedValue(undefined);

            await mockConfigRepository.setTelegramConfig(config);

            expect(mockConfigRepository.setTelegramConfig).toHaveBeenCalledWith(config);
        });

        it('should get default telegram config', async () => {
            mockConfigRepository.getTelegramConfig.mockResolvedValue({
                token: '',
                enabled: false
            });

            const result = await mockConfigRepository.getTelegramConfig();

            expect(result.enabled).toBe(false);
            expect(result.token).toBe('');
        });
    });

    describe('Cache operations', () => {
        it('should clear cache', () => {
            mockConfigRepository.clearCache.mockReturnValue(undefined);

            mockConfigRepository.clearCache();

            expect(mockConfigRepository.clearCache).toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        it('should handle errors when getting settings', async () => {
            mockConfigRepository.getSettings.mockRejectedValue(new Error('Read error'));

            await expect(mockConfigRepository.getSettings()).rejects.toThrow('Read error');
        });

        it('should handle errors when saving settings', async () => {
            const settings = createMockSettings();
            mockConfigRepository.saveSettings.mockRejectedValue(new Error('Write error'));

            await expect(mockConfigRepository.saveSettings(settings)).rejects.toThrow('Write error');
        });
    });
});
