# Container App image for the fraudintel backend proxy (Option B). Builds the host-agnostic
# handlers into a tiny Node HTTP server (src/server.ts) that exposes the /api/* routes with CORS
# for the Rayfin origin. Built remotely by `az containerapp up --source` (ACR Tasks) — no local
# Docker daemon and no managed-mirror lock pollution (ACR build hits the public npm registry).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.js"]
