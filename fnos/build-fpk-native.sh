#!/bin/bash
# 预构建原生fpk - 内置ARM64和x86_64原生模块

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/dist"

VERSION=${1:-1.0.0}
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

mkdir -p "$OUTPUT_DIR"

info "预构建 NewMail v${VERSION}"

# 创建临时构建目录
BUILD_DIR="/tmp/newmail-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/app/server" "$BUILD_DIR/app/ui/images" "$BUILD_DIR/cmd" "$BUILD_DIR/config" "$BUILD_DIR/wizard"

# 安装后端依赖（跳过原生模块编译）
info "安装后端依赖..."
cd "$PROJECT_ROOT/server"
npm install --production --ignore-scripts --no-fund 2>/dev/null || true

# 安装前端依赖并构建
info "构建前端..."
cd "$PROJECT_ROOT/client"
npm install --no-fund 2>/dev/null || true
npm run build

# 复制server代码（不包含原生模块）
info "打包后端代码..."
cp -r "$PROJECT_ROOT/server/package.json" "$BUILD_DIR/app/server/"
cp -r "$PROJECT_ROOT/server/package-lock.json" "$BUILD_DIR/app/server/" 2>/dev/null || true
cp -r "$PROJECT_ROOT/server/src" "$BUILD_DIR/app/server/"
cp -r "$PROJECT_ROOT/server/node_modules" "$BUILD_DIR/app/server/"

# 删除可能存在的旧原生模块
rm -rf "$BUILD_DIR/app/server/node_modules/better-sqlite3/build"

# 交叉编译ARM64原生模块
if command -v docker &> /dev/null; then
    info "交叉编译 ARM64 原生模块..."
    docker run --rm \
        --platform linux/arm64 \
        -v "$BUILD_DIR/app/server:/app" \
        -w /app \
        node:20-slim \
        bash -c "
            apt-get update > /dev/null 2>&1 && 
            apt-get install -y python3 make g++ > /dev/null 2>&1 &&
            npm rebuild better-sqlite3 --build-from-source > /dev/null 2>&1 &&
            echo 'ARM64 build complete'
        " 2>&1
    
    if [ -f "$BUILD_DIR/app/server/node_modules/better-sqlite3/build/Release/better_sqlite3.node" ]; then
        info "ARM64 原生模块编译成功"
    else
        warn "ARM64 编译失败，安装时需要重新编译"
    fi
else
    warn "Docker 未安装，跳过 ARM64 交叉编译"
    warn "安装时需要在 ARM 设备上编译原生模块"
fi

# 复制前端构建产物到 server/public
info "打包前端..."
mkdir -p "$BUILD_DIR/app/server/public"
cp -r "$PROJECT_ROOT/client/dist"/* "$BUILD_DIR/app/server/public/"

# 复制UI配置
cp "$PROJECT_ROOT/fnos-native/app/ui/config" "$BUILD_DIR/app/ui/"

# 复制图标
cp "$PROJECT_ROOT/fnos/icon.png" "$BUILD_DIR/app/ui/images/icon_64.png"
cp "$PROJECT_ROOT/fnos/icon_256.png" "$BUILD_DIR/app/ui/images/icon_256.png"

# 复制框架文件
cp "$PROJECT_ROOT/fnos-native/manifest" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/fnos-native/cmd/"* "$BUILD_DIR/cmd/"
cp -r "$PROJECT_ROOT/fnos-native/config/"* "$BUILD_DIR/config/"
cp -r "$PROJECT_ROOT/fnos-native/wizard/"* "$BUILD_DIR/wizard/"

# 复制图标
cp "$PROJECT_ROOT/fnos/icon.png" "$BUILD_DIR/ICON.PNG"
cp "$PROJECT_ROOT/fnos/icon_256.png" "$BUILD_DIR/ICON_256.PNG"

# 更新manifest版本号
sed -i "s/^version.*/version               = ${VERSION}/" "$BUILD_DIR/manifest"

# 更新install_callback - 如果有预编译模块则跳过编译
cat > "$BUILD_DIR/cmd/install_callback" << 'EOF'
#!/bin/bash

export PATH=/var/apps/nodejs_v22/target/bin:$PATH

log_msg() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "${TRIM_PKGVAR}/install.log"
}

log_msg "Initializing NewMail..."

# 创建数据目录
mkdir -p "${TRIM_PKGVAR}/data"
mkdir -p "${TRIM_PKGVAR}/logs"

# 检查原生模块
APP_DIR="${TRIM_APPDEST}"
if [ -d "$APP_DIR/server" ]; then
  cd "$APP_DIR/server"
  
  # 测试原生模块是否可用
  if node -e "require('./node_modules/better-sqlite3')" 2>/dev/null; then
    log_msg "Native module OK"
  else
    log_msg "Rebuilding native module..."
    npm rebuild better-sqlite3 --build-from-source 2>&1 >> "${TRIM_PKGVAR}/install.log"
  fi
fi

# 只在首次安装时生成环境变量
if [ ! -f "${TRIM_PKGVAR}/.env" ]; then
  log_msg "Creating .env file..."
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
else
  log_msg "Preserving existing .env"
fi

log_msg "NewMail installed successfully"
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

# 检查是否包含ARM64模块
if [ -f "$BUILD_DIR/app/server/node_modules/better-sqlite3/build/Release/better_sqlite3.node" ]; then
    info "✅ 包含 ARM64 原生模块"
else
    warn "⚠️ 未包含 ARM64 原生模块，安装时需要编译"
fi
