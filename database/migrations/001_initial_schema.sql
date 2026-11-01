CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('ADMIN', 'OPERATOR', 'FIELD_REPORTER');
CREATE TYPE incident_status AS ENUM (
  'SUBMITTED', 'PROCESSING', 'PENDING_VERIFICATION', 'VERIFIED', 'ASSIGNED',
  'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'DUPLICATE', 'REOPENED'
);
CREATE TYPE risk_category AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id, expires_at);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  zone_type text NOT NULL,
  boundary geometry(MULTIPOLYGON, 4326) NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zones_boundary_gist ON zones USING gist(boundary);
CREATE TABLE road_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  from_node text NOT NULL,
  to_node text NOT NULL,
  name text,
  distance_m double precision NOT NULL CHECK(distance_m >= 0),
  risk_score numeric(5,2) CHECK(risk_score BETWEEN 0 AND 100),
  is_closed boolean NOT NULL DEFAULT false,
  path geometry(LINESTRING, 4326) NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false
);
CREATE INDEX road_segments_path_gist ON road_segments USING gist(path);
CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  facility_type text NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false
);
CREATE INDEX facilities_location_gist ON facilities USING gist(location);
CREATE TABLE environmental_grid_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_key text NOT NULL UNIQUE,
  cell geometry(POLYGON, 4326) NOT NULL,
  elevation_m numeric,
  slope_degrees numeric,
  drainage_score numeric CHECK(drainage_score BETWEEN 0 AND 100),
  is_synthetic boolean NOT NULL DEFAULT false
);
CREATE INDEX environmental_grid_cells_gist ON environmental_grid_cells USING gist(cell);

CREATE TABLE data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  name text NOT NULL,
  provider_type text NOT NULL,
  attribution text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES data_sources(id),
  status text NOT NULL CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
  started_at timestamptz,
  completed_at timestamptz,
  records_written integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE weather_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES data_sources(id),
  provider_record_key text,
  observed_at timestamptz NOT NULL,
  location geography(POINT, 4326),
  rainfall_mm numeric(8,2) NOT NULL CHECK(rainfall_mm >= 0),
  is_synthetic boolean NOT NULL DEFAULT false,
  UNIQUE(source_id, provider_record_key)
);
CREATE INDEX weather_observations_time_idx ON weather_observations(observed_at DESC);
CREATE TABLE weather_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES data_sources(id),
  forecast_for timestamptz NOT NULL,
  location geography(POINT, 4326),
  rainfall_mm numeric(8,2) NOT NULL CHECK(rainfall_mm >= 0),
  is_synthetic boolean NOT NULL DEFAULT false
);
CREATE TABLE environmental_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES data_sources(id),
  observed_at timestamptz NOT NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  location geography(POINT, 4326),
  is_synthetic boolean NOT NULL DEFAULT false
);

CREATE TABLE risk_model_versions (
  version text PRIMARY KEY,
  description text NOT NULL,
  weights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
  category risk_category NOT NULL,
  model_version text NOT NULL REFERENCES risk_model_versions(version),
  feature_values jsonb NOT NULL,
  feature_contributions jsonb NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  is_synthetic boolean NOT NULL DEFAULT false
);
CREATE INDEX risk_assessments_zone_time_idx ON risk_assessments(zone_id, assessed_at DESC);
CREATE TABLE risk_zone_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  feature_value numeric,
  observed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id),
  title text NOT NULL CHECK(length(title) BETWEEN 4 AND 160),
  description text NOT NULL CHECK(length(description) BETWEEN 8 AND 5000),
  category text NOT NULL,
  severity risk_category NOT NULL DEFAULT 'MODERATE',
  status incident_status NOT NULL DEFAULT 'SUBMITTED',
  location geography(POINT, 4326) NOT NULL,
  zone_id uuid REFERENCES zones(id),
  assigned_team_id uuid,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_location_gist ON incidents USING gist(location);
CREATE INDEX incidents_status_created_idx ON incidents(status, created_at DESC);
CREATE INDEX incidents_reporter_idx ON incidents(reporter_id, created_at DESC);
CREATE TABLE incident_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES users(id),
  storage_key text NOT NULL UNIQUE,
  media_type text NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes > 0),
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incident_events_incident_idx ON incident_events(incident_id, created_at);
CREATE TABLE incident_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  related_incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  similarity_score numeric(5,4) CHECK(similarity_score BETWEEN 0 AND 1),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, related_incident_id),
  CHECK(incident_id <> related_incident_id)
);

CREATE TABLE knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_uri text,
  checksum text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(384),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(document_id, chunk_index)
);
CREATE INDEX knowledge_chunks_embedding_hnsw ON knowledge_chunks USING hnsw(embedding vector_cosine_ops);
CREATE TABLE ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id),
  status text NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK(status IN ('PENDING_APPROVAL','APPROVED','REJECTED')),
  recommendation jsonb NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  uncertainty text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id),
  status text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE response_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capabilities text[] NOT NULL DEFAULT '{}',
  is_available boolean NOT NULL DEFAULT true,
  location geography(POINT, 4326),
  is_synthetic boolean NOT NULL DEFAULT false
);
ALTER TABLE incidents ADD CONSTRAINT incidents_assigned_team_fk
  FOREIGN KEY(assigned_team_id) REFERENCES response_teams(id);
CREATE TABLE response_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id),
  team_id uuid NOT NULL REFERENCES response_teams(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'ASSIGNED',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE route_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id),
  team_id uuid REFERENCES response_teams(id),
  route geometry(LINESTRING, 4326),
  distance_m numeric,
  risk_exposure numeric,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_plans_gist ON route_plans USING gist(route);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO risk_model_versions(version,description,weights)
VALUES ('illustrative-v1','Deterministic explainable demonstration index; not a validated probability.',
  '{"rainfall":0.35,"history":0.20,"slope":0.15,"drainage":0.15,"incidents":0.15}')
ON CONFLICT(version) DO NOTHING;
INSERT INTO data_sources(provider_key,name,provider_type,attribution)
VALUES ('synthetic','Synthetic demonstration fixtures','FIXTURE','Synthetic data for local demonstration only.')
ON CONFLICT(provider_key) DO NOTHING;
