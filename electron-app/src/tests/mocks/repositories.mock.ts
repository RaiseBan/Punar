import { Wallet, AppSettings } from '../../../../shared';

export const mockWalletRepository = {
    getAll: jest.fn().mockResolvedValue([]),
    getByPublicKey: jest.fn().mockResolvedValue(null),
    add: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    count: jest.fn().mockResolvedValue(0),
    clear: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockReturnValue(undefined),
};

export const mockConfigRepository = {
    getSettings: jest.fn().mockResolvedValue({}),
    saveSettings: jest.fn().mockResolvedValue(undefined),
    getScriptDirectory: jest.fn().mockResolvedValue('/mock/scripts'),
    setScriptDirectory: jest.fn().mockResolvedValue(undefined),
    getMainRpc: jest.fn().mockResolvedValue(undefined),
    getTensorApiToken: jest.fn().mockResolvedValue(undefined),
    getTelegramConfig: jest.fn().mockResolvedValue({ token: '', enabled: false }),
    setTelegramConfig: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockReturnValue(undefined),
};

export function createMockWallet(overrides?: Partial<Wallet>): Wallet {
    return {
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key',
        ...overrides,
    };
}

export function createMockSettings(overrides?: Partial<AppSettings>): AppSettings {
    return {
        ...overrides,
        mainRpc: overrides?.mainRpc || 'https://mock-rpc.com',
        heliusRpcs: overrides?.heliusRpcs ?? [],
        walletsSet: overrides?.walletsSet || {},
        tensor_api_token: overrides?.tensor_api_token || '',
    } as AppSettings;
}