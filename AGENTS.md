# MonsoonMesh engineering guide

## Project conventions
- Treat `docs/` and the supplied project specification as the source of truth.
- Never describe synthetic/demo observations as live data or risk scores as validated flood probabilities.
- Keep HTTP handlers thin; put business logic in services and SQL in repositories.
- Validate all external input and authorize every protected operation on the server.
- Keep secrets in environment variables; never commit `.env` files.
- Run `npm run build` and `npm test` after relevant changes.

## Current implementation boundary
This repository starts with an executable vertical slice: React operations dashboard,
Express API, PostgreSQL/PostGIS schema and seeds, Redis/BullMQ worker, and a Python
AI service with deterministic local fallback. Optional external sources and Gemini
must remain configurable and must not prevent core incident workflows.
