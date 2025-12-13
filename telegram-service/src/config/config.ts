import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  botToken: string;
  chatIds: number[];
  electronApiUrl: string;
  serviceApiKey: string;
}

function parseEnv(): Config {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    throw new Error('BOT_TOKEN is required');
  }

  const chatIdsStr = process.env.CHAT_IDS || '';
  const chatIds = chatIdsStr
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));

  const electronApiUrl = process.env.ELECTRON_API_URL || 'http://localhost:3002';
  const serviceApiKey = process.env.SERVICE_API_KEY || 'default-key';
  const port = parseInt(process.env.PORT || '3003', 10);

  return {
    port,
    botToken,
    chatIds,
    electronApiUrl,
    serviceApiKey,
  };
}

export const config = parseEnv();
