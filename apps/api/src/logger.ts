import winston from 'winston';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';

const logDir = config.logDir || './logs';

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format with timestamps and structured data
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
);

// Console format for development (colorized)
const consoleFormat = winston.format.combine(
  logFormat,
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      // Remove internal winston properties
      const { ms, ...cleanMeta } = meta;
      metaStr = Object.keys(cleanMeta).length > 0 ? '\n' + JSON.stringify(cleanMeta, null, 2) : '';
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  }),
);

// JSON format for file logging (production)
const jsonFormat = winston.format.combine(
  logFormat,
  winston.format.json(),
);

// Create transports
const transports: winston.transport[] = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logLevel,
  }),
);

// File transports (combined and error logs)
if (config.nodeEnv === 'production' || config.logLevel === 'debug') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: jsonFormat,
      level: config.logLevel,
      maxsize: 5242880, // 5MB
      maxFiles: 7, // Keep 7 days of logs
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      format: jsonFormat,
      level: 'error',
      maxsize: 5242880,
      maxFiles: 7,
    }),
  );
}

export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: jsonFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: jsonFormat,
    }),
  ],
});

// Create child logger factory for services
export function createChildLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}

// Export convenience functions
export const logInfo = (message: string, meta?: any) => logger.info(message, meta);
export const logWarn = (message: string, meta?: any) => logger.warn(message, meta);
export const logError = (message: string, meta?: any) => logger.error(message, meta);
export const logDebug = (message: string, meta?: any) => logger.debug(message, meta);
export const logHttp = (message: string, meta?: any) => logger.info(message, { ...meta, level: 'http' });
