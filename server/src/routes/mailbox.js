const express = require('express');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { testImapConnection, testSmtpConnection, testPop3Connection } = require('../services/mailService');
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
      'SELECT id, name, email, protocol, imap_host, imap_port, imap_secure, pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure, is_default, created_at FROM mailboxes WHERE user_id = ?'
    ).all(req.user.userId);

    res.json({ mailboxes });
  } catch (error) {
    logger.error('获取邮箱列表失败:', error);
    res.status(500).json({ error: '获取邮箱列表失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, password, protocol = 'imap', provider, imap_host, imap_port, imap_secure, pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure, is_default = false } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    let finalProtocol = protocol;
    let finalImapHost = imap_host?.trim();
    let finalImapPort = imap_port;
    let finalImapSecure = imap_secure;
    let finalPop3Host = pop3_host?.trim();
    let finalPop3Port = pop3_port;
    let finalPop3Secure = pop3_secure;
    let finalSmtpHost = smtp_host?.trim();
    let finalSmtpPort = smtp_port;
    let finalSmtpSecure = smtp_secure;

    if (provider) {
      const providerConfig = getProviderConfig(provider);
      if (providerConfig) {
        finalProtocol = providerConfig.protocol || protocol;
        finalImapHost = finalImapHost || providerConfig.imap?.host;
        finalImapPort = finalImapPort || providerConfig.imap?.port;
        finalImapSecure = finalImapSecure !== undefined ? finalImapSecure : providerConfig.imap?.secure;
        finalPop3Host = finalPop3Host || providerConfig.pop3?.host;
        finalPop3Port = finalPop3Port || providerConfig.pop3?.port;
        finalPop3Secure = finalPop3Secure !== undefined ? finalPop3Secure : providerConfig.pop3?.secure;
        finalSmtpHost = finalSmtpHost || providerConfig.smtp?.host;
        finalSmtpPort = finalSmtpPort || providerConfig.smtp?.port;
        finalSmtpSecure = finalSmtpSecure !== undefined ? finalSmtpSecure : providerConfig.smtp?.secure;
      }
    }

    // 根据协议验证必填字段
    if (finalProtocol === 'imap' && !finalImapHost) {
      return res.status(400).json({ error: '请填写IMAP服务器地址' });
    }
    if (finalProtocol === 'pop3' && !finalPop3Host) {
      return res.status(400).json({ error: '请填写POP3服务器地址' });
    }
    if (!finalSmtpHost) {
      return res.status(400).json({ error: '请填写SMTP服务器地址' });
    }

    const encryptedPassword = encrypt(password);
    const db = getDb();

    // 检查是否已有默认邮箱
    const hasDefault = db.prepare('SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ? AND is_default = 1').get(req.user.userId).count > 0;
    
    // 如果用户选择设为默认，或者没有默认邮箱，则设为默认
    const shouldBeDefault = is_default || (!hasDefault);

    // 如果设为默认，先取消其他默认
    if (shouldBeDefault) {
      db.prepare('UPDATE mailboxes SET is_default = 0 WHERE user_id = ?').run(req.user.userId);
    }

    const result = db.prepare(`
      INSERT INTO mailboxes (user_id, name, email, protocol, imap_host, imap_port, imap_secure, pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure, password_encrypted, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId, name, email, finalProtocol,
      finalImapHost || '', finalImapPort || 993, finalImapSecure !== false ? 1 : 0,
      finalPop3Host || '', finalPop3Port || 995, finalPop3Secure !== false ? 1 : 0,
      finalSmtpHost, finalSmtpPort || 465, finalSmtpSecure !== false ? 1 : 0,
      encryptedPassword, shouldBeDefault ? 1 : 0
    );

    logger.info(`邮箱添加成功: ${email} (${finalProtocol})${shouldBeDefault ? ' [默认]' : ''}`);
    res.status(201).json({ id: result.lastInsertRowid, name, email, protocol: finalProtocol, is_default: shouldBeDefault });
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

    // 去除主机名空格
    const cleanHost = host.trim();

    let result;
    if (type === 'imap') {
      result = await testImapConnection({ host: cleanHost, port: port || 993, secure: secure !== false, user: email, password });
    } else if (type === 'pop3') {
      result = await testPop3Connection({ host: cleanHost, port: port || 995, secure: secure !== false, user: email, password });
    } else if (type === 'smtp') {
      result = await testSmtpConnection({ host: cleanHost, port: port || 465, secure: secure !== false, user: email, password });
    } else {
      return res.status(400).json({ error: '无效的连接类型' });
    }

    res.json({ success: true, message: '连接测试成功' });
  } catch (error) {
    logger.error('连接测试失败:', error);
    
    // 提供更友好的错误信息
    let errorMessage = error.message || '连接测试失败';
    
    if (error.code === 'ENOTFOUND') {
      errorMessage = `无法解析服务器地址 ${error.hostname}，请检查：
1. 服务器地址是否正确
2. 飞牛NAS是否已连接网络
3. DNS设置是否正确`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = '连接被拒绝，请检查服务器地址和端口是否正确';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      errorMessage = '连接超时，请检查网络连接';
    } else if (error.code === 'EAUTH') {
      errorMessage = '认证失败，请检查邮箱地址和密码/授权码';
    } else if (error.message.includes('Timed out')) {
      errorMessage = '连接超时，请检查服务器地址和端口是否正确';
    } else if (error.message.includes('ECONNRESET')) {
      errorMessage = '连接被重置，可能是SSL/TLS配置问题';
    }
    
    res.json({ success: false, message: errorMessage });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, protocol, imap_host, imap_port, imap_secure, pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure } = req.body;

    const db = getDb();
    const mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(id, req.user.userId);

    if (!mailbox) {
      return res.status(404).json({ error: '邮箱不存在' });
    }

    const encryptedPassword = password ? encrypt(password) : mailbox.password_encrypted;

    db.prepare(`
      UPDATE mailboxes SET name = ?, email = ?, protocol = ?, imap_host = ?, imap_port = ?, imap_secure = ?, pop3_host = ?, pop3_port = ?, pop3_secure = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, password_encrypted = ?
      WHERE id = ? AND user_id = ?
    `).run(
      name || mailbox.name, 
      email || mailbox.email,
      protocol || mailbox.protocol,
      imap_host || mailbox.imap_host, 
      imap_port || mailbox.imap_port, 
      imap_secure !== undefined ? (imap_secure ? 1 : 0) : mailbox.imap_secure,
      pop3_host || mailbox.pop3_host, 
      pop3_port || mailbox.pop3_port, 
      pop3_secure !== undefined ? (pop3_secure ? 1 : 0) : mailbox.pop3_secure,
      smtp_host || mailbox.smtp_host, 
      smtp_port || mailbox.smtp_port, 
      smtp_secure !== undefined ? (smtp_secure ? 1 : 0) : mailbox.smtp_secure,
      encryptedPassword, 
      id, 
      req.user.userId
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
