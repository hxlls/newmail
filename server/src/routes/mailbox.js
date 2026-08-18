const express = require('express');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { testImapConnection, testSmtpConnection } = require('../services/mailService');
const { encrypt, decrypt } = require('../utils/crypto');
const { detectProvider, getProviderConfig, getAllProviders } = require('../config/emailProviders');

const router = express.Router();
router.use(authMiddleware);

router.get('/providers', (req, res) => {
  res.json({ providers: getAllProviders() });
});

router.get('/providers/detect', (req, res) => {
  const { email } = req.query;
  const provider = detectProvider(email);
  res.json({ provider });
});

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const mailboxes = db.prepare(
      'SELECT id, name, email, imap_host, imap_port, smtp_host, smtp_port, is_default, created_at FROM mailboxes WHERE user_id = ?'
    ).all(req.user.userId);

    res.json({ mailboxes });
  } catch (error) {
    logger.error('获取邮箱列表失败:', error);
    res.status(500).json({ error: '获取邮箱列表失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, password, provider, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    let finalImapHost = imap_host;
    let finalImapPort = imap_port;
    let finalImapSecure = imap_secure;
    let finalSmtpHost = smtp_host;
    let finalSmtpPort = smtp_port;
    let finalSmtpSecure = smtp_secure;

    if (provider) {
      const providerConfig = getProviderConfig(provider);
      if (providerConfig) {
        finalImapHost = finalImapHost || providerConfig.imap.host;
        finalImapPort = finalImapPort || providerConfig.imap.port;
        finalImapSecure = finalImapSecure !== undefined ? finalImapSecure : providerConfig.imap.secure;
        finalSmtpHost = finalSmtpHost || providerConfig.smtp.host;
        finalSmtpPort = finalSmtpPort || providerConfig.smtp.port;
        finalSmtpSecure = finalSmtpSecure !== undefined ? finalSmtpSecure : providerConfig.smtp.secure;
      }
    }

    if (!finalImapHost || !finalSmtpHost) {
      return res.status(400).json({ error: '请填写IMAP和SMTP服务器地址' });
    }

    const encryptedPassword = encrypt(password);
    const db = getDb();

    const mailboxCount = db.prepare('SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ?').get(req.user.userId).count;

    const result = db.prepare(`
      INSERT INTO mailboxes (user_id, name, email, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, password_encrypted, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId, name, email,
      finalImapHost, finalImapPort || 993, finalImapSecure !== false ? 1 : 0,
      finalSmtpHost, finalSmtpPort || 465, finalSmtpSecure !== false ? 1 : 0,
      encryptedPassword, mailboxCount === 0 ? 1 : 0
    );

    logger.info(`邮箱添加成功: ${email}`);
    res.status(201).json({ id: result.lastInsertRowid, name, email });
  } catch (error) {
    logger.error('添加邮箱失败:', error);
    res.status(500).json({ error: '添加邮箱失败' });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { type, host, port, secure, email, password } = req.body;

    if (!type || !host || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    let result;
    if (type === 'imap') {
      result = await testImapConnection({ host, port: port || 993, secure: secure !== false, user: email, password });
    } else if (type === 'smtp') {
      result = await testSmtpConnection({ host, port: port || 465, secure: secure !== false, user: email, password });
    } else {
      return res.status(400).json({ error: '无效的连接类型' });
    }

    res.json({ success: true, message: '连接测试成功' });
  } catch (error) {
    logger.error('连接测试失败:', error);
    res.json({ success: false, message: error.message || '连接测试失败' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure } = req.body;

    const db = getDb();
    const mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(id, req.user.userId);

    if (!mailbox) {
      return res.status(404).json({ error: '邮箱不存在' });
    }

    const encryptedPassword = password ? encrypt(password) : mailbox.password_encrypted;

    db.prepare(`
      UPDATE mailboxes SET name = ?, email = ?, imap_host = ?, imap_port = ?, imap_secure = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, password_encrypted = ?
      WHERE id = ? AND user_id = ?
    `).run(
      name || mailbox.name, email || mailbox.email,
      imap_host || mailbox.imap_host, imap_port || mailbox.imap_port, imap_secure !== undefined ? (imap_secure ? 1 : 0) : mailbox.imap_secure,
      smtp_host || mailbox.smtp_host, smtp_port || mailbox.smtp_port, smtp_secure !== undefined ? (smtp_secure ? 1 : 0) : mailbox.smtp_secure,
      encryptedPassword, id, req.user.userId
    );

    res.json({ message: '邮箱更新成功' });
  } catch (error) {
    logger.error('更新邮箱失败:', error);
    res.status(500).json({ error: '更新邮箱失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(id, req.user.userId);

    if (!mailbox) {
      return res.status(404).json({ error: '邮箱不存在' });
    }

    db.prepare('DELETE FROM mailboxes WHERE id = ? AND user_id = ?').run(id, req.user.userId);

    if (mailbox.is_default) {
      const next = db.prepare('SELECT id FROM mailboxes WHERE user_id = ? LIMIT 1').get(req.user.userId);
      if (next) {
        db.prepare('UPDATE mailboxes SET is_default = 1 WHERE id = ?').run(next.id);
      }
    }

    res.json({ message: '邮箱删除成功' });
  } catch (error) {
    logger.error('删除邮箱失败:', error);
    res.status(500).json({ error: '删除邮箱失败' });
  }
});

router.put('/:id/default', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(id, req.user.userId);

    if (!mailbox) {
      return res.status(404).json({ error: '邮箱不存在' });
    }

    db.prepare('UPDATE mailboxes SET is_default = 0 WHERE user_id = ?').run(req.user.userId);
    db.prepare('UPDATE mailboxes SET is_default = 1 WHERE id = ?').run(id);

    res.json({ message: '默认邮箱设置成功' });
  } catch (error) {
    logger.error('设置默认邮箱失败:', error);
    res.status(500).json({ error: '设置默认邮箱失败' });
  }
});

router.get('/unified', (req, res) => {
  try {
    const { page = 1, limit = 50, unread_only, starred_only } = req.query;
    const db = getDb();

    const mailboxes = db.prepare('SELECT id FROM mailboxes WHERE user_id = ?').all(req.user.userId);
    const mailboxIds = mailboxes.map(m => m.id);

    if (mailboxIds.length === 0) {
      return res.json({ emails: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
    }

    const placeholders = mailboxIds.map(() => '?').join(',');
    const offset = (page - 1) * limit;

    let whereClause = `WHERE e.mailbox_id IN (${placeholders})`;
    const params = [...mailboxIds];

    if (unread_only === 'true') {
      whereClause += ' AND e.is_read = 0';
    }
    if (starred_only === 'true') {
      whereClause += ' AND e.is_starred = 1';
    }

    const emails = db.prepare(`
      SELECT e.*, m.name as mailbox_name, m.email as mailbox_email
      FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      ${whereClause}
      ORDER BY e.received_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const countResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM emails e
      ${whereClause}
    `).get(...params);

    res.json({
      emails,
      total: countResult.count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('获取聚合收件箱失败:', error);
    res.status(500).json({ error: '获取聚合收件箱失败' });
  }
});

router.get('/unified/stats', (req, res) => {
  try {
    const db = getDb();

    const mailboxes = db.prepare('SELECT id FROM mailboxes WHERE user_id = ?').all(req.user.userId);
    const mailboxIds = mailboxes.map(m => m.id);

    if (mailboxIds.length === 0) {
      return res.json({ total: 0, unread: 0, starred: 0, mailboxCount: 0 });
    }

    const placeholders = mailboxIds.map(() => '?').join(',');

    const total = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE mailbox_id IN (${placeholders})`).get(...mailboxIds).count;
    const unread = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE mailbox_id IN (${placeholders}) AND is_read = 0`).get(...mailboxIds).count;
    const starred = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE mailbox_id IN (${placeholders}) AND is_starred = 1`).get(...mailboxIds).count;

    res.json({
      total,
      unread,
      starred,
      mailboxCount: mailboxIds.length
    });
  } catch (error) {
    logger.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

module.exports = router;
