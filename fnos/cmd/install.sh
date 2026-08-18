#!/bin/bash
# Install script for NewMail

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="/vol1/app_data/newmail"

# 创建数据目录
mkdir -p "$DATA_DIR/logs"
mkdir -p "$DATA_DIR/data"

# 设置权限
chmod 755 "$DATA_DIR"

echo "NewMail installed successfully"
