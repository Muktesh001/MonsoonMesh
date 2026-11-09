import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { z } from 'zod';
import { config } from './config.js';
import { logger, logError } from './logger.js';
import { router } from './routes.js';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middleware/logging.js';

export const app = express();
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });
const requests = new Counter({ name: 'http_requests_total', help: 'HTTP requests', labelNames: ['method', 'route', 'status'] });
const duration = new Histogram({ name: 'http_request_duration_seconds', help: 'Request duration', labelNames: ['method', 'route'], buckets: [0.05, 0.1, 0.25, 0.5, 1, 2] });
metricsRegistry.registerMetric(requests);
metricsRegistry.registerMetric(duration);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

// Add request ID header
app.use((req, res, next) => {
  const supplied = z.string().uuid().safeParse(req.header('x-request-id'));
  res.setHeader('X-Request-ID', supplied.success ? supplied.data : randomUUID());
  next();
});

// Add request/response logging middleware
app.use(requestLoggingMiddleware);

// Add metrics middleware
app.use((req, res, next) => {
  const end = duration.startTimer({ method: req.method, route: req.route?.path ?? req.path });
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    requests.inc({ method: req.method, route, status: res.statusCode });
    end();
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/metrics', async (_req, res, next) => {
  try {
    res.type(metricsRegistry.contentType).send(await metricsRegistry.metrics());
  } catch (error) {
    next(error);
  }
});

app.use('/api', router);

// Add error logging middleware before final error handler
app.use(errorLoggingMiddleware);

// Global error handler
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = res.getHeader('X-Request-ID');

  if (error instanceof z.ZodError) {
    logError('Validation error', {
      requestId,
      issues: error.issues,
    });
    res.status(400).json({ error: 'Invalid request', details: error.issues });
    return;
  }

  if (error instanceof Error && 'code' in error && error.code === 'LIMIT_FILE_SIZE') {
    logError('File size limit exceeded', {
      requestId,
      error: error.message,
    });
    res.status(413).json({ error: 'Image exceeds the configured upload size limit' });
    return;
  }

  // Log unexpected errors
  logError('Unhandled server error', {
    requestId,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
});
