import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/config';
import { authPlugin } from './plugins/auth.plugin';
import { botRoutes } from './routes/bot.routes';
import { notificationRoutes } from './routes/notification.routes';
import { botService } from './services/bot.service';
import { registerCommands } from './commands';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

async function start(): Promise<void> {
  try {
    await fastify.register(cors, {
      origin: true,
    });

    await fastify.register(authPlugin);

    await fastify.register(botRoutes, { prefix: '/api' });
    await fastify.register(notificationRoutes, { prefix: '/api' });

    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    registerCommands();
    fastify.log.info('Telegram commands registered');

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${config.port}`);
    fastify.log.info('Bot is stopped. Use POST /api/bot/start to start polling');
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  fastify.log.info('Received SIGINT, shutting down gracefully...');
  await botService.stopPolling();
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  fastify.log.info('Received SIGTERM, shutting down gracefully...');
  await botService.stopPolling();
  await fastify.close();
  process.exit(0);
});

start();