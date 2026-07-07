# Opción 1 · Cargar desde el API de Content Island

Parte de la guía _Dynamic Snapshot con TanStack Start_. Este proyecto es el
[proyecto base](../00-base-project) sin cambios: **cero infraestructura**.

El `snapshotLoader` ya tira del API con `exportSnapshot()` (es la versión del paso 3 del proyecto
base). El refresh lo dispara una GitHub Action que llama a tu endpoint; en local lo simulamos con
`curl`.

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

let primed: Promise<unknown> | null = null;
export function ensureSnapshot() {
  if (!primed) primed = contentIslandClient.refreshSnapshot();
  return primed;
}
```

---

## Probarlo en local

```bash
npm run dev
# abre http://localhost:3000  ->  verás exportedAt y el recuento
```

En otra terminal, simula lo que haría la GitHub Action al publicar contenido:

```bash
curl -fsS -X POST http://localhost:3000/api/content-island/refresh \
  -H "x-refresh-secret: dev-secret"
# -> {"status":"updated","meta":{...}}   (o "unchanged" si no hay nada nuevo)
```

Publica algo en Content Island, vuelve a lanzar el `curl` y **recarga la página**: `exportedAt`
habrá cambiado, sin reiniciar el servidor ni rebuild.

Comprueba también la protección del endpoint:

```bash
curl -i -X POST http://localhost:3000/api/content-island/refresh   # sin secreto -> 401
```

## En producción

La GitHub Action del post (`.github/workflows/refresh.yml`) hace exactamente ese `curl`, disparada
por el webhook de Content Island vía `repository_dispatch`. Guarda `APP_URL` y `REFRESH_SECRET` como
secrets del repo.
