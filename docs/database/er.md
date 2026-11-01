# Database model

```mermaid
erDiagram
  USERS ||--o{ INCIDENTS : reports
  USERS ||--o{ INCIDENT_EVENTS : acts
  USERS ||--o{ INCIDENT_EVIDENCE : uploads
  ZONES ||--o{ INCIDENTS : contains
  ZONES ||--o{ RISK_ASSESSMENTS : assessed
  RISK_MODEL_VERSIONS ||--o{ RISK_ASSESSMENTS : versions
  DATA_SOURCES ||--o{ INGESTION_RUNS : runs
  DATA_SOURCES ||--o{ WEATHER_OBSERVATIONS : supplies
  INCIDENTS ||--o{ INCIDENT_EVENTS : records
  INCIDENTS ||--o{ INCIDENT_EVIDENCE : supports
  INCIDENTS ||--o{ INCIDENT_RELATIONS : relates
  INCIDENTS ||--o{ AI_RECOMMENDATIONS : informs
  INCIDENTS ||--o{ RESPONSE_ASSIGNMENTS : receives
  RESPONSE_TEAMS ||--o{ RESPONSE_ASSIGNMENTS : assigned
  INCIDENTS ||--o{ ROUTE_PLANS : plans
  RESPONSE_TEAMS ||--o{ ROUTE_PLANS : routes
  KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_CHUNKS : contains
  USERS ||--o{ REFRESH_TOKENS : owns
  USERS ||--o{ AUDIT_LOGS : performs
  USERS ||--o{ NOTIFICATIONS : receives
```

Spatial columns use SRID 4326: incident/facility locations are `geography(POINT)`,
zone boundaries are `geometry(MULTIPOLYGON)`, roads are `geometry(LINESTRING)`, and
environment grid cells are `geometry(POLYGON)`. GiST indexes support bounding-box and
nearby-feature lookups; B-tree indexes cover incident status/time, reporter/time,
risk zone/time, and incident event/time. Vector similarity uses a 384-dimensional
pgvector column with an HNSW cosine index.

Representative spatial query (distance returned in metres):

```sql
SELECT f.name, ST_Distance(f.location, i.location) AS distance_m
FROM facilities f
JOIN incidents i ON i.id = $1
ORDER BY f.location <-> i.location
LIMIT 5;
```
