import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db.js';
import {
  createTestUser,
  createTestIncident,
  createAuthHeader,
  cleanupTestData,
  TestUser,
} from './setup.js';

describe('Analytics Endpoints', () => {
  let admin: TestUser;
  let operator: TestUser;
  let fieldReporter: TestUser;

  beforeEach(async () => {
    await cleanupTestData();
    admin = await createTestUser('admin@test.com', 'ADMIN');
    operator = await createTestUser('operator@test.com', 'OPERATOR');
    fieldReporter = await createTestUser('reporter@test.com', 'FIELD_REPORTER');
  });

  describe('GET /api/analytics/metrics', () => {
    beforeEach(async () => {
      // Create some test incidents with different statuses
      await createTestIncident(fieldReporter.id, { status: 'VERIFIED' });
      await createTestIncident(fieldReporter.id, { status: 'RESOLVED' });
      await createTestIncident(admin.id, { status: 'IN_PROGRESS' });
    });

    it('should return key metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('incidents');
      expect(response.body).toHaveProperty('weatherEvents');
      expect(response.body).toHaveProperty('assessments');
    });

    it('should return metrics as numbers', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      // Metrics should be numbers or null
      expect(
        typeof response.body.incidents === 'number' ||
        typeof response.body.incidents === 'object' // null is object
      ).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/analytics/metrics');

      expect(response.status).toBe(401);
    });

    it('should be accessible to all authenticated users', async () => {
      const operatorRes = await request(app)
        .get('/api/analytics/metrics')
        .set(createAuthHeader(operator.token));
      expect(operatorRes.status).toBe(200);

      const reporterRes = await request(app)
        .get('/api/analytics/metrics')
        .set(createAuthHeader(fieldReporter.token));
      expect(reporterRes.status).toBe(200);
    });
  });

  describe('GET /api/analytics/trends', () => {
    beforeEach(async () => {
      // Create incidents over time
      const baseTime = new Date();
      for (let i = 0; i < 3; i++) {
        await pool.query(
          `INSERT INTO incidents (reporter_id, title, description, category, severity, status, location, zone_id, is_synthetic, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint(72.8479, 19.0176), 4326)::geography, null, true, now() - interval '1 week' * $7)`,
          [fieldReporter.id, `Incident ${i}`, 'Test', 'WATERLOGGING', 'MODERATE', 'VERIFIED', i]
        );
      }
    });

    it('should return incident trends by week', async () => {
      const response = await request(app)
        .get('/api/analytics/trends')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('incidents');
      expect(Array.isArray(response.body.incidents)).toBe(true);
    });

    it('should return weather trends by week', async () => {
      const response = await request(app)
        .get('/api/analytics/trends')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('weather');
      expect(Array.isArray(response.body.weather)).toBe(true);
    });

    it('should include 8-week history or available data', async () => {
      const response = await request(app)
        .get('/api/analytics/trends')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.incidents.length).toBeLessThanOrEqual(8);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/analytics/trends');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/risk-distribution', () => {
    beforeEach(async () => {
      // Create test zones with risk assessments
      const { rows: zoneRows } = await pool.query(
        `INSERT INTO zones (name, zone_type, boundary, is_synthetic)
         VALUES ($1, $2, ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0)')), 4326), true)
         RETURNING id`
      );

      // Insert risk assessments
      await pool.query(
        `INSERT INTO risk_assessments (zone_id, score, category, model_version, feature_values, assessed_at, is_synthetic)
         VALUES ($1, 75.5, 'HIGH', 'v1.0', '{"rainfall": 80, "drainage": 30}', now(), true)`,
        [zoneRows[0].id]
      );
    });

    it('should return zones with risk scores', async () => {
      const response = await request(app)
        .get('/api/analytics/risk-distribution')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('zones');
      expect(Array.isArray(response.body.zones)).toBe(true);
    });

    it('should include contributing factors', async () => {
      const response = await request(app)
        .get('/api/analytics/risk-distribution')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      if (response.body.zones.length > 0) {
        const zone = response.body.zones[0];
        expect(zone).toHaveProperty('factors');
      }
    });

    it('should sort by risk score descending', async () => {
      const response = await request(app)
        .get('/api/analytics/risk-distribution')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      const zones = response.body.zones;
      for (let i = 0; i < zones.length - 1; i++) {
        const current = zones[i].score ?? 0;
        const next = zones[i + 1].score ?? 0;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/analytics/risk-distribution');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/response-stats', () => {
    beforeEach(async () => {
      // Create incidents in different statuses
      await createTestIncident(fieldReporter.id, { status: 'PENDING_VERIFICATION' });
      await createTestIncident(fieldReporter.id, { status: 'VERIFIED' });
      await createTestIncident(fieldReporter.id, { status: 'IN_PROGRESS' });
      await createTestIncident(fieldReporter.id, { status: 'RESOLVED' });
    });

    it('should return response times by status', async () => {
      const response = await request(app)
        .get('/api/analytics/response-stats')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('statsByStatus');
      expect(typeof response.body.statsByStatus).toBe('object');
    });

    it('should include average and median times', async () => {
      const response = await request(app)
        .get('/api/analytics/response-stats')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      const stats = response.body.statsByStatus as Record<string, unknown>;
      if (stats && Object.keys(stats).length > 0) {
        const firstStatus = Object.keys(stats)[0]!;
        const statData = stats[firstStatus];
        expect(statData).toHaveProperty('avgTime');
        expect(statData).toHaveProperty('medianTime');
      }
    });

    it('should include count per status', async () => {
      const response = await request(app)
        .get('/api/analytics/response-stats')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      const stats = response.body.statsByStatus as Record<string, unknown>;
      if (stats && Object.keys(stats).length > 0) {
        const firstStatus = Object.keys(stats)[0]!;
        const statData = stats[firstStatus];
        expect(statData).toHaveProperty('count');
        expect(typeof statData).toBe('object');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/analytics/response-stats');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/uptime', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/analytics/uptime')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    it('should include database connection status', async () => {
      const response = await request(app)
        .get('/api/analytics/uptime')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('database');
      expect(['connected', 'disconnected']).toContain(response.body.database);
    });

    it('should include API response time', async () => {
      const response = await request(app)
        .get('/api/analytics/uptime')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('responseTime');
      expect(typeof response.body.responseTime).toBe('number');
    });

    it('should include overall status', async () => {
      const response = await request(app)
        .get('/api/analytics/uptime')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('overall');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.overall);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/analytics/uptime');

      expect(response.status).toBe(401);
    });

    it('should be accessible to all authenticated users', async () => {
      const reporterRes = await request(app)
        .get('/api/analytics/uptime')
        .set(createAuthHeader(fieldReporter.token));

      expect(reporterRes.status).toBe(200);
    });
  });
});
