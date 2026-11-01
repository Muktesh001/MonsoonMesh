# Data and event workflow

```mermaid
flowchart LR
  Provider[Configured provider or labeled fixture] --> Worker[BullMQ worker]
  Worker --> Validate[Validate and normalize]
  Validate --> Run[Persist ingestion run]
  Run --> PG[(PostgreSQL / PostGIS)]
  Report[Incident API transaction] --> Outbox[Transactional outbox]
  Outbox --> Queue[Redis / BullMQ]
  Queue --> AI[Local AI service]
  AI --> Review[Pending operator review]
```

Synthetic fixtures are clearly marked in database rows. External IMD, NASA GPM,
OpenStreetMap, and historical-data adapters are extension points, not currently
connected live providers.
