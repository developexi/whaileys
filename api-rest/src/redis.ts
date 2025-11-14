import { createClient } from 'redis';
import pino from 'pino';

const logger = pino({ level: 'info' });

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis-whaileys',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('✅ Conectado ao Redis');
});

export async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Erro ao conectar ao Redis:', error);
  }
}

export default redisClient;
