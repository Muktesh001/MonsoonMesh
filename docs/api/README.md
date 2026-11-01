# API reference

API base URL: `http://localhost:4000/api` (Compose web proxy:
`http://localhost:5173/api`). Service liveness is at `http://localhost:4000/health`.
All protected routes require `Authorization: Bearer <access-token>`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` (service root) | public | Service liveness |
| GET | `/metrics` (service root) | internal network | Prometheus metrics |
| POST | `/api/auth/login` | public | Exchange email/password for an 8-hour access token |
| POST | `/api/auth/register` | public | Create a FIELD_REPORTER account |
| GET | `/api/auth/me` | signed in | Current token claims |
| GET | `/api/dashboard` | signed in | Backend counts, recent reports and latest risk distribution |
| GET | `/api/zones` | signed in | GeoJSON zone features with latest risk assessments |
| GET | `/api/incidents?page=1&limit=25&status=...` | signed in | Paginated reports; reporters only see their own |
| GET | `/api/incidents/{id}` | signed in | Incident, event timeline, evidence metadata, and reviewed duplicate candidates |
| POST | `/api/incidents` | signed in | Submit a report and durable outbox event |
| PATCH | `/api/incidents/{id}/status` | ADMIN / OPERATOR | Apply a valid lifecycle transition |
| POST | `/api/incidents/{id}/evidence` | signed in | Upload a JPEG/PNG/WebP evidence image |
| GET | `/api/incidents/{id}/evidence` | signed in | List evidence metadata, owner-scoped for reporters |
| GET | `/api/incidents/{id}/evidence/{evidenceId}` | signed in | Retrieve an authorized uploaded image |
| POST | `/api/risk/simulate` | signed in | Calculate an isolated illustrative scenario |
| POST | `/api/routes/plan` | signed in | Dijkstra route plan over seeded road graph |

Incident creation request:

```json
{
  "title": "Waterlogging near junction",
  "description": "Standing water is visible near the crossing.",
  "category": "WATERLOGGING",
  "severity": "MODERATE",
  "latitude": 18.5204,
  "longitude": 73.8567
}
```

The API validates JSON with Zod, stores incident plus lifecycle event and outbox
entry in one transaction, then the worker requests a local structured AI analysis.
An AI recommendation remains pending operator approval; the service cannot dispatch
teams or alter verified facts.

The OpenAPI 3.1 description is available at [openapi.yml](./openapi.yml).
