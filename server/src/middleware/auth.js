const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

// 启动时生成随机JWT密钥（如果未设置环境变量）
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  logger.warn('JWT_SECRET 未设置，使用随机生成的密钥（重启后所有token将失效）');
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId || decoded.id,  // 兼容两种格式
      username: decoded.username
    };
    next();
  } catch (error) {
    logger.warn('认证失败:', error.message);
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
