const EMAIL_PROVIDERS = {
  gmail: {
    name: 'Gmail',
    domain: 'gmail.com',
    icon: 'gmail',
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true
    },
    pop3: {
      host: 'pop.gmail.com',
      port: 995,
      secure: true
    },
    smtp: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true
    },
    protocol: 'imap', // 默认协议
    note: '需要开启两步验证并生成应用专用密码。如需使用IMAP，请在Gmail设置中启用IMAP访问。',
    helpUrl: 'https://support.google.com/accounts/answer/185833',
    helpNote: 'Gmail设置 > 转发和POP/IMAP > 启用IMAP'
  },
  outlook: {
    name: 'Outlook / Hotmail',
    domain: 'outlook.com',
    icon: 'outlook',
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false
    },
    protocol: 'imap',
    note: '支持 @outlook.com, @hotmail.com, @live.com',
    helpUrl: null
  },
  qq: {
    name: 'QQ邮箱',
    domain: 'qq.com',
    icon: 'qq',
    imap: {
      host: 'imap.qq.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.qq.com',
      port: 465,
      secure: true
    },
    note: '需要在QQ邮箱设置中开启IMAP/SMTP并获取授权码',
    helpUrl: 'https://service.mail.qq.com/cgi-bin/help?subtype=1&&id=28&&no=369'
  },
  '163': {
    name: '网易163邮箱',
    domain: '163.com',
    icon: '163',
    imap: {
      host: 'imap.163.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.163.com',
      port: 465,
      secure: true
    },
    note: '需要开启IMAP/SMTP服务并获取授权码',
    helpUrl: null
  },
  '126': {
    name: '网易126邮箱',
    domain: '126.com',
    icon: '126',
    imap: {
      host: 'imap.126.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.126.com',
      port: 465,
      secure: true
    },
    note: '需要开启IMAP/SMTP服务并获取授权码',
    helpUrl: null
  },
  yeah: {
    name: '网易Yeah邮箱',
    domain: 'yeah.net',
    icon: 'yeah',
    imap: {
      host: 'imap.yeah.net',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.yeah.net',
      port: 465,
      secure: true
    },
    note: '需要开启IMAP/SMTP服务并获取授权码',
    helpUrl: null
  },
  icloud: {
    name: 'iCloud邮箱',
    domain: 'icloud.com',
    icon: 'icloud',
    imap: {
      host: 'imap.mail.me.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false
    },
    note: '需要生成App专用密码',
    helpUrl: 'https://support.apple.com/zh-cn/102654'
  },
  yahoo: {
    name: 'Yahoo邮箱',
    domain: 'yahoo.com',
    icon: 'yahoo',
    imap: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true
    },
    note: '需要生成应用专用密码',
    helpUrl: null
  },
  aliyun: {
    name: '阿里云邮箱',
    domain: 'aliyun.com',
    icon: 'aliyun',
    imap: {
      host: 'imap.aliyun.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.aliyun.com',
      port: 465,
      secure: true
    },
    note: '支持 @aliyun.com',
    helpUrl: null
  },
  sina: {
    name: '新浪邮箱',
    domain: 'sina.com',
    icon: 'sina',
    imap: {
      host: 'imap.sina.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.sina.com',
      port: 465,
      secure: true
    },
    note: '需要开启IMAP/SMTP服务',
    helpUrl: null
  },
  sohu: {
    name: '搜狐邮箱',
    domain: 'sohu.com',
    icon: 'sohu',
    imap: {
      host: 'imap.sohu.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.sohu.com',
      port: 465,
      secure: true
    },
    note: '需要开启IMAP/SMTP服务',
    helpUrl: null
  },
  corporate: {
    name: '企业邮箱 (自定义)',
    domain: 'custom',
    icon: 'corporate',
    imap: {
      host: '',
      port: 993,
      secure: true
    },
    smtp: {
      host: '',
      port: 465,
      secure: true
    },
    note: '请填写企业邮箱的IMAP/SMTP服务器地址',
    helpUrl: null
  }
};

function detectProvider(email) {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  for (const [key, provider] of Object.entries(EMAIL_PROVIDERS)) {
    if (provider.domain === domain) {
      return { key, ...provider };
    }
  }
  return null;
}

function getProviderConfig(providerKey) {
  return EMAIL_PROVIDERS[providerKey] || null;
}

function getAllProviders() {
  return Object.entries(EMAIL_PROVIDERS).map(([key, provider]) => ({
    key,
    name: provider.name,
    domain: provider.domain,
    icon: provider.icon,
    note: provider.note,
    protocol: provider.protocol || 'imap',
    imap: provider.imap,
    pop3: provider.pop3,
    smtp: provider.smtp
  }));
}

module.exports = {
  EMAIL_PROVIDERS,
  detectProvider,
  getProviderConfig,
  getAllProviders
};
