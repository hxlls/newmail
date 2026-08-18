const { getDb } = require('../db/init');
const { fetchEmails } = require('./mailService');
const { decrypt } = require('../utils/crypto');
const { logger } = require('../utils/logger');

const CHECK_INTERVAL = 5 * 60 * 1000;
let checkTimer = null;

function startMailChecker(io) {
  logger.info('启动邮件检查服务');

  checkAllMailboxes(io);

  checkTimer = setInterval(() => {
    checkAllMailboxes(io);
  }, CHECK_INTERVAL);
}

async function checkAllMailboxes(io) {
  try {
    const db = getDb();
    const mailboxes = db.prepare('SELECT * FROM mailboxes').all();

    for (const mailbox of mailboxes) {
      try {
        await checkMailbox(mailbox, io);
      } catch (error) {
        logger.error(`检查邮箱失败 ${mailbox.email}:`, error.message);
      }
    }
  } catch (error) {
    logger.error('邮件检查服务错误:', error);
  }
}

async function checkMailbox(mailbox, io) {
  const config = {
    host: mailbox.imap_host,
    port: mailbox.imap_port,
    secure: mailbox.imap_secure === 1,
    user: mailbox.email,
    password: decrypt(mailbox.password_encrypted)
  };

  const emails = await fetchEmails(config, 'INBOX', 20);

  const db = getDb();
  let newCount = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO emails (mailbox_id, message_id, subject, from_address, from_name, to_address, body_text, body_html, received_at, folder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const email of emails) {
    const fromMatch = email.from.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].trim() : email.from;
    const fromAddress = fromMatch ? fromMatch[2] : email.from;

    const result = insertStmt.run(
      mailbox.id,
      email.messageId,
      email.subject,
      fromAddress,
      fromName,
      email.to,
      email.text,
      email.html,
      email.date.toISOString(),
      'INBOX'
    );

    if (result.changes > 0) {
      newCount++;
    }
  }

  if (newCount > 0) {
    logger.info(`新邮件: ${mailbox.email} - ${newCount}封`);

    io.to(`user:${mailbox.user_id}`).emit('new-emails', {
      mailboxId: mailbox.id,
      count: newCount
    });
  }
}

function stopMailChecker() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

module.exports = { startMailChecker, stopMailChecker };
