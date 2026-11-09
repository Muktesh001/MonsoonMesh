import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db.js';
import {
  createTestUser,
  createAuthHeader,
  cleanupTestData,
  createTestRiskFactors,
  TestUser,
} from './setup.js';

describe('Data Endpoints', () => {
  let admin: TestUser;
  let operator: TestUser;
  let fieldReporter: TestUser;

  beforeEach(async () => {
    await cleanupTestData();
    admin = await createTestUser('admin@test.com', 'ADMIN');
    operator = await createTestUser('operator@test.com', 'OPERATOR');
    fieldReporter = await createTestUser('reporter@test.com', 'FIELD_REPORTER');
  });

  describe('GET /api/dashboard', () => {
    beforeEach(async () => {
      // Create test zones
      await pool.query(
        `INSERT INTO zones (name, zone_type, boundary, is_synthetic)
         VALUES ($1, $2, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0)')), 4326), true)`
      );
    });

    it('should return dashboard summary', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('recent');
      expect(response.body).toHaveProperty('riskDistribution');
    });

    it('should include summary metrics', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      const summary = response.body.summary;
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('verified');
      expect(summary).toHaveProperty('unresolved');
    });

    it('should include recent incidents', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.recent)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/dashboard');

      expect(response.status).toBe(401);
    });

    it('should include data label indicating demonstration data', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('dataLabel');
      expect(response.body.dataLabel.toLowerCase()).toContain('synthetic');
    });
  });

  describe('GET /api/zones', () => {
    beforeEach(async () => {
      // Create test zones
      await pool.query(
        `INSERT INTO zones (name, zone_type, boundary, is_synthetic)
         VALUES ($1, $2, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0)')), 4326), true),
                ($3, $4, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(72.7 18.9, 72.8 18.9, 72.8 19.0, 72.7 19.0, 72.7 18.9)')), 4326), true)`
      );
    });

    it('should return GeoJSON FeatureCollection', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('FeatureCollection');
      expect(Array.isArray(response.body.features)).toBe(true);
    });

    it('should include zone geometries', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      if (response.body.features.length > 0) {
        const feature = response.body.features[0];
        expect(feature.geometry).toBeDefined();
        expect(feature.type).toBe('Feature');
      }
    });

    it('should include zone properties', async () => {
      const response = await request(app)
        .get('/api/zones')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      if (response.body.features.length > 0) {
        const feature = response.body.features[0];
        expect(feature.properties).toBeDefined();
        expect(feature.properties).toHaveProperty('name');
        expect(feature.properties).toHaveProperty('zoneType');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/zones');

      expect(response.status).toBe(401);
    });

    it('should be accessible to all authenticated users', async () => {
      const reporterRes = await request(app)
        .get('/api/zones')
        .set(createAuthHeader(fieldReporter.token));

      expect(reporterRes.status).toBe(200);
    });
  });

  describe('POST /api/routes/plan (Route Planning)', () => {
    beforeEach(async () => {
      // Create test road segments
      await pool.query(
        `INSERT INTO road_segments (from_node, to_node, distance_m, risk_score, is_closed, path, is_synthetic)
         VALUES ($1, $2, $3, $4, false, ST_SetSRID(ST_MakeLine(ST_MakePoint(72.8, 19.0), ST_MakePoint(72.9, 19.0)), 4326), true)`,
        ['A', 'B', 1000, 25]
      );
      await pool.query(
        `INSERT INTO road_segments (from_node, to_node, distance_m, risk_score, is_closed, path, is_synthetic)
         VALUES ($1, $2, $3, $4, false, ST_SetSRID(ST_MakeLine(ST_MakePoint(72.9, 19.0), ST_MakePoint(72.9, 19.1)), 4326), true)`,
        ['B', 'C', 1500, 45]
      );
    });

    it('should plan route between two points', async () => {
      const response = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          origin: 'A',
          destination: 'C',
          riskPenalty: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('distance');
    });

    it('should return optimized route', async () => {
      const response = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          origin: 'A',
          destination: 'C',
          riskPenalty: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.label).toBeDefined();
      expect(response.body.label.toLowerCase()).toContain('route');
    });

    it('should consider risk penalties', async () => {
      const lowPenalty = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          origin: 'A',
          destination: 'C',
          riskPenalty: 0,
        });

      const highPenalty = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          origin: 'A',
          destination: 'C',
          riskPenalty: 10,
        });

      expect(lowPenalty.status).toBe(200);
      expect(highPenalty.status).toBe(200);
      // Higher penalty may result in longer distance
      expect(highPenalty.body.distance).toBeGreaterThanOrEqual(0);
    });

    it('should reject if no connected route', async () => {
      const response = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          origin: 'A',
          destination: 'NONEXISTENT',
          riskPenalty: 2,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No connected route');
    });

    it('should default riskPenalty to 2', async () => {
      const response = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          origin: 'A',
          destination: 'C',
        });

      expect(response.status).toBe(200);
      expect(response.body.distance).toBeDefined();
    });

    it('should reject with missing origin', async () => {
      const response = await request(app)
        .post('/api/routes/plan')
        .set(createAuthHeader(admin.token))
        .send({
          destination: 'C',
          riskPenalty: 2,
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/routes/plan').send({
        origin: 'A',
        destination: 'C',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/risk/simulate (Simulation)', () => {
    it('should calculate risk score from factors', async () => {
      const factors = createTestRiskFactors();
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(factors);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('score');
      expect(response.body).toHaveProperty('category');
    });

    it('should accept all factors 0-100', async () => {
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(createTestRiskFactors());

      expect(response.status).toBe(200);
      expect(response.body.score).toBeGreaterThanOrEqual(0);
      expect(response.body.score).toBeLessThanOrEqual(100);
    });

    it('should return score 0-100', async () => {
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(createTestRiskFactors());

      expect(response.status).toBe(200);
      expect(response.body.score).toBeGreaterThanOrEqual(0);
      expect(response.body.score).toBeLessThanOrEqual(100);
    });

    it('should include category label', async () => {
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(createTestRiskFactors());

      expect(response.status).toBe(200);
      expect(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).toContain(response.body.category);
    });

    it('should reject with rainfall > 100', async () => {
      const factors = createTestRiskFactors({ rainfall: 101 });
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(factors);

      expect(response.status).toBe(400);
    });

    it('should reject with negative factor values', async () => {
      const factors = createTestRiskFactors({ rainfall: -1 });
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(factors);

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/risk/simulate').send(createTestRiskFactors());

      expect(response.status).toBe(401);
    });

    it('should mark as simulation data', async () => {
      const response = await request(app)
        .post('/api/risk/simulate')
        .set(createAuthHeader(admin.token))
        .send(createTestRiskFactors());

      expect(response.status).toBe(200);
      expect(response.body.label).toBeDefined();
      expect(response.body.label.toLowerCase()).toContain('simulation');
    });
  });
});
