FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY . .

WORKDIR /app/server
RUN npm install --production --ignore-scripts || true

WORKDIR /app/client
RUN npm install --ignore-scripts || true
RUN npm run build || npx vite build

WORKDIR /app/server
RUN mkdir -p /app/data/logs

EXPOSE 3000

CMD ["node", "src/index.js"]
