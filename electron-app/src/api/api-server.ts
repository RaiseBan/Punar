import express, { Request, Response } from 'express';
import { BrowserWindow } from 'electron';
import { getProcesses } from '../ipcHandlers/processHandler';

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createApiServer(
  mainWindow: BrowserWindow | null,
  mevLoadBalancer: any
) {
  const app = express();
  app.use(express.json());

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
      res.json({ success: false, error: (error as Error).message });
    }
  });

  // MEV endpoints
  app.post('/api/mev/start', async (req: Request, res: Response) => {
    try {
      const result = await mevLoadBalancer.start();
      res.json(result);
    } catch (error) {
      res.json({ success: false, error: (error as Error).message });
    }
  });

  app.post('/api/mev/stop', async (req: Request, res: Response) => {
    try {
      const result = await mevLoadBalancer.stop();
      res.json(result);
    } catch (error) {
      res.json({ success: false, error: (error as Error).message });
    }
  });

  app.get('/api/mev/processes', async (req: Request, res: Response) => {
    try {
      const processes = mevLoadBalancer.getProcesses();
      res.json({ success: true, data: processes });
    } catch (error) {
      res.json({ success: false, error: (error as Error).message });
    }
  });

  app.post('/api/mev/processes/:processId/stop', async (req: Request, res: Response) => {
    try {
      const { processId } = req.params;
      const result = await mevLoadBalancer.stopProcess(processId);
      res.json(result);
    } catch (error) {
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
      res.json({ success: false, error: (error as Error).message });
    }
  });

  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const PORT = process.env.ELECTRON_API_PORT || 3002;
  app.listen(PORT, () => {
    console.log(`[Electron API] Server running on port ${PORT}`);
  });

  return app;
}