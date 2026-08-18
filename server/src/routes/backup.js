const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const zlib = require('zlib');
const { Transform } = require('stream');

// 流式JSON写入器
class JsonStreamWriter {
  constructor(filePath) {
    this.filePath = filePath;
    this.stream = fs.createWriteStream(filePath);
    this.stream.write('[');
    this.first = true;
  }

  write(item) {
    if (!this.first) {
      this.stream.write(',');
    }
    this.stream.write(JSON.stringify(item));
    this.first = false;
  }

  end() {
    this.stream.write(']');
    return new Promise((resolve) => {
      this.stream.end(resolve);
    });
  }
}

// 分页导出所有数据
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.userId;
    const { folders } = req.query;  // 文件夹过滤，逗号分隔

    // 解析要导出的文件夹
    const allowedFolders = ['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash'];
    let exportFolders = allowedFolders;
    if (folders) {
      exportFolders = folders.split(',').filter(f => allowedFolders.includes(f));
      if (exportFolders.length === 0) {
        return res.status(400).json({ error: '请选择至少一个有效的文件夹' });
      }
    }

    // 获取用户信息
    const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(userId);
    
    // 获取邮箱配置
    const mailboxes = db.prepare(`
      SELECT id, name, email, imap_host, imap_port, imap_secure, 
             smtp_host, smtp_port, smtp_secure, is_default, created_at 
      FROM mailboxes WHERE user_id = ?
    `).all(userId);

    // 获取AI配置
    const aiConfigs = db.prepare(`
      SELECT id, provider, model, base_url, is_active, created_at 
      FROM ai_configs WHERE user_id = ?
    `).all(userId);

    // 统计邮件数量（按文件夹）
    const placeholders = exportFolders.map(() => '?').join(',');
    const emailCount = db.prepare(`
      SELECT COUNT(*) as count FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      WHERE m.user_id = ? AND e.folder IN (${placeholders})
    `).get(userId, ...exportFolders).count;

    // 创建临时目录
    const tmpDir = `/tmp/newmail-export-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });

    // 写入元数据
    const metaFile = path.join(tmpDir, 'meta.json');
    fs.writeFileSync(metaFile, JSON.stringify({
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      user: { username: user.username, email: user.email },
      mailboxes,
      ai_configs: aiConfigs,
      export_folders: exportFolders,
      stats: {
        mailbox_count: mailboxes.length,
        email_count: emailCount
      }
    }, null, 2));

    // 分页导出邮件到多个文件
    const PAGE_SIZE = 1000;
    const totalPages = Math.ceil(emailCount / PAGE_SIZE);
    
    if (emailCount > 0) {
      const emailsDir = path.join(tmpDir, 'emails');
      fs.mkdirSync(emailsDir, { recursive: true });

      for (let page = 0; page < totalPages; page++) {
        const emails = db.prepare(`
          SELECT e.* FROM emails e
          JOIN mailboxes m ON e.mailbox_id = m.id
          WHERE m.user_id = ? AND e.folder IN (${placeholders})
          ORDER BY e.id
          LIMIT ? OFFSET ?
        `).all(userId, ...exportFolders, PAGE_SIZE, page * PAGE_SIZE);

        const emailsFile = path.join(emailsDir, `batch_${page}.json`);
        fs.writeFileSync(emailsFile, JSON.stringify(emails));
      }

      // 导出附件
      const attachmentsDir = path.join(tmpDir, 'attachments');
      fs.mkdirSync(attachmentsDir, { recursive: true });

      let offset = 0;
      let hasMore = true;
      let batchNum = 0;

      while (hasMore) {
        const attachments = db.prepare(`
          SELECT a.id, a.email_id, a.filename, a.content_type, a.size, a.content
          FROM attachments a
          JOIN emails e ON a.email_id = e.id
          JOIN mailboxes m ON e.mailbox_id = m.id
          WHERE m.user_id = ? AND e.folder IN (${placeholders})
          LIMIT ? OFFSET ?
        `).all(userId, ...exportFolders, 100, offset);

        if (attachments.length === 0) {
          hasMore = false;
        } else {
          const attBatchFile = path.join(attachmentsDir, `batch_${batchNum}.json`);
          const attData = attachments.map(att => ({
            ...att,
            content_base64: att.content ? att.content.toString('base64') : null,
            content: undefined
          }));
          fs.writeFileSync(attBatchFile, JSON.stringify(attData));
          
          batchNum++;
          offset += 100;
        }
      }
    }

    // 创建压缩包
    const zipFile = `/tmp/newmail-backup-${new Date().toISOString().slice(0,10)}.zip`;
    execFileSync('zip', ['-r', '-j', zipFile, tmpDir]);

    // 发送文件
    const stat = fs.statSync(zipFile);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="newmail-backup-${new Date().toISOString().slice(0,10)}.zip"`);
    res.setHeader('Content-Length', stat.size);
    
    const fileStream = fs.createReadStream(zipFile);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      fs.unlinkSync(zipFile);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    logger.info(`用户 ${user.username} 导出了数据: ${mailboxes.length}个邮箱, ${emailCount}封邮件, 文件夹: ${exportFolders.join(',')}`);
  } catch (error) {
    logger.error('导出数据失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

// 分页导入数据
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.userId;

    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: '请上传备份文件' });
    }

    const file = req.files.file;
    let tmpDir;

    // 解压文件
    if (file.name.endsWith('.zip')) {
      tmpDir = `/tmp/newmail-import-${Date.now()}`;
      fs.mkdirSync(tmpDir, { recursive: true });
      
      const zipPath = path.join(tmpDir, 'backup.zip');
      fs.writeFileSync(zipPath, file.data);
      
      execFileSync('unzip', ['-o', 'backup.zip'], { cwd: tmpDir });
    } else if (file.name.endsWith('.json')) {
      // 兼容旧格式
      tmpDir = `/tmp/newmail-import-${Date.now()}`;
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'meta.json'), file.data);
    } else {
      return res.status(400).json({ error: '不支持的文件格式' });
    }

    // 读取元数据
    const metaFile = path.join(tmpDir, 'meta.json');
    if (!fs.existsSync(metaFile)) {
      return res.status(400).json({ error: '无效的备份文件' });
    }

    const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    
    let imported = { mailboxes: 0, emails: 0, attachments: 0 };
    const mailboxIdMap = {};  // 旧邮箱ID -> 新邮箱ID
    const emailIdMap = {};    // 旧邮件ID -> 新邮件ID

    // 导入邮箱配置
    if (metaData.mailboxes && Array.isArray(metaData.mailboxes)) {
      for (const mailbox of metaData.mailboxes) {
        try {
          // 检查是否已存在
          const existing = db.prepare('SELECT id FROM mailboxes WHERE user_id = ? AND email = ?')
            .get(userId, mailbox.email);
          
          if (existing) {
            mailboxIdMap[mailbox.id] = existing.id;
          } else {
            const result = db.prepare(`
              INSERT INTO mailboxes 
              (user_id, name, email, protocol, imap_host, imap_port, imap_secure, 
               pop3_host, pop3_port, pop3_secure,
               smtp_host, smtp_port, smtp_secure, is_default, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              userId, mailbox.name, mailbox.email,
              mailbox.protocol || 'imap',
              mailbox.imap_host, mailbox.imap_port, mailbox.imap_secure,
              mailbox.pop3_host || '', mailbox.pop3_port || 995, mailbox.pop3_secure || 1,
              mailbox.smtp_host, mailbox.smtp_port, mailbox.smtp_secure,
              mailbox.is_default, mailbox.created_at
            );
            mailboxIdMap[mailbox.id] = result.lastInsertRowid;
          }
          imported.mailboxes++;
        } catch (e) {
          logger.warn('导入邮箱失败:', e.message);
        }
      }
    }

    // 获取用户邮箱列表（如果没有从备份中导入）
    const userMailboxes = db.prepare('SELECT id, email FROM mailboxes WHERE user_id = ?').all(userId);
    const defaultMailboxId = userMailboxes[0]?.id;

    // 分页导入邮件
    const emailsDir = path.join(tmpDir, 'emails');
    if (fs.existsSync(emailsDir)) {
      const batchFiles = fs.readdirSync(emailsDir)
        .filter(f => f.endsWith('.json'))
        .sort();

      for (const batchFile of batchFiles) {
        const emails = JSON.parse(fs.readFileSync(path.join(emailsDir, batchFile), 'utf8'));
        
        for (const email of emails) {
          try {
            // 确定邮箱ID：优先使用映射，其次使用默认邮箱
            let mailboxId = defaultMailboxId;
            if (email.mailbox_id && mailboxIdMap[email.mailbox_id]) {
              mailboxId = mailboxIdMap[email.mailbox_id];
            }
            
            if (!mailboxId) continue;

            // 检查是否已存在（基于message_id）
            if (email.message_id) {
              const existing = db.prepare('SELECT id FROM emails WHERE message_id = ? AND mailbox_id = ?')
                .get(email.message_id, mailboxId);
              if (existing) {
                emailIdMap[email.id] = existing.id;
                continue;
              }
            }

            const result = db.prepare(`
              INSERT INTO emails 
              (mailbox_id, message_id, subject, from_address, from_name, 
               to_address, body_text, body_html, received_at, is_read, is_starred, folder,
               spam_score, spam_reasons, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              mailboxId, email.message_id, email.subject,
              email.from_address, email.from_name, email.to_address,
              email.body_text, email.body_html, email.received_at,
              email.is_read || 0, email.is_starred || 0, email.folder || 'INBOX',
              email.spam_score || 0, email.spam_reasons || '[]',
              email.created_at
            );
            
            // 记录ID映射
            emailIdMap[email.id] = result.lastInsertRowid;
            imported.emails++;
          } catch (e) {
            // 忽略重复
          }
        }
      }

      // 导入附件
      const attachmentsDir = path.join(tmpDir, 'attachments');
      if (fs.existsSync(attachmentsDir)) {
        const attBatchFiles = fs.readdirSync(attachmentsDir)
          .filter(f => f.endsWith('.json'))
          .sort();

        for (const batchFile of attBatchFiles) {
          const attachments = JSON.parse(fs.readFileSync(path.join(attachmentsDir, batchFile), 'utf8'));
          
          for (const att of attachments) {
            try {
              // 使用ID映射找到新邮件ID
              const newEmailId = emailIdMap[att.email_id];
              
              if (newEmailId && att.content_base64) {
                db.prepare(`
                  INSERT INTO attachments (email_id, filename, content_type, size, content)
                  VALUES (?, ?, ?, ?, ?)
                `).run(
                  newEmailId,
                  att.filename,
                  att.content_type,
                  att.size,
                  Buffer.from(att.content_base64, 'base64')
                );
                imported.attachments++;
              }
            } catch (e) {
              // 忽略错误
            }
          }
        }
      }
    }

    // 清理临时目录
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    res.json({
      success: true,
      imported,
      message: `成功导入 ${imported.mailboxes} 个邮箱、${imported.emails} 封邮件和 ${imported.attachments} 个附件`
    });

    logger.info(`用户导入了数据: ${imported.mailboxes}个邮箱, ${imported.emails}封邮件, ${imported.attachments}个附件`);
  } catch (error) {
    logger.error('导入数据失败:', error);
    res.status(500).json({ error: '导入失败' });
  }
});

// 获取备份统计
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.userId;

    const stats = {
      mailboxes: db.prepare('SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ?').get(userId).count,
      emails: db.prepare(`
        SELECT COUNT(*) as count FROM emails e
        JOIN mailboxes m ON e.mailbox_id = m.id
        WHERE m.user_id = ?
      `).get(userId).count,
      unread: db.prepare(`
        SELECT COUNT(*) as count FROM emails e
        JOIN mailboxes m ON e.mailbox_id = m.id
        WHERE m.user_id = ? AND e.is_read = 0
      `).get(userId).count,
      starred: db.prepare(`
        SELECT COUNT(*) as count FROM emails e
        JOIN mailboxes m ON e.mailbox_id = m.id
        WHERE m.user_id = ? AND e.is_starred = 1
      `).get(userId).count,
      attachments: db.prepare(`
        SELECT COUNT(*) as count FROM attachments a
        JOIN emails e ON a.email_id = e.id
        JOIN mailboxes m ON e.mailbox_id = m.id
        WHERE m.user_id = ?
      `).get(userId).count,
      db_size: fs.existsSync(process.env.DB_PATH) ? fs.statSync(process.env.DB_PATH).size : 0
    };

    res.json(stats);
  } catch (error) {
    logger.error('获取统计失败:', error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

module.exports = router;
