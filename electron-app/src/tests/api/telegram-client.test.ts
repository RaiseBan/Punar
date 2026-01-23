import axios from 'axios';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

class TelegramClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:3001') {
        this.baseUrl = baseUrl;
    }

    async sendSystemNotification(message: string): Promise<boolean> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/notify`, {
                message,
                type: 'system'
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            return response.status === 200;
        } catch {
            return false;
        }
    }
}

describe('TelegramClient', () => {
    let client: TelegramClient;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new TelegramClient();
    });

    describe('sendSystemNotification', () => {
        it('should send notification successfully', async () => {
            mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

            const result = await client.sendSystemNotification('Test message');

            expect(result).toBe(true);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'http://localhost:3001/api/notify',
                {
                    message: 'Test message',
                    type: 'system'
                }
            );
        });

        it('should return false on error', async () => {
            mockedAxios.post.mockRejectedValue(new Error('Network error'));

            const result = await client.sendSystemNotification('Test message');

            expect(result).toBe(false);
        });

        it('should handle different message types', async () => {
            mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

            await client.sendSystemNotification('Error occurred!');
            await client.sendSystemNotification('Success notification');
            await client.sendSystemNotification('Warning: check this');

            expect(mockedAxios.post).toHaveBeenCalledTimes(3);
        });
    });

    describe('checkHealth', () => {
        it('should return true when service is healthy', async () => {
            mockedAxios.get.mockResolvedValue({ status: 200, data: { status: 'ok' } });

            const result = await client.checkHealth();

            expect(result).toBe(true);
            expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/health');
        });

        it('should return false when service is down', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Service unavailable'));

            const result = await client.checkHealth();

            expect(result).toBe(false);
        });

        it('should handle timeout errors', async () => {
            mockedAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });

            const result = await client.checkHealth();

            expect(result).toBe(false);
        });
    });

    describe('Custom base URL', () => {
        it('should use custom base URL', async () => {
            const customClient = new TelegramClient('http://custom-url:4000');
            mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

            await customClient.sendSystemNotification('Test');

            expect(mockedAxios.post).toHaveBeenCalledWith(
                'http://custom-url:4000/api/notify',
                expect.any(Object)
            );
        });
    });
});
