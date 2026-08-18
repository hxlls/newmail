#!/bin/bash
# Build fnos fpk package for NewMail using official fnpack tool

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/dist"

VERSION=${1:-1.0.0}
IMAGE_NAME=${2:-ghcr.io/yourusername/newmail}

GREEN='\033[0;32m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

info "Building NewMail fpk v${VERSION}"

# 创建项目目录
FPK_DIR="$PROJECT_ROOT/fnos-app"
rm -rf "$FPK_DIR"
mkdir -p "$FPK_DIR"

# 下载 fnpack (如果不存在)
FNPACK="/tmp/fnpack"
if [ ! -f "$FNPACK" ]; then
    info "Downloading fnpack..."
    curl -sL "https://static2.fnnas.com/fnpack/fnpack-1.2.3-linux-amd64" -o "$FNPACK"
    chmod +x "$FNPACK"
fi

# 使用 fnpack 创建项目
cd "$PROJECT_ROOT"
"$FNPACK" create newmail --template docker
mv newmail "$FPK_DIR"

# 更新 manifest
cat > "$FPK_DIR/manifest" << EOF
appname               = newmail
version               = ${VERSION}
display_name          = NewMail
desc                  = AI邮件助手 - 支持多邮箱统一管理、AI智能处理邮件、实时通知推送
platform              = all
source                = thirdparty
maintainer            = NewMail
maintainer_url        = https://github.com/yourusername/newmail
distributor           = custom
distributor_url       = https://github.com/yourusername/newmail
desktop_uidir         = ui
desktop_applaunchname = newmail.Application
service_port          = 3000
ctl_stop              = true
EOF

# 更新 docker-compose.yaml
cat > "$FPK_DIR/app/docker/docker-compose.yaml" << EOF
version: "3.8"

services:
  newmail:
    image: ${IMAGE_NAME}:${VERSION}
    container_name: newmail
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - "\${TRIM_PKGVAR}:/app/data"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=\${JWT_SECRET}
      - ENCRYPTION_KEY=\${ENCRYPTION_KEY}
      - DB_PATH=/app/data/newmail.db
      - LOG_PATH=/app/data/logs
EOF

# 更新 UI 配置
cat > "$FPK_DIR/app/ui/config" << EOF
{
  ".url": {
    "newmail.Application": {
      "title": "NewMail",
      "desc": "AI邮件助手",
      "icon": "images/icon_{0}.png",
      "type": "url",
      "port": "3000",
      "protocol": "http",
      "url": "/",
      "allUsers": true
    }
  }
}
EOF

# 更新 cmd/main
cat > "$FPK_DIR/cmd/main" << 'EOF'
#!/bin/bash

case "$1" in
  start)
    cd "${TRIM_APPDEST}/app/docker"
    docker compose up -d
    exit $?
    ;;
  stop)
    cd "${TRIM_APPDEST}/app/docker"
    docker compose down
    exit $?
    ;;
  status)
    docker inspect newmail 2>/dev/null | grep -q '"Status": "running",' 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "NewMail is running"
      exit 0
    else
      echo "NewMail is not running"
      exit 3
    fi
    ;;
  log)
    LINES="${2:-100}"
    docker logs --tail "$LINES" newmail 2>&1
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
EOF

# 更新 cmd/install_callback
cat > "$FPK_DIR/cmd/install_callback" << 'EOF'
#!/bin/bash

# 生成随机密钥
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# 保存环境变量
cat > "${TRIM_PKGVAR}/.env" << ENVEOF
PORT=3000
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
DB_PATH=/app/data/newmail.db
LOG_PATH=/app/data/logs
ENVEOF

# 创建数据目录
mkdir -p "${TRIM_PKGVAR}/data"
mkdir -p "${TRIM_PKGVAR}/logs"

echo "NewMail installed successfully"
EOF

# 更新 config/resource
cat > "$FPK_DIR/config/resource" << EOF
{
  "port-config": {
    "protocol-file": "newmail.sc"
  },
  "data-share": {
    "shares": [
      {
        "name": "newmail",
        "permission": {
          "rw": [
            "newmail"
          ]
        }
      }
    ]
  },
  "systemd-unit": {}
}
EOF

# 更新 config/privilege
cat > "$FPK_DIR/config/privilege" << EOF
{
  "defaults": {
    "run-as": "package"
  },
  "username": "newmail",
  "groupname": "newmail"
}
EOF

# 创建端口转发配置
cat > "$FPK_DIR/newmail.sc" << EOF
[newmail]
title="NewMail"
desc="AI邮件助手"
port_forward="yes"
src.ports="3000/tcp"
dst.ports="3000/tcp"
EOF

# 复制图标
if [ -f "$PROJECT_ROOT/fnos/icon.png" ]; then
    cp "$PROJECT_ROOT/fnos/icon.png" "$FPK_DIR/ICON.PNG"
    cp "$PROJECT_ROOT/fnos/icon_256.png" "$FPK_DIR/ICON_256.PNG" 2>/dev/null || cp "$PROJECT_ROOT/fnos/icon.png" "$FPK_DIR/ICON_256.PNG"
    cp "$PROJECT_ROOT/fnos/icon.png" "$FPK_DIR/app/ui/images/icon_64.png"
    cp "$PROJECT_ROOT/fnos/icon_256.png" "$FPK_DIR/app/ui/images/icon_256.png" 2>/dev/null || cp "$PROJECT_ROOT/fnos/icon.png" "$FPK_DIR/app/ui/images/icon_256.png"
fi

# 打包 fpk
info "Packing fpk..."
cd "$FPK_DIR"
"$FNPACK" build

# 移动到输出目录
mv newmail.fpk "$OUTPUT_DIR/newmail_${VERSION}.fpk"

info "Built: $OUTPUT_DIR/newmail_${VERSION}.fpk"
info "Size: $(du -h "$OUTPUT_DIR/newmail_${VERSION}.fpk" | cut -f1)"
echo ""
echo "安装方法:"
echo "1. 将 newmail_${VERSION}.fpk 上传到飞牛 fnos"
echo "2. 在应用中心选择「手动安装」"
echo "3. 上传 fpk 文件并完成安装"
