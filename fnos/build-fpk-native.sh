#!/bin/bash
# 预构建原生fpk - 将所有依赖打包进fpk

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/dist"

VERSION=${1:-1.0.0}
GREEN='\033[0;32m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }

mkdir -p "$OUTPUT_DIR"

info "预构建 NewMail v${VERSION}"

# 创建临时构建目录
BUILD_DIR="/tmp/newmail-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/app/server" "$BUILD_DIR/app/client/dist" "$BUILD_DIR/app/ui/images"

# 复制fnos框架文件
info "复制框架文件..."
cp -r "$PROJECT_ROOT/fnos-native/cmd" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/fnos-native/config" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/fnos-native/wizard" "$BUILD_DIR/"
cp "$PROJECT_ROOT/fnos-native/manifest" "$BUILD_DIR/"
cp "$PROJECT_ROOT/fnos-native/newmail.sc" "$BUILD_DIR/"

# 复制图标
cp "$PROJECT_ROOT/fnos/icon.png" "$BUILD_DIR/ICON.PNG"
cp "$PROJECT_ROOT/fnos/icon_256.png" "$BUILD_DIR/ICON_256.PNG"
cp "$PROJECT_ROOT/fnos/icon.png" "$BUILD_DIR/app/ui/images/icon_64.png"
cp "$PROJECT_ROOT/fnos/icon_256.png" "$BUILD_DIR/app/ui/images/icon_256.png"
cp "$PROJECT_ROOT/fnos-native/app/ui/config" "$BUILD_DIR/app/ui/"

# 安装后端依赖
info "安装后端依赖..."
cd "$PROJECT_ROOT/server"
npm ci --only=production --no-fund 2>/dev/null || npm install --only=production --no-fund

# 安装前端依赖并构建
info "构建前端..."
cd "$PROJECT_ROOT/client"
npm ci --no-fund 2>/dev/null || npm install --no-fund
npm run build

# 复制后端代码和依赖
info "打包后端..."
cp -r "$PROJECT_ROOT/server"/* "$BUILD_DIR/app/server/"

# 复制前端构建产物
info "打包前端..."
cp -r "$PROJECT_ROOT/client/dist"/* "$BUILD_DIR/app/client/dist/"

# 复制前端必要文件（运行时需要）
cp "$PROJECT_ROOT/client/package.json" "$BUILD_DIR/app/client/"

# 更新manifest版本号
sed -i "s/^version.*/version               = ${VERSION}/" "$BUILD_DIR/manifest"

# 简化install_callback（所有文件已经打包好了）
cat > "$BUILD_DIR/cmd/install_callback" << 'EOF'
#!/bin/bash

echo "Initializing NewMail..."

# 创建数据目录
mkdir -p "${TRIM_PKGVAR}/data"
mkdir -p "${TRIM_PKGVAR}/logs"

# 生成环境变量
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

cat > "${TRIM_PKGVAR}/.env" << ENVEOF
PORT=3000
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
DB_PATH=${TRIM_PKGVAR}/data/newmail.db
LOG_PATH=${TRIM_PKGVAR}/logs
NODE_ENV=production
ENVEOF

echo "NewMail installed successfully"
EOF

chmod +x "$BUILD_DIR/cmd/"*

# 使用fnpack打包
info "打包fpk..."
cd "$BUILD_DIR"
/tmp/fnpack build

# 移动到输出目录
mv newmail.fpk "$OUTPUT_DIR/newmail_${VERSION}_native.fpk"

info "Built: $OUTPUT_DIR/newmail_${VERSION}_native.fpk"
info "Size: $(du -h "$OUTPUT_DIR/newmail_${VERSION}_native.fpk" | cut -f1)"
