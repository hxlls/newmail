const { logger } = require('../utils/logger');

// 垃圾邮件关键词
const SPAM_KEYWORDS = [
  '中奖', '免费', '优惠', '促销', '限时', '紧急', '立即行动',
  '点击这里', '恭喜您', '您已中奖', '汇款', '转账', '账户异常',
  '验证身份', '密码过期', '安全警告', 'viagra', 'casino', 'lottery',
  'winner', 'congratulations', 'urgent', 'act now', 'click here',
  'free money', 'make money', 'earn extra', 'weight loss', 'diet pills'
];

// 可疑发件人模式
const SUSPICIOUS_SENDER_PATTERNS = [
  /noreply@.*\.xyz$/i,
  /info@.*\.top$/i,
  /admin@.*\.buzz$/i,
  /support@.*\.click$/i,
  /^[a-z0-9]{20,}@/i,  // 长随机用户名
  /\d{10,}@/  // 纯数字用户名
];

// 可疑URL模式
const SUSPICIOUS_URL_PATTERNS = [
  /bit\.ly/i,
  /tinyurl\.com/i,
  /goo\.gl/i,
  /t\.co/i,
  /clk\.at/i
];

/**
 * 分析邮件是否为垃圾邮件
 * @param {Object} email - 邮件对象
 * @returns {Object} - { isSpam: boolean, score: number, reasons: string[] }
 */
function analyzeSpam(email) {
  let score = 0;
  const reasons = [];

  const subject = (email.subject || '').toLowerCase();
  const body = ((email.body_text || '') + ' ' + (email.body_html || '')).toLowerCase();
  const fromAddress = (email.from_address || '').toLowerCase();
  const fromName = (email.from_name || '').toLowerCase();

  // 1. 检查关键词
  for (const keyword of SPAM_KEYWORDS) {
    if (subject.includes(keyword.toLowerCase())) {
      score += 3;
      reasons.push(`主题包含可疑词: ${keyword}`);
    }
    if (body.includes(keyword.toLowerCase())) {
      score += 1;
      reasons.push(`内容包含可疑词: ${keyword}`);
    }
  }

  // 2. 检查发件人
  for (const pattern of SUSPICIOUS_SENDER_PATTERNS) {
    if (pattern.test(fromAddress)) {
      score += 5;
      reasons.push(`可疑发件人地址: ${fromAddress}`);
      break;
    }
  }

  // 3. 检查可疑URL
  for (const pattern of SUSPICIOUS_URL_PATTERNS) {
    const urlRegex = new RegExp(pattern.source + '[^\\s]*', 'gi');
    const urlMatches = body.match(urlRegex);
    if (urlMatches && urlMatches.length > 2) {
      score += 3;
      reasons.push(`包含多个短链接`);
      break;
    }
  }

  // 4. 检查全大写主题
  if (subject === subject.toUpperCase() && subject.length > 5) {
    score += 2;
    reasons.push('主题全大写');
  }

  // 5. 检查过多感叹号
  const exclamationCount = (subject.match(/!/g) || []).length;
  if (exclamationCount > 3) {
    score += 2;
    reasons.push('主题包含过多感叹号');
  }

  // 6. 检查HTML内容中的隐藏文本
  if (email.body_html) {
    const hiddenTextRegex = /color:\s*(white|#fff|#ffffff|transparent)/gi;
    if (hiddenTextRegex.test(email.body_html)) {
      score += 3;
      reasons.push('包含隐藏文本');
    }
  }

  // 7. 检查附件类型
  if (email.attachments && email.attachments.length > 0) {
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs', '.wsf'];
    for (const att of email.attachments) {
      const filename = (att.filename || '').toLowerCase();
      if (suspiciousExtensions.some(ext => filename.endsWith(ext))) {
        score += 5;
        reasons.push(`包含可疑附件: ${att.filename}`);
      }
    }
  }

  // 8. 检查回复地址不一致
  if (email.reply_to && email.from_address) {
    const replyDomain = email.reply_to.split('@')[1]?.toLowerCase();
    const fromDomain = email.from_address.split('@')[1]?.toLowerCase();
    if (replyDomain && fromDomain && replyDomain !== fromDomain) {
      score += 2;
      reasons.push('回复地址与发件人域名不一致');
    }
  }

  // 判断是否为垃圾邮件（分数阈值）
  const isSpam = score >= 5;

  return {
    isSpam,
    score,
    reasons,
    confidence: Math.min(score / 10, 1) // 置信度 0-1
  };
}

/**
 * 获取垃圾邮件分数颜色
 */
function getSpamScoreColor(score) {
  if (score >= 8) return 'red';
  if (score >= 5) return 'orange';
  if (score >= 3) return 'yellow';
  return 'green';
}

module.exports = {
  analyzeSpam,
  getSpamScoreColor,
  SPAM_KEYWORDS
};
