import 'dotenv/config';
import { exportSnapshot } from '@content-island/api-client';
import { createClient as createRedis } from 'redis';

const redis = createRedis({ url: process.env.REDIS_URL });
await redis.connect();

const snapshot = await exportSnapshot({ accessToken:
process.env.CONTENT_ISLAND_TOKEN! });
await redis.set('content-island:snapshot', JSON.stringify(snapshot));
await redis.publish('content-island:updated', '1');

await redis.quit();
console.log('✅ snapshot publicado en Redis');