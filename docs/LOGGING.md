# Logging and Error Handling Guide

MonsoonMesh implements comprehensive structured logging using Winston logger. This guide explains the logging architecture, configuration, and best practices.

## Architecture Overview

### Log Levels

Logs are categorized by severity level (from least to most severe):

- **debug**: Detailed diagnostic information, usually disabled in production
- **http**: HTTP request/response information
- **info**: General informational messages about normal operations
- **warn**: Warning messages about potentially problematic situations
- **error**: Error messages about serious problems that occurred

### Log Transports

Winston uses multiple transports to output logs:

1. **Console** (always enabled):
   - Development: Human-readable format with colors
   - Production: JSON format for log aggregation

2. **File Transports** (enabled in production or debug mode):
   - `logs/app.log`: All logs in JSON format
   - `logs/error.log`: Error logs only
   - `logs/exceptions.log`: Uncaught exceptions
   - `logs/rejections.log`: Unhandled promise rejections

Log files are rotated daily and kept for 7 days.

## Configuration

### Environment Variables

Set these in your `.env` file:

```
# Log level: debug, http, info, warn, error
LOG_LEVEL=info

# Directory to store log files
LOG_DIR=./logs

# Enable audit logging of user actions
ENABLE_AUDIT_LOGS=true

# Enable error tracking integration (for Sentry, DataDog, etc.)
ENABLE_ERROR_TRACKING=false
```

### Log Directory Structure

```
logs/
├── app.log              # All application logs (JSON format)
├── error.log            # Error logs only
├── exceptions.log       # Uncaught exceptions
└── rejections.log       # Unhandled promise rejections
```

## Log Message Format

### Development Console Output

```
2024-01-15 10:30:45 [info]: User login successful
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/auth/login",
  "email": "user@example.com",
  "role": "FIELD_REPORTER"
}
```

### Production JSON Format

```json
{
  "level": "info",
  "message": "User login successful",
  "timestamp": "2024-01-15T10:30:45.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "service": "routes",
  "method": "POST",
  "path": "/api/auth/login",
  "email": "user@example.com",
  "role": "FIELD_REPORTER"
}
```

## Request/Response Logging

All HTTP requests and responses are automatically logged:

```
POST /api/incidents - 201
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/incidents",
  "statusCode": 201,
  "duration": "145ms",
  "contentLength": "256"
}
```

### Request ID Tracking

Each request gets a unique ID (UUID) that's included in all related logs. This enables tracing a request through all services:

- Provided via `X-Request-ID` header (if valid UUID)
- Generated automatically if not provided
- Included in all log messages for that request

## Service-Level Logging

### Weather Adapter Logging

The weather adapter logs API calls, retries, circuit breaker state, and caching:

```typescript
import { createChildLogger } from '../logger.js';

const logger = createChildLogger('weather-adapter');

logger.info('Successfully fetched IMD data', {
  provider: 'IMD',
  observations: 42,
  duration: '250ms',
  cacheKey: 'weather-cache-key',
});

logger.warn('API call failed for IMD, retrying', {
  provider: 'IMD',
  attempt: 1,
  maxRetries: 3,
  error: 'Network timeout',
  delayMs: 1000,
});

logger.error('API call failed after retries', {
  provider: 'IMD',
  maxRetries: 3,
  error: 'HTTP 503 Service Unavailable',
  stack: '...',
});
```

### Incident Service Logging

```typescript
logger.info('Incident created', {
  incidentId: '123e4567-e89b-12d3-a456-426614174000',
  category: 'FLOODING',
  severity: 'HIGH',
  reporter: '...',
});

logger.info('Incident status changed', {
  incidentId: '123e4567-e89b-12d3-a456-426614174000',
  from: 'PENDING_VERIFICATION',
  to: 'VERIFIED',
  operator: '...',
  duration: '50ms',
});
```

### Database Operation Logging

Database operations are logged by service layer:

```typescript
logger.debug('Database query executed', {
  query: 'SELECT * FROM incidents WHERE id = $1',
  duration: '15ms',
  rowsAffected: 1,
});

logger.debug('Transaction started', {
  transactionId: '...',
});

logger.warn('Slow query detected', {
  query: 'SELECT ... (truncated)',
  duration: '1250ms',
  threshold: '1000ms',
});
```

## Audit Logging

Audit logs track all significant user actions for compliance and investigation:

### Database Schema

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Audit Events Logged

1. **Authentication Events**:
   - LOGIN_SUCCESS: User successfully logged in
   - LOGIN_FAILED: Login attempt failed (invalid credentials)
   - REGISTRATION: New user registered
   - LOGOUT: User logged out

2. **Incident Events**:
   - INCIDENT_CREATED: New incident submitted
   - INCIDENT_STATUS_CHANGED: Incident status changed
   - EVIDENCE_UPLOADED: Evidence added to incident

3. **Administrative Events**:
   - RISK_ASSESSMENT: Risk assessment completed
   - DATA_INGESTION: Weather data ingested

### Querying Audit Logs

```typescript
import { getAuditLogs } from './services/audit.js';

// Get all audit logs for an incident
const logs = await getAuditLogs('INCIDENT', 'incident-id', 50);

// Logs include:
// - actor_id: User who performed action
// - action: Type of action
// - details: JSON details (status change from/to, timestamps, etc.)
// - created_at: When the action occurred
```

## Error Tracking and Monitoring

### Error Logging Middleware

All errors are captured and logged with full context:

```typescript
{
  "level": "error",
  "message": "Unhandled error in GET /api/incidents",
  "timestamp": "2024-01-15T10:30:45.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/incidents",
  "statusCode": 500,
  "error": "Database connection failed",
  "stack": "Error: Database connection failed\n at ...",
  "ip": "192.168.1.1"
}
```

### Sensitive Data Protection

Logs **never** include:

- Passwords or password hashes
- API keys or tokens
- Personal identifiable information (PII)
- Credit card numbers or other sensitive credentials

When logging authentication, use sanitized values:

```typescript
// ✓ Good: Only log email without password
logger.info('Login attempt', { email: 'user@example.com' });

// ✗ Bad: Never log passwords
logger.info('Login attempt', { email, password });

// ✓ Good: Truncate API keys
const keyPreview = apiKey.substring(0, 4) + '...' + apiKey.slice(-4);
logger.info('API key configured', { keyPreview });
```

## Using the Logger in Code

### Creating a Service Logger

Each service should create a child logger for context:

```typescript
import { createChildLogger } from '../logger.js';

const logger = createChildLogger('my-service');

logger.info('Processing started', { itemCount: 100 });
logger.warn('Timeout approaching', { elapsedMs: 9500, timeoutMs: 10000 });
logger.error('Processing failed', { error: e.message, stack: e.stack });
```

### Log Levels in Routes

```typescript
router.post('/incidents', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const requestId = res.getHeader('X-Request-ID') as string;
    const input = incidentSchema.parse(req.body);
    
    // Log info about the incident being created
    logger.info(`Incident creation started`, {
      category: input.category,
      severity: input.severity,
      requestId,
    });
    
    // ... create incident ...
    
    // Log successful creation
    logger.info(`Incident created`, {
      incidentId: incident.id,
      category: input.category,
      requestId,
    });
    
    res.status(201).json({ incident });
  } catch (error) {
    // Error is automatically logged by error middleware
    next(error);
  }
});
```

## Viewing Logs

### Docker Containers

View logs from a running container:

```bash
# View all logs from api service
docker compose logs api

# Follow logs in real-time
docker compose logs -f api

# View last 100 lines
docker compose logs --tail=100 api

# Filter by time
docker compose logs --since 10m api
```

### Local Development

Logs appear in console during development:

```bash
# Start dev server with logging
npm run dev

# Set log level
LOG_LEVEL=debug npm run dev
```

### Production Log Files

Access logs from the container or mounted volume:

```bash
# List log files
ls -la logs/

# View current app log (last 50 lines)
tail -50 logs/app.log

# Search for errors
grep "ERROR" logs/error.log

# Follow log in real-time
tail -f logs/app.log

# Search for specific request
grep "REQUEST_ID_HERE" logs/app.log
```

## Troubleshooting

### Finding Errors

1. **Check error log file**:
   ```bash
   tail -100 logs/error.log
   ```

2. **Search by request ID**:
   ```bash
   grep "550e8400-e29b-41d4-a716-446655440000" logs/app.log
   ```

3. **Find recent errors**:
   ```bash
   grep "2024-01-15" logs/error.log | tail -20
   ```

### Common Issues

**No logs appearing?**
- Check `LOG_LEVEL` is set to correct value
- Verify `LOG_DIR` directory exists and is writable
- Check file permissions on logs directory

**Logs file growing too large?**
- Reduce `LOG_LEVEL` to filter less important messages
- Check if error loops are causing repeated logging
- Verify log rotation is working

**Missing request context?**
- Ensure request logging middleware is enabled
- Check request doesn't bypass middleware
- Verify `X-Request-ID` header is being set

## Best Practices

1. **Always include context**: Add relevant data to help debugging
   ```typescript
   logger.info('User action', { userId, action, result });
   ```

2. **Use appropriate log levels**:
   - `debug`: Detailed trace information for development
   - `info`: Significant application events
   - `warn`: Potential issues that should be investigated
   - `error`: Problems that need immediate attention

3. **Never log sensitive data**: Passwords, tokens, API keys, PII

4. **Include request ID**: All logs should include `requestId` for tracing

5. **Log both start and end**: For long operations, log when starting and when complete

6. **Keep messages concise**: Use metadata object for detailed information

7. **Use child loggers**: Each service gets its own logger with service name

## Integration with External Services

### Sentry Integration

To send errors to Sentry (when `ENABLE_ERROR_TRACKING=true`):

```typescript
// Future: Would integrate Sentry transport
logger.error('Critical error', {
  error: e.message,
  severity: 'critical',
  context: { userId, requestId },
});
```

### Log Aggregation

Production JSON logs can be sent to:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog
- CloudWatch
- Splunk
- Any service that accepts JSON logs

## Performance Considerations

- Logging is async and non-blocking
- Log entries are buffered when using file transports
- Avoid logging in tight loops
- Use debug level for high-frequency operations
- Circuit breaker patterns help prevent log spam from failing APIs

## Related Documentation

- [Architecture Overview](./architecture/overview.md)
- [API Documentation](./api/README.md)
- [Deployment Guide](./deployment.md)
