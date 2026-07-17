# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
RUN npm run build -w @app/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_URL=http://api:3001

COPY --from=build /app/apps/web/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
