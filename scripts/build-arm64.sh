#!/bin/bash
# 在有Docker的机器上运行此脚本构建ARM64版本

set -e

echo "=== 构建 ARM64 原生模块 ==="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# 使用 Docker 构建 ARM64 版本
echo "使用 Docker 构建 ARM64 better-sqlite3..."
docker run --rm \
    --platform linux/arm64 \
    -v "$(pwd)/server:/app" \
    -w /app \
    node:20-slim \
    bash -c "
        apt-get update > /dev/null 2>&1 && 
        apt-get install -y python3 make g++ > /dev/null 2>&1 &&
        npm install better-sqlite3 --build-from-source > /dev/null 2>&1 &&
        echo '构建成功'
    "

if [ $? -eq 0 ]; then
    echo "✅ ARM64 版本构建成功"
    
    # 验证文件
    BINARY="server/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
    if [ -f "$BINARY" ]; then
        echo "文件: $BINARY"
        file "$BINARY"
    fi
else
    echo "❌ 构建失败"
    exit 1
fi
