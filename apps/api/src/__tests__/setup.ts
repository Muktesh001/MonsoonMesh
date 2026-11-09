import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { config } from '../config.js';
import { randomUUID } from 'node:crypto';

export interface TestUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'FIELD_REPORTER';
  token: string;
}

export interface TestIncident {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
}

// Store for transaction clients to ensure they're properly used
let transactionClient: any = null;

/**
 * Create a test user with JWT token
 */
export async function createTestUser(
  email: string,
  role: 'ADMIN' | 'OPERATOR' | 'FIELD_REPORTER' = 'FIELD_REPORTER',
  password = 'TestPassword123456',
): Promise<TestUser> {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const displayName = `Test ${role}`;
  
  // Use transaction client if available, otherwise use pool
  const queryable = transactionClient || pool;

  await queryable.query(
    `INSERT INTO users(id, email, display_name, password_hash, role, is_active)
     VALUES($1, $2, $3, $4, $5, true)`,
    [id, email, displayName, passwordHash, role],
  );

  const token = jwt.sign({ id, email, role }, config.jwtSecret, { expiresIn: '8h' });

  return { id, email, role, token };
}

/**
 * Create a test incident
 */
export async function createTestIncident(
  reporterId: string,
  overrides: Partial<TestIncident> = {},
): Promise<TestIncident> {
  const id = randomUUID();
  const title = overrides.title ?? `Test Incident ${id.slice(0, 8)}`;
  const description = overrides.description ?? 'This is a test incident for integration testing';
  const category = overrides.category ?? 'WATERLOGGING';
  const severity = overrides.severity ?? 'MODERATE';
  const status = overrides.status ?? 'PENDING_VERIFICATION';

  // Use transaction client if available, otherwise use pool
  const queryable = transactionClient || pool;

  const { rows } = await queryable.query(
    `INSERT INTO incidents(id, reporter_id, title, description, category, severity, status, location, zone_id, is_synthetic)
     VALUES($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint(72.8479, 19.0176), 4326)::geography, null, true)
     RETURNING id, title, description, category, severity, status`,
    [id, reporterId, title, description, category, severity, status],
  );

  const incident = rows[0] as TestIncident;
  return incident;
}

/**
 * Setup transaction-based test isolation
 */
export function setupTransactionIsolation() {
  let client: any;

  beforeEach(async () => {
    client = await pool.connect();
    await client.query('BEGIN');
  });

  afterEach(async () => {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  return () => client;
}

/**
 * Clean up test data (for tests that can't use transactions)
 */
export async function cleanupTestData() {
  const tables = [
    'incident_events',
    'incident_evidence',
    'incident_relations',
    'incidents',
    'audit_logs',
    'refresh_tokens',
    'users',
  ];

  for (const table of tables) {
    await pool.query(`DELETE FROM ${table}`);
  }
}

/**
 * Create an authenticated request header
 */
export function createAuthHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Setup and teardown for the entire test suite
 */
export function setupGlobalTestHooks() {
  beforeAll(async () => {
    // Verify database connection
    const result = await pool.query('SELECT NOW()');
    if (!result.rows[0]) {
      throw new Error('Failed to connect to test database');
    }
  });

  afterAll(async () => {
    // Keep pool open for other tests
  });
}

export interface TestFactors {
  rainfall?: number | null;
  history?: number | null;
  slope?: number | null;
  drainage?: number | null;
  incidents?: number | null;
}

export function createTestRiskFactors(overrides: TestFactors = {}): TestFactors {
  return {
    rainfall: overrides.rainfall ?? 50,
    history: overrides.history ?? 25,
    slope: overrides.slope ?? 30,
    drainage: overrides.drainage ?? 40,
    incidents: overrides.incidents ?? 20,
  };
}

// Export setClient for tests to use
export function setTransactionClient(client: any) {
  transactionClient = client;
}
