const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// 密钥文件路径
const KEY_FILE = process.env.ENCRYPTION_KEY_FILE || 
  path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, '../../../data'), '.encryption_key');

// 获取或生成密钥
function getOrCreateKey() {
  // 优先使用环境变量
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32) {
    return process.env.ENCRYPTION_KEY.substring(0, 32);
  }

  // 尝试从文件读取
  try {
    if (fs.existsSync(KEY_FILE)) {
      const key = fs.readFileSync(KEY_FILE, 'utf8').trim();
      if (key && key.length >= 32) {
        return key.substring(0, 32);
      }
    }
  } catch (e) {
    // 忽略读取错误
  }

  // 生成新密钥并保存
  const newKey = crypto.randomBytes(32).toString('hex').substring(0, 32);
  try {
    const dir = path.dirname(KEY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(KEY_FILE, newKey, 'utf8');
    fs.chmodSync(KEY_FILE, 0o600); // 只有 owner 可读写
    console.log('Generated new encryption key and saved to:', KEY_FILE);
  } catch (e) {
    console.error('Warning: Could not save encryption key to file:', e.message);
  }
  
  return newKey;
}

const SECRET_KEY = getOrCreateKey();

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length !== 2) return null;
  
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error('Decryption failed:', e.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
