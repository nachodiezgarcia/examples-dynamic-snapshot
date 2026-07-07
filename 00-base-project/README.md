# Parte 0 · Proyecto base (común a las 3 opciones)

Esta carpeta contiene el **proyecto base de TanStack Start** sobre el que se construyen las tres
opciones de _Dynamic Snapshot_ con Content Island. En cada opción cambiamos **únicamente dos
piezas**: el `snapshotLoader` (de dónde se lee el JSON) y quién dispara `refreshSnapshot()`. El
resto de este proyecto base no se toca.

- Opción 1 · [`01-api-load`](../01-api-load) — cargar desde el API de Content Island.
- Opción 2 · [`02-bucket-s3`](../02-bucket-s3) — bucket S3 (MinIO en local).
- Opción 3 · [`03-redis-pub-sub`](../03-redis-pub-sub) — Redis pub/sub (Docker en local).

---

## Requisitos

- **Node.js 20+** y **npm**.
- **Docker** (para MinIO y Redis en las opciones 2 y 3).
- Un **token de lectura** de tu proyecto en Content Island (`CONTENT_ISLAND_TOKEN`).
  Con prefijo `PREVIEW_` exportarás también borradores; sin prefijo, solo publicado.
- **AWS CLI** instalado (solo Opción 2), para subir el JSON al bucket local.

---

## 1. Crear el proyecto

```bash
npx @tanstack/cli create content-island-dynamic
# Elige tu gestor de paquetes y TypeScript. No hacen falta add-ons.
cd content-island-dynamic
npm i @content-island/api-client
npm i dotenv          # para cargar el .env también en el proceso de servidor
```

El scaffold levanta un proyecto Vite con file-based routing y `src/routes/__root.tsx` +
`src/routes/index.tsx`. El dev server escucha en `http://localhost:3000`.

## 2. Variables de entorno

Crea un `.env` en la raíz (no lo subas al repo):

```bash
# .env
CONTENT_ISLAND_TOKEN=tu-token-de-lectura
REFRESH_SECRET=dev-secret
```

## 3. Cliente de Content Island (singleton de servidor)

El snapshot vive **en memoria del servidor**, así que el cliente tiene que ser un singleton que
solo se instancia en el backend. Creamos `src/server/content-island.ts`.

> ⚠️ Este es el **único fichero que cambia entre opciones** (la función `snapshotLoader`).
> Abajo está la versión de la Opción 1; en las opciones 2 y 3 se sustituye el `snapshotLoader`.

```ts
// src/server/content-island.ts
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
```

## 4. Server function para leer contenido

Con `createServerFn` leemos del snapshot en memoria. Exponemos el `exportedAt` del snapshot y un
recuento de contenidos para **ver a simple vista** cuándo se ha refrescado.

```ts
// src/server/content.ts
import { createServerFn } from '@tanstack/react-start';
import { contentIslandClient, ensureSnapshot } from './content-island';

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureSnapshot();
  const info = await contentIslandClient.getSnapshotInfo();
  // Ajusta el contentType al de tu proyecto (o quita el filtro para traer todo).
  const posts = await contentIslandClient.getContentList({ contentType: 'post' });
  return { exportedAt: info.exportedAt, count: posts.length };
});
```

## 5. Página que muestra el estado del snapshot

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { getHomeData } from '../server/content';

export const Route = createFileRoute('/')({
  loader: () => getHomeData(),
  component: Home,
});

function Home() {
  const { exportedAt, count } = Route.useLoaderData();
  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>Content Island · Dynamic Snapshot</h1>
      <p>Snapshot exportado: <strong>{exportedAt}</strong></p>
      <p>Contenidos en memoria: <strong>{count}</strong></p>
      <p style={{ color: '#666' }}>
        Dispara un refresh y recarga esta página: <code>exportedAt</code> cambiará.
      </p>
    </main>
  );
}
```

## 6. Endpoint de refresh protegido con secreto

Esta es la ruta que dispararán el webhook / la GitHub Action / el publisher. Valida el secreto
compartido antes de tocar nada.

```ts
// src/routes/api.content-island.refresh.ts  ->  POST /api/content-island/refresh
import { createFileRoute } from '@tanstack/react-router';
import { contentIslandClient } from '../server/content-island';

export const Route = createFileRoute('/api/content-island/refresh')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get('x-refresh-secret') !== process.env.REFRESH_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }
        const result = await contentIslandClient.refreshSnapshot();
        return Response.json(result); // { status: 'updated' | 'unchanged', meta: {...} }
      },
    },
  },
});
```

Con esto el proyecto base está listo. Cada opción a partir de aquí solo cambia el `snapshotLoader`
(paso 3) y **cómo se dispara** el refresh.

---

## Referencias

- Content Island — [Snapshot mode](https://docs.contentisland.net/es/advanced/snapshot-mode/) ·
  [`exportSnapshot()`](https://docs.contentisland.net/es/client-api/export-snapshot/) ·
  [`refreshSnapshot()`](https://docs.contentisland.net/es/client-api/refresh-snapshot/) ·
  [`getSnapshotInfo()`](https://docs.contentisland.net/es/client-api/get-snapshot-info/)
- [TanStack Start · Server Routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [TanStack Start · Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [MinIO](https://min.io/docs/minio/container/index.html) · [Redis (Docker)](https://hub.docker.com/_/redis)
