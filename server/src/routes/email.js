const express = require('express');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { fetchEmails, sendEmail } = require('../services/mailService');
const { decrypt } = require('../utils/crypto');

const router = express.Router();
router.use(authMiddleware);

function getMailboxConfig(mailbox) {
  return {
    host: mailbox.imap_host,
    port: mailbox.imap_port,
    secure: mailbox.imap_secure === 1,
    user: mailbox.email,
    password: decrypt(mailbox.password_encrypted)
  };
}

router.get('/', (req, res) => {
  try {
    const { mailbox_id, folder = 'INBOX', page = 1, limit = 50 } = req.query;
    const db = getDb();

    let mailbox;
    if (mailbox_id) {
      mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(mailbox_id, req.user.userId);
    } else {
      mailbox = db.prepare('SELECT * FROM mailboxes WHERE user_id = ? AND is_default = 1').get(req.user.userId);
    }

    if (!mailbox) {
      return res.status(404).json({ error: '未找到邮箱' });
    }

    const offset = (page - 1) * limit;
    const emails = db.prepare(
      'SELECT * FROM emails WHERE mailbox_id = ? AND folder = ? ORDER BY received_at DESC LIMIT ? OFFSET ?'
    ).all(mailbox.id, folder, parseInt(limit), offset);

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM emails WHERE mailbox_id = ? AND folder = ?'
    ).get(mailbox.id, folder).count;

    res.json({ emails, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    logger.error('获取邮件列表失败:', error);
    res.status(500).json({ error: '获取邮件列表失败' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { mailbox_id, folder = 'INBOX' } = req.body;
    const db = getDb();

    let mailbox;
    if (mailbox_id) {
      mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(mailbox_id, req.user.userId);
    } else {
      mailbox = db.prepare('SELECT * FROM mailboxes WHERE user_id = ? AND is_default = 1').get(req.user.userId);
    }

    if (!mailbox) {
      return res.status(404).json({ error: '未找到邮箱' });
    }

    const config = getMailboxConfig(mailbox);
    const emails = await fetchEmails(config, folder, 100);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO emails (mailbox_id, message_id, subject, from_address, from_name, to_address, body_text, body_html, received_at, folder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const email of items) {
        const fromMatch = email.from.match(/^(.+?)\s*<(.+?)>$/);
        const fromName = fromMatch ? fromMatch[1].trim() : email.from;
        const fromAddress = fromMatch ? fromMatch[2] : email.from;

        insertStmt.run(
          mailbox.id,
          email.messageId,
          email.subject,
          fromAddress,
          fromName,
          email.to,
          email.text,
          email.html,
          email.date.toISOString(),
          folder
        );
      }
    });

    insertMany(emails);

    logger.info(`同步邮件成功: ${mailbox.email} - ${folder} - ${emails.length}封`);
    res.json({ message: '同步成功', count: emails.length });
  } catch (error) {
    logger.error('同步邮件失败:', error);
    res.status(500).json({ error: '同步邮件失败: ' + error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const email = db.prepare(`
      SELECT e.*, m.email as mailbox_email
      FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      WHERE e.id = ? AND m.user_id = ?
    `).get(id, req.user.userId);

    if (!email) {
      return res.status(404).json({ error: '邮件不存在' });
    }

    db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(id);

    res.json({ email });
  } catch (error) {
    logger.error('获取邮件详情失败:', error);
    res.status(500).json({ error: '获取邮件详情失败' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { mailbox_id, to, cc, bcc, subject, text, html } = req.body;
    const db = getDb();

    let mailbox;
    if (mailbox_id) {
      mailbox = db.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ?').get(mailbox_id, req.user.userId);
    } else {
      mailbox = db.prepare('SELECT * FROM mailboxes WHERE user_id = ? AND is_default = 1').get(req.user.userId);
    }

    if (!mailbox) {
      return res.status(404).json({ error: '未找到邮箱' });
    }

    const config = {
      host: mailbox.smtp_host,
      port: mailbox.smtp_port,
      secure: mailbox.smtp_secure === 1,
      user: mailbox.email,
      password: decrypt(mailbox.password_encrypted)
    };

    await sendEmail(config, { to, cc, bcc, subject, text, html });

    logger.info(`邮件发送成功: ${mailbox.email} -> ${to}`);
    res.json({ message: '邮件发送成功' });
  } catch (error) {
    logger.error('发送邮件失败:', error);
    res.status(500).json({ error: '发送邮件失败: ' + error.message });
  }
});

router.put('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    db.prepare('UPDATE emails SET is_read = ? WHERE id = ?').run(req.body.read ? 1 : 0, id);

    res.json({ message: '更新成功' });
  } catch (error) {
    logger.error('更新邮件状态失败:', error);
    res.status(500).json({ error: '更新邮件状态失败' });
  }
});

router.put('/:id/star', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    db.prepare('UPDATE emails SET is_starred = ? WHERE id = ?').run(req.body.starred ? 1 : 0, id);

    res.json({ message: '更新成功' });
  } catch (error) {
    logger.error('更新邮件星标失败:', error);
    res.status(500).json({ error: '更新邮件星标失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    db.prepare('DELETE FROM emails WHERE id = ? AND mailbox_id IN (SELECT id FROM mailboxes WHERE user_id = ?)').run(id, req.user.userId);

    res.json({ message: '邮件删除成功' });
  } catch (error) {
    logger.error('删除邮件失败:', error);
    res.status(500).json({ error: '删除邮件失败' });
  }
});

module.exports = router;
