import 'dotenv/config';
import { createClient } from '@content-island/api-client';

const accessToken = process.env.CONTENT_ISLAND_TOKEN!;

export const contentIslandClient = createClient({
    accessToken,
    mode: 'snapshot',
    // 👇 OPCIÓN 2: el loader lee el JSON del bucket
    snapshotLoader: async () => {
        const res = await fetch(process.env.SNAPSHOT_URL!, {
            cache: 'no-store'
        });
        
        return res.text();
    },
});

// Carga inicial del snapshot la primera vez que se usa el cliente en el servidor.
let primed: Promise<unknown> | null = null;
export function ensureSnapshot() {
    if (!primed) primed = contentIslandClient.refreshSnapshot();
    return primed;
}