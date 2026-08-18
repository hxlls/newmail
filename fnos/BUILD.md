# fnos ARM 版本构建说明

## 方式一：GitHub Actions 自动构建（推荐）

### 1. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/newmail.git
git push -u origin main
```

### 2. 设置 GitHub Secrets（可选）

如果要推送到 Docker Hub，需要添加：
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

默认使用 GitHub Container Registry (ghcr.io)，无需额外配置。

### 3. 触发构建

**方式 A：打 tag 触发**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**方式 B：手动触发**
1. 进入 GitHub 仓库 → Actions
2. 选择 "Build Docker Multi-Arch"
3. 点击 "Run workflow"
4. 输入版本号（可选）

### 4. 下载 fnos 安装包

构建完成后：
1. 进入 GitHub 仓库 → Actions → 对应的 workflow run
2. 滚动到底部 "Artifacts"
3. 下载 `newmail-fnos-package`

## 方式二：本地构建

### 前提条件
- 安装 Docker Desktop 或 Docker Engine
- 启用 experimental features

### 构建步骤

```bash
# 创建 buildx builder
docker buildx create --name multiarch --use

# 构建并推送多架构镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/YOUR_USERNAME/newmail:latest \
  --push \
  ./docker

# 打包 fnos 安装包
cd fnos
tar -czf ../newmail-fnos.tar.gz *
```

## fnos 安装方法

1. 登录飞牛 fnos 管理界面
2. 打开 Docker 应用
3. 导入下载的 `newmail-fnos.tar.gz` 或手动创建项目
4. 配置：
   - 镜像：`ghcr.io/YOUR_USERNAME/newmail:latest`
   - 端口映射：3000:3000
   - 数据卷：`/vol1/app_data/newmail:/app/data`
5. 启动容器

## 配置环境变量

创建 `.env` 文件或在 fnos 界面配置：

```bash
PORT=3000
JWT_SECRET=your-random-secret-key
ENCRYPTION_KEY=your-32-char-encryption-key-here!
DB_PATH=/app/data/newmail.db
LOG_PATH=/app/data/logs
```

## 访问应用

打开浏览器访问 `http://your-fnos-ip:3000`
