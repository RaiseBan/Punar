import { FastifyPluginAsync } from 'fastify';
import { botService } from '../services/bot.service';
import {
  TaskNotificationRequest,
  TaskStatusRequest,
  SystemNotificationRequest,
  PoolChangeNotificationRequest,
  ApiResponse,
} from '../types/api.types';
import { electronClient } from '../services/electron-client.service';

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: TaskNotificationRequest; Reply: ApiResponse }>(
    '/notifications/task',
    {
      schema: {
        body: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string' },
            rowIndex: { type: 'number' },
            rowId: { type: 'string' },
            token: { type: 'string' },
            volumeChange: { type: 'string' },
            volumeValue: { type: 'string' },
            allCells: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { taskId, token, volumeChange, volumeValue } = request.body;

      let message = `🚀 <b>Запущена задача ${taskId}</b>\n\n`;
      if (token) message += `Токен: <code>${token}</code>\n`;
      if (volumeChange) message += `Изменение объема: ${volumeChange}\n`;
      if (volumeValue) message += `Значение: ${volumeValue}\n`;

      await botService.broadcastMessage(message);
      return { success: true };
    }
  );

  fastify.post<{ Body: TaskStatusRequest; Reply: ApiResponse }>(
    '/notifications/task-status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { taskId } = request.body;

      try {
        const task = await electronClient.getTask(taskId);
        if (!task) {
          return { success: false, error: 'Task not found' };
        }

        const logs = await electronClient.getTaskLogs(taskId, 5);
        
        let message = `📊 <b>Статус задачи ${taskId}</b>\n\n`;
        message += `Название: ${task.name || 'N/A'}\n`;
        message += `Модуль: ${task.moduleName || 'N/A'}\n`;
        message += `Статус: ${task.status || 'N/A'}\n\n`;
        
        if (logs.length > 0) {
          message += `<b>Последние логи:</b>\n`;
          logs.forEach(log => {
            const trimmed = log.length > 100 ? log.substring(0, 97) + '...' : log;
            message += `• ${trimmed}\n`;
          });
        }

        await botService.broadcastMessage(message);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  fastify.post<{ Body: SystemNotificationRequest; Reply: ApiResponse }>(
    '/notifications/system',
    {
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      await botService.broadcastMessage(request.body.message);
      return { success: true };
    }
  );

  fastify.post<{ Body: PoolChangeNotificationRequest; Reply: ApiResponse }>(
    '/notifications/pool-change',
    {
      schema: {
        body: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string' },
            oldPool: { type: 'string' },
            newPool: { type: 'string' },
            tokenAddress: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { taskId, oldPool, newPool, tokenAddress } = request.body;

      const message =
        `🔄 <b>Обнаружена смена пула Meteora</b>\n\n` +
        `Задача ID: ${taskId}\n` +
        `Токен: ${tokenAddress || 'не указан'}\n` +
        `Старый пул: ${oldPool || 'не указан'}\n` +
        `Новый пул: ${newPool || 'не указан'}\n` +
        `Время: ${new Date().toISOString()}\n\n` +
        `Процесс будет перезапущен автоматически с новым пулом.`;

      await botService.broadcastMessage(message);
      return { success: true };
    }
  );
};
