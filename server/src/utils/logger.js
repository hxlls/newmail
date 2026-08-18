const winston = require('winston');
const path = require('path');

const LOG_PATH = process.env.LOG_PATH || path.join(__dirname, '../../../data/logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(LOG_PATH, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(LOG_PATH, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

module.exports = { logger };
