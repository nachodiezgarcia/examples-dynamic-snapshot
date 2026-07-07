# Opción 3 · Redis pub/sub (Docker en local)

Parte de la guía _Dynamic Snapshot con TanStack Start_. Construida sobre el
[proyecto base](../00-base-project).

El JSON vive en Redis. Un **publisher** exporta el snapshot, hace `SET` + `PUBLISH`, y **todas las
instancias suscritas** se refrescan a la vez. Ideal para escalado horizontal.

---

## 1. Levantar Redis

```bash
docker run -d --name redis -p 6379:6379 redis:7
```

## 2. Dependencias

```bash
npm i redis
npm i -D tsx     # para ejecutar el script publisher en TypeScript
```

Añade al `.env`:

```bash
REDIS_URL=redis://localhost:6379
```

## 3. Conexión a Redis y suscripción en el servidor

```ts
// src/server/redis.ts
import 'dotenv/config';
import { createClient as createRedis } from 'redis';

export const redis = createRedis({ url: process.env.REDIS_URL });
export const redisReady = redis.connect();
```

```ts
// src/server/content-island.ts  (cambia el snapshotLoader + añade la suscripción)
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
```

> Con este cableado **ya no necesitas el endpoint HTTP** de refresh para esta opción: el disparo
> llega por el canal de Redis. Puedes dejar la ruta del paso 6 del proyecto base como forma manual
> de forzar un refresh, o quitarla.

## 4. Publisher (export → SET → PUBLISH)

```ts
// scripts/publish-redis.ts
import 'dotenv/config';
import { exportSnapshot } from '@content-island/api-client';
import { createClient as createRedis } from 'redis';

const redis = createRedis({ url: process.env.REDIS_URL });
await redis.connect();

const snapshot = await exportSnapshot({ accessToken: process.env.CONTENT_ISLAND_TOKEN! });
await redis.set('content-island:snapshot', JSON.stringify(snapshot));
await redis.publish('content-island:updated', '1');

await redis.quit();
console.log('✅ snapshot publicado en Redis');
```

## 5. Probarlo en local (con varias instancias, que es la gracia)

```bash
set -a; source .env; set +a

# 1) SIEMBRA Redis antes de arrancar las apps
npx tsx scripts/publish-redis.ts

# 2) arranca DOS instancias en puertos distintos (simula el escalado horizontal)
PORT=3000 npm run dev
# en otra terminal:
PORT=3001 npm run dev
```

Abre `http://localhost:3000` y `http://localhost:3001`: ambas muestran el mismo `exportedAt`.

Ahora publica contenido nuevo en Content Island y lanza **una sola vez** el publisher:

```bash
npx tsx scripts/publish-redis.ts
```

Recarga **las dos** páginas: las dos instancias han actualizado su `exportedAt` a la vez, con un
único `PUBLISH` — sin builds, sin llamar N veces al API, sin webhooks por instancia. Eso es lo que
te da Redis pub/sub.

---

## (Opcional) docker-compose para MinIO + Redis

Si quieres levantar todo de una:

```yaml
# docker-compose.yml
services:
  minio:
    image: quay.io/minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
  redis:
    image: redis:7
    ports: ["6379:6379"]
```

```bash
docker compose up -d
```
