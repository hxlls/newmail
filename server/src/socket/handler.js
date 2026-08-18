const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { JWT_SECRET } = require('../middleware/auth');

function setupSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('认证失败'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = {
        userId: decoded.userId || decoded.id,
        username: decoded.username
      };
      next();
    } catch (error) {
      next(new Error('认证失败'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.userId;
    logger.info(`用户连接: ${userId}`);

    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      logger.info(`用户断开: ${userId}`);
    });
  });

  return io;
}

module.exports = { setupSocketHandlers };
