// 加载环境变量（优先使用系统环境变量）
if (!process.env.DB_PATH) {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available, use system env
  }
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fileUpload = require('express-fileupload');

const { initDatabase } = require('./db/init');
const { logger } = require('./utils/logger');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailbox');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');
const backupRoutes = require('./routes/backup');
const { setupSocketHandlers } = require('./socket/handler');
const { startMailChecker } = require('./services/mailChecker');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CLIENT_URL || true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB限制
  abortOnLimit: true,
  responseOnLimit: '文件大小超过限制(100MB)'
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/mailboxes', mailboxRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/backup', backupRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 网络检查（需要认证）
app.get('/api/network/check', authMiddleware, async (req, res) => {
  const dns = require('dns');
  const hosts = ['imap.qq.com', 'imap.gmail.com', 'imap.163.com'];
  
  const results = {};
  for (const host of hosts) {
    try {
      await new Promise((resolve, reject) => {
        dns.lookup(host, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      results[host] = 'ok';
    } catch (e) {
      results[host] = 'failed';
    }
  }
  
  res.json({ results });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

setupSocketHandlers(io);

async function start() {
  try {
    await initDatabase();
    logger.info('数据库初始化完成');

    startMailChecker(io);

    httpServer.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    logger.error('启动失败:', error);
    process.exit(1);
  }
}

start();

module.exports = { app, io };
