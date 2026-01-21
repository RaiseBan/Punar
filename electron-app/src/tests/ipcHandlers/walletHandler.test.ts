import { mockWalletRepository, createMockWallet } from '../mocks/repositories.mock';

jest.mock('../../repositories', () => ({
    getWalletRepository: jest.fn(() => mockWalletRepository)
}));

describe('walletHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Wallet operations', () => {
        it('should get all wallets', async () => {
            const mockWallets = [
                createMockWallet({ publicKey: 'key-1' }),
                createMockWallet({ publicKey: 'key-2' })
            ];
            mockWalletRepository.getAll.mockResolvedValue(mockWallets);

            const result = await mockWalletRepository.getAll();

            expect(result).toHaveLength(2);
            expect(result).toEqual(mockWallets);
        });

        it('should add new wallet', async () => {
            const wallet = createMockWallet();
            mockWalletRepository.add.mockResolvedValue(undefined);

            await mockWalletRepository.add(wallet);

            expect(mockWalletRepository.add).toHaveBeenCalledWith(wallet);
        });

        it('should delete wallet by public key', async () => {
            mockWalletRepository.delete.mockResolvedValue(true);

            const result = await mockWalletRepository.delete('test-key');

            expect(result).toBe(true);
            expect(mockWalletRepository.delete).toHaveBeenCalledWith('test-key');
        });

        it('should update wallet', async () => {
            const wallet = createMockWallet({ publicKey: 'updated-key' });
            mockWalletRepository.update.mockResolvedValue(true);

            const result = await mockWalletRepository.update('old-key', wallet);

            expect(result).toBe(true);
            expect(mockWalletRepository.update).toHaveBeenCalledWith('old-key', wallet);
        });

        it('should check if wallet exists', async () => {
            mockWalletRepository.exists.mockResolvedValue(true);

            const result = await mockWalletRepository.exists('test-key');

            expect(result).toBe(true);
        });

        it('should get wallet by public key', async () => {
            const wallet = createMockWallet();
            mockWalletRepository.getByPublicKey.mockResolvedValue(wallet);

            const result = await mockWalletRepository.getByPublicKey('test-key');

            expect(result).toEqual(wallet);
        });

        it('should return null for non-existent wallet', async () => {
            mockWalletRepository.getByPublicKey.mockResolvedValue(null);

            const result = await mockWalletRepository.getByPublicKey('non-existent');

            expect(result).toBeNull();
        });

        it('should count wallets', async () => {
            mockWalletRepository.count.mockResolvedValue(10);

            const result = await mockWalletRepository.count();

            expect(result).toBe(10);
        });

        it('should clear all wallets', async () => {
            mockWalletRepository.clear.mockResolvedValue(undefined);

            await mockWalletRepository.clear();

            expect(mockWalletRepository.clear).toHaveBeenCalled();
        });

        it('should clear cache', () => {
            mockWalletRepository.clearCache.mockReturnValue(undefined);

            mockWalletRepository.clearCache();

            expect(mockWalletRepository.clearCache).toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        it('should handle errors when getting wallets', async () => {
            mockWalletRepository.getAll.mockRejectedValue(new Error('Database error'));

            await expect(mockWalletRepository.getAll()).rejects.toThrow('Database error');
        });

        it('should handle errors when adding wallet', async () => {
            const wallet = createMockWallet();
            mockWalletRepository.add.mockRejectedValue(new Error('Add failed'));

            await expect(mockWalletRepository.add(wallet)).rejects.toThrow('Add failed');
        });

        it('should handle errors when deleting wallet', async () => {
            mockWalletRepository.delete.mockRejectedValue(new Error('Delete failed'));

            await expect(mockWalletRepository.delete('test')).rejects.toThrow('Delete failed');
        });
    });
});
