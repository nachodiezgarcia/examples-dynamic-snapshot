# Opción 2 · Bucket S3 (MinIO en local)

Parte de la guía _Dynamic Snapshot con TanStack Start_. Construida sobre el
[proyecto base](../00-base-project).

Aquí el JSON vive en un bucket. Levantamos **MinIO** (S3 en local), y un script hace de "GitHub
Action": exporta el snapshot, lo sube al bucket y avisa a la app.

---

## 1. Levantar MinIO

```bash
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"
```

- API S3: `http://localhost:9000`  ·  Consola web: `http://localhost:9001` (minioadmin / minioadmin).

## 2. Crear el bucket y hacerlo de lectura pública

Usamos el cliente `mc` de MinIO vía Docker (sin instalar nada):

```bash
alias mc='docker run --rm -i --network=host \
-e MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
quay.io/minio/mc'

mc mb local/content-island                 # crea el bucket
mc anonymous set download local/content-island   # GET público (como un bucket público)
```

El JSON quedará accesible en:
`http://localhost:9000/content-island/content-island-snapshot.json`

## 3. Cambiar el `snapshotLoader` para leer del bucket

```ts
// src/server/content-island.ts  (solo cambia el snapshotLoader)
import 'dotenv/config';
import { createClient } from '@content-island/api-client';

const accessToken = process.env.CONTENT_ISLAND_TOKEN!;

export const contentIslandClient = createClient({
  accessToken,
  mode: 'snapshot',
  // 👇 OPCIÓN 2: el loader lee el JSON del bucket
  snapshotLoader: async () => {
    const res = await fetch(process.env.SNAPSHOT_URL!, { cache: 'no-store' });
    return res.text();
  },
});

let primed: Promise<unknown> | null = null;
export function ensureSnapshot() {
  if (!primed) primed = contentIslandClient.refreshSnapshot();
  return primed;
}
```

Añade al `.env`:

```bash
SNAPSHOT_URL=http://localhost:9000/content-island/content-island-snapshot.json
```

## 4. Script que hace de "GitHub Action" (export → bucket → avisar)

```bash
# scripts/publish-bucket.sh
#!/usr/bin/env bash
set -euo pipefail

export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_DEFAULT_REGION=us-east-1

# 1) Exporta el snapshot desde Content Island
npx content-island export \
  --access-token "$CONTENT_ISLAND_TOKEN" \
  --snapshot-path ./content-island-snapshot.json

# 2) Súbelo al bucket (MinIO habla S3; solo cambia el --endpoint-url)
aws --endpoint-url http://localhost:9000 s3 cp \
  ./content-island-snapshot.json \
  s3://content-island/content-island-snapshot.json

# 3) Avisa a la app para que recargue en memoria
curl -fsS -X POST http://localhost:3000/api/content-island/refresh \
  -H "x-refresh-secret: $REFRESH_SECRET"
echo "✅ snapshot publicado y app avisada"
```

```bash
chmod +x scripts/publish-bucket.sh
```

## 5. Probarlo en local

```bash
# 0) exporta las vars del .env a tu shell (o usa `set -a; source .env; set +a`)
set -a; source .env; set +a

# 1) SIEMBRA el bucket antes de arrancar la app (si no, el primer refresh no encuentra JSON)
./scripts/publish-bucket.sh

# 2) arranca la app
npm run dev
# http://localhost:3000  ->  lee el JSON desde MinIO
```

Ahora, cada vez que publiques contenido en Content Island, lanza de nuevo el script y recarga la
página. El orden importa: **primero sube al bucket, luego avisa** — así el refresh ya lee la versión
nueva.

```bash
./scripts/publish-bucket.sh    # simula el webhook -> Action -> refresh
```

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
