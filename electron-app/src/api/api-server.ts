import express, { Request, Response, Application } from 'express';
import { BrowserWindow } from 'electron';
import { getProcesses } from '../ipcHandlers/processHandler';
import { ApiResponse, TaskApiInfo } from '../../../shared/types';

console.log('📦 [API-SERVER] Module loading...');

/**
 * Интерфейс для MEV Load Balancer
 */
interface IMevLoadBalancer {
  start(): Promise<{ success: boolean; status?: string; message?: string; error?: string }>;
  stop(): Promise<{ success: boolean; message?: string; error?: string }>;
  getProcesses(): Array<{
    id?: string;
    pid?: number | null;
    tokenAddress: string;
    meteoraPool?: string | null;
    pumpSwapPool?: string | null;
    raydiumPool?: string;
    config?: Record<string, unknown>;
    status?: string;
    startTime?: number;
    lastActivity?: number | string;
    signals?: number;
  }>;
  stopProcess(processId: string): Promise<{ success: boolean; message?: string; error?: string }>;
  getProcessLogs(processId: string, lines: number): Promise<string[] | null>;
}

/**
 * Создает Express API сервер
 */
export function createApiServer(
    mainWindow: BrowserWindow | null,
    mevLoadBalancer: IMevLoadBalancer
): Application {
  console.log('🌐 [API-SERVER] createApiServer called');
  console.log(`  - mainWindow: ${!!mainWindow}`);
  console.log(`  - mevLoadBalancer: ${!!mevLoadBalancer}`);

  try {
    const app = express();
    console.log('✅ [API-SERVER] Express app created');

    app.use(express.json());
    console.log('✅ [API-SERVER] JSON middleware added');

    // ============= Tasks Endpoints =============

    /**
     * GET /api/tasks - Получение списка задач
     */
    app.get('/api/tasks', async (_req: Request, res: Response): Promise<void> => {
      try {
        const processes = getProcesses();
        const tasks: TaskApiInfo[] = Object.keys(processes).map((taskId) => ({
          id: taskId,
          status: processes[taskId].isActive ? 'Running' : 'Stopped',
          moduleName: processes[taskId].moduleName,
          startTime: processes[taskId].startTime,
          pid: processes[taskId].pid,
        }));

        res.json({ success: true, data: tasks } as ApiResponse<TaskApiInfo[]>);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * GET /api/tasks/:taskId - Получение информации о задаче
     */
    app.get('/api/tasks/:taskId', async (req: Request, res: Response): Promise<void> => {
      try {
        const { taskId } = req.params;
        const processes = getProcesses();
        const task = processes[taskId];

        if (!task) {
          res.json({ success: false, error: 'Task not found' } as ApiResponse);
          return;
        }

        const taskInfo: TaskApiInfo = {
          id: taskId,
          status: task.isActive ? 'Running' : 'Stopped',
          moduleName: task.moduleName,
          startTime: task.startTime,
          pid: task.pid,
        };

        res.json({ success: true, data: taskInfo } as ApiResponse<TaskApiInfo>);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * POST /api/tasks/:taskId/start - Запуск задачи
     */
    app.post('/api/tasks/:taskId/start', async (req: Request, res: Response): Promise<void> => {
      try {
        const { taskId } = req.params;

        if (mainWindow) {
          mainWindow.webContents.send('telegram-start-task', taskId);
        }

        res.json({ success: true } as ApiResponse);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId/start:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * POST /api/tasks/:taskId/stop - Остановка задачи
     */
    app.post('/api/tasks/:taskId/stop', async (req: Request, res: Response): Promise<void> => {
      try {
        const { taskId } = req.params;

        if (mainWindow) {
          mainWindow.webContents.send('telegram-stop-task', taskId);
        }

        res.json({ success: true } as ApiResponse);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId/stop:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * DELETE /api/tasks/:taskId - Удаление задачи
     */
    app.delete('/api/tasks/:taskId', async (req: Request, res: Response): Promise<void> => {
      try {
        const { taskId } = req.params;

        if (mainWindow) {
          mainWindow.webContents.send('telegram-remove-task', taskId);
        }

        res.json({ success: true } as ApiResponse);
      } catch (error) {
        console.error('[API-SERVER] Error in DELETE /api/tasks/:taskId:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * GET /api/tasks/:taskId/logs - Получение логов задачи
     */
    app.get('/api/tasks/:taskId/logs', async (req: Request, res: Response): Promise<void> => {
      try {
        const { taskId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        const processes = getProcesses();
        const task = processes[taskId];

        if (!task) {
          res.json({ success: false, error: 'Task not found' } as ApiResponse);
          return;
        }

        const logs = task.logs?.slice(-limit) || [];
        res.json({ success: true, data: logs } as ApiResponse<string[]>);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId/logs:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    console.log('✅ [API-SERVER] Tasks routes registered');

    // ============= MEV Endpoints =============

    /**
     * POST /api/mev/start - Запуск MEV балансировщика
     */
    app.post('/api/mev/start', async (_req: Request, res: Response): Promise<void> => {
      try {
        const result = await mevLoadBalancer.start();
        res.json(result);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/start:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * POST /api/mev/stop - Остановка MEV балансировщика
     */
    app.post('/api/mev/stop', async (_req: Request, res: Response): Promise<void> => {
      try {
        const result = await mevLoadBalancer.stop();
        res.json(result);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/stop:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * GET /api/mev/processes - Получение списка MEV процессов
     */
    app.get('/api/mev/processes', async (_req: Request, res: Response): Promise<void> => {
      try {
        const processes = mevLoadBalancer.getProcesses();
        res.json({ success: true, data: processes } as ApiResponse<typeof processes>);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/processes:', error);
        res.json({ success: false, error: (error as Error).message } as ApiResponse);
      }
    });

    /**
     * POST /api/mev/processes/:processId/stop - Остановка MEV процесса
     */
    app.post(
        '/api/mev/processes/:processId/stop',
        async (req: Request, res: Response): Promise<void> => {
          try {
            const { processId } = req.params;
            const result = await mevLoadBalancer.stopProcess(processId);
            res.json(result);
          } catch (error) {
            console.error('[API-SERVER] Error in /api/mev/processes/:processId/stop:', error);
            res.json({ success: false, error: (error as Error).message } as ApiResponse);
          }
        }
    );

    /**
     * GET /api/mev/processes/:processId/logs - Получение логов MEV процесса
     */
    app.get(
        '/api/mev/processes/:processId/logs',
        async (req: Request, res: Response): Promise<void> => {
          try {
            const { processId } = req.params;
            const lines = parseInt(req.query.lines as string) || 20;

            const logs = await mevLoadBalancer.getProcessLogs(processId, lines);
            res.json({ success: true, data: logs || [] } as ApiResponse<string[]>);
          } catch (error) {
            console.error('[API-SERVER] Error in /api/mev/processes/:processId/logs:', error);
            res.json({ success: false, error: (error as Error).message } as ApiResponse);
          }
        }
    );

    console.log('✅ [API-SERVER] MEV routes registered');

    // ============= Health Endpoint =============

    /**
     * GET /health - Проверка состояния сервера
     */
    app.get('/health', (_req: Request, res: Response): void => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    console.log('✅ [API-SERVER] Health route registered');

    // ============= Start Server =============

    const PORT = process.env.ELECTRON_API_PORT || 3002;
    console.log(`🔌 [API-SERVER] Attempting to start server on port ${PORT}...`);

    const server = app.listen(PORT, () => {
      console.log(`✅✅✅ [API-SERVER] Server SUCCESSFULLY STARTED on port ${PORT} ✅✅✅`);
      console.log(`[API-SERVER] Time: ${new Date().toISOString()}`);
      console.log(`[API-SERVER] Health endpoint: http://localhost:${PORT}/health`);
    });

    // Обработка ошибок запуска сервера
    server.on('error', (error: NodeJS.ErrnoException) => {
      console.error('❌❌❌ [API-SERVER] Server ERROR:', error);
      console.error(`[API-SERVER] Error code: ${error.code}`);
      console.error(`[API-SERVER] Error message: ${error.message}`);
      console.error(`[API-SERVER] Stack: ${error.stack}`);

      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.error(
            `Try: 1) Kill process on port ${PORT}, or 2) Set ELECTRON_API_PORT env variable`
        );
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${PORT}`);
      }
    });

    server.on('listening', () => {
      const addr = server.address();
      console.log(`🎧 [API-SERVER] Server is LISTENING on`, addr);
    });

    server.on('close', () => {
      console.log('🛑 [API-SERVER] Server closed');
    });

    console.log('✅ [API-SERVER] Server setup completed, returning app instance');
    return app;
  } catch (error) {
    console.error('❌❌❌ [API-SERVER] CRITICAL ERROR in createApiServer:', error);
    console.error('[API-SERVER] Stack:', (error as Error).stack);
    throw error;
  }
}

console.log('✅ [API-SERVER] Module loaded successfully');