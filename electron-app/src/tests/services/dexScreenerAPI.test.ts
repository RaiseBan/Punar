import axios from 'axios';
import { checkPairDex } from '../../services/dexScreenerAPI';

jest.mock('axios');
jest.mock('../../services/loggerService', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        LOG_MODULES: {
            API: 'API'
        }
    }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('dexScreenerAPI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkPairDex', () => {
        it('should fetch pair data successfully', async () => {
            const mockData = {
                pair: {
                    chainId: 'solana',
                    dexId: 'raydium',
                    pairAddress: 'test-pair-address'
                }
            };

            mockedAxios.get.mockResolvedValue({ data: mockData });

            const result = await checkPairDex('test-pair');

            expect(result).toEqual(mockData);
            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://api.dexscreener.com/latest/dex/pairs/solana/test-pair'
            );
        });

        it('should return undefined on error', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            const result = await checkPairDex('test-pair');

            expect(result).toBeUndefined();
        });

        it('should handle TypeError with fetch failure', async () => {
            const error = new TypeError('Failed to fetch');
            mockedAxios.get.mockRejectedValue(error);

            const result = await checkPairDex('test-pair');

            expect(result).toBeUndefined();
        });

        it('should handle error with cause', async () => {
            const error = new Error('Test error');
            (error as Error & { cause?: string }).cause = 'Test cause';
            mockedAxios.get.mockRejectedValue(error);

            const result = await checkPairDex('test-pair');

            expect(result).toBeUndefined();
        });

        it('should construct correct URL for different pairs', async () => {
            mockedAxios.get.mockResolvedValue({ data: {} });

            await checkPairDex('pair-123');
            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://api.dexscreener.com/latest/dex/pairs/solana/pair-123'
            );

            await checkPairDex('another-pair');
            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://api.dexscreener.com/latest/dex/pairs/solana/another-pair'
            );
        });
    });
});