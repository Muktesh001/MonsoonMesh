# imresamu/postgis:16-3.5 — PostgreSQL 16 + PostGIS 3.5 on Debian Bookworm
# with the PGDG repo already configured. We just add pgvector on top.
FROM imresamu/postgis:16-3.5

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-pgvector \
 && rm -rf /var/lib/apt/lists/*
