import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  db: parseInt(process.env.REDIS_DB ?? '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error: Error) => {
  logger.error({ error }, 'Redis connection error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

export const createRedisConnection = () => {
  return new Redis(redisConfig);
};

export default redis;
