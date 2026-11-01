# MonsoonMesh

AI-powered urban flood intelligence, predictive risk mapping, and emergency response
coordination for Pune, Maharashtra. MonsoonMesh is a local decision-support and
demonstration platform—not a validated flood forecast or emergency dispatch system.

## What works in this implementation

- React + TypeScript operations dashboard, incident intake, GeoJSON zone map using
  MapLibre without external tile dependencies, and what-if risk simulation.
- Express + TypeScript API with JWT login, reporter registration, backend role checks,
  rate limiting, Zod request validation, transactional incident lifecycle history,
  image upload metadata, dashboard data, GeoJSON queries, and route planning.
- PostgreSQL with PostGIS and pgvector extensions, SQL migrations, synthetic Pune
  zone/weather/incident/risk fixtures, spatial indexes, and local-only demo accounts.
- Redis + BullMQ durable outbox worker that sends incident reports to a FastAPI
  service; AI output is a deterministic local fallback and remains human-review-only.
- Docker Compose, Prometheus API metrics, provisioned Grafana dashboard, and CI.

This is the first functional vertical slice, not completion of every item in the
project specification. Live IMD/NASA/OSM ingestion, evidence image viewing, full
LangGraph RAG/citations, Gemini/image processing, refresh sessions, team assignment,
Socket.IO, complete analytics/pages, and Playwright end-to-end flows remain future
work. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Start locally

Requirements: Docker Desktop with Compose, and Git if cloning.

1. Copy `.env.example` to `.env`. Replace `JWT_SECRET` and local passwords before
   exposing the services to any network. Defaults are intended only for local demo.
2. Start the stack:

   ```powershell
   docker compose up --build
   ```

   Compose waits for PostGIS, applies SQL migrations, seeds the demo fixtures and
   accounts, then starts the API, worker, web app, monitoring, and AI fallback.
3. Open `http://localhost:5173`.

Local-only accounts (password for all: `MonsoonDemo!2026`):

| Role | Email |
|---|---|
| Administrator | `admin@monsoonmesh.local` |
| Operator | `operator@monsoonmesh.local` |
| Field reporter | `reporter@monsoonmesh.local` |

These are synthetic development accounts. Never reuse their password in a deployed
environment.

Other local interfaces: Grafana `http://localhost:3000` (admin / monsoonmesh),
Prometheus `http://localhost:9090`, API `http://localhost:4000/health`.

To run database steps explicitly after the services are up:

```powershell
docker compose run --rm bootstrap npm run migrate -w apps/api
docker compose run --rm bootstrap npm run seed -w apps/api
```

To stop services use `docker compose down`. To reset all local database, Redis,
uploaded-image, and monitoring state, run `docker compose down -v`; this deletes
the named local volumes.

## Development

```powershell
npm ci
npm run dev:api
npm run dev:web
npm run dev:worker
```

The development commands expect PostgreSQL and Redis on their default local ports.
Use Docker Compose for the complete integrated environment. Build and test:

```powershell
npm run build
npm test
```

AI service:

```powershell
python -m venv apps/ai-service/.venv
apps/ai-service/.venv/Scripts/Activate.ps1
pip install -r apps/ai-service/requirements.lock
pytest -q apps/ai-service/tests
```

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

## Security and operations

- API authorization—not client-side visibility—protects operator status changes.
- Use a unique random `JWT_SECRET`, strong database/Grafana passwords, HTTPS, and
  secure cookie/session settings before deployment.
- Evidence upload accepts JPEG, PNG, and WebP under the configured byte limit.
- Do not expose Prometheus/Grafana or local demo accounts to the public internet.
- Health endpoints only report liveness. API request metrics are available at
  `/metrics` to the internal Compose network.
- Gemini keys are not required. The current AI path is local and deterministic;
  no external provider integration is active.

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
