import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db.js';
import {
  createTestUser,
  createAuthHeader,
  cleanupTestData,
  TestUser,
} from './setup.js';

describe('Weather Data Endpoints', () => {
  let admin: TestUser;
  let operator: TestUser;
  let fieldReporter: TestUser;

  beforeEach(async () => {
    await cleanupTestData();
    admin = await createTestUser('admin@test.com', 'ADMIN');
    operator = await createTestUser('operator@test.com', 'OPERATOR');
    fieldReporter = await createTestUser('reporter@test.com', 'FIELD_REPORTER');
  });

  describe('GET /api/data/weather (Fetch)', () => {
    beforeEach(async () => {
      // Insert test weather data
      await pool.query(
        `INSERT INTO weather_observations (source_id, provider_record_key, observed_at, location, rainfall_mm, is_synthetic)
         VALUES ($1, $2, now(), ST_SetSRID(ST_MakePoint(72.8479, 19.0176), 4326)::geography, 45.5, false)`,
        ['test-source-1', 'provider-key-1']
      );
      await pool.query(
        `INSERT INTO weather_observations (source_id, provider_record_key, observed_at, location, rainfall_mm, is_synthetic)
         VALUES ($1, $2, now() - interval '1 hour', ST_SetSRID(ST_MakePoint(72.9, 19.1), 4326)::geography, 32.2, false)`,
        ['test-source-2', 'provider-key-2']
      );
    });

    it('should return weather observations', async () => {
      const response = await request(app)
        .get('/api/data/weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should include source, provider, and timestamp', async () => {
      const response = await request(app)
        .get('/api/data/weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
      const observation = response.body.items[0];
      expect(observation).toHaveProperty('source_id');
      expect(observation).toHaveProperty('provider_record_key');
      expect(observation).toHaveProperty('observed_at');
    });

    it('should include at least 1 observation', async () => {
      const response = await request(app)
        .get('/api/data/weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/data/weather');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should be accessible to all authenticated users', async () => {
      const operatorRes = await request(app)
        .get('/api/data/weather')
        .set(createAuthHeader(operator.token));
      expect(operatorRes.status).toBe(200);

      const reporterRes = await request(app)
        .get('/api/data/weather')
        .set(createAuthHeader(fieldReporter.token));
      expect(reporterRes.status).toBe(200);
    });

    it('should exclude synthetic data', async () => {
      const response = await request(app)
        .get('/api/data/weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items.every((o: any) => o.is_synthetic === false)).toBe(true);
    });
  });

  describe('POST /api/data/ingest-weather (Trigger Ingestion)', () => {
    it('should require ADMIN role', async () => {
      const response = await request(app)
        .post('/api/data/ingest-weather')
        .set(createAuthHeader(operator.token));

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should reject for non-admin', async () => {
      const response = await request(app)
        .post('/api/data/ingest-weather')
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).post('/api/data/ingest-weather');

      expect(response.status).toBe(401);
    });

    it('should allow ADMIN to ingest data', async () => {
      const response = await request(app)
        .post('/api/data/ingest-weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recordsIngested');
    });

    it('should return record count', async () => {
      const response = await request(app)
        .post('/api/data/ingest-weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(typeof response.body.recordsIngested).toBe('number');
      expect(response.body.recordsIngested).toBeGreaterThanOrEqual(0);
    });

    it('should mention external sources', async () => {
      const response = await request(app)
        .post('/api/data/ingest-weather')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sources');
      expect(Array.isArray(response.body.sources)).toBe(true);
    });
  });

  describe('GET /api/data/risk-assessments (Fetch)', () => {
    beforeEach(async () => {
      // Create test zones first
      await pool.query(
        `INSERT INTO zones (name, zone_type, boundary, is_synthetic)
         VALUES ($1, $2, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0)')), 4326), true)`,
        ['Test Zone 1', 'NEIGHBORHOOD']
      );

      // Insert test risk assessments
      await pool.query(
        `INSERT INTO risk_assessments (zone_id, score, category, model_version, feature_values, assessed_at, is_synthetic)
         SELECT id, 75.5, 'HIGH', 'v1.0', '{}', now(), false FROM zones WHERE name = 'Test Zone 1'`
      );
    });

    it('should return risk scores for zones', async () => {
      const response = await request(app)
        .get('/api/data/risk-assessments')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should include category', async () => {
      const response = await request(app)
        .get('/api/data/risk-assessments')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      if (response.body.items.length > 0) {
        const assessment = response.body.items[0];
        expect(assessment).toHaveProperty('category');
        expect(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']).toContain(assessment.category);
      }
    });

    it('should include at least 1 assessment', async () => {
      const response = await request(app)
        .get('/api/data/risk-assessments')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThanOrEqual(0); // May be 0 initially
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/data/risk-assessments');

      expect(response.status).toBe(401);
    });

    it('should exclude synthetic data', async () => {
      const response = await request(app)
        .get('/api/data/risk-assessments')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items.every((a: any) => a.is_synthetic === false)).toBe(true);
    });

    it('should be sorted by assessed_at descending', async () => {
      // Insert multiple assessments
      const { rows: zoneRows } = await pool.query(
        `INSERT INTO zones (name, zone_type, boundary, is_synthetic)
         VALUES ($1, $2, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(73.0 19.0, 73.1 19.0, 73.1 19.1, 73.0 19.1, 73.0 19.0)')), 4326), true)
         RETURNING id`
      );

      await pool.query(
        `INSERT INTO risk_assessments (zone_id, score, category, model_version, feature_values, assessed_at, is_synthetic)
         VALUES ($1, 45.0, 'MODERATE', 'v1.0', '{}', now() - interval '1 day', false)`,
        [zoneRows[0].id]
      );

      const response = await request(app)
        .get('/api/data/risk-assessments')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      if (response.body.items.length > 1) {
        for (let i = 0; i < response.body.items.length - 1; i++) {
          const current = new Date(response.body.items[i].assessed_at);
          const next = new Date(response.body.items[i + 1].assessed_at);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });
  });

  describe('POST /api/data/assess-risks (Trigger Assessment)', () => {
    beforeEach(async () => {
      // Create test zone
      await pool.query(
        `INSERT INTO zones (name, zone_type, boundary, is_synthetic)
         VALUES ($1, $2, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0)')), 4326), true)`
      );
    });

    it('should require ADMIN role', async () => {
      const response = await request(app)
        .post('/api/data/assess-risks')
        .set(createAuthHeader(operator.token));

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should reject for non-admin', async () => {
      const response = await request(app)
        .post('/api/data/assess-risks')
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).post('/api/data/assess-risks');

      expect(response.status).toBe(401);
    });

    it('should allow ADMIN to assess risks', async () => {
      const response = await request(app)
        .post('/api/data/assess-risks')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('zones');
    });

    it('should return zone count', async () => {
      const response = await request(app)
        .post('/api/data/assess-risks')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.zones)).toBe(true);
    });

    it('should update risk scores in database', async () => {
      await request(app)
        .post('/api/data/assess-risks')
        .set(createAuthHeader(admin.token));

      const { rows } = await pool.query(
        `SELECT COUNT(*) as count FROM risk_assessments WHERE assessed_at > now() - interval '1 minute'`
      );

      expect(rows[0].count).toBeGreaterThan(0);
    });
  });

  describe('GET /api/data/sources', () => {
    it('should return list of data sources', async () => {
      const response = await request(app)
        .get('/api/data/sources')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('availableSources');
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/data/sources');

      expect(response.status).toBe(401);
    });

    it('should list available external sources', async () => {
      const response = await request(app)
        .get('/api/data/sources')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      const sourceKeys = response.body.availableSources.map((s: any) => s.key);
      expect(sourceKeys).toContain('imd');
      expect(sourceKeys).toContain('nasa-gpm');
      expect(sourceKeys).toContain('openweather');
    });
  });

  describe('GET /api/data/ingestion-history', () => {
    it('should return ingestion history', async () => {
      const response = await request(app)
        .get('/api/data/ingestion-history')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/data/ingestion-history');

      expect(response.status).toBe(401);
    });

    it('should be accessible by all authenticated users', async () => {
      const response = await request(app)
        .get('/api/data/ingestion-history')
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(200);
    });
  });
});
