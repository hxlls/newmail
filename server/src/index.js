require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDatabase } = require('./db/init');
const { logger } = require('./utils/logger');
const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailbox');
const emailRoutes = require('./routes/email');
const aiRoutes = require('./routes/ai');
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

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '../../client/dist')));

app.use('/api/auth', authRoutes);
app.use('/api/mailboxes', mailboxRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
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
