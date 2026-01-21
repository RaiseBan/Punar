import { sleep } from '../../utils/solanaUtils';

// Mock heliusDasApi to avoid actual API calls
jest.mock('../../utils/heliusDasApi', () => ({
    retrieveDASAssetFields: jest.fn()
}));

describe('solanaUtils', () => {
    describe('sleep', () => {
        it('should pause execution for specified milliseconds', async () => {
            const startTime = Date.now();
            await sleep(100);
            const endTime = Date.now();
            const elapsed = endTime - startTime;
            
            expect(elapsed).toBeGreaterThanOrEqual(90);
            expect(elapsed).toBeLessThan(200);
        });

        it('should work with 0 milliseconds', async () => {
            const startTime = Date.now();
            await sleep(0);
            const endTime = Date.now();
            const elapsed = endTime - startTime;
            
            expect(elapsed).toBeLessThan(50);
        });

        it('should return a Promise', () => {
            const result = sleep(1);
            expect(result).toBeInstanceOf(Promise);
        });

        it('should resolve the promise', async () => {
            await expect(sleep(1)).resolves.toBeUndefined();
        });

        it('should allow chaining', async () => {
            const startTime = Date.now();
            await sleep(50).then(() => sleep(50));
            const elapsed = Date.now() - startTime;
            expect(elapsed).toBeGreaterThanOrEqual(90);
        });

        it('should work with small delays', async () => {
            await expect(sleep(10)).resolves.toBeUndefined();
        });

        it('should work with larger delays', async () => {
            const start = Date.now();
            await sleep(150);
            expect(Date.now() - start).toBeGreaterThanOrEqual(140);
        });
    });

    describe('convertBigIntToString', () => {
        // Test the function exists and can be imported
        it('should export convertBigIntToString function', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            expect(typeof convertBigIntToString).toBe('function');
        });

        it('should handle primitive values', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            expect(convertBigIntToString('string')).toBe('string');
            expect(convertBigIntToString(123)).toBe(123);
            expect(convertBigIntToString(true)).toBe(true);
            expect(convertBigIntToString(null)).toBeNull();
            expect(convertBigIntToString(undefined)).toBeUndefined();
        });

        it('should handle empty objects', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            const result = convertBigIntToString({});
            expect(result).toEqual({});
        });

        it('should handle empty arrays', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            const result = convertBigIntToString([]);
            expect(result).toEqual([]);
        });

        it('should handle objects with strings', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            const input = { a: 'test', b: 'value' };
            const result = convertBigIntToString(input);
            expect(result).toEqual({ a: 'test', b: 'value' });
        });

        it('should handle nested objects', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            const input = {
                level1: {
                    level2: {
                        value: 'test'
                    }
                }
            };
            const result = convertBigIntToString(input);
            expect(result).toEqual(input);
        });

        it('should handle arrays of objects', () => {
            const { convertBigIntToString } = require('../../utils/solanaUtils');
            const input = [{ a: 1 }, { b: 2 }];
            const result = convertBigIntToString(input);
            expect(result).toEqual(input);
        });
    });

    describe('getCollectionAddress', () => {
        it('should export getCollectionAddress function', () => {
            const { getCollectionAddress } = require('../../utils/solanaUtils');
            expect(typeof getCollectionAddress).toBe('function');
        });
    });
});
