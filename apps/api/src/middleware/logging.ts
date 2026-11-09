import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

/**
 * Middleware to log HTTP requests and responses
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const requestId = res.getHeader('X-Request-ID') as string;

  // Log request
  const queryParams = Object.keys(req.query).length > 0 ? req.query : undefined;
  logger.http(`${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: queryParams,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;

    // Log response
    logger.http(`${req.method} ${req.path} - ${res.statusCode}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Error handling middleware with structured logging
 */
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = res.getHeader('X-Request-ID') as string;

  // Log error with full context
  logger.error(`Unhandled error in ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode || 500,
    error: error.message,
    stack: error.stack,
    ip: req.ip,
  });

  next(error);
}
