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
      imap_host TEXT NOT NULL,
      imap_port INTEGER DEFAULT 993,
      imap_secure INTEGER DEFAULT 1,
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

    CREATE INDEX IF NOT EXISTS idx_emails_mailbox ON emails(mailbox_id);
    CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
    CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_user ON mailboxes(user_id);
  `);

  logger.info('数据库表初始化完成');
}

module.exports = { getDb, initDatabase };
