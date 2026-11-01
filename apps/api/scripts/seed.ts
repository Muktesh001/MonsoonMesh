import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const accounts = [
  ['admin@monsoonmesh.local', 'Admin Demo', 'ADMIN'],
  ['operator@monsoonmesh.local', 'Operator Demo', 'OPERATOR'],
  ['reporter@monsoonmesh.local', 'Reporter Demo', 'FIELD_REPORTER'],
] as const;
const hash = await bcrypt.hash('MonsoonDemo!2026', 12);
for (const [email, name, role] of accounts) {
  await pool.query(
    `INSERT INTO users(email,display_name,password_hash,role,is_active)
     VALUES($1,$2,$3,$4,true) ON CONFLICT(email) DO NOTHING`,
    [email, name, hash, role],
  );
}
await pool.query(`
  INSERT INTO zones(name,zone_type,boundary,is_synthetic)
  SELECT d.name,'DEMONSTRATION',ST_Multi(ST_GeomFromText(d.wkt,4326)),true
  FROM (VALUES
    ('Shivajinagar','POLYGON((73.84 18.50,73.87 18.50,73.87 18.54,73.84 18.54,73.84 18.50))'),
    ('Kothrud','POLYGON((73.78 18.48,73.82 18.48,73.82 18.52,73.78 18.52,73.78 18.48))'),
    ('Hadapsar','POLYGON((73.92 18.48,73.96 18.48,73.96 18.52,73.92 18.52,73.92 18.48))')
  ) AS d(name,wkt)
  WHERE NOT EXISTS (SELECT 1 FROM zones WHERE zones.name=d.name);
`);
await pool.query(`
  INSERT INTO facilities(name,facility_type,location,is_synthetic)
  SELECT 'Demo Response Station','RESPONSE_TEAM',ST_SetSRID(ST_MakePoint(73.8567,18.5204),4326)::geography,true
  WHERE NOT EXISTS (SELECT 1 FROM facilities WHERE name='Demo Response Station');
  INSERT INTO weather_observations(source_id,provider_record_key,observed_at,rainfall_mm,is_synthetic)
  SELECT id,'demo-pune-rain-001',now()-interval '1 hour',42.5,true FROM data_sources WHERE provider_key='synthetic'
  ON CONFLICT(source_id,provider_record_key) DO NOTHING;
  INSERT INTO risk_assessments(zone_id,score,category,model_version,feature_values,feature_contributions,is_synthetic)
  SELECT id,score,category::risk_category,'illustrative-v1',
    '{"rainfall":70,"history":55,"slope":35,"drainage":60,"incidents":50}'::jsonb,
    '{"rainfall":24.5,"history":11,"slope":5.25,"drainage":9,"incidents":7.5}'::jsonb,true
  FROM (VALUES ('Shivajinagar',57,'HIGH'),('Kothrud',33,'MODERATE'),('Hadapsar',78,'CRITICAL')) AS v(name,score,category)
  JOIN zones z ON z.name=v.name
  WHERE NOT EXISTS (SELECT 1 FROM risk_assessments r WHERE r.zone_id=z.id);
  INSERT INTO incidents(title,description,category,severity,status,location,is_synthetic)
  SELECT v.title,v.description,v.category,v.severity::risk_category,'PENDING_VERIFICATION'::incident_status,
    ST_SetSRID(ST_MakePoint(v.lon,v.lat),4326)::geography,true
  FROM (VALUES
    ('Demo waterlogging near station','Synthetic sample report for local demonstration.','WATERLOGGING','HIGH',73.8567,18.5204),
    ('Demo blocked storm drain','Synthetic sample report for local demonstration.','DRAINAGE','MODERATE',73.8077,18.5074)
  ) AS v(title,description,category,severity,lon,lat)
  WHERE NOT EXISTS (SELECT 1 FROM incidents i WHERE i.title=v.title);
  UPDATE incidents i SET zone_id=z.id FROM zones z
  WHERE i.zone_id IS NULL AND ST_Covers(z.boundary,i.location::geometry);
  INSERT INTO incident_events(incident_id,event_type,details)
  SELECT i.id,'SUBMITTED','{"source":"synthetic-seed"}'::jsonb
  FROM incidents i
  WHERE i.is_synthetic AND NOT EXISTS (SELECT 1 FROM incident_events e WHERE e.incident_id=i.id);
  INSERT INTO road_segments(from_node,to_node,name,distance_m,risk_score,path,is_synthetic)
  SELECT v.from_node,v.to_node,v.name,v.distance_m,v.risk_score,ST_GeomFromText(v.wkt,4326),true
  FROM (VALUES
    ('junction-a','junction-b','Demo Central Road',900,28,'LINESTRING(73.84 18.50,73.85 18.51)'),
    ('junction-b','junction-c','Demo Riverside Road',1100,72,'LINESTRING(73.85 18.51,73.87 18.52)'),
    ('junction-a','junction-c','Demo Bypass Road',1700,12,'LINESTRING(73.84 18.50,73.86 18.52)'),
    ('junction-c','junction-d','Demo Station Road',800,20,'LINESTRING(73.86 18.52,73.87 18.53)')
  ) AS v(from_node,to_node,name,distance_m,risk_score,wkt)
  WHERE NOT EXISTS (SELECT 1 FROM road_segments r WHERE r.name=v.name);
  INSERT INTO response_teams(name,capabilities,is_available,location,is_synthetic)
  SELECT 'Demo Response Team',ARRAY['WATER_RESCUE','TRAFFIC_CONTROL'],true,
    ST_SetSRID(ST_MakePoint(73.8567,18.5204),4326)::geography,true
  WHERE NOT EXISTS (SELECT 1 FROM response_teams WHERE name='Demo Response Team');
`);
console.log('Seed complete. Local-only demo password for all three accounts: MonsoonDemo!2026');
await pool.end();
