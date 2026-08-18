#!/bin/bash
# 生成 fnos 应用图标
# 需要安装 ImageMagick: apt-get install imagemagick

# 创建 128x128 的 PNG 图标
convert -size 128x128 xc:#4A90D9 \
  -fill white -font Helvetica -pointsize 72 \
  -gravity center -annotate 0 "NM" \
  icon.png

echo "icon.png 已生成"
