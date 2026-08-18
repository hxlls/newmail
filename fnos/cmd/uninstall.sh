#!/bin/bash
# Uninstall script for NewMail

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="/vol1/app_data/newmail"

# 停止容器
docker stop newmail 2>/dev/null || true
docker rm newmail 2>/dev/null || true

# 删除镜像
docker rmi ghcr.io/yourusername/newmail:latest 2>/dev/null || true

# 询问是否删除数据
if [ "$1" = "--purge" ]; then
    rm -rf "$DATA_DIR"
    echo "NewMail uninstalled with data removal"
else
    echo "NewMail uninstalled (data preserved at $DATA_DIR)"
fi
