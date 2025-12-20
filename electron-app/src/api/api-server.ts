import express, { Request, Response } from 'express';
import { BrowserWindow } from 'electron';
import { getProcesses } from '../ipcHandlers/processHandler';

console.log('📦 [API-SERVER] Module loading...');

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createApiServer(
    mainWindow: BrowserWindow | null,
    mevLoadBalancer: any
) {
  console.log('🌐 [API-SERVER] createApiServer called');
  console.log(`  - mainWindow: ${!!mainWindow}`);
  console.log(`  - mevLoadBalancer: ${!!mevLoadBalancer}`);

  try {
    const app = express();
    console.log('✅ [API-SERVER] Express app created');

    app.use(express.json());
    console.log('✅ [API-SERVER] JSON middleware added');

    // Tasks endpoints
    app.get('/api/tasks', async (req: Request, res: Response) => {
      try {
        const processes = getProcesses();
        const tasks = Object.keys(processes).map(taskId => ({
          id: taskId,
          status: processes[taskId].isActive ? 'Running' : 'Stopped',
          moduleName: processes[taskId].moduleName,
          startTime: processes[taskId].startTime,
          pid: processes[taskId].pid,
        }));

        res.json({ success: true, data: tasks });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.get('/api/tasks/:taskId', async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;
        const processes = getProcesses();
        const task = processes[taskId];

        if (!task) {
          res.json({ success: false, error: 'Task not found' });
          return;
        }

        res.json({
          success: true,
          data: {
            id: taskId,
            status: task.isActive ? 'Running' : 'Stopped',
            moduleName: task.moduleName,
            startTime: task.startTime,
            pid: task.pid,
          },
        });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.post('/api/tasks/:taskId/start', async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;

        if (mainWindow) {
          mainWindow.webContents.send('telegram-start-task', taskId);
        }

        res.json({ success: true });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId/start:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.post('/api/tasks/:taskId/stop', async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;

        if (mainWindow) {
          mainWindow.webContents.send('telegram-stop-task', taskId);
        }

        res.json({ success: true });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId/stop:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.delete('/api/tasks/:taskId', async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;

        if (mainWindow) {
          mainWindow.webContents.send('telegram-remove-task', taskId);
        }

        res.json({ success: true });
      } catch (error) {
        console.error('[API-SERVER] Error in DELETE /api/tasks/:taskId:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.get('/api/tasks/:taskId/logs', async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        const processes = getProcesses();
        const task = processes[taskId];
        if (!task) {
          res.json({ success: false, error: 'Task not found' });
          return;
        }

        const logs = task.logs?.slice(-limit) || [];
        res.json({ success: true, data: logs });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/tasks/:taskId/logs:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    console.log('✅ [API-SERVER] Tasks routes registered');

    // MEV endpoints
    app.post('/api/mev/start', async (req: Request, res: Response) => {
      try {
        const result = await mevLoadBalancer.start();
        res.json(result);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/start:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.post('/api/mev/stop', async (req: Request, res: Response) => {
      try {
        const result = await mevLoadBalancer.stop();
        res.json(result);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/stop:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.get('/api/mev/processes', async (req: Request, res: Response) => {
      try {
        const processes = mevLoadBalancer.getProcesses();
        res.json({ success: true, data: processes });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/processes:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.post('/api/mev/processes/:processId/stop', async (req: Request, res: Response) => {
      try {
        const { processId } = req.params;
        const result = await mevLoadBalancer.stopProcess(processId);
        res.json(result);
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/processes/:processId/stop:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    app.get('/api/mev/processes/:processId/logs', async (req: Request, res: Response) => {
      try {
        const { processId } = req.params;
        const lines = parseInt(req.query.lines as string) || 20;

        const logs = await mevLoadBalancer.getProcessLogs(processId, lines);
        res.json({ success: true, data: logs || [] });
      } catch (error) {
        console.error('[API-SERVER] Error in /api/mev/processes/:processId/logs:', error);
        res.json({ success: false, error: (error as Error).message });
      }
    });

    console.log('✅ [API-SERVER] MEV routes registered');

    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    console.log('✅ [API-SERVER] Health route registered');

    const PORT = process.env.ELECTRON_API_PORT || 3002;
    console.log(`🔌 [API-SERVER] Attempting to start server on port ${PORT}...`);

    // Создаем сервер с обработкой ошибок
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
        console.error(`Try: 1) Kill process on port ${PORT}, or 2) Set ELECTRON_API_PORT env variable`);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${PORT}`);
      }
    });

    // Дополнительное логирование
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
    console.error('[API-SERVER] Stack:', error.stack);
    throw error;
  }
}

console.log('✅ [API-SERVER] Module loaded successfully');