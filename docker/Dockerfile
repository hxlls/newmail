FROM --platform=$BUILDPLATFORM node:20-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY server/package*.json ./server/
COPY client/package*.json ./client/

WORKDIR /app/server
RUN npm install --only=production --no-fund

WORKDIR /app/client
RUN npm install --no-fund

FROM deps AS build

COPY server ./server
COPY client ./client

WORKDIR /app/client
RUN npm run build

FROM base AS production

COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server ./server

WORKDIR /app/server

RUN mkdir -p /app/data/logs

EXPOSE 3000

CMD ["node", "src/index.js"]
