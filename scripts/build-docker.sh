#!/bin/bash

# 多架构构建脚本
IMAGE_NAME="yourname/newmail"
VERSION=${1:-latest}

echo "=== 构建多架构 Docker 镜像 ==="
echo "镜像: $IMAGE_NAME:$VERSION"
echo "架构: linux/amd64, linux/arm64"

# 创建buildx builder（首次运行）
docker buildx create --name multiarch --use 2>/dev/null || true

# 构建并推送多架构镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t $IMAGE_NAME:$VERSION \
  -t $IMAGE_NAME:latest \
  --push \
  ./docker

echo "=== 构建完成 ==="
echo "支持架构: amd64 (x86_64), arm64 (aarch64)"
