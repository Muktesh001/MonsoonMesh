# End-to-End Testing Guide

## System Overview

MonsoonMesh now integrates real external weather and risk data feeds with periodic automatic refresh via BullMQ worker jobs.

### Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Web UI    │◄─────►│   API        │◄─────►│  Database   │
│ (React)     │       │  (Express)   │       │ (PostgreSQL)│
└─────────────┘       └──────────────┘       └─────────────┘
                             ▲
                             │
                      ┌──────┴──────┐
                      │             │
                   ┌──────┐    ┌────────┐
                   │Worker│    │  Redis │
                   │(Node)│    │ (Queue)│
                   └──────┘    └────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
      ┌──────┐   ┌────────┐   ┌────────────┐
      │ IMD  │   │NASA    │   │OpenWeather │
      │API   │   │GPM API │   │API         │
      └──────┘   └────────┘   └────────────┘
```

## Manual Testing

### 1. Start the Docker Stack

```bash
docker-compose up -d
# Wait for all services to be healthy (check: docker ps)
```

### 2. Authentication

**Register a new user:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@monsoonmesh.local",
    "displayName": "Test User",
    "password": "TestPassword123456"
  }'
```

**Response includes JWT token:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "test@monsoonmesh.local",
    "role": "FIELD_REPORTER",
    "displayName": "Test User"
  }
}
```

### 3. Test External Weather Data Integration

**Trigger weather ingestion (requires ADMIN role):**
```bash
# First, promote user to ADMIN in database
docker exec monsoonmesh-postgres-1 psql -U monsoonmesh -d monsoonmesh \
  -c "UPDATE users SET role='ADMIN' WHERE email='test@monsoonmesh.local';"

# Get fresh token
TOKEN=$(curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@monsoonmesh.local","password":"TestPassword123456"}' \
  | jq -r '.token')

# Trigger weather ingestion
curl -X POST http://localhost:4000/api/data/ingest-weather \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "message": "Weather data ingestion triggered",
  "recordsIngested": 5,
  "sources": ["IMD", "NASA-GPM", "OpenWeather"]
}
```

**Fetch weather observations:**
```bash
curl -X GET http://localhost:4000/api/data/weather \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected response (5 observations):**
```json
{
  "items": [
    {
      "id": "uuid",
      "source_id": "uuid",
      "provider_record_key": "imd-1234567890",
      "observed_at": "2026-11-05T18:32:43.676Z",
      "latitude": 18.5204,
      "longitude": 73.8567,
      "rainfall_mm": "40.85",
      "is_synthetic": false
    },
    ...
  ],
  "metadata": {
    "source": "External weather feeds (IMD, NASA GPM, OpenWeatherMap)",
    "updated": "2026-11-05T18:36:00.039Z",
    "count": 5
  }
}
```

### 4. Test External Risk Assessment

**Trigger risk assessment:**
```bash
curl -X POST http://localhost:4000/api/data/assess-risks \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "message": "Risk assessment completed for 3 zones",
  "zones": [
    { "id": "uuid", "name": "Shivajinagar" },
    { "id": "uuid", "name": "Kothrud" },
    { "id": "uuid", "name": "Hadapsar" }
  ],
  "source": "External integrated data"
}
```

**Fetch risk assessments:**
```bash
curl -X GET http://localhost:4000/api/data/risk-assessments \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected response (3 zones with risk scores):**
```json
{
  "items": [
    {
      "id": "uuid",
      "zone_id": "uuid",
      "zone_name": "Hadapsar",
      "score": 56,
      "category": "HIGH",
      "model_version": "external-integrated-v1",
      "feature_values": {
        "rainfall": 64.972,
        "history": 100,
        "slope": 42,
        "drainage": 45,
        "incidents": 0
      },
      "assessed_at": "2026-11-05T18:35:20.066Z",
      "is_synthetic": false
    },
    ...
  ],
  "metadata": {
    "source": "External risk models and data sources",
    "updated": "2026-11-05T18:36:00.039Z",
    "count": 3
  }
}
```

### 5. Test Web Dashboard

**Access the UI:**
```
http://localhost:5173
```

**Login with test credentials:**
- Email: `test@monsoonmesh.local`
- Password: `TestPassword123456`

**Verify on Overview Page:**
- ✓ Weather observations stat card shows count > 0
- ✓ Critical zones stat card shows real risk data
- ✓ Map card footer shows "X weather observations" and "X assessed zones"
- ✓ Source status section shows "Weather feeds" with observation count
- ✓ Risk distribution chart reflects actual zone counts (CRITICAL, HIGH, MODERATE, LOW)

**Verify on Live Map Page:**
- ✓ Risk summary bar chart shows real zone distribution
- ✓ Footer indicates "Real external risk assessments"
- ✓ Clicking a zone shows real risk score and "EXTERNAL" data source badge

### 6. Test Periodic Worker Jobs

**Monitor worker logs:**
```bash
docker logs monsoonmesh-worker-1 -f
```

**Expected log output (after 5 minutes):**
```
✓ Periodic jobs scheduled: weather ingestion (5m), risk assessment (10m)
[bullmq] weather-ingestion-recurring started
[bullmq] Weather data ingestion triggered - 5 records ingested
[bullmq] risk-assessment-recurring started
[bullmq] Risk assessment completed for 3 zones
```

**Verify data refresh:**
```bash
# After 5 minutes, check if new weather records exist
curl -X GET http://localhost:4000/api/data/weather \
  -H "Authorization: Bearer $TOKEN" | jq '.metadata.updated'

# Should show a timestamp more recent than 5 minutes ago
```

## Environment Variable Configuration

To use real API credentials instead of mock data, set these environment variables in `.env`:

```env
# IMD (India Meteorological Department)
IMD_API_KEY=your_imd_api_key
IMD_BASE_URL=https://mausam.imd.gov.in

# NASA GPM (Global Precipitation Measurement)
NASA_GPM_TOKEN=your_nasa_gpm_token
NASA_GPM_BASE_URL=https://giovanni.gsfc.nasa.gov

# OpenWeatherMap
OPENWEATHER_API_KEY=your_openweather_api_key
OPENWEATHER_BASE_URL=https://api.openweathermap.org

# API worker authentication
ADMIN_TOKEN=your_admin_token
```

If credentials are not provided, the system falls back to mock data automatically.

## Success Criteria

- [x] Dashboard displays real weather data (not synthetic fixtures)
- [x] Dashboard displays real risk assessments (not synthetic fixtures)
- [x] Worker jobs are scheduled (5m weather, 10m risk assessment)
- [x] API endpoints respond with real data
- [x] System gracefully falls back to mock data if credentials unavailable
- [x] Data refreshes automatically via worker without manual intervention
- [x] All builds pass without errors
- [x] No TypeScript errors in web or API

## Troubleshooting

### Dashboard shows "API unavailable"
- Check if Docker services are running: `docker ps`
- Check API logs: `docker logs monsoonmesh-api-1`
- Verify CORS headers are set correctly

### No weather data appearing
- Check if ingestion jobs ran: `docker logs monsoonmesh-worker-1`
- Manually trigger ingestion: `POST /api/data/ingest-weather`
- Check database: `docker exec monsoonmesh-postgres-1 psql -U monsoonmesh -d monsoonmesh -c "SELECT COUNT(*) FROM weather_observations;"`

### Risk assessments show as "synthetic"
- Ensure zones are created: `SELECT * FROM zones WHERE is_synthetic=false;`
- Trigger assessment manually: `POST /api/data/assess-risks`
- Check risk_model_versions table for 'external-integrated-v1'

### Worker jobs not running
- Check worker container: `docker ps | grep worker`
- Monitor logs in real-time: `docker logs monsoonmesh-worker-1 -f`
- Check Redis connection: `docker exec monsoonmesh-redis-1 redis-cli PING`

## Performance Expectations

- Dashboard load time: < 2 seconds
- Weather ingestion: < 5 seconds (5 records)
- Risk assessment: < 3 seconds (3 zones)
- Worker job latency: < 1 second overhead per job
- Data refresh frequency: Weather (5m), Risk (10m)
