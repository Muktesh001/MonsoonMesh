# Deployment Guide

This guide covers deploying MonsoonMesh using Docker Compose locally and provides guidance for production environments.

## Local Development with Docker Compose

### Prerequisites

- Docker Desktop (or Docker + Docker Compose)
- Git
- 4GB+ available memory
- Ports 5173, 4000, 5432, 6379, 3000, 9090 available

### Setup

1. **Clone and configure**

   ```bash
   git clone <repository>
   cd MonsoonMesh
   cp .env.example .env
   ```

2. **Update environment variables** in `.env`:

   ```env
   # Database
   POSTGRES_PASSWORD=secure-password-change-this

   # API
   JWT_SECRET=generate-a-random-secret-key-min-32-chars
   NODE_ENV=development
   WEB_ORIGIN=http://localhost:5173

   # Optional: AI Service
   GEMINI_API_KEY=           # Leave blank for local-only mode

   # Upload limits
   UPLOAD_MAX_BYTES=5242880  # 5MB

   # Monitoring
   GRAFANA_USER=admin
   GRAFANA_PASSWORD=secure-password-change-this
   ```

   Generate a secure JWT_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Start services**

   ```bash
   docker compose up --build
   ```

   Compose will:
   - Build all Docker images
   - Start PostgreSQL with PostGIS
   - Apply database migrations
   - Seed demo data
   - Start API, worker, web app, Redis, AI service
   - Start Prometheus and Grafana

4. **Verify services**

   ```bash
   # Check all services are running
   docker compose ps

   # View logs
   docker compose logs -f api
   ```

### Health Checks

Verify services are healthy:

- **Web**: http://localhost:5173
- **API**: http://localhost:4000/health
- **Grafana**: http://localhost:3000 (admin / your-password)
- **Prometheus**: http://localhost:9090
- **AI Service**: http://localhost:8000/health

All health checks should return success/up status.

### Database Management

#### View database

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U monsoonmesh -d monsoonmesh

# List tables
\dt

# Exit
\q
```

#### Run migrations manually

```bash
docker compose exec api npm run migrate
```

#### Seed demo data manually

```bash
docker compose exec api npm run seed
```

#### Reset everything

```bash
# Stop and remove all volumes
docker compose down -v

# Rebuild and restart
docker compose up --build
```

### Demo Accounts

After seeding, use these credentials to login:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@monsoonmesh.local` | `MonsoonDemo!2026` |
| Operator | `operator@monsoonmesh.local` | `MonsoonDemo!2026` |
| Field Reporter | `reporter@monsoonmesh.local` | `MonsoonDemo!2026` |

**Never use these credentials or passwords in production.**

## Environment Variables

### Required (API and Worker)

```env
DATABASE_URL=postgres://user:pass@host:5432/monsoonmesh
REDIS_URL=redis://host:6379
JWT_SECRET=<32+ char random string>
AI_SERVICE_URL=http://ai-service:8000
```

### Optional

```env
# AI/External providers
GEMINI_API_KEY=          # Leave blank for local-only

# Upload handling
UPLOAD_DIR=/workspace/uploads
UPLOAD_MAX_BYTES=5242880

# API
PORT=4000
WEB_ORIGIN=http://localhost:5173
LOG_LEVEL=info

# Monitoring
PROMETHEUS_ENABLED=true
```

### Node Environment

- `development`: Local dev, verbose logging, no rate limiting
- `staging`: Pre-production testing
- `production`: Strict HTTPS, rate limiting enabled

## Health Check Verification

### Using curl

```bash
# API
curl http://localhost:4000/health

# Worker (check Redis connection)
docker compose logs worker | grep -i "ready\|connected"

# PostgreSQL
docker compose exec postgres pg_isready -U monsoonmesh

# Redis
docker compose exec redis redis-cli ping

# AI Service
curl http://localhost:8000/health
```

### Expected responses

- **API `/health`**: `{"status":"ok"}`
- **Redis `PING`**: `PONG`
- **PostgreSQL `pg_isready`**: `accepting connections`

## Troubleshooting

### Services fail to start

**Issue**: Container exits immediately

**Solution**:
```bash
# Check logs
docker compose logs <service-name>

# Rebuild images
docker compose build --no-cache <service-name>

# Restart service
docker compose up <service-name>
```

### Database connection errors

**Issue**: `connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Wait for database to be ready
docker compose up postgres
# Wait ~10 seconds, then Ctrl+C

# Start full stack
docker compose up
```

### Port already in use

**Issue**: `Address already in use: 0.0.0.0:5173`

**Solution**:
```bash
# Find what's using the port (macOS/Linux)
lsof -i :5173

# Find what's using the port (Windows)
netstat -ano | findstr :5173

# Kill the process or change the port in docker-compose.yml
```

### Volumes not cleaning up

**Issue**: Old data persists after `docker compose down`

**Solution**:
```bash
# List volumes
docker volume ls | grep monsoonmesh

# Remove specific volume
docker volume rm monsoonmesh_postgres-data

# Or remove all project volumes
docker compose down -v
```

### Out of disk space

**Issue**: Build fails with "no space left on device"

**Solution**:
```bash
# Clean up Docker system
docker system prune -a --volumes

# Restart
docker compose up --build
```

### Memory issues

**Issue**: Services crash or are killed (OOMKilled)

**Solution**:
- Docker Desktop: Increase memory limit in Settings
- Typical needs: 4GB minimum, 8GB recommended
- Check: `docker stats` to monitor memory usage

### Web app can't reach API

**Issue**: Frontend shows "Cannot reach API" or 404s

**Solution**:
1. Verify API container is running: `docker compose ps api`
2. Check API health: `curl http://localhost:4000/health`
3. Verify `WEB_ORIGIN` in API matches frontend URL
4. Check browser console for CORS errors
5. Restart both services: `docker compose restart api web`

### Changes not reflected in running container

**Issue**: Code changes don't appear after restart

**Solution**:
```bash
# Rebuild the service
docker compose build --no-cache api

# Start fresh
docker compose down
docker compose up
```

## Production Checklist

Before deploying to production, ensure:

- [ ] JWT_SECRET is strong (32+ random characters)
- [ ] Database password is strong
- [ ] HTTPS/TLS is enabled
- [ ] CORS_ORIGIN is set to your domain
- [ ] NODE_ENV=production
- [ ] Logging is configured (sent to centralized service)
- [ ] Database backups are automated
- [ ] Monitoring/alerting is configured
- [ ] Rate limiting is appropriate for expected load
- [ ] File uploads have size limits enforced
- [ ] External services (Gemini, etc.) are configured if needed
- [ ] Demo accounts are removed or disabled
- [ ] All secrets are in environment variables (not committed)

See [PRODUCTION.md](./PRODUCTION.md) for cloud deployment guidance.

## Monitoring

### Prometheus metrics

Available at: http://localhost:9090

- Query: `http_requests_total`
- Query: `http_request_duration_seconds_bucket`
- Query: `http_client_request_duration_seconds`

### Grafana dashboards

Available at: http://localhost:3000

- **Node.js API Dashboard**: Displays request metrics, latency, error rates
- Add more dashboards by uploading JSON in Settings > Dashboards > Import

### Log collection

View logs for any service:

```bash
# All logs
docker compose logs

# Follow logs
docker compose logs -f

# Specific service
docker compose logs -f api

# Last 100 lines
docker compose logs api --tail=100

# Logs since 10 minutes ago
docker compose logs --since 10m api
```

## Next Steps

- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [PRODUCTION.md](./PRODUCTION.md) for cloud deployment
- Check [API documentation](./api/README.md) for endpoint details
