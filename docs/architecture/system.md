# System architecture

```mermaid
flowchart LR
  Browser[React + MapLibre web app] -->|REST / Socket.IO| API[Express modular monolith]
  API --> PG[(PostgreSQL + PostGIS + pgvector)]
  API --> Redis[(Redis + BullMQ)]
  Redis --> Worker[Node.js worker]
  Worker --> AI[FastAPI AI service]
  AI --> PG
  Prometheus --> API
  Prometheus --> Worker
  Prometheus --> AI
  Grafana --> Prometheus
```

The API is the application boundary and the database is the source of truth. Redis
only transports retryable background work. Risk calculations are explainable and
versioned; local sample data and simulations are explicitly labelled.
