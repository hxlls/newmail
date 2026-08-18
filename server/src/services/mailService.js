const Imap = require('imap');
const POP3Client = require('poplib');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { logger } = require('../utils/logger');

function createImapConnection(config) {
  return new Imap({
    user: config.user,
    password: config.password,
    host: config.host,
    port: config.port || 993,
    tls: config.secure !== false,
    tlsOptions: { 
      rejectUnauthorized: false,
      servername: config.host
    },
    authTimeout: 10000,
    connTimeout: 30000
  });
}

// 获取邮箱文件夹列表
function getMailboxFolders(config) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config);
    const folders = [];

    imap.once('ready', () => {
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        function extractFolders(box, prefix = '') {
          const name = prefix ? `${prefix}${box.delimiter}${box.name}` : box.name;
          folders.push({
            name: name,
            delimiter: box.delimiter,
            hasChildren: !!box.children
          });
          
          if (box.children) {
            for (const child of Object.values(box.children)) {
              extractFolders(child, name);
            }
          }
        }

        for (const box of Object.values(boxes)) {
          extractFolders(box);
        }

        imap.end();
        resolve(folders);
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}

function testImapConnection(config) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config);

    imap.once('ready', () => {
      imap.end();
      resolve(true);
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}

function testSmtpConnection(config) {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || 465,
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.password
      },
      tls: { rejectUnauthorized: false }
    });

    transporter.verify((error) => {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

function fetchEmails(config, folder = 'INBOX', limit = 50) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config);
    const emails = [];
    let resolved = false;

    // 设置超时
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { imap.end(); } catch(e) {}
        reject(new Error('IMAP连接超时'));
      }
    }, 60000);

    imap.once('ready', () => {
      clearTimeout(timeout);
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          try { imap.end(); } catch(e) {}
          if (!resolved) {
            resolved = true;
            reject(err);
          }
          return;
        }

        const total = box.messages.total;
        if (total === 0) {
          try { imap.end(); } catch(e) {}
          if (!resolved) {
            resolved = true;
            resolve([]);
          }
          return;
        }

        const start = Math.max(1, total - limit + 1);
        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: ['HEADER', 'TEXT'],
          struct: true
        });

        fetch.on('message', (msg, seqno) => {
          let headerData = '';
          let bodyData = '';
          let isRead = false;

          msg.once('attributes', (attrs) => {
            isRead = attrs.flags.includes('\\Seen');
          });

          msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', () => {
              if (info.which === 'HEADER') {
                headerData = buffer;
              } else {
                bodyData = buffer;
              }
            });
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(headerData + '\r\n\r\n' + bodyData);
              
              const attachments = (parsed.attachments || []).map(att => ({
                filename: att.filename || 'unnamed',
                contentType: att.contentType || 'application/octet-stream',
                size: att.size || 0,
                content: att.content
              }));
              
              emails.push({
                messageId: parsed.messageId,
                subject: parsed.subject || '(无主题)',
                from: parsed.from?.text || '',
                to: parsed.to?.text || '',
                date: parsed.date || new Date(),
                text: parsed.text || '',
                html: parsed.html || '',
                isRead: isRead,
                attachments: attachments
              });
            } catch (e) {
              logger.error('解析邮件失败:', e);
            }
          });
        });

        fetch.once('end', () => {
          try { imap.end(); } catch(e) {}
          if (!resolved) {
            resolved = true;
            resolve(emails.reverse());
          }
        });

        fetch.once('error', (err) => {
          try { imap.end(); } catch(e) {}
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
      });
    });

    imap.once('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    imap.connect();
  });
}

function sendEmail(config, options) {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || 465,
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.password
      },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"${options.fromName || config.user}" <${config.user}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info);
      }
    });
  });
}

// POP3 连接测试
function testPop3Connection(config) {
  return new Promise((resolve, reject) => {
    const client = new POP3Client(
      config.port || 995,
      config.host,
      {
        tlserrs: false,
        enabletls: config.secure !== false,
        debug: false
      }
    );

    client.on('error', (err) => {
      reject(err);
    });

    client.on('connect', () => {
      client.login(config.user, config.password);
    });

    client.on('login', (status) => {
      if (status) {
        client.quit();
        resolve(true);
      } else {
        client.quit();
        reject(new Error('POP3登录失败'));
      }
    });
  });
}

// POP3 获取邮件
function fetchEmailsPop3(config, limit = 50) {
  return new Promise((resolve, reject) => {
    const emails = [];
    const client = new POP3Client(
      config.port || 995,
      config.host,
      {
        tlserrs: false,
        enabletls: config.secure !== false,
        debug: false
      }
    );

    client.on('error', (err) => {
      reject(err);
    });

    client.on('connect', () => {
      client.login(config.user, config.password);
    });

    client.on('login', (status) => {
      if (!status) {
        client.quit();
        reject(new Error('POP3登录失败'));
        return;
      }
      client.list();
    });

    client.on('list', (status, msgCount) => {
      if (!status || msgCount === 0) {
        client.quit();
        resolve([]);
        return;
      }

      const fetchCount = Math.min(msgCount, limit);
      const startMsg = Math.max(1, msgCount - fetchCount + 1);
      let fetched = 0;

      for (let i = startMsg; i <= msgCount; i++) {
        client.retr(i);
      }
    });

    client.on('retr', (status, msgNumber, data) => {
      if (status) {
        simpleParser(data)
          .then(parsed => {
            emails.push({
              messageId: parsed.messageId,
              subject: parsed.subject || '(无主题)',
              from: parsed.from?.text || '',
              to: parsed.to?.text || '',
              date: parsed.date || new Date(),
              text: parsed.text || '',
              html: parsed.html || '',
              isRead: false, // POP3 不区分已读未读
              attachments: (parsed.attachments || []).map(att => ({
                filename: att.filename || 'unnamed',
                contentType: att.contentType || 'application/octet-stream',
                size: att.size || 0,
                content: att.content
              }))
            });
          })
          .catch(err => {
            logger.error('解析POP3邮件失败:', err);
          })
          .finally(() => {
            fetched++;
            if (fetched >= Math.min(msgCount, limit)) {
              client.quit();
              resolve(emails);
            }
          });
      }
    });
  });
}

module.exports = {
  testImapConnection,
  testSmtpConnection,
  testPop3Connection,
  fetchEmails,
  fetchEmailsPop3,
  sendEmail
};
