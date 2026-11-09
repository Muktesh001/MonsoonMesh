# System Architecture

MonsoonMesh is a full-stack incident management and risk assessment platform for urban flood intelligence. This document describes the system design, components, and data flows.

## High-Level System Overview

```
┌──────────────────────────────────────────────────────┐
│                  User Interfaces                      │
├──────────────────────────────────────────────────────┤
│  • React Web App (Dashboard, Incidents, Analytics)   │
│  • Field Reporter Mobile-ready Web Form              │
│  • Operator Status Update Interface                  │
└────────────────┬─────────────────────────────────────┘
                 │ HTTP/REST + WebSocket (Socket.IO)
┌────────────────▼─────────────────────────────────────┐
│            Express.js API Layer                      │
├──────────────────────────────────────────────────────┤
│  Authentication & Authorization (JWT)               │
│  Incident Management (CRUD, status workflow)       │
│  Risk Assessment & Analytics                        │
│  Evidence/Image Upload                              │
│  Real-time WebSocket Connections                   │
│  Prometheus Metrics Endpoint                        │
└────────────────┬─────────────────────────────────────┘
                 │
       ┌─────────┼──────────┬──────────┐
       │         │          │          │
       ▼         ▼          ▼          ▼
   ┌────────┐ ┌──────┐  ┌─────────┐ ┌──────────┐
   │Database│ │Cache │  │Queue    │ │External  │
   │PostgreSQL Redis│  │BullMQ  │ │APIs     │
   │+ PostGIS│ │     │  │         │ │Weather   │
   └────────┘ └──────┘  └─────────┘ │Geocoding │
                              │      │Risk Data │
       ┌──────────────────────┘      └──────────┘
       │
       ▼
   ┌──────────────────┐
   │ Background Worker│
   │ (BullMQ Consumer)│
   ├──────────────────┤
   │ • Process events │
   │ • Call AI service│
   │ • Update status  │
   └────────┬─────────┘
            │
            ▼
      ┌──────────────┐
      │ AI Service   │
      │ (FastAPI)    │
      │ • Python ML  │
      │ • Local/Gemini
      └──────────────┘

Monitoring:
┌──────────────────────────────────────────┐
│ Prometheus + Grafana                     │
│ • Metrics collection from API            │
│ • Pre-built dashboards                   │
│ • Alert configuration support            │
└──────────────────────────────────────────┘

Logging:
┌──────────────────────────────────────────┐
│ Winston Logger                           │
│ • JSON structured logs                   │
│ • Daily rotation                         │
│ • Error & exception tracking             │
└──────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend (React)

**Location**: `apps/web/`

**Key Components**:
- **AppShell**: Main layout with sidebar navigation
- **Pages**: Overview, Analytics, Incidents, RiskMap, etc.
- **RiskMap**: Interactive MapLibre map with zone polygons and markers
- **IncidentsPage**: List, detail, and create/edit incident forms
- **AnalyticsPage**: Charts and trends

**Key Features**:
- TanStack Query for server state management
- React Router for navigation
- MapLibre GL for geospatial visualization
- Socket.IO client for real-time updates
- Recharts for data visualization
- Zod for client-side validation

**Data Flow**:
```
Component → API Hook (useQuery) → API Server
                              ↓
         Server State (TanStack Query Cache)
                              ↓
Component Render + Live Updates (WebSocket)
```

### 2. Backend API (Express)

**Location**: `apps/api/`

**Routes**:
- `POST /api/auth/login` - JWT token generation
- `POST /api/auth/register` - New user registration
- `GET /api/auth/me` - Current user info
- `GET /api/dashboard` - Dashboard summary
- `GET /api/incidents` - List incidents (paginated, filtered)
- `POST /api/incidents` - Create incident
- `GET /api/incidents/:id` - Incident detail
- `PATCH /api/incidents/:id/status` - Update status (with WebSocket broadcast)
- `POST /api/incidents/:id/evidence` - Upload image
- `GET /api/incidents/:id/evidence` - Get images
- `GET /api/incidents/risk` - Risk assessment
- `GET /metrics` - Prometheus metrics
- `GET /health` - Liveness check

**Middleware**:
- `authenticate`: JWT verification
- `requireRoles`: Authorization checks
- `requestLoggingMiddleware`: Request/response logging
- `errorLoggingMiddleware`: Exception tracking
- `cors`: Cross-origin handling
- `helmet`: Security headers
- `rateLimit`: Request throttling

**Services**:
- `auth.ts`: Login, registration, JWT
- `incident.ts`: CRUD operations
- `risk.ts`: Risk calculation algorithm
- `routes.ts`: Route planning (shortest path)
- `duplicates.ts`: Incident deduplication
- `weather-adapter.ts`: Weather data integration
- `risk-data-adapter.ts`: External risk source integration
- `audit.ts`: Action logging
- `websocket.ts`: Real-time connections

### 3. Database (PostgreSQL + PostGIS)

**Location**: `database/`

**Schema Overview**:
```
users
├── id (UUID primary key)
├── email (unique, indexed)
├── password_hash (bcrypt)
├── role (ADMIN, OPERATOR, FIELD_REPORTER)
├── display_name
├── is_active
└── timestamps (created_at, updated_at)

incidents
├── id (UUID primary key)
├── reporter_id (FK → users)
├── title
├── description
├── category (WATERLOGGING, FLOODING, etc.)
├── severity (LOW, MODERATE, HIGH, CRITICAL)
├── status (PENDING_VERIFICATION, VERIFIED, etc.)
├── location (PostGIS geography type)
├── zone_id (FK → zones)
├── is_synthetic
└── timestamps

incident_events
├── id
├── incident_id (FK → incidents)
├── actor_id (FK → users)
├── event_type (status change, etc.)
├── details (JSON)
└── created_at

incident_evidence
├── id
├── incident_id (FK → incidents)
├── file_path
├── mime_type
├── file_size
└── uploaded_at

zones
├── id (UUID)
├── name
├── polygon (PostGIS geometry type)
├── risk_score
└── metadata (JSON)

weather_observations
├── id
├── zone_id
├── rainfall_mm
├── humidity
├── temperature
└── observed_at

risk_assessments
├── id
├── zone_id
├── score (0-100)
├── category
├── factors (JSON)
└── assessed_at

audit_logs
├── id
├── actor_id
├── action (LOGIN_SUCCESS, INCIDENT_STATUS_CHANGED, etc.)
├── entity_type
├── entity_id
├── details (JSON)
├── request_id
└── created_at
```

**Key Indexes**:
- `incidents(status, created_at)` - Status filtering
- `incidents(location)` - Spatial queries (PostGIS GIST)
- `incidents(zone_id, created_at)` - Zone analysis
- `zones(polygon)` - Zone boundary queries (PostGIS GIST)
- `users(email)` - Login lookups
- `audit_logs(actor_id, created_at)` - User action tracking

**Migrations**:
Located in `database/migrations/` with numbered SQL files executed in order.

### 4. Message Queue (Redis + BullMQ)

**Location**: `apps/worker/`

**Purpose**: Asynchronous job processing for expensive operations

**Jobs**:
- `incident:process` - Call AI service for incident analysis
- `risk:update` - Recalculate zone risks
- `weather:sync` - Fetch and ingest weather data
- `notification:send` - Send user notifications

**Flow**:
```
API Server → Queue Job → Worker Process → AI Service
                              ↓
                        Update Database
                              ↓
                        Broadcast WebSocket
```

### 5. AI Service (FastAPI + Python)

**Location**: `apps/ai-service/`

**Endpoints**:
- `POST /analyze` - Analyze incident for relevance and risk
- `POST /classify` - Categorize incident type
- `GET /health` - Service health check

**Features**:
- Deterministic local fallback (no external dependency)
- Optional Gemini API integration (configurable)
- Structured logging
- Request validation

### 6. Real-time Communication (Socket.IO)

**Server**: Initialized in API server (`index.ts`)

**Channels**:
- `incidents` - All users subscribed to incident updates
- `risk-map` - Users viewing risk visualization
- `user:${userId}` - Personal notifications

**Events**:
- `incident:updated` - Broadcast when incident status changes
- `risk:updated` - Broadcast when zone risk score changes
- `notification` - Personal user notification

**Client Hook**: `useWebSocket()` in React app

### 7. Monitoring & Observability

**Prometheus Metrics** (exposed at `/metrics`):
- `http_requests_total` - Request count by method/status
- `http_request_duration_seconds` - Latency histogram
- `http_client_request_duration_seconds` - Client request timing
- Default metrics (memory, CPU, etc.)

**Grafana Dashboards** (pre-configured):
- Node.js API Dashboard: Request rate, error rate, latency
- Custom dashboards can be imported

**Structured Logging** (Winston):
- JSON format for parsing
- Request IDs for tracing
- Error stack traces
- Daily log rotation
- Separate error/exception logs

## Data Flow Examples

### 1. Incident Creation Flow

```
Reporter Form (React)
    ↓
Validate (Zod)
    ↓
POST /api/incidents (JWT auth)
    ↓
API: Validate input
    ↓
API: Insert into database (transaction)
    ↓
API: Queue background job
    ↓
API: Return incident ID
    ↓
Worker: Receive job
    ↓
Worker: Call AI service
    ↓
Worker: Update incident with analysis
    ↓
WebSocket: Broadcast incident:created
    ↓
Dashboard: React component receives update via Socket.IO
    ↓
React: Update cache, re-render with new incident
```

### 2. Status Update Flow (Operator)

```
Operator UI (React)
    ↓
Select new status
    ↓
PATCH /api/incidents/:id/status (JWT auth, OPERATOR role check)
    ↓
API: Verify valid state transition
    ↓
API: Begin transaction
    ↓
API: Update incidents.status
    ↓
API: Insert incident_event
    ↓
API: Insert audit_log
    ↓
API: Commit transaction
    ↓
API: Broadcast via WebSocket (incident:updated)
    ↓
All Connected Clients: Receive update
    ↓
React Components: Update local cache and UI
    ↓
Reporter: Notified of status change (if personal update)
```

### 3. Risk Assessment Flow

```
Periodic Worker Job OR Incident Creation
    ↓
Worker: Query zone polygon + incidents + weather
    ↓
Worker: Call calculateRisk() with factors
    ↓
Risk Calculation:
  R = 0.35P + 0.20H + 0.15S + 0.15D + 0.15F
  (Rainfall, History, Slope, Drainage, Frequency)
    ↓
Worker: Update risk_assessments table
    ↓
Worker: Broadcast via WebSocket (risk:updated)
    ↓
Dashboard (React): Receive update
    ↓
Map: Update zone colors based on risk
    ↓
Analytics: Recalculate trend charts
```

## Security Architecture

### Authentication
- JWT tokens signed with `JWT_SECRET`
- Tokens expire after 8 hours
- Login requires email + password (min 8 chars)
- Password hashed with bcrypt (12 rounds)

### Authorization
- Every endpoint checks JWT token validity
- Protected endpoints verify user role
- Status update requires ADMIN or OPERATOR role
- Reporters can only modify their own incidents

### Data Validation
- All inputs validated with Zod schemas
- File uploads: MIME type + size limits
- Coordinates: lat/long bounds checking
- Rate limiting: 120 requests per minute per IP

### Audit Trail
- Every action logged with user ID, timestamp, request ID
- Immutable audit log (never deleted, only added)
- Searchable for compliance

## Deployment Considerations

### Horizontal Scaling
- **API**: Stateless, can run multiple instances behind load balancer
- **Worker**: Can run multiple consumers from same Redis queue
- **Database**: Connection pooling required
- **WebSocket**: Redis adapter for Socket.IO to share connections across instances

### Database Performance
- Connection pooling via pg library
- Spatial indexes on location fields
- Query optimization with EXPLAIN ANALYZE
- Regular VACUUM for maintenance

### Caching Strategy
- Redis for session tokens and temporary data
- TanStack Query for client-side caching
- HTTP cache headers for static assets

### Rate Limiting
- Per-IP rate limiting on API (120/min default)
- Per-user rate limiting on uploads
- Exponential backoff on WebSocket reconnection

## Technology Rationale

- **PostgreSQL**: Relational data + spatial extensions (PostGIS)
- **Redis**: Fast in-memory queue and cache
- **Express**: Lightweight, fast Node.js HTTP framework
- **React**: Component-based UI with excellent ecosystem
- **TypeScript**: Type safety across full stack
- **Socket.IO**: Real-time bidirectional communication with fallbacks
- **BullMQ**: Reliable job queue with persistence
- **Zod**: Runtime validation matching TypeScript types
- **Docker**: Consistent dev/prod environments

## Future Enhancements

- [ ] Horizontal scaling with Redis adapter
- [ ] GraphQL API for flexible querying
- [ ] Elasticsearch for incident text search
- [ ] Machine learning model retraining pipeline
- [ ] Mobile native apps (iOS/Android)
- [ ] SMS notifications for operators
- [ ] Integration with emergency dispatch systems
- [ ] Historical data archival strategy
- [ ] Multi-language support
- [ ] Offline mode for field reporters

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed feature roadmap.
