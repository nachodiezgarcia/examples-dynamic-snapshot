import 'dotenv/config';
import { createClient } from '@content-island/api-client';
import { redis, redisReady } from './redis';

const accessToken = process.env.CONTENT_ISLAND_TOKEN!;
const SNAPSHOT_KEY = 'content-island:snapshot';
const CHANNEL = 'content-island:updated';

export const contentIslandClient = createClient({
    accessToken,
    mode: 'snapshot',
    // 👇 OPCIÓN 3: el loader lee el JSON de Redis
    snapshotLoader: async () => {
        await redisReady;
        return (await redis.get(SNAPSHOT_KEY)) ?? '';
    },
});

// Suscripción: al primer uso del cliente en el servidor, esta instancia escucha el canal
// y se refresca sola cada vez que el publisher avisa.
let primed: Promise<unknown> | null = null;
export function ensureSnapshot() {
    if (!primed) {
        primed = (async () => {
            await redisReady;
            const sub = redis.duplicate();
            await sub.connect();
            await sub.subscribe(CHANNEL, () => {
                contentIslandClient.refreshSnapshot().catch(console.error);
            });
            await contentIslandClient.refreshSnapshot(); // carga inicial
        })();
    }
    return primed;
}