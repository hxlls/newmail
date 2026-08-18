# NewMail - AI邮件助手

统一管理多个邮箱，支持AI智能处理邮件。

## 功能特点

- 📧 **统一收件箱** - 聚合管理Gmail、Outlook、QQ邮箱、网易邮箱、iCloud等多个邮箱
- 🤖 **AI智能** - 支持OpenAI、Claude等大模型，邮件总结、智能回复
- 📱 **实时通知** - WebSocket推送新邮件提醒
- 🔒 **安全加密** - 密码加密存储，JWT认证
- 🎨 **现代界面** - React + Ant Design，响应式设计
- 🐳 **易于部署** - Docker支持，兼容群晖、fnos等NAS系统

## 支持的邮箱

| 邮箱 | IMAP | SMTP |
|------|------|------|
| Gmail | ✅ | ✅ |
| Outlook/Hotmail | ✅ | ✅ |
| QQ邮箱 | ✅ | ✅ |
| 网易163/126/Yeah | ✅ | ✅ |
| iCloud | ✅ | ✅ |
| Yahoo | ✅ | ✅ |
| 阿里云邮箱 | ✅ | ✅ |
| 新浪邮箱 | ✅ | ✅ |
| 搜狐邮箱 | ✅ | ✅ |
| 企业邮箱 | ✅ | ✅ |

## 快速开始

### Docker部署（推荐）

```bash
cd docker
cp .env.example .env
# 编辑 .env 文件，设置密钥
docker-compose up -d
```

### 本地开发

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install

# 启动后端
cd ../server
npm run dev

# 启动前端
cd ../client
npm run dev
```

访问 http://localhost:5173

## 环境变量

```bash
PORT=3000                    # 服务端口
JWT_SECRET=your-secret       # JWT密钥
ENCRYPTION_KEY=your-key      # 数据加密密钥（32位）
DB_PATH=./data/newmail.db    # 数据库路径
```

## 架构说明

```
newmail/
├── server/                  # Node.js后端
│   ├── src/
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务逻辑
│   │   ├── config/         # 配置文件
│   │   ├── db/             # 数据库
│   │   ├── middleware/     # 中间件
│   │   ├── socket/         # WebSocket
│   │   └── utils/          # 工具函数
│   └── package.json
├── client/                  # React前端
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   └── services/       # API服务
│   └── package.json
├── docker/                  # Docker配置
└── scripts/                 # 构建脚本
```

## API接口

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/mailboxes` - 获取邮箱列表
- `POST /api/mailboxes` - 添加邮箱
- `GET /api/mailboxes/unified` - 聚合收件箱
- `GET /api/emails` - 获取邮件列表
- `POST /api/emails/sync` - 同步邮件
- `POST /api/emails/send` - 发送邮件
- `POST /api/ai/chat` - AI对话
- `POST /api/ai/summarize` - AI总结邮件
- `POST /api/ai/reply` - AI生成回复

## 群晖部署

1. 打开Docker套件
2. 导入docker-compose.yml
3. 配置端口和卷
4. 启动容器

## fnos部署

1. 打开Docker应用
2. 创建新项目
3. 导入docker-compose.yml
4. 启动服务

## 版本策略

| 变更类型 | 版本号 | 示例 |
|---------|--------|------|
| 界面调整/修复 | 1.0.X | 1.0.1, 1.0.2 |
| 新增功能 | 1.X.0 | 1.1.0, 1.2.0 |
| 重大更新 | X.0.0 | 2.0.0 |

```bash
# 发布补丁版本（界面调整）
git tag -a v1.0.1 -m "fix: 修复界面问题"
git push origin v1.0.1

# 发布功能版本
git tag -a v1.1.0 -m "feat: 新增AI回复功能"
git push origin v1.1.0
```

## License

MIT
