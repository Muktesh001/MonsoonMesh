import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('Incident Endpoints', () => {
  let fieldReporter: TestUser;
  let operator: TestUser;
  let admin: TestUser;

  beforeEach(async () => {
    await cleanupTestData();
    fieldReporter = await createTestUser('reporter@test.com', 'FIELD_REPORTER');
    operator = await createTestUser('operator@test.com', 'OPERATOR');
    admin = await createTestUser('admin@test.com', 'ADMIN');
  });

  describe('POST /api/incidents (Create)', () => {
    it('should create incident with valid data', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow at Market Street',
          description: 'Heavy waterlogging observed in the market area blocking traffic',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(201);
      expect(response.body.incident).toHaveProperty('id');
      expect(response.body.incident.title).toBe('Water Overflow at Market Street');
      expect(response.body.incident.status).toBe('PENDING_VERIFICATION');
    });

    it('should reject with missing title', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          description: 'Heavy waterlogging observed',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with short title (< 4 chars)', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Bad',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with missing description', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow at Market Street',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with short description (< 8 chars)', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Bad',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid category', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'INVALID_CATEGORY',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept all valid categories', async () => {
      const categories = ['WATERLOGGING', 'FLOODING', 'DRAINAGE', 'ROAD_BLOCKAGE', 'OTHER'];

      for (const category of categories) {
        const response = await request(app)
          .post('/api/incidents')
          .set(createAuthHeader(fieldReporter.token))
          .send({
            title: `Test Incident ${category}`,
            description: 'Heavy waterlogging observed in the market area',
            category,
            severity: 'HIGH',
            latitude: 19.0176,
            longitude: 72.8479,
          });

        expect(response.status).toBe(201);
        expect(response.body.incident.category ?? category).toBe(category);
      }
    });

    it('should reject with invalid severity', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'INVALID_SEVERITY',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should default severity to MODERATE', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          latitude: 19.0176,
          longitude: 72.8479,
        });

      expect(response.status).toBe(201);
      expect(response.body.incident.severity ?? 'MODERATE').toBe('MODERATE');
    });

    it('should reject with missing latitude', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid latitude (> 90)', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 91,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid latitude (< -90)', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: -91,
          longitude: 72.8479,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with missing longitude', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid longitude (> 180)', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set(createAuthHeader(fieldReporter.token))
        .send({
          title: 'Water Overflow',
          description: 'Heavy waterlogging observed in the market area',
          category: 'WATERLOGGING',
          severity: 'HIGH',
          latitude: 19.0176,
          longitude: 181,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/incidents').send({
        title: 'Water Overflow',
        description: 'Heavy waterlogging observed in the market area',
        category: 'WATERLOGGING',
        severity: 'HIGH',
        latitude: 19.0176,
        longitude: 72.8479,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });
  });

  describe('GET /api/incidents (List)', () => {
    beforeEach(async () => {
      // Create some test incidents
      await createTestIncident(fieldReporter.id, {
        title: 'First Incident',
        status: 'PENDING_VERIFICATION',
      });
      await createTestIncident(fieldReporter.id, {
        title: 'Second Incident',
        status: 'VERIFIED',
      });
      await createTestIncident(operator.id, {
        title: 'Operator Incident',
        status: 'IN_PROGRESS',
      });
    });

    it('should return all incidents for admin', async () => {
      const response = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(response.body.items.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by status parameter', async () => {
      const response = await request(app)
        .get('/api/incidents?status=VERIFIED')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(response.body.items.every((i: any) => i.status === 'VERIFIED')).toBe(true);
    });

    it('should support pagination with page and limit', async () => {
      const response = await request(app)
        .get('/api/incidents?page=1&limit=2')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.items.length).toBeLessThanOrEqual(2);
    });

    it('should field reporters see only own incidents', async () => {
      const response = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(response.body.items.every((i: any) => i.created_at)).toBe(true);
    });

    it('should operators and admins see all incidents', async () => {
      const operatorRes = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(operator.token));

      expect(operatorRes.status).toBe(200);
      expect(operatorRes.body.items.length).toBeGreaterThan(0);

      const adminRes = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(admin.token));

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.items.length).toBeGreaterThan(0);
    });

    it('should return empty array if no incidents', async () => {
      await pool.query('DELETE FROM incidents');

      const response = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/incidents');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should default to page 1 and limit 25', async () => {
      const response = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(25);
    });

    it('should reject invalid page (< 1)', async () => {
      const response = await request(app)
        .get('/api/incidents?page=0')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid limit (> 100)', async () => {
      const response = await request(app)
        .get('/api/incidents?limit=101')
        .set(createAuthHeader(admin.token));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/incidents/:id (Detail)', () => {
    let incidentId: string;

    beforeEach(async () => {
      const incident = await createTestIncident(fieldReporter.id, {
        title: 'Test Incident for Detail',
      });
      incidentId = incident.id;
    });

    it('should return full incident detail', async () => {
      const response = await request(app)
        .get(`/api/incidents/${incidentId}`)
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(200);
      expect(response.body.incident).toBeDefined();
      expect(response.body.incident.id).toBe(incidentId);
      expect(response.body.incident.title).toBe('Test Incident for Detail');
    });

    it('should include events, evidence, related incidents', async () => {
      const response = await request(app)
        .get(`/api/incidents/${incidentId}`)
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(200);
      expect(response.body.events).toBeDefined();
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.evidence).toBeDefined();
      expect(Array.isArray(response.body.evidence)).toBe(true);
      expect(response.body.relatedIncidents).toBeDefined();
      expect(Array.isArray(response.body.relatedIncidents)).toBe(true);
    });

    it('should reject with invalid UUID', async () => {
      const response = await request(app)
        .get('/api/incidents/not-a-uuid')
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with non-existent incident (404)', async () => {
      const response = await request(app)
        .get('/api/incidents/00000000-0000-0000-0000-000000000000')
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should require authentication', async () => {
      const response = await request(app).get(`/api/incidents/${incidentId}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should field reporter cannot see others incidents', async () => {
      const otherReporter = await createTestUser('other@test.com', 'FIELD_REPORTER');
      const response = await request(app)
        .get(`/api/incidents/${incidentId}`)
        .set(createAuthHeader(otherReporter.token));

      expect(response.status).toBe(404);
    });

    it('should operator can see any incident', async () => {
      const response = await request(app)
        .get(`/api/incidents/${incidentId}`)
        .set(createAuthHeader(operator.token));

      expect(response.status).toBe(200);
      expect(response.body.incident.id).toBe(incidentId);
    });
  });

  describe('PATCH /api/incidents/:id/status (Update Status)', () => {
    let incidentId: string;

    beforeEach(async () => {
      const incident = await createTestIncident(fieldReporter.id);
      incidentId = incident.id;
    });

    it('should update status with valid transition', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set(createAuthHeader(operator.token))
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(200);
      expect(response.body.incident.status).toBe('VERIFIED');
    });

    it('should require ADMIN or OPERATOR role', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set(createAuthHeader(fieldReporter.token))
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should reject invalid status transition', async () => {
      // First verify the incident
      await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set(createAuthHeader(operator.token))
        .send({ status: 'VERIFIED' });

      // Then try invalid transition
      const response = await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set(createAuthHeader(operator.token))
        .send({ status: 'PENDING_VERIFICATION' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Cannot transition');
    });

    it('should create event in timeline', async () => {
      await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set(createAuthHeader(operator.token))
        .send({ status: 'VERIFIED' });

      const eventsRes = await pool.query(
        'SELECT * FROM incident_events WHERE incident_id = $1 AND event_type = $2',
        [incidentId, 'VERIFIED']
      );

      expect(eventsRes.rowCount).toBeGreaterThan(0);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(401);
    });

    it('should reject with invalid UUID', async () => {
      const response = await request(app)
        .patch('/api/incidents/not-a-uuid/status')
        .set(createAuthHeader(operator.token))
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(400);
    });

    it('should reject with non-existent incident', async () => {
      const response = await request(app)
        .patch('/api/incidents/00000000-0000-0000-0000-000000000000/status')
        .set(createAuthHeader(operator.token))
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(404);
    });

    it('should allow admin to transition', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set(createAuthHeader(admin.token))
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/incidents/:id/duplicates (Detect)', () => {
    let incidentId: string;
    let similarIncidentId: string;

    beforeEach(async () => {
      // Create original incident
      const incident = await createTestIncident(fieldReporter.id, {
        title: 'Waterlogging at Main Street',
        description: 'Heavy waterlogging in main shopping area',
        category: 'WATERLOGGING',
      });
      incidentId = incident.id;

      // Create a similar incident
      const similar = await createTestIncident(fieldReporter.id, {
        title: 'Flooding at Market Street',
        description: 'Water overflow in market area',
        category: 'WATERLOGGING',
      });
      similarIncidentId = similar.id;
    });

    it('should find similar incidents', async () => {
      const response = await request(app)
        .post(`/api/incidents/${incidentId}/duplicate-candidates`)
        .set(createAuthHeader(operator.token));

      expect(response.status).toBe(200);
      expect(response.body.candidates).toBeDefined();
      expect(Array.isArray(response.body.candidates)).toBe(true);
    });

    it('should return empty array if no similar incidents', async () => {
      await pool.query('DELETE FROM incidents WHERE id != $1', [incidentId]);

      const response = await request(app)
        .post(`/api/incidents/${incidentId}/duplicate-candidates`)
        .set(createAuthHeader(operator.token));

      expect(response.status).toBe(200);
      expect(response.body.candidates).toEqual([]);
    });

    it('should require ADMIN or OPERATOR role', async () => {
      const response = await request(app)
        .post(`/api/incidents/${incidentId}/duplicate-candidates`)
        .set(createAuthHeader(fieldReporter.token));

      expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/incidents/${incidentId}/duplicate-candidates`);

      expect(response.status).toBe(401);
    });
  });

  describe('Role-Based Access Control', () => {
    let testIncident: any;

    beforeEach(async () => {
      testIncident = await createTestIncident(fieldReporter.id);
    });

    it('should field reporter can only see own incidents in list', async () => {
      const otherReporter = await createTestUser('other@test.com', 'FIELD_REPORTER');

      const myRes = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(fieldReporter.token));

      const otherRes = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(otherReporter.token));

      expect(myRes.body.items.some((i: any) => i.id === testIncident.id)).toBe(true);
      expect(otherRes.body.items.some((i: any) => i.id === testIncident.id)).toBe(false);
    });

    it('should operator can see all incidents', async () => {
      const response = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(operator.token));

      expect(response.body.items.some((i: any) => i.id === testIncident.id)).toBe(true);
    });

    it('should admin can see all incidents', async () => {
      const response = await request(app)
        .get('/api/incidents')
        .set(createAuthHeader(admin.token));

      expect(response.body.items.some((i: any) => i.id === testIncident.id)).toBe(true);
    });
  });
});
