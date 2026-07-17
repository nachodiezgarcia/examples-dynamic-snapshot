# Parte 2 · Refresh por webhook (Vercel)

Parte de la guía _Static Snapshot con TanStack Start + Hono_. Construida sobre la [Parte 1](../04-static-local-with-docker). Aquí añadimos un **endpoint de refresh protegido con secreto** que recarga el contenido en caliente, **sin rebuild**. Lo dispara el **webhook de Content Island** cada vez que publicas: llama a `/api/refresh` en el api desplegado, que ejecuta `refreshSnapshot()` y trae contenido fresco del API de Content Island.

> El snapshot que va incrustado en el bundle (Parte 1) sigue siendo la semilla inicial. Con un token de lectura, el refresh actualiza ese contenido en memoria sin volver a desplegar.

---

## 1. El endpoint de refresh (protegido con secreto)

El backend Hono añade una ruta que valida un secreto compartido antes de refrescar. Con `CONTENT_ISLAND_READ_TOKEN` puesto, el loader pide el contenido en vivo; sin él, sirve el snapshot del bundle (como en la Parte 1).

```ts
// apps/api/src/app.ts  (resumido)
app.on(['GET', 'POST'], '/api/refresh', async (c) => {
  const secret = process.env.REFRESH_SECRET;
  const provided = c.req.header('x-refresh-secret') ?? c.req.query('secret');
  if (!secret || provided !== secret) {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }
  return c.json(await contentIslandClient.refreshSnapshot());
});
```

## 2. Configurar Vercel (desplegar el backend)

1. En [vercel.com](https://vercel.com) → **Add New… → Project** e **importa tu repositorio** de GitHub.
2. En **Root Directory** pulsa **Edit** y elige la carpeta del api: **`05-static-cd-workflow/apps/api`** (es un monorepo; Vercel debe apuntar a esa subcarpeta).
3. **Framework Preset:** `Other`. No hace falta build command: Vercel detecta la carpeta `api/` como función serverless y aplica el `vercel.json`.

  ```ts
  // apps/api/api/index.ts  — adaptador de Hono a la función de Vercel
  import { getRequestListener } from '@hono/node-server';
  import app from '../src/app.js';
  export default getRequestListener(app.fetch);
  ```

  ```json
  // apps/api/vercel.json  — manda todas las rutas al handler
  { "rewrites": [{ "source": "/(.*)", "destination": "/api" }] }
  ```

4. En **Environment Variables** añade estas dos (para *Production* y *Preview*):

   | Name | Value |
   | --- | --- |
   | `CONTENT_ISLAND_READ_TOKEN` | tu token de lectura de Content Island (necesario para que el refresh traiga contenido en vivo) |
   | `REFRESH_SECRET` | un secreto que inventas tú (p. ej. `openssl rand -hex 24`) |

5. Pulsa **Deploy**. Al terminar tendrás una URL tipo `https://tu-api.vercel.app`. Compruébalo:

  ```bash
  curl https://tu-api.vercel.app/health          # -> {"ok":true}
  ```

  Tu endpoint de refresh será: **`https://tu-api.vercel.app/api/refresh`**. Guárdalo para el paso 3.

> Si cambias las env vars en Vercel más adelante, haz **redeploy** para que la función use los nuevos valores.

## 3. Configurar GitHub (secrets del workflow)

El workflow `.github/workflows/refresh.yml` hace un `curl` a tu endpoint. Lee sus datos de los **secrets del repositorio**.

Ve a tu repo → **Settings → Secrets and variables → Actions → New repository secret** y crea:

| Secret | Valor |
| --- | --- |
| `REFRESH_URL` | `https://tu-api.vercel.app/api/refresh` |
| `REFRESH_SECRET` | el **mismo** secreto que pusiste en Vercel |

Puedes probar el workflow **a mano** antes de conectar Content Island: repo → pestaña **Actions** → `refresh.yml` → **Run workflow** (`workflow_dispatch`). Debe terminar en verde y mostrar `HTTP 200`.

## 4. Configurar Content Island (el webhook)

Content Island dispara el workflow llamando a la **API de _repository dispatch_ de GitHub**. Para autenticarse necesita un token de GitHub.

### 4.1. Crear el token de GitHub (fine-grained)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** *Only select repositories* → elige **este repositorio**.
3. **Permissions → Repository permissions → Contents: Read and write** (es el permiso que necesita la API de _repository dispatch_).
4. **Generate token** y **cópialo** (solo se muestra una vez).

### 4.2. Crear el webhook en Content Island

En tu proyecto de Content Island → sección **Webhooks** → **nuevo webhook de GitHub**. Te pedirá:

| Campo | Valor |
| --- | --- |
| **Propietario del repositorio** | Tu usuario u organización donde esté el repositorio |
| **Nombre del repositorio** | Nombre del repositorio |
| **Event name** | `content-refresh` |

El **event name** tiene que coincidir con el `types:` del workflow (`refresh.yml` escucha `content-refresh`).

> **Equivalente en crudo** (útil para probarlo con `curl`): Content Island hace este POST autenticado a la API de GitHub.
>
> ```bash
> curl -X POST https://api.github.com/repos/<owner>/<repo>/dispatches \
>   -H "Authorization: Bearer <TU_PAT_DE_GITHUB>" \
>   -H "Accept: application/vnd.github+json" \
>   -d '{"event_type":"content-refresh"}'
> ```

## 5. Probarlo de principio a fin

### En local (sin desplegar)

```bash
export REFRESH_SECRET=dev-secret
# opcional: export CONTENT_ISLAND_READ_TOKEN=... para pedir el contenido en vivo
npm install
npm run dev        # api :3001 · web :3000
```

Simula lo que hará el webhook y comprueba la protección del secreto:

```bash
curl -X POST http://localhost:3001/api/refresh \
  -H "x-refresh-secret: $REFRESH_SECRET"
# -> {"status":"updated"|"unchanged", ...}

curl -i -X POST http://localhost:3001/api/refresh   # sin secreto -> 401
```

Publica algo en Content Island, relanza el `curl` y **recarga** `http://localhost:3000`: el `exportedAt` de la home habrá cambiado, sin reiniciar ni rebuild.

### En producción (Vercel + GitHub + Content Island)

1. **Prueba el workflow a mano:** repo → **Actions** → `refresh.yml` → **Run workflow**. Debe dar `HTTP 200`.
2. **Prueba el webhook real:** publica un contenido en Content Island y verás una ejecución nueva del workflow disparada por `repository_dispatch`.
3. **Comprueba que refresca:** recarga tu web y mira que el `exportedAt` se ha actualizado.

Si algo falla, mira en orden: el log del workflow en **Actions**, los **Runtime Logs** de la función en Vercel, y que `REFRESH_URL`, `REFRESH_SECRET` y el token coincidan en todos los sitios.

---

## Referencias

- Content Island — [GitHub Webhooks](https://docs.contentisland.net/deployment/github-webhooks/) ·
  [Snapshot mode](https://docs.contentisland.net/es/advanced/snapshot-mode/) ·
  [`refreshSnapshot()`](https://docs.contentisland.net/es/client-api/refresh-snapshot/)
- [Hono en Vercel](https://hono.dev/docs/getting-started/vercel) ·
  [GitHub · `repository_dispatch`](https://docs.github.com/es/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)
