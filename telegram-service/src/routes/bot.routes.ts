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
      return { success: true };
    }
  );

  fastify.get<{ Reply: ApiResponse<BotStatus> }>('/bot/status', async (request, reply) => {
    return {
      success: true,
      data: {
        isActive: true,
        lastActivity: new Date().toISOString(),
      },
    };
  });

  fastify.post<{ Reply: ApiResponse }>('/bot/start', async (request, reply) => {
    try {
      await botService.startPolling();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  fastify.post<{ Reply: ApiResponse }>('/bot/stop', async (request, reply) => {
    try {
      botService.stopPolling();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
};
