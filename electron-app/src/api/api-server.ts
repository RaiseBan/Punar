import express, { Request, Response, Application } from 'express';
import { BrowserWindow } from 'electron';
import { getProcesses } from '../ipcHandlers/processHandler';
import { ApiResponse, TaskApiInfo } from '../../../shared/types';
import logger from "../services/loggerService";

logger.info(logger.LOG_MODULES.SYSTEM, '📦 [API-SERVER] Module loading...');

export function createApiServer(
    mainWindow: BrowserWindow | null
): Application {
  logger.info(logger.LOG_MODULES.SYSTEM, '🌐 [API-SERVER] createApiServer called');
  logger.info(logger.LOG_MODULES.SYSTEM, `  - mainWindow: ${!!mainWindow}`);
  try {
    const app = express();
    logger.info(logger.LOG_MODULES.SYSTEM, '✅ [API-SERVER] Express app created');

    app.use(express.json());
    logger.info(logger.LOG_MODULES.SYSTEM, '✅ [API-SERVER] JSON middleware added');

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

    logger.info(logger.LOG_MODULES.SYSTEM, '✅ [API-SERVER] Tasks routes registered');

    app.get('/health', (_req: Request, res: Response): void => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    logger.info(logger.LOG_MODULES.SYSTEM, '✅ [API-SERVER] Health route registered');

    const PORT = process.env.ELECTRON_API_PORT || 3002;
    logger.info(logger.LOG_MODULES.SYSTEM, `🔌 [API-SERVER] Attempting to start server on port ${PORT}...`);

    const server = app.listen(PORT, () => {
      logger.info(logger.LOG_MODULES.SYSTEM, `✅✅✅ [API-SERVER] Server SUCCESSFULLY STARTED on port ${PORT} ✅✅✅`);
      logger.info(logger.LOG_MODULES.SYSTEM, `[API-SERVER] Time: ${new Date().toISOString()}`);
      logger.info(logger.LOG_MODULES.SYSTEM, `[API-SERVER] Health endpoint: http://localhost:${PORT}/health`);
    });

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
      logger.info(logger.LOG_MODULES.SYSTEM, `🎧 [API-SERVER] Server is LISTENING on`, addr);
    });

    server.on('close', () => {
      logger.info(logger.LOG_MODULES.SYSTEM, '🛑 [API-SERVER] Server closed');
    });

    logger.info(logger.LOG_MODULES.SYSTEM, '✅ [API-SERVER] Server setup completed, returning app instance');
    return app;
  } catch (error) {
    console.error('❌❌❌ [API-SERVER] CRITICAL ERROR in createApiServer:', error);
    console.error('[API-SERVER] Stack:', (error as Error).stack);
    throw error;
  }
}

logger.info(logger.LOG_MODULES.SYSTEM, '✅ [API-SERVER] Module loaded successfully');