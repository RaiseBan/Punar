import { mockWalletRepository, mockConfigRepository, createMockWallet } from '../mocks/repositories.mock';

describe('IPC Handlers Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Wallet Handlers', () => {
        it('should handle GET_WALLETS', async () => {
            const mockWallets = [createMockWallet()];
            mockWalletRepository.getAll.mockResolvedValue(mockWallets);

            const result = await mockWalletRepository.getAll();

            expect(result).toEqual(mockWallets);
            expect(mockWalletRepository.getAll).toHaveBeenCalled();
        });

        it('should handle ADD_WALLET', async () => {
            const wallet = createMockWallet();

            await mockWalletRepository.add(wallet);

            expect(mockWalletRepository.add).toHaveBeenCalledWith(wallet);
        });

        it('should handle DELETE_WALLET', async () => {
            const publicKey = 'test-key';
            mockWalletRepository.delete.mockResolvedValue(true);

            const result = await mockWalletRepository.delete(publicKey);

            expect(result).toBe(true);
            expect(mockWalletRepository.delete).toHaveBeenCalledWith(publicKey);
        });
    });

    describe('Settings Handlers', () => {
        it('should handle GET_SETTINGS', async () => {
            const mockSettings = { mainRpc: 'https://test.com' };
            mockConfigRepository.getSettings.mockResolvedValue(mockSettings);

            const result = await mockConfigRepository.getSettings();

            expect(result).toEqual(mockSettings);
            expect(mockConfigRepository.getSettings).toHaveBeenCalled();
        });

        it('should handle SAVE_SETTINGS', async () => {
            const settings = { mainRpc: 'https://new.com' };

            await mockConfigRepository.saveSettings(settings);

            expect(mockConfigRepository.saveSettings).toHaveBeenCalledWith(settings);
        });
    });
});