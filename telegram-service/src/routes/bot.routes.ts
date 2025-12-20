import { FastifyPluginAsync } from 'fastify';
import { botService } from '../services/bot.service';
import { BotConfig, BotStatus, ApiResponse } from '../types/api.types';

export const botRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: BotConfig; Reply: ApiResponse }>(
      '/bot/config',
      {
        schema: {
          body: {
            type: 'object',
            required: ['botToken', 'chatIds'],
            properties: {
              botToken: { type: 'string' },
              chatIds: { type: 'array', items: { type: 'number' } },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          const { botToken, chatIds } = request.body;
          botService.updateConfig(botToken, chatIds);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
  );

  fastify.get<{ Reply: ApiResponse<BotStatus> }>('/bot/status', async (request, reply) => {
    const status = botService.getStatus();
    return {
      success: true,
      data: status,
    };
  });

  // Убираем schema для body - разрешаем пустой body
  fastify.post<{ Reply: ApiResponse }>('/bot/start', async (request, reply) => {
    try {
      await botService.startPolling();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Убираем schema для body - разрешаем пустой body
  fastify.post<{ Reply: ApiResponse }>('/bot/stop', async (request, reply) => {
    try {
      await botService.stopPolling();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
};