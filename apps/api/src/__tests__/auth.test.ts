import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db.js';
import { createTestUser, createAuthHeader, cleanupTestData } from './setup.js';

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Verify database connection
    const result = await pool.query('SELECT NOW()');
    expect(result.rows[0]).toBeDefined();
  });

  afterAll(async () => {
    // Close pool but don't end it (tests may continue)
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('POST /api/auth/register', () => {
    it('should register with valid data', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        displayName: 'Test User',
        password: 'SecurePassword123456',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@test.com');
      expect(response.body.user.role).toBe('FIELD_REPORTER');
      expect(response.body.user.displayName).toBe('Test User');
    });

    it('should reject with missing email', async () => {
      const response = await request(app).post('/api/auth/register').send({
        displayName: 'Test User',
        password: 'SecurePassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with missing password', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        displayName: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with missing displayName', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        password: 'SecurePassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid email format', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        displayName: 'Test User',
        password: 'SecurePassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with short password (< 12 chars)', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        displayName: 'Test User',
        password: 'Short123',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject if email already exists', async () => {
      // Create first user
      await request(app).post('/api/auth/register').send({
        email: 'duplicate@test.com',
        displayName: 'First User',
        password: 'SecurePassword123456',
      });

      // Try to register with same email
      const response = await request(app).post('/api/auth/register').send({
        email: 'duplicate@test.com',
        displayName: 'Second User',
        password: 'DifferentPassword123456',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject with displayName too short (< 2 chars)', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        displayName: 'A',
        password: 'SecurePassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with displayName too long (> 100 chars)', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@test.com',
        displayName: 'A'.repeat(101),
        password: 'SecurePassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return JWT token that can be used for auth', async () => {
      const registerRes = await request(app).post('/api/auth/register').send({
        email: 'tokentest@test.com',
        displayName: 'Token Test',
        password: 'SecurePassword123456',
      });

      const token = registerRes.body.token;
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('tokentest@test.com');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user for login tests
      await createTestUser('testuser@test.com', 'FIELD_REPORTER', 'TestPassword123456');
    });

    it('should login with correct credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'TestPassword123456',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('testuser@test.com');
      expect(response.body.user.role).toBe('FIELD_REPORTER');
    });

    it('should reject with wrong password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'WrongPassword123456',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject with non-existent email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@test.com',
        password: 'TestPassword123456',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject with missing email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        password: 'TestPassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with missing password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with short password (< 8 chars)', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'short',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid email format', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'not-an-email',
        password: 'TestPassword123456',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should be case-insensitive for email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'TESTUSER@TEST.COM',
        password: 'TestPassword123456',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('testuser@test.com');
    });

    it('should return valid JWT token', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'testuser@test.com',
        password: 'TestPassword123456',
      });

      const token = loginRes.body.token;
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.id).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser('metest@test.com', 'ADMIN');
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should reject without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should reject with malformed auth header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidHeader');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject with expired token', async () => {
      // Create a token that expires immediately
      const expiredToken = require('jsonwebtoken').sign(
        { id: testUser.id, email: testUser.email, role: testUser.role },
        require('../config.js').config.jwtSecret,
        { expiresIn: '-1s' } // Already expired
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should work with different Bearer casing', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('should return different user data for OPERATOR role', async () => {
      const operator = await createTestUser('operator@test.com', 'OPERATOR');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${operator.token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('OPERATOR');
    });
  });
});
