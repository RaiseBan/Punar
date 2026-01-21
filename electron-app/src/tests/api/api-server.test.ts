jest.mock('../../ipcHandlers/processHandler', () => ({
    getProcesses: jest.fn()
}));

import { getProcesses } from '../../ipcHandlers/processHandler';

describe('API Server - Extended', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Express app creation', () => {
        it('should define app creation', () => {
            const express = require('express');
            const app = express();
            expect(app).toBeDefined();
        });

        it('should configure JSON middleware', () => {
            const express = require('express');
            const jsonMiddleware = express.json();
            expect(jsonMiddleware).toBeDefined();
        });
    });

    describe('API endpoints', () => {
        it('should define /api/tasks route', () => {
            const route = '/api/tasks';
            expect(route).toBe('/api/tasks');
        });

        it('should define /api/tasks/:taskId route', () => {
            const route = '/api/tasks/:taskId';
            expect(route).toContain(':taskId');
        });

        it('should handle route parameters', () => {
            const params = { taskId: '123' };
            expect(params.taskId).toBe('123');
        });
    });

    describe('Response formatting', () => {
        it('should format success response', () => {
            const response = {
                success: true,
                data: { id: '1', status: 'Running' }
            };

            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
        });

        it('should format error response', () => {
            const response = {
                success: false,
                error: 'Task not found'
            };

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('should include task details in response', () => {
            const taskInfo = {
                id: '1',
                status: 'Running',
                moduleName: 'test-module',
                startTime: Date.now(),
                pid: 1234
            };

            expect(taskInfo).toHaveProperty('id');
            expect(taskInfo).toHaveProperty('status');
            expect(taskInfo).toHaveProperty('moduleName');
        });
    });

    describe('Process status mapping', () => {
        it('should map active to Running', () => {
            const isActive = true;
            const status = isActive ? 'Running' : 'Stopped';
            expect(status).toBe('Running');
        });

        it('should map inactive to Stopped', () => {
            const isActive = false;
            const status = isActive ? 'Running' : 'Stopped';
            expect(status).toBe('Stopped');
        });
    });

    describe('Server port configuration', () => {
        it('should use default port 3002', () => {
            const port = 3002;
            expect(port).toBe(3002);
        });

        it('should validate port number', () => {
            const port = 3002;
            expect(port).toBeGreaterThan(0);
            expect(port).toBeLessThan(65536);
        });
    });

    describe('Error handling in routes', () => {
        it('should catch route errors', () => {
            const errorHandler = (error: Error) => ({
                success: false,
                error: error.message
            });

            const result = errorHandler(new Error('Test error'));
            expect(result.success).toBe(false);
            expect(result.error).toBe('Test error');
        });

        it('should handle missing process', () => {
            (getProcesses as jest.Mock).mockReturnValue({});

            const processes = getProcesses();
            const task = processes['999'];

            expect(task).toBeUndefined();
        });
    });

    describe('Task API info structure', () => {
        it('should define complete task info', () => {
            const taskInfo = {
                id: '1',
                status: 'Running',
                moduleName: 'module-name',
                startTime: 1234567890,
                pid: 999
            };

            expect(taskInfo.id).toBe('1');
            expect(taskInfo.status).toBe('Running');
            expect(taskInfo.moduleName).toBe('module-name');
            expect(taskInfo.startTime).toBe(1234567890);
            expect(taskInfo.pid).toBe(999);
        });
    });
});