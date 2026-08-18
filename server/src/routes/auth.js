const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);

    if (existing) {
      return res.status(409).json({ error: '用户名或邮箱已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, passwordHash);

    const token = jwt.sign({ userId: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });

    logger.info(`用户注册成功: ${username}`);
    res.status(201).json({ token, user: { id: result.lastInsertRowid, username, email } });
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', async (req, res) => {
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
