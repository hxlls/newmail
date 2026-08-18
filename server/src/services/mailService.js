const Imap = require('imap');
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
    tlsOptions: { rejectUnauthorized: false }
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

    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const total = box.messages.total;
        if (total === 0) {
          imap.end();
          return resolve([]);
        }

        const start = Math.max(1, total - limit + 1);
        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: ['HEADER', 'TEXT'],
          struct: true
        });

        fetch.on('message', (msg, seqno) => {
          let headerData = '';
          let bodyData = '';

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
              emails.push({
                messageId: parsed.messageId,
                subject: parsed.subject || '(无主题)',
                from: parsed.from?.text || '',
                to: parsed.to?.text || '',
                date: parsed.date || new Date(),
                text: parsed.text || '',
                html: parsed.html || '',
                attachments: parsed.attachments?.length || 0
              });
            } catch (e) {
              logger.error('解析邮件失败:', e);
            }
          });
        });

        fetch.once('end', () => {
          imap.end();
          resolve(emails.reverse());
        });

        fetch.once('error', (err) => {
          imap.end();
          reject(err);
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
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

module.exports = {
  testImapConnection,
  testSmtpConnection,
  fetchEmails,
  sendEmail
};
