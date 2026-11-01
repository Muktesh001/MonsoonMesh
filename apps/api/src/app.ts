import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { z } from 'zod';
import { config } from './config.js';
import { router } from './routes.js';

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
app.use((req, res, next) => {
  const supplied = z.string().uuid().safeParse(req.header('x-request-id'));
  res.setHeader('X-Request-ID', supplied.success ? supplied.data : randomUUID());
  next();
});
app.use((req, res, next) => {
  const end = duration.startTimer({ method: req.method, route: req.route?.path ?? req.path });
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    requests.inc({ method: req.method, route, status: res.statusCode });
    end();
  });
  next();
});
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/metrics', async (_req, res, next) => {
  try { res.type(metricsRegistry.contentType).send(await metricsRegistry.metrics()); }
  catch (error) { next(error); }
});
app.use('/api', router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid request', details: error.issues });
    return;
  }
  if (error instanceof Error && 'code' in error && error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Image exceeds the configured upload size limit' });
    return;
  }
  console.error(JSON.stringify({
    level: 'error',
    requestId: res.getHeader('X-Request-ID'),
    message: error instanceof Error ? error.message : 'Unknown server error',
    stack: error instanceof Error ? error.stack : undefined,
  }));
  res.status(500).json({ error: 'Internal server error' });
});
