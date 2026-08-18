#!/bin/bash

# 群晖 SPK 多架构打包脚本
VERSION="1.0.0"
PACKAGE_NAME="newmail"

# 群晖架构列表
ARCHITECTURES=(
  "apollolake"    # Intel J系列 (x64)
  "broadwell"     # Intel Xeon (x64)
  "r1000"         # AMD (x64)
  "armada37xx"    # Marvell ARM64
  "rtd1296"       # Realtek ARM64
)

build_spk() {
  local arch=$1
  echo "=== 构建 $arch 架构 ==="
  
  # 架构映射到Node.js平台
  local node_arch="x64"
  if [[ "$arch" == *"arm"* ]] || [[ "$arch" == *"rtd"* ]]; then
    node_arch="arm64"
  fi
  
  # 创建临时目录
  local build_dir="./build/$arch"
  mkdir -p $build_dir
  
  # 复制应用文件
  cp -r ./src $build_dir/
  cp -r ./docker/package*.json $build_dir/
  
  # 安装依赖（针对目标架构）
  cd $build_dir
  npm ci --only=production --arch=$node_arch 2>/dev/null || npm ci --only=production
  cd ../..
  
  # 创建 package.tgz
  cd $build_dir
  tar czf ../package.tgz .
  cd ../..
  
  # 创建 INFO 文件
  cat > ./build/INFO << EOF
package="com.newmail.${PACKAGE_NAME}"
version="${VERSION}"
os_min_ver="7.0-40000"
description="AI邮件助手 - 支持多邮箱、大模型处理"
arch="${arch}"
maintainer="YourName"
displayname="NewMail"
EOF
  
  # 创建 SPK
  cd ./build
  tar cf ../../${PACKAGE_NAME}-${arch}-${VERSION}.spk INFO package.tgz scripts/
  cd ../..
  
  echo "生成: ${PACKAGE_NAME}-${arch}-${VERSION}.spk"
}

# 构建所有架构
for arch in "${ARCHITECTURES[@]}"; do
  build_spk $arch
done

echo "=== 所有 SPK 构建完成 ==="
