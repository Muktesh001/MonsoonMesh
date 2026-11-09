# MonsoonMesh Testing Guide

## Overview

MonsoonMesh uses **Vitest** for unit and integration testing, combined with **Supertest** for HTTP endpoint testing. This guide covers testing architecture, execution, and best practices.

## Testing Architecture

### Test Organization

```
apps/api/src/
├── __tests__/
│   ├── setup.ts                 # Shared utilities and fixtures
│   ├── auth.test.ts            # Authentication endpoints
│   ├── incidents.test.ts       # Incident CRUD operations
│   ├── weather.test.ts         # Weather data endpoints
│   ├── analytics.test.ts       # Analytics endpoints
│   ├── data-endpoints.test.ts # Dashboard, zones, routes, risk simulation
│   └── error-handling.test.ts # Error cases and edge cases
├── services/
│   ├── risk.test.ts           # Risk calculation logic
│   ├── duplicates.test.ts     # Duplicate detection
│   └── routes.test.ts         # Route planning
```

### Test Types

1. **Integration Tests** (`**/[module].test.ts`): Test complete HTTP endpoints with database
2. **Unit Tests** (`src/services/*.test.ts`): Test isolated business logic
3. **Error Handling Tests**: Validate error responses and edge cases
4. **Security Tests**: Verify authentication, authorization, and input validation

## Running Tests

### Development Mode

```bash
# Watch mode - reruns tests on file changes
npm run test:watch

# Run specific test file
npm run test:watch -- auth.test.ts

# Run tests matching a pattern
npm run test:watch -- --grep "POST /api/auth/login"
```

### Continuous Integration

```bash
# Run all tests once (used in CI/CD)
npm test

# Generate coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Coverage Goals

Target coverage: **80%+ for routes and services**

```bash
npm run test:coverage
# Generates coverage reports in:
# - Terminal output
# - HTML report: coverage/index.html
# - LCOV format: coverage/lcov.info
```

## Test Setup and Cleanup

### Transaction-Based Isolation

Tests use PostgreSQL transactions for isolation - no test data persists:

```typescript
// Each test automatically rolls back after execution
beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});
```

**Benefit**: Fast, no side effects, tests can run in any order.

### Test Fixtures

The `setup.ts` module provides factory functions:

```typescript
import { createTestUser, createTestIncident, createAuthHeader } from './setup';

// Create a test user with JWT token
const user = await createTestUser('reporter@test.com', 'FIELD_REPORTER');

// Create a test incident
const incident = await createTestIncident(user.id, {
  title: 'Custom Title',
  category: 'WATERLOGGING',
});

// Create authentication header
const authHeader = createAuthHeader(user.token);
```

## Common Testing Patterns

### Testing Authenticated Endpoints

```typescript
import request from 'supertest';
import { app } from '../app';
import { createTestUser, createAuthHeader } from './setup';

it('should return current user with valid token', async () => {
  const user = await createTestUser('test@test.com', 'ADMIN');
  
  const response = await request(app)
    .get('/api/auth/me')
    .set(createAuthHeader(user.token));

  expect(response.status).toBe(200);
  expect(response.body.user.email).toBe(user.email);
});
```

### Testing with Role-Based Access

```typescript
it('should require ADMIN role for ingest', async () => {
  const admin = await createTestUser('admin@test.com', 'ADMIN');
  const reporter = await createTestUser('reporter@test.com', 'FIELD_REPORTER');

  // Should succeed for admin
  const adminRes = await request(app)
    .post('/api/data/ingest-weather')
    .set(createAuthHeader(admin.token));
  expect(adminRes.status).toBe(200);

  // Should fail for reporter
  const reporterRes = await request(app)
    .post('/api/data/ingest-weather')
    .set(createAuthHeader(reporter.token));
  expect(reporterRes.status).toBe(403);
});
```

### Testing Error Cases

```typescript
it('should reject with invalid email format', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'not-an-email',
      displayName: 'Test User',
      password: 'SecurePassword123456',
    });

  expect(response.status).toBe(400);
  expect(response.body.error).toBeDefined();
});
```

### Testing Database Queries

```typescript
it('should create incident event in timeline', async () => {
  const user = await createTestUser('test@test.com', 'OPERATOR');
  
  // Perform action
  await request(app)
    .patch(`/api/incidents/${incidentId}/status`)
    .set(createAuthHeader(user.token))
    .send({ status: 'VERIFIED' });

  // Verify database state
  const { rows } = await pool.query(
    'SELECT * FROM incident_events WHERE incident_id = $1 AND event_type = $2',
    [incidentId, 'VERIFIED']
  );
  
  expect(rows.length).toBeGreaterThan(0);
});
```

## Adding New Tests

### 1. Identify Endpoints to Test

```typescript
// New endpoint: POST /api/reports/:id/mark-resolved
// Tests needed:
// - Valid transitions
// - Invalid status codes
// - Role-based access
// - Error cases
```

### 2. Create Test File

```bash
# Add to appropriate test file or create new one
# apps/api/src/__tests__/reports.test.ts
```

### 3. Write Test Cases

```typescript
describe('POST /api/reports/:id/mark-resolved', () => {
  let report;

  beforeEach(async () => {
    const user = await createTestUser('test@test.com', 'FIELD_REPORTER');
    report = await pool.query('INSERT INTO reports...');
  });

  it('should mark report as resolved', async () => {
    const operator = await createTestUser('op@test.com', 'OPERATOR');
    
    const response = await request(app)
      .patch(`/api/reports/${report.id}/mark-resolved`)
      .set(createAuthHeader(operator.token))
      .send({ reason: 'Issue fixed' });

    expect(response.status).toBe(200);
    expect(response.body.report.status).toBe('RESOLVED');
  });

  // Add more test cases for error scenarios, edge cases, etc.
});
```

### 4. Run and Verify

```bash
npm run test:watch -- reports.test.ts
```

## Debugging Failing Tests

### 1. Verbose Output

```bash
# Show detailed logs
npm test -- --reporter=verbose

# Show only failing tests
npm test -- --reporter=verbose -- --grep "should fail"
```

### 2. Single Test Execution

```bash
# Run only one test
npm run test:watch -- --grep "exact test name"

# Run only one file
npm run test:watch -- auth.test.ts
```

### 3. Inspect Database State

Add debugging to your test:

```typescript
it('should do something', async () => {
  await request(app).post('/api/incidents').send(data);
  
  // Query database to debug
  const { rows } = await pool.query('SELECT * FROM incidents');
  console.log('Incidents:', rows);
  
  expect(rows.length).toBe(1);
});
```

### 4. Use Test Timeout

```typescript
it('should do something', async () => {
  // Increase timeout for slow tests
}, { timeout: 20000 });
```

## Test Checklist for New Endpoints

When adding a new endpoint, ensure you test:

- [ ] **Happy Path**: Valid input produces expected output
- [ ] **Missing Fields**: Each required field validation
- [ ] **Invalid Types**: Wrong data types rejected
- [ ] **Out of Range**: Values outside acceptable bounds
- [ ] **Authentication**: Endpoint requires token
- [ ] **Authorization**: Role-based access enforced
- [ ] **Error Handling**: Error responses are well-formed
- [ ] **Edge Cases**: Boundary values, empty arrays, null values
- [ ] **Concurrent Operations**: Race condition handling
- [ ] **Database Consistency**: State is correct after operation

## Performance Considerations

### Test Execution Time

- **Target**: Most tests complete in < 100ms
- **Slow tests**: Use `@vitest/coverage-v8` to profile
- **Parallel execution**: Vitest runs tests in parallel by default

### Database Connection Pooling

- Tests share a connection pool for efficiency
- Transaction rollback ensures isolation without slowdown
- Typical test run: ~30-50 tests in 5-10 seconds

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis
        env:
          POSTGRES_PASSWORD: password
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Best Practices

1. **Test Isolation**: Each test should be independent and can run in any order
2. **Meaningful Names**: Test names should describe what is being tested and expected behavior
3. **Arrange-Act-Assert**: Structure tests clearly:
   - Arrange: Set up test data
   - Act: Perform the action
   - Assert: Verify the result
4. **No Test Dependencies**: Tests should not depend on execution order
5. **Clean Data**: Use transactions to ensure no side effects
6. **Realistic Data**: Use realistic test data that matches actual use cases
7. **Error Messages**: Include clear assertions with good error messages
8. **DRY**: Use setup helpers and shared fixtures to avoid duplication

## Common Issues

### Issue: Tests timeout

**Solution**: Increase timeout in vitest.config.ts
```typescript
test: {
  testTimeout: 20000, // milliseconds
}
```

### Issue: Database locked

**Solution**: Ensure transactions are properly rolled back
```typescript
afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});
```

### Issue: Port already in use

**Solution**: Tests use in-memory database, shouldn't conflict. Check for hung processes:
```bash
# macOS/Linux
lsof -i :5432

# Windows
netstat -ano | findstr :5432
```

### Issue: Flaky tests

**Solution**: 
- Check for timing issues (use consistent timestamps)
- Verify transaction isolation
- Ensure fixtures are properly created
- Check for race conditions

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Jest Patterns](https://jestjs.io/docs/setup-teardown) (similar patterns apply to Vitest)
- [Testing Best Practices](https://testingjavascript.com/)
