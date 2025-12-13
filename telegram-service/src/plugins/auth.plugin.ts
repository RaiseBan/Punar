import { FastifyPluginAsync } from 'fastify';
import { config } from '../config/config';

export const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const apiKey = request.headers['x-api-key'];
    
    if (apiKey !== config.serviceApiKey) {
      reply.code(401).send({ 
        success: false, 
        error: 'Unauthorized: Invalid API key' 
      });
    }
  });
};
