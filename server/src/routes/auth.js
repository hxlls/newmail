const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 登录接口专用限流（更严格）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次尝试
  message: { error: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 邮箱格式验证
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    // 验证用户名
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: '用户名长度应为3-30个字符' });
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' });
    }

    // 验证邮箱
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 验证密码强度
    if (password.length < 8) {
      return res.status(400).json({ error: '密码至少8位' });
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: '密码需包含大小写字母和数字' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);

    if (existing) {
      return res.status(409).json({ error: '用户名或邮箱已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 12);  // 增加salt轮数
    const result = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, passwordHash);

    const token = jwt.sign({ userId: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });

    logger.info(`用户注册成功: ${username}`);
    res.status(201).json({ token, user: { id: result.lastInsertRowid, username, email } });
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    logger.info(`用户登录成功: ${user.username}`);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    logger.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.userId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  res.json({ user });
});

module.exports = router;
