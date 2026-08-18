#!/bin/bash
# Start script for NewMail

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="/vol1/app_data/newmail"

# 检查环境变量文件
if [ ! -f "$DATA_DIR/.env" ]; then
    cat > "$DATA_DIR/.env" << EOF
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DB_PATH=/app/data/newmail.db
LOG_PATH=/app/data/logs
NODE_ENV=production
EOF
fi

# 启动 Docker 容器
docker run -d \
    --name newmail \
    --restart unless-stopped \
    -p 3000:3000 \
    -v "$DATA_DIR:/app/data" \
    --env-file "$DATA_DIR/.env" \
    ghcr.io/yourusername/newmail:latest

echo "NewMail started on port 3000"
