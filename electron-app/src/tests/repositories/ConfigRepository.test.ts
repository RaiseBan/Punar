import { mockConfigRepository, createMockSettings } from '../mocks/repositories.mock';

describe('ConfigRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should get settings', async () => {
        const mockSettings = createMockSettings({ mainRpc: 'https://test.com' });
        mockConfigRepository.getSettings.mockResolvedValue(mockSettings);

        const result = await mockConfigRepository.getSettings();

        expect(result).toEqual(mockSettings);
        expect(mockConfigRepository.getSettings).toHaveBeenCalledTimes(1);
    });

    it('should save settings', async () => {
        const settings = createMockSettings();

        await mockConfigRepository.saveSettings(settings);

        expect(mockConfigRepository.saveSettings).toHaveBeenCalledWith(settings);
        expect(mockConfigRepository.saveSettings).toHaveBeenCalledTimes(1);
    });

    it('should get script directory', async () => {
        mockConfigRepository.getScriptDirectory.mockResolvedValue('/test/path');

        const result = await mockConfigRepository.getScriptDirectory();

        expect(result).toBe('/test/path');
    });
});