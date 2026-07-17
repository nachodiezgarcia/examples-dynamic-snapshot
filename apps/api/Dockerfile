# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

# El snapshot vive en apps/api y esbuild lo incrusta en el bundle.
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api ./apps/api
RUN npm run build -w @app/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV BACKEND_PORT=3001

COPY --from=build /app/apps/api/dist/server.js ./server.js

EXPOSE 3001
CMD ["node", "server.js"]
