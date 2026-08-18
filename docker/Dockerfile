FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
COPY client/package*.json ./client/

WORKDIR /app/server
RUN npm install --production --ignore-scripts && npm rebuild better-sqlite3 --build-from-source 2>/dev/null || true

WORKDIR /app/client
RUN npm install --ignore-scripts

COPY server ./server
COPY client ./client

WORKDIR /app/client
RUN npx tsc --noEmit 2>/dev/null || true && npx vite build

WORKDIR /app/server

RUN mkdir -p /app/data/logs

EXPOSE 3000

CMD ["node", "src/index.js"]
