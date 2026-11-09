# MonsoonMesh

AI-powered urban flood intelligence, predictive risk mapping, and emergency response
coordination for Pune, Maharashtra. MonsoonMesh is a local decision-support and
demonstration platform—not a validated flood forecast or emergency dispatch system.

## Features

### Incident Management
- **Incident Intake**: Field reporters submit waterlogging, flooding, and drainage incidents with location, photos, and severity
- **Status Workflow**: Verify, assign, prioritize, and resolve incidents with full audit trail
- **Evidence Tracking**: Attach and view images with metadata for each incident
- **Timeline View**: See complete incident lifecycle with all status changes and actions

### Risk Assessment & Analytics
- **Predictive Risk Modeling**: Multi-factor risk algorithm (rainfall, drainage, slope, history, incidents)
- **Zone-based Analysis**: Spatial risk assessment with PostGIS queries
- **Real-time Dashboard**: Live incident counts, risk scores, and trend analytics
- **Historical Data**: Query incidents, weather, and risk factors over time

### Operations Dashboard
- **Overview**: Summary statistics, recent incidents, risk breakdown
- **Analytics**: Charts and graphs for incident trends, zone risk distribution
- **Risk Map**: Interactive MapLibre map with zone polygons and incident markers
- **Navigation**: Quick access to all tools from responsive sidebar

### Data Integration
- **Weather APIs**: Rainfall and meteorological data integration (local and external sources)
- **External Sources**: Configurable support for IMD, NASA, and OSM data
- **AI Processing**: FastAPI service for incident analysis with deterministic fallback
- **Data Validation**: Zod schema validation on all inputs

### Security & Authorization
- **JWT Authentication**: Secure token-based login
- **Role-based Access Control**: Admin, Operator, Field Reporter roles
- **Audit Logging**: All user actions logged with timestamps and request IDs
- **Rate Limiting**: API request throttling to prevent abuse
- **Image Upload**: Secure file handling with MIME type validation

### Real-time Updates
- **WebSocket Support**: Socket.IO for live incident and risk updates
- **Incident Broadcasts**: Instant notification when incident status changes
- **Risk Notifications**: Real-time zone risk updates
- **Reconnection Handling**: Automatic reconnection with exponential backoff

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│               MonsoonMesh System Overview                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐
│  React Web App  │         │   Playwright E2E  │
│  (Port 5173)    │◄────────┤   Tests (CI/CD)   │
└────────┬────────┘         └──────────────────┘
         │ HTTP/REST           
         │ WebSocket (Socket.IO)
         │
┌────────▼────────────────────────────────────┐
│      Express.js API Server (Port 4000)      │
│ • Auth (JWT, roles, audit logging)          │
│ • Incident CRUD operations                  │
│ • Risk calculation & assessment             │
│ • File uploads & evidence management        │
│ • WebSocket connection handling             │
│ • Metrics & health checks                   │
└────────┬────────────────────────────────────┘
         │
    ┌────┴──────┬──────────┬──────────┐
    │            │          │          │
    ▼            ▼          ▼          ▼
 ┌──────┐   ┌────────┐  ┌─────┐  ┌─────────┐
 │ PG   │   │ Redis  │  │ AI  │  │External │
 │ + GIS│   │ +BullMQ│  │API  │  │ Sources │
 └──────┘   └────────┘  └─────┘  └─────────┘
    │            │          │          │
    └────┬───────┴──────────┴──────────┘
         │
┌────────▼────────────────┐
│  Monitoring & Logging   │
│ • Prometheus (metrics)  │
│ • Grafana (dashboards)  │
│ • Winston (logs)        │
└─────────────────────────┘
```

### Technology Stack

**Frontend**
- React 19 + TypeScript
- Vite for fast builds
- TanStack Query for API data fetching
- React Router for navigation
- MapLibre GL for spatial visualization
- Recharts for data visualization
- Socket.IO client for real-time updates

**Backend**
- Express.js with TypeScript
- PostgreSQL + PostGIS for spatial data
- Redis + BullMQ for message queue
- JWT for authentication
- Zod for schema validation
- Socket.IO for WebSocket communication

**Infrastructure**
- Docker Compose for local development
- PostgreSQL with PostGIS extension
- Redis for caching and queues
- FastAPI (Python) for AI processing
- Prometheus for metrics collection
- Grafana for monitoring dashboards

**Quality**
- Vitest for API unit tests
- Supertest for API integration tests
- Playwright for E2E tests
- TypeScript for type safety

## Quick Start

### Requirements
- Docker Desktop (with Compose)
- Git
- 4GB+ RAM, ports 5173, 4000, 5432 available

### Local Development (< 2 minutes)

```bash
git clone <repository>
cd MonsoonMesh
cp .env.example .env
docker compose up --build
```

Then open **http://localhost:5173** and login:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@monsoonmesh.local` | `MonsoonDemo!2026` |
| Operator | `operator@monsoonmesh.local` | `MonsoonDemo!2026` |
| Field Reporter | `reporter@monsoonmesh.local` | `MonsoonDemo!2026` |

Other interfaces:
- **Grafana**: http://localhost:3000 (admin / monsoonmesh)
- **Prometheus**: http://localhost:9090
- **API**: http://localhost:4000

## Development

```bash
npm ci
npm run dev:api
npm run dev:web
npm run dev:worker
```

The development commands expect PostgreSQL and Redis on their default local ports.
Use Docker Compose for the complete integrated environment. Build and test:

```bash
npm run build
npm test
npm run test:e2e        # Run Playwright E2E tests
npm run test:e2e:ui     # UI mode for E2E tests
```

AI service:

```bash
python -m venv apps/ai-service/.venv
apps/ai-service/.venv/Scripts/Activate.ps1
pip install -r apps/ai-service/requirements.lock
pytest -q apps/ai-service/tests
```

## API Examples

### Authentication

**Login**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "reporter@monsoonmesh.local",
    "password": "MonsoonDemo!2026"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "reporter@monsoonmesh.local",
    "role": "FIELD_REPORTER",
    "displayName": "Field Reporter"
  }
}
```

**Get Current User**
```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Incidents

**Create Incident**
```bash
curl -X POST http://localhost:4000/api/incidents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Waterlogging at Kondhwa",
    "description": "Area near market is waterlogged after heavy rain",
    "category": "WATERLOGGING",
    "severity": "HIGH",
    "latitude": 18.4721,
    "longitude": 73.8732
  }'
```

**Get All Incidents**
```bash
curl "http://localhost:4000/api/incidents?limit=10&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Update Incident Status** (Operator only)
```bash
curl -X PATCH http://localhost:4000/api/incidents/<incident-id>/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "VERIFIED"}'
```

**Upload Evidence Image**
```bash
curl -X POST http://localhost:4000/api/incidents/<incident-id>/evidence \
  -H "Authorization: Bearer <token>" \
  -F "file=@photo.jpg"
```

### Dashboard

**Get Dashboard Summary**
```bash
curl http://localhost:4000/api/dashboard \
  -H "Authorization: Bearer <token>"
```

**Get Risk Assessment**
```bash
curl http://localhost:4000/api/incidents/risk \
  -H "Authorization: Bearer <token>"
```

### Metrics

**Prometheus Metrics** (for monitoring)
```bash
curl http://localhost:4000/metrics
```

See [API documentation](docs/api/README.md) for complete endpoint reference.

## Risk index and data provenance

The deterministic illustrative formula is
`R = 0.35P + 0.20H + 0.15S + 0.15D + 0.15F`. Available feature weights are
renormalized when some inputs are missing; absent factors are not treated as zero.
Scores are labelled LOW (0-24), MODERATE (25-49), HIGH (50-74), or CRITICAL
(75-100). No scientific flood probability is implied.

Seeded zone polygons, weather observations, roads, incidents, and facilities are
synthetic. The current MapLibre view draws stored zone polygons on a neutral local
canvas and does not request map tiles. It therefore needs no external tile
attribution. Operational deployments must configure a licensed tile source and
display its required attribution.

## Security Features

- **Authentication**: JWT tokens with role-based access control
- **Authorization**: Every protected operation checks user role on the server
- **Input Validation**: Zod schema validation on all API requests
- **CORS**: Configurable origin, secure cookie settings
- **Rate Limiting**: Request throttling to prevent abuse
- **Helmet**: HTTP security headers (HSTS, CSP, X-Frame-Options, etc.)
- **Image Upload**: MIME type validation, file size limits
- **Audit Logging**: Complete trail of user actions for compliance
- **Secrets Management**: All credentials in environment variables (never committed)
- **Password Security**: bcrypt with 12-round salt

Before production deployment:
- [ ] Set strong `JWT_SECRET` (32+ random characters)
- [ ] Change all default database and Grafana passwords
- [ ] Enable HTTPS/TLS termination
- [ ] Configure secure CORS origins
- [ ] Remove or disable demo accounts
- [ ] Set `NODE_ENV=production`
- [ ] Configure external monitoring and logging
- [ ] Set up automated database backups

## Contributing

### Code Standards
- TypeScript for type safety
- ESLint + Oxlint for linting
- Vitest for unit tests
- Supertest for integration tests
- Playwright for E2E tests
- Format: 2-space indentation

### Workflow
1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes and test: `npm run build && npm test`
3. Commit with descriptive message
4. Push and open a pull request
5. CI must pass before merge

### Testing
```bash
# Unit and integration tests
npm test

# E2E tests (requires running services)
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Structure
```
MonsoonMesh/
├── apps/
│   ├── api/          # Express backend
│   ├── web/          # React frontend
│   ├── worker/       # BullMQ background worker
│   └── ai-service/   # Python AI service
├── database/         # PostgreSQL setup & migrations
├── infrastructure/   # Docker, monitoring, configs
├── docs/             # Documentation
├── e2e/              # Playwright tests
└── docker-compose.yml
```

## Documentation

- [API reference](docs/api/README.md)
- [OpenAPI 3.1 schema](docs/api/openapi.yml)
- [Database ER diagram and spatial query example](docs/database/er.md)
- [System architecture](docs/architecture/system.md)
- [Risk model](docs/architecture/risk-model.md)
- [Incident lifecycle](docs/architecture/incident-lifecycle.md)
- [AI workflow and limitations](docs/architecture/ai-workflow.md)
- [Data/event workflow](docs/architecture/data-ingestion.md)
- [Implementation status and remaining work](docs/IMPLEMENTATION_STATUS.md)
- The supplied 4,237-line PDF was used as the project specification and is not
  copied into this repository.
