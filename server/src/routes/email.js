const express = require('express');
const path = require('path');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { fetchEmails, sendEmail, getMailboxFolders } = require('../services/mailService');
const { decrypt } = require('../utils/crypto');
const { analyzeSpam } = require('../utils/spamFilter');

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

    // 参数验证和限制
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 50)); // 限制最大100

    let query = 'SELECT e.*, m.email as mailbox_email FROM emails e JOIN mailboxes m ON e.mailbox_id = m.id WHERE m.user_id = ?';
    let countQuery = 'SELECT COUNT(*) as count FROM emails e JOIN mailboxes m ON e.mailbox_id = m.id WHERE m.user_id = ?';
    const params = [req.user.userId];
    const countParams = [req.user.userId];

    if (mailbox_id) {
      query += ' AND e.mailbox_id = ?';
      countQuery += ' AND e.mailbox_id = ?';
      params.push(mailbox_id);
      countParams.push(mailbox_id);
    }

    if (folder) {
      // 验证文件夹名称（只允许合法文件夹）
      const allowedFolders = ['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash'];
      if (!allowedFolders.includes(folder)) {
        return res.status(400).json({ error: '无效的文件夹名称' });
      }
      query += ' AND e.folder = ?';
      countQuery += ' AND e.folder = ?';
      params.push(folder);
      countParams.push(folder);
    }

    query += ' ORDER BY e.received_at DESC LIMIT ? OFFSET ?';
    const offset = (parsedPage - 1) * parsedLimit;
    params.push(parsedLimit, offset);

    const emails = db.prepare(query).all(...params);
    const total = db.prepare(countQuery).get(...countParams).count;

    res.json({ emails, total, page: parsedPage, limit: parsedLimit });
  } catch (error) {
    logger.error('获取邮件列表失败:', error);
    res.status(500).json({ error: '获取邮件列表失败' });
  }
});

// 获取邮箱文件夹列表
router.get('/folders', async (req, res) => {
  try {
    const { mailbox_id } = req.query;
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
    const folders = await getMailboxFolders(config);
    
    // 分类文件夹
    const categorized = {
      inbox: folders.find(f => f.name === 'INBOX'),
      sent: folders.find(f => 
        f.name === 'Sent' || 
        f.name === 'Sent Messages' || 
        f.name === 'Sent Mail' ||
        f.name === '[Gmail]/Sent Mail' ||
        f.name === '已发送'
      ),
      drafts: folders.find(f => 
        f.name === 'Drafts' || 
        f.name === 'Draft' ||
        f.name === '[Gmail]/Drafts' ||
        f.name === '草稿'
      ),
      junk: folders.find(f => 
        f.name === 'Junk' || 
        f.name === 'Spam' || 
        f.name === '[Gmail]/Spam' ||
        f.name === '垃圾邮件'
      ),
      trash: folders.find(f => 
        f.name === 'Trash' || 
        f.name === 'Deleted' ||
        f.name === '[Gmail]/Trash' ||
        f.name === '已删除'
      ),
      all: folders
    };

    // 获取每个文件夹的邮件数量
    const folderCounts = {};
    for (const folder of folders) {
      try {
        const emails = await fetchEmails(config, folder.name, 1);
        folderCounts[folder.name] = emails.length > 0 ? '有邮件' : '空';
      } catch (e) {
        folderCounts[folder.name] = '无法访问';
      }
    }

    res.json({ folders: categorized, folderCounts });
  } catch (error) {
    logger.error('获取文件夹列表失败:', error);
    res.status(500).json({ error: '获取文件夹列表失败' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { mailbox_id, folder = 'INBOX', all_folders = false, limit = 500 } = req.body;
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
    
    // 获取实际文件夹名称
    let foldersToSync = [];
    if (all_folders) {
      try {
        const folders = await getMailboxFolders(config);
        const folderNames = folders.map(f => f.name);
        
        // 智能匹配文件夹
        const inbox = folderNames.find(f => f === 'INBOX');
        const sent = folderNames.find(f => 
          f === 'Sent' || f === 'Sent Messages' || f === 'Sent Mail' ||
          f === '[Gmail]/Sent Mail' || f === '已发送'
        );
        const drafts = folderNames.find(f => 
          f === 'Drafts' || f === 'Draft' || f === '[Gmail]/Drafts' || f === '草稿'
        );
        const junk = folderNames.find(f => 
          f === 'Junk' || f === 'Spam' || f === '[Gmail]/Spam' || f === '垃圾邮件'
        );
        const trash = folderNames.find(f => 
          f === 'Trash' || f === 'Deleted' || f === '[Gmail]/Trash' || f === '已删除'
        );

        foldersToSync = [inbox, sent, drafts, junk, trash].filter(Boolean);
      } catch (e) {
        logger.warn('获取文件夹列表失败，使用默认:', e.message);
        foldersToSync = ['INBOX'];
      }
    } else {
      foldersToSync = [folder];
    }

    let totalCount = 0;
    const syncLimit = Math.min(limit || 500, 2000);
    const errors = [];

    for (const f of foldersToSync) {
      let retries = 2;
      let success = false;
      
      while (retries >= 0 && !success) {
        try {
          const emails = await fetchEmails(config, f, syncLimit);

          const insertEmail = db.prepare(`
            INSERT INTO emails (mailbox_id, message_id, subject, from_address, from_name, to_address, body_text, body_html, received_at, folder, is_read, spam_score, spam_reasons)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const insertAttachment = db.prepare(`
            INSERT INTO attachments (email_id, filename, content_type, size, content)
            VALUES (?, ?, ?, ?, ?)
          `);

          const insertMany = db.transaction((items) => {
            for (const email of items) {
              if (email.messageId) {
                const existing = db.prepare('SELECT id FROM emails WHERE message_id = ? AND mailbox_id = ?').get(email.messageId, mailbox.id);
                if (existing) {
                  continue;
                }
              }

              const fromMatch = email.from.match(/^(.+?)\s*<(.+?)>$/);
              const fromName = fromMatch ? fromMatch[1].trim() : email.from;
              const fromAddress = fromMatch ? fromMatch[2] : email.from;

              const spamResult = analyzeSpam({
                subject: email.subject,
                body_text: email.text,
                body_html: email.html,
                from_address: fromAddress,
                from_name: fromName
              });

              let targetFolder = f;
              if (spamResult.isSpam && f === 'INBOX') {
                targetFolder = 'Junk';
              }

              const result = insertEmail.run(
                mailbox.id,
                email.messageId,
                email.subject,
                fromAddress,
                fromName,
                email.to,
                email.text,
                email.html,
                email.date.toISOString(),
                targetFolder,
                email.isRead ? 1 : 0,
                spamResult.score,
                JSON.stringify(spamResult.reasons)
              );

              if (email.attachments && email.attachments.length > 0) {
                for (const att of email.attachments) {
                  insertAttachment.run(
                    result.lastInsertRowid,
                    att.filename,
                    att.contentType,
                    att.size,
                    att.content
                  );
                }
              }
              
              totalCount++;
            }
          });

          insertMany(emails);
          success = true;
        } catch (e) {
          retries--;
          if (retries >= 0) {
            logger.warn(`同步文件夹 ${f} 失败，重试中...`, e.message);
            await new Promise(r => setTimeout(r, 2000)); // 等待2秒后重试
          } else {
            errors.push(`${f}: ${e.message}`);
            logger.error(`同步文件夹 ${f} 最终失败:`, e.message);
          }
        }
      }
    }

    logger.info(`同步邮件完成: ${mailbox.email} - ${totalCount}封, 失败: ${errors.length}`);
    res.json({ 
      message: errors.length > 0 ? '部分同步成功' : '同步成功', 
      count: totalCount,
      folders: foldersToSync,
      errors: errors.length > 0 ? errors : undefined
    });
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

    // 获取附件列表（不包含内容）
    const attachments = db.prepare(`
      SELECT id, filename, content_type, size FROM attachments WHERE email_id = ?
    `).all(id);

    db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(id);

    res.json({ email, attachments });
  } catch (error) {
    logger.error('获取邮件详情失败:', error);
    res.status(500).json({ error: '获取邮件详情失败' });
  }
});

// 获取附件列表
router.get('/:id/attachments', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const email = db.prepare(`
      SELECT e.id FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      WHERE e.id = ? AND m.user_id = ?
    `).get(id, req.user.userId);

    if (!email) {
      return res.status(404).json({ error: '邮件不存在' });
    }

    const attachments = db.prepare(`
      SELECT id, filename, content_type, size FROM attachments WHERE email_id = ?
    `).all(id);

    res.json({ attachments });
  } catch (error) {
    logger.error('获取附件列表失败:', error);
    res.status(500).json({ error: '获取附件列表失败' });
  }
});

// 下载附件
router.get('/:emailId/attachments/:attachmentId', (req, res) => {
  try {
    const { emailId, attachmentId } = req.params;
    const db = getDb();

    const email = db.prepare(`
      SELECT e.id FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      WHERE e.id = ? AND m.user_id = ?
    `).get(emailId, req.user.userId);

    if (!email) {
      return res.status(404).json({ error: '邮件不存在' });
    }

    const attachment = db.prepare(`
      SELECT filename, content_type, size, content FROM attachments WHERE id = ? AND email_id = ?
    `).get(attachmentId, emailId);

    if (!attachment) {
      return res.status(404).json({ error: '附件不存在' });
    }

    res.setHeader('Content-Type', attachment.content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    res.setHeader('Content-Length', attachment.size);
    res.send(attachment.content);
  } catch (error) {
    logger.error('下载附件失败:', error);
    res.status(500).json({ error: '下载附件失败' });
  }
});

// 发送带附件的邮件
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

    // 处理附件
    let attachments = [];
    if (req.files && req.files.attachments) {
      const files = Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments];
      
      // 限制附件数量
      if (files.length > 10) {
        return res.status(400).json({ error: '附件数量不能超过10个' });
      }
      
      // 禁止的文件扩展名
      const blockedExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.vbs', '.wsf', '.msi', '.dll'];
      
      attachments = files.map(file => {
        const ext = path.extname(file.name).toLowerCase();
        if (blockedExtensions.includes(ext)) {
          throw new Error(`不允许上传 ${ext} 类型的文件`);
        }
        
        // 限制单个附件大小 (25MB)
        if (file.data.length > 25 * 1024 * 1024) {
          throw new Error(`文件 ${file.name} 超过25MB限制`);
        }
        
        return {
          filename: file.name,
          content: file.data,
          contentType: file.mimetype
        };
      });
    }

    await sendEmail(config, { to, cc, bcc, subject, text, html, attachments });

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

// 移动邮件到其他文件夹
router.put('/:id/move', (req, res) => {
  try {
    const { id } = req.params;
    const { folder } = req.body;
    const db = getDb();

    if (!folder) {
      return res.status(400).json({ error: '请指定目标文件夹' });
    }

    const email = db.prepare(`
      SELECT e.id FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      WHERE e.id = ? AND m.user_id = ?
    `).get(id, req.user.userId);

    if (!email) {
      return res.status(404).json({ error: '邮件不存在' });
    }

    db.prepare('UPDATE emails SET folder = ? WHERE id = ?').run(folder, id);

    res.json({ message: '移动成功' });
  } catch (error) {
    logger.error('移动邮件失败:', error);
    res.status(500).json({ error: '移动邮件失败' });
  }
});

module.exports = router;
