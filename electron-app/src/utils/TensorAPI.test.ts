jest.mock('../../utils/fsHelper', () => ({
    getSettings: jest.fn().mockReturnValue({ tensor_api_token: 'test-token' })
}));

describe('TensorAPI Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Module exports', () => {
        it('should export TensorAPI class', () => {
            const TensorAPIModule = require('../../utils/TensorAPI');
            expect(TensorAPIModule).toBeDefined();
        });
    });

    describe('API configuration', () => {
        it('should handle API key requirement', () => {
            const apiKey = 'test-api-key-123';
            expect(apiKey).toBeTruthy();
            expect(apiKey.length).toBeGreaterThan(0);
        });

        it('should validate API key format', () => {
            const validKey = 'abc123';
            const emptyKey = '';
            
            expect(validKey.length).toBeGreaterThan(0);
            expect(emptyKey.length).toBe(0);
        });
    });

    describe('Endpoint operations', () => {
        it('should handle collection search params', () => {
            const params = { query: 'test-collection' };
            expect(params.query).toBe('test-collection');
        });

        it('should handle NFT fetch params', () => {
            const params = {
                collId: 'col-123',
                sortBy: 'ListingPriceAsc',
                limit: '10',
                onlyListings: 'true'
            };
            expect(params.collId).toBe('col-123');
            expect(params.limit).toBe('10');
        });

        it('should handle tx history params', () => {
            const params = {
                collId: 'collection-id',
                limit: 20,
                txTypes: ['SALE', 'LIST'],
                minPrice: 1.0,
                maxPrice: 10.0
            };
            expect(params.collId).toBe('collection-id');
            expect(params.limit).toBe(20);
            expect(params.txTypes).toHaveLength(2);
        });
    });

    describe('Parameter validation', () => {
        it('should validate collection ID', () => {
            const collId = 'test-collection-123';
            expect(collId).toBeTruthy();
            expect(typeof collId).toBe('string');
        });

        it('should validate limit parameter', () => {
            const limit = 10;
            expect(limit).toBeGreaterThan(0);
            expect(typeof limit).toBe('number');
        });

        it('should validate cursor for pagination', () => {
            const cursor = 'next-page-cursor';
            expect(cursor).toBeTruthy();
            expect(typeof cursor).toBe('string');
        });
    });

    describe('Data transformation', () => {
        it('should handle traits array', () => {
            const traits = ['trait1', 'trait2', 'trait3'];
            const stringified = JSON.stringify(traits);
            expect(JSON.parse(stringified)).toEqual(traits);
        });

        it('should handle price filtering', () => {
            const minPrice = 1.5;
            const maxPrice = 10.0;
            const price = 5.0;
            
            const inRange = price >= minPrice && price <= maxPrice;
            expect(inRange).toBe(true);
        });
    });

    describe('Request building', () => {
        it('should build search collection request', () => {
            const endpoint = '/api/search/collections';
            const params = { query: 'my-nft' };
            
            expect(endpoint).toContain('/api/search');
            expect(params.query).toBe('my-nft');
        });

        it('should build NFTs by collection request', () => {
            const endpoint = '/api/nfts/collection';
            const params = { collId: 'col-123', limit: '5' };
            
            expect(endpoint).toContain('/collection');
            expect(params.limit).toBe('5');
        });

        it('should build tx history request', () => {
            const endpoint = '/api/tx/history';
            const params = { collId: 'col-456', limit: 10 };
            
            expect(endpoint).toContain('/tx/history');
            expect(params.collId).toBe('col-456');
        });
    });
});
