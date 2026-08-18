# NewMail - 多架构构建说明

## 支持的架构

| 平台 | 架构 | Docker标签 | 群晖架构 |
|------|------|-----------|----------|
| PC/NAS | x86_64 | amd64 | apollolake, broadwell, r1000 |
| ARM设备 | aarch64 | arm64 | armada37xx, rtd1296 |

## 构建方式

### 1. Docker 多架构镜像（推荐）

```bash
# 构建并推送
./scripts/build-docker.sh v1.0.0

# 或手动构建单架构
docker build -t newmail:amd64 --platform linux/amd64 ./docker
docker build -t newmail:arm64 --platform linux/arm64 ./docker
```

### 2. 群晖 SPK 打包

```bash
# 构建所有架构的SPK
./scripts/build-synology.sh

# 生成文件：
# newmail-apollolake-1.0.0.spk (Intel x64)
# newmail-armada37xx-1.0.0.spk (ARM64)
```

### 3. fnos 应用

fnos 使用 Docker 部署，直接使用多架构镜像即可。

## 注意事项

1. **原生模块** - better-sqlite3 等需要在目标架构编译
2. **交叉编译** - 使用 docker buildx 自动处理
3. **测试** - 建议在两种架构上分别测试
