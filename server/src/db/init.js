const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/newmail.db');

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      protocol TEXT DEFAULT 'imap',
      imap_host TEXT NOT NULL,
      imap_port INTEGER DEFAULT 993,
      imap_secure INTEGER DEFAULT 1,
      pop3_host TEXT,
      pop3_port INTEGER DEFAULT 995,
      pop3_secure INTEGER DEFAULT 1,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER DEFAULT 465,
      smtp_secure INTEGER DEFAULT 1,
      password_encrypted TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mailbox_id INTEGER NOT NULL,
      message_id TEXT,
      subject TEXT,
      from_address TEXT,
      from_name TEXT,
      to_address TEXT,
      body_text TEXT,
      body_html TEXT,
      received_at DATETIME,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      folder TEXT DEFAULT 'INBOX',
      spam_score INTEGER DEFAULT 0,
      spam_reasons TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      model TEXT,
      base_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email_id INTEGER,
      task_type TEXT NOT NULL,
      prompt TEXT,
      result TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT,
      size INTEGER DEFAULT 0,
      content BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_emails_mailbox ON emails(mailbox_id);
    CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
    CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_user ON mailboxes(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);
  `);

  // 数据库迁移 - 添加新列（如果不存在）
  try {
    const columns = db.prepare("PRAGMA table_info(mailboxes)").all();
    const columnNames = columns.map(c => c.name);
    
    if (!columnNames.includes('protocol')) {
      db.exec("ALTER TABLE mailboxes ADD COLUMN protocol TEXT DEFAULT 'imap'");
    }
    if (!columnNames.includes('pop3_host')) {
      db.exec("ALTER TABLE mailboxes ADD COLUMN pop3_host TEXT");
    }
    if (!columnNames.includes('pop3_port')) {
      db.exec("ALTER TABLE mailboxes ADD COLUMN pop3_port INTEGER DEFAULT 995");
    }
    if (!columnNames.includes('pop3_secure')) {
      db.exec("ALTER TABLE mailboxes ADD COLUMN pop3_secure INTEGER DEFAULT 1");
    }
  } catch (e) {
    logger.warn('数据库迁移检查失败:', e.message);
  }

  logger.info('数据库表初始化完成');
}

module.exports = { getDb, initDatabase };
