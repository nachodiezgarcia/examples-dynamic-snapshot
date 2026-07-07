import { createClient as createRedis } from 'redis';

export const redis = createRedis({ url: process.env.REDIS_URL });
export const redisReady = redis.connect();