import { mockWalletRepository, createMockWallet } from '../mocks/repositories.mock';

describe('WalletRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should get all wallets', async () => {
        const mockWallets = [createMockWallet(), createMockWallet({ publicKey: 'key-2' })];
        mockWalletRepository.getAll.mockResolvedValue(mockWallets);

        const result = await mockWalletRepository.getAll();

        expect(result).toHaveLength(2);
        expect(mockWalletRepository.getAll).toHaveBeenCalledTimes(1);
    });

    it('should add wallet', async () => {
        const wallet = createMockWallet();

        await mockWalletRepository.add(wallet);

        expect(mockWalletRepository.add).toHaveBeenCalledWith(wallet);
        expect(mockWalletRepository.add).toHaveBeenCalledTimes(1);
    });

    it('should delete wallet', async () => {
        mockWalletRepository.delete.mockResolvedValue(true);

        const result = await mockWalletRepository.delete('test-key');

        expect(result).toBe(true);
        expect(mockWalletRepository.delete).toHaveBeenCalledWith('test-key');
    });

    it('should check if wallet exists', async () => {
        mockWalletRepository.exists.mockResolvedValue(true);

        const result = await mockWalletRepository.exists('test-key');

        expect(result).toBe(true);
    });

    it('should count wallets', async () => {
        mockWalletRepository.count.mockResolvedValue(5);

        const result = await mockWalletRepository.count();

        expect(result).toBe(5);
    });
});