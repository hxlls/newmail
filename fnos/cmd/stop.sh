#!/bin/bash
# Stop script for NewMail

set -e

# 停止并删除容器
docker stop newmail 2>/dev/null || true
docker rm newmail 2>/dev/null || true

echo "NewMail stopped"
