#!/bin/bash
# NewMail fnos 构建脚本
# 支持构建 Docker 镜像和 fpk 安装包

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION=${1:-1.0.0}
IMAGE_NAME=${2:-ghcr.io/yourusername/newmail}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo "=== NewMail fnos 构建工具 ==="
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    warn "未安装 Docker，跳过镜像构建"
    SKIP_DOCKER=1
fi

# 菜单
echo "请选择构建选项:"
echo "1) 构建 Docker 镜像 (amd64 + arm64)"
echo "2) 构建 fpk 安装包 (仅打包)"
echo "3) 完整构建 (Docker 镜像 + fpk)"
echo "4) 退出"
echo ""
read -p "请输入选项 [1-4]: " CHOICE

case $CHOICE in
    1)
        # 构建 Docker 镜像
        if [ "$SKIP_DOCKER" = "1" ]; then
            error "未安装 Docker，无法构建镜像"
        fi
        
        info "构建 Docker 多架构镜像..."
        docker buildx create --name newmail-builder --use 2>/dev/null || docker buildx use newmail-builder
        
        docker buildx build \
            --platform linux/amd64,linux/arm64 \
            -t "$IMAGE_NAME:$VERSION" \
            -t "$IMAGE_NAME:latest" \
            --push \
            .
        
        info "Docker 镜像已推送到: $IMAGE_NAME:$VERSION"
        ;;
    2)
        # 构建 fpk
        info "构建 fpk 安装包..."
        cd fnos
        chmod +x build-fpk.sh
        ./build-fpk.sh "$VERSION" "arm64" "$IMAGE_NAME"
        ./build-fpk.sh "$VERSION" "x86_64" "$IMAGE_NAME"
        cd "$SCRIPT_DIR"
        ;;
    3)
        # 完整构建
        if [ "$SKIP_DOCKER" != "1" ]; then
            info "Step 1/2: 构建 Docker 镜像..."
            docker buildx create --name newmail-builder --use 2>/dev/null || docker buildx use newmail-builder
            
            docker buildx build \
                --platform linux/amd64,linux/arm64 \
                -t "$IMAGE_NAME:$VERSION" \
                -t "$IMAGE_NAME:latest" \
                --push \
                .
        fi
        
        info "Step 2/2: 构建 fpk 安装包..."
        cd fnos
        chmod +x build-fpk.sh
        ./build-fpk.sh "$VERSION" "arm64" "$IMAGE_NAME"
        ./build-fpk.sh "$VERSION" "x86_64" "$IMAGE_NAME"
        cd "$SCRIPT_DIR"
        ;;
    4)
        exit 0
        ;;
    *)
        error "无效选项"
        ;;
esac

echo ""
echo "=== 构建完成 ==="
