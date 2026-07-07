import 'dotenv/config';
import { createClient, exportSnapshot } from '@content-island/api-client';

const accessToken = process.env.CONTENT_ISLAND_TOKEN!;

export const contentIslandClient = createClient({
    accessToken,
    mode: 'snapshot',
    // 👇 OPCIÓN 1: el loader tira del API de Content Island con exportSnapshot()
    snapshotLoader: async () => exportSnapshot({ accessToken }),
});

// Carga inicial del snapshot la primera vez que se usa el cliente en el servidor.
let primed: Promise<unknown> | null = null;
export function ensureSnapshot() {
    if (!primed) primed = contentIslandClient.refreshSnapshot();
    return primed;
}