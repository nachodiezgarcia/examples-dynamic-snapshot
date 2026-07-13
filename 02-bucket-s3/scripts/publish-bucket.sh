# scripts/publish-bucket.sh
#!/usr/bin/env bash
set -euo pipefail
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_DEFAULT_REGION=us-east-1
export CONTENT_ISLAND_TOKEN=tu-key-content-island
export REFRESH_SECRET=dev-secret
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