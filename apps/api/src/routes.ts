import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';
import { authenticate, type AuthRequest, requireRoles } from './middleware/auth.js';
import { calculateRisk } from './services/risk.js';
import { shortestRoute, type RoadEdge } from './services/routes.js';
import { duplicateScore, textSimilarity } from './services/duplicates.js';

export const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const incidentSchema = z.object({
  title: z.string().min(4).max(160),
  description: z.string().min(8).max(5000),
  category: z.enum(['WATERLOGGING', 'FLOODING', 'DRAINAGE', 'ROAD_BLOCKAGE', 'OTHER']),
  severity: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).default('MODERATE'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const validateUuidParam = (name: string) => (req: Request, res: Response, next: NextFunction): void => {
  if (!z.string().uuid().safeParse(req.params[name]).success) {
    res.status(400).json({ error: `Invalid ${name}` });
    return;
  }
  next();
};

router.post('/auth/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await pool.query(
      'SELECT id, email, password_hash, role, display_name FROM users WHERE lower(email) = lower($1) AND is_active = true',
      [input.email],
    );
    const user = result.rows[0] as { id: string; email: string; password_hash: string; role: string; display_name: string } | undefined;
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.display_name } });
  } catch (error) { next(error); }
});

router.post('/auth/register', async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(254),
      displayName: z.string().trim().min(2).max(100),
      password: z.string().min(12).max(128),
    }).parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users(email,display_name,password_hash,role)
       VALUES(lower($1),$2,$3,'FIELD_REPORTER')
       RETURNING id,email,display_name,role`,
      [input.email, input.displayName, passwordHash],
    );
    const user = rows[0] as { id: string; email: string; display_name: string; role: string };
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '8h' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.display_name } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    next(error);
  }
});

router.get('/auth/me', authenticate, (req: AuthRequest, res) => res.json({ user: req.user }));

router.get('/dashboard', authenticate, async (_req, res, next) => {
  try {
    const [summary, recent, risk] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status IN ('VERIFIED','ASSIGNED','IN_PROGRESS'))::int AS verified,
        count(*) FILTER (WHERE status NOT IN ('RESOLVED','REJECTED','DUPLICATE'))::int AS unresolved
        FROM incidents`),
      pool.query(`SELECT id, title, category, severity, status, is_synthetic, created_at
        FROM incidents ORDER BY created_at DESC LIMIT 6`),
      pool.query(`SELECT category, count(*)::int AS count FROM risk_assessments
        WHERE assessed_at = (SELECT max(assessed_at) FROM risk_assessments) GROUP BY category`),
    ]);
    res.json({ summary: summary.rows[0], recent: recent.rows, riskDistribution: risk.rows, dataLabel: 'Synthetic demonstration data' });
  } catch (error) { next(error); }
});

router.get('/zones', authenticate, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT z.id, z.name, z.zone_type, z.is_synthetic,
      ST_AsGeoJSON(z.boundary)::json AS geometry,
      r.score, r.category AS risk_category
      FROM zones z LEFT JOIN LATERAL
        (SELECT score, category FROM risk_assessments WHERE zone_id = z.id ORDER BY assessed_at DESC LIMIT 1) r ON true`);
    res.json({ type: 'FeatureCollection', features: rows.map((row) => ({
      type: 'Feature', id: row.id, geometry: row.geometry,
      properties: { name: row.name, zoneType: row.zone_type, synthetic: row.is_synthetic, risk: row.score, category: row.risk_category },
    })) });
  } catch (error) { next(error); }
});

router.get('/incidents', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const pagination = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      status: z.enum(['SUBMITTED','PROCESSING','PENDING_VERIFICATION','VERIFIED','ASSIGNED','IN_PROGRESS','RESOLVED','REJECTED','DUPLICATE','REOPENED']).optional(),
    }).parse(req.query);
    const { page, limit } = pagination;
    const status = pagination.status ?? null;
    const reportSelect = `SELECT id, title, description, category, severity, status, is_synthetic,
        ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, created_at
       FROM incidents WHERE ($1::incident_status IS NULL OR status = $1::incident_status)`;
    const { rows } = req.user?.role === 'FIELD_REPORTER'
      ? await pool.query(
        `${reportSelect} AND reporter_id=$3 ORDER BY created_at DESC LIMIT $2 OFFSET $4`,
        [status, limit, req.user.id, (page - 1) * limit],
      )
      : await pool.query(
        `${reportSelect} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [status, limit, (page - 1) * limit],
      );
    res.json({ items: rows, page, limit });
  } catch (error) { next(error); }
});

router.get('/incidents/:id', authenticate, validateUuidParam('id'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id,i.title,i.description,i.category,i.severity,i.status,i.is_synthetic,
        ST_Y(i.location::geometry) AS latitude,ST_X(i.location::geometry) AS longitude,
        i.created_at,i.updated_at,i.reporter_id,z.name AS zone_name
       FROM incidents i LEFT JOIN zones z ON z.id=i.zone_id
       WHERE i.id=$1 AND ($2 <> 'FIELD_REPORTER' OR i.reporter_id=$3)`,
      [req.params.id, req.user!.role, req.user!.id],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Incident not found' }); return; }
    const [events, evidence, relations] = await Promise.all([
      pool.query(`SELECT event_type,details,created_at FROM incident_events WHERE incident_id=$1 ORDER BY created_at`, [req.params.id]),
      pool.query(`SELECT id,media_type,size_bytes,created_at FROM incident_evidence WHERE incident_id=$1 ORDER BY created_at`, [req.params.id]),
      pool.query(`SELECT r.similarity_score,r.reasons,i.id,i.title,i.status
        FROM incident_relations r JOIN incidents i ON i.id=r.related_incident_id WHERE r.incident_id=$1`, [req.params.id]),
    ]);
    res.json({ incident: rows[0], events: events.rows, evidence: evidence.rows, relatedIncidents: relations.rows });
  } catch (error) { next(error); }
});

router.post('/incidents', authenticate, async (req: AuthRequest, res, next) => {
  const client = await pool.connect();
  try {
    const input = incidentSchema.parse(req.body);
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO incidents (reporter_id, title, description, category, severity, status, location, zone_id, is_synthetic)
       VALUES ($1,$2,$3,$4,$5,'PENDING_VERIFICATION',ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,
         (SELECT id FROM zones WHERE ST_Covers(boundary,ST_SetSRID(ST_MakePoint($6,$7),4326)) LIMIT 1),false)
       RETURNING id, title, status, created_at`,
      [req.user!.id, input.title, input.description, input.category, input.severity, input.longitude, input.latitude],
    );
    const incident = rows[0] as { id: string; title: string; status: string };
    await client.query(
      `INSERT INTO incident_events (incident_id, actor_id, event_type, details)
       VALUES ($1,$2,'SUBMITTED',$3)`,
      [incident.id, req.user!.id, JSON.stringify({ status: incident.status })],
    );
    await client.query(
      `INSERT INTO outbox_events(topic,payload) VALUES('incident-analysis',$1)`,
      [JSON.stringify({ incident_id: incident.id, title: input.title, description: input.description, category: input.category })],
    );
    await client.query('COMMIT');
    res.status(201).json({ incident });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

const transitions: Record<string, string[]> = {
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED', 'DUPLICATE'],
  VERIFIED: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS'],
};

router.patch('/incidents/:id/status', authenticate, validateUuidParam('id'), requireRoles('ADMIN', 'OPERATOR'), async (req: AuthRequest, res, next) => {
  const client = await pool.connect();
  try {
    const status = z.enum(['VERIFIED','ASSIGNED','IN_PROGRESS','RESOLVED','REJECTED','DUPLICATE','REOPENED']).parse(req.body.status);
    await client.query('BEGIN');
    const existing = await client.query('SELECT status FROM incidents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!existing.rowCount) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Incident not found' }); return; }
    const prior = existing.rows[0].status as string;
    if (!transitions[prior]?.includes(status)) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: `Cannot transition incident from ${prior} to ${status}` });
      return;
    }
    const { rows } = await client.query('UPDATE incidents SET status=$2, updated_at=now() WHERE id=$1 RETURNING id,status', [req.params.id, status]);
    await client.query(`INSERT INTO incident_events (incident_id,actor_id,event_type,details)
      VALUES ($1,$2,$3,$4)`, [req.params.id, req.user!.id, status, JSON.stringify({ from: prior, to: status })]);
    await client.query(
      `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id,details)
       VALUES($1,'INCIDENT_STATUS_CHANGED','incident',$2,$3,$4)`,
      [req.user!.id, req.params.id, res.getHeader('X-Request-ID'), JSON.stringify({ from: prior, to: status })],
    );
    await client.query('COMMIT');
    res.json({ incident: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(null, false);
      return;
    }
    callback(null, true);
  },
});

router.post('/incidents/:id/evidence', authenticate, validateUuidParam('id'), upload.single('file'), async (req: AuthRequest, res, next) => {
  let uploadedPath: string | undefined;
  try {
    if (!req.file) { res.status(400).json({ error: 'An image file is required' }); return; }
    uploadedPath = req.file.path;
    const incidentResult = await pool.query('SELECT reporter_id FROM incidents WHERE id=$1', [req.params.id]);
    if (!incidentResult.rowCount) {
      await fs.promises.unlink(uploadedPath);
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    if (req.user!.role === 'FIELD_REPORTER' && incidentResult.rows[0].reporter_id !== req.user!.id) {
      await fs.promises.unlink(uploadedPath);
      res.status(403).json({ error: 'You can only add evidence to your own reports' });
      return;
    }
    const bytes = await fs.promises.readFile(uploadedPath);
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isWebp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    const detectedType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null;
    if (!detectedType || detectedType !== req.file.mimetype) {
      await fs.promises.unlink(uploadedPath);
      res.status(400).json({ error: 'The file contents do not match an accepted JPEG, PNG, or WebP image' });
      return;
    }
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[detectedType];
    const storageKey = `${randomUUID()}${extension}`;
    const storedPath = path.join(config.uploadDir, storageKey);
    await fs.promises.rename(uploadedPath, storedPath);
    uploadedPath = storedPath;
    const { rows } = await pool.query(
      `INSERT INTO incident_evidence (incident_id,uploader_id,storage_key,media_type,size_bytes,is_synthetic)
       VALUES ($1,$2,$3,$4,$5,false) RETURNING id`,
      [req.params.id, req.user!.id, storageKey, detectedType, req.file.size],
    );
    uploadedPath = undefined;
    res.status(201).json({ evidenceId: rows[0].id });
  } catch (error) {
    if (uploadedPath) await fs.promises.unlink(uploadedPath).catch((cleanupError: unknown) => console.error('Upload cleanup failed:', cleanupError));
    next(error);
  }
});

router.get('/incidents/:id/evidence/:evidenceId', authenticate, validateUuidParam('id'), validateUuidParam('evidenceId'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.storage_key,e.media_type
       FROM incident_evidence e JOIN incidents i ON i.id=e.incident_id
       WHERE e.incident_id=$1 AND e.id=$2
         AND ($3 <> 'FIELD_REPORTER' OR i.reporter_id=$4)`,
      [req.params.id, req.params.evidenceId, req.user!.role, req.user!.id],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Evidence not found' }); return; }
    const key = rows[0].storage_key as string;
    if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(key)) {
      res.status(500).json({ error: 'Stored evidence key is invalid' });
      return;
    }
    res.type(rows[0].media_type).set('X-Content-Type-Options', 'nosniff')
      .sendFile(path.resolve(config.uploadDir, key), (error) => { if (error) next(error); });
  } catch (error) { next(error); }
});

router.post('/incidents/:id/duplicate-candidates', authenticate, validateUuidParam('id'), requireRoles('ADMIN', 'OPERATOR'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sourceResult = await client.query(
      `SELECT id,title,description,category,created_at,location
       FROM incidents WHERE id=$1 FOR UPDATE`,
      [req.params.id],
    );
    if (!sourceResult.rowCount) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const source = sourceResult.rows[0] as {
      id: string; title: string; description: string; category: string; created_at: Date;
    };
    const { rows } = await client.query(
      `SELECT id,title,description,created_at,ST_Distance(location,source.location) AS distance_m
       FROM incidents, (SELECT location FROM incidents WHERE id=$1) AS source
       WHERE incidents.id<>$1 AND category=$2
         AND incidents.created_at BETWEEN $3::timestamptz - interval '24 hours'
                                     AND $3::timestamptz + interval '24 hours'
         AND ST_DWithin(incidents.location,source.location,1500)
       ORDER BY ST_Distance(incidents.location,source.location)
       LIMIT 20`,
      [source.id, source.category, source.created_at],
    );
    const candidates = rows.map((row) => {
      const hours = Math.abs(new Date(row.created_at as string).getTime() - source.created_at.getTime()) / 3_600_000;
      const { score, reasons } = duplicateScore(
        textSimilarity(`${source.title} ${source.description}`, `${row.title} ${row.description}`),
        Number(row.distance_m),
        hours,
      );
      return { id: row.id as string, title: row.title as string, score, reasons };
    }).filter((candidate) => candidate.score >= 0.2);
    for (const candidate of candidates) {
      await client.query(
        `INSERT INTO incident_relations(incident_id,related_incident_id,similarity_score,reasons)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(incident_id,related_incident_id) DO UPDATE
         SET similarity_score=EXCLUDED.similarity_score,reasons=EXCLUDED.reasons`,
        [source.id, candidate.id, candidate.score, JSON.stringify(candidate.reasons)],
      );
    }
    await client.query('COMMIT');
    res.json({ candidates, humanReviewRequired: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

router.get('/incidents/:id/evidence', authenticate, validateUuidParam('id'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id,e.media_type,e.size_bytes,e.created_at
       FROM incident_evidence e JOIN incidents i ON i.id=e.incident_id
       WHERE e.incident_id=$1 AND ($2 <> 'FIELD_REPORTER' OR i.reporter_id=$3)
       ORDER BY e.created_at`,
      [req.params.id, req.user!.role, req.user!.id],
    );
    res.json({ items: rows });
  } catch (error) { next(error); }
});

router.post('/risk/simulate', authenticate, async (req, res, next) => {
  try {
    const factors = z.object({
      rainfall: z.number().min(0).max(100),
      history: z.number().min(0).max(100),
      slope: z.number().min(0).max(100),
      drainage: z.number().min(0).max(100),
      incidents: z.number().min(0).max(100),
    }).parse(req.body);
    res.json({ ...calculateRisk(factors), label: 'SIMULATION — not an observation or validated probability', modelVersion: 'illustrative-v1' });
  } catch (error) { next(error); }
});

router.post('/routes/plan', authenticate, async (req, res, next) => {
  try {
    const input = z.object({ origin: z.string().min(1), destination: z.string().min(1), riskPenalty: z.number().min(0).max(10).default(2) }).parse(req.body);
    const { rows } = await pool.query('SELECT from_node,to_node,distance_m,risk_score,is_closed FROM road_segments');
    const edges: RoadEdge[] = rows.map((r) => ({ from: r.from_node, to: r.to_node, distance: Number(r.distance_m), risk: Number(r.risk_score ?? 0), closed: r.is_closed }));
    const route = shortestRoute(edges, input.origin, input.destination, input.riskPenalty);
    if (!route) { res.status(404).json({ error: 'No connected route is available for the selected locations' }); return; }
    res.json({ ...route, label: 'Estimated route; not guaranteed safe' });
  } catch (error) { next(error); }
});
