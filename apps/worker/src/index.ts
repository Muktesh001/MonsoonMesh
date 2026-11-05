import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import pg from 'pg';
import { ingestAllWeatherData } from '../../../apps/api/src/services/weather-adapter.js';
import { assessZoneRisks } from '../../../apps/api/src/services/risk-data-adapter.js';

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  maxRetriesPerRequest: null,
};
const database = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://monsoonmesh:monsoonmesh@localhost:5432/monsoonmesh' });
const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const queue = new Queue('monsoonmesh-events', { connection });

const worker = new Worker('monsoonmesh-events', async (job) => {
  if (job.name === 'incident-analysis') {
    const response = await fetch(`${aiServiceUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job.data),
    });
    if (!response.ok) throw new Error(`AI service returned ${response.status}`);
    const recommendation: unknown = await response.json();
    await database.query(
      `INSERT INTO ai_recommendations(incident_id,status,recommendation,citations,uncertainty)
       VALUES($1,'PENDING_APPROVAL',$2,'[]'::jsonb,$3)`,
      [job.data.incident_id, JSON.stringify(recommendation), 'Local deterministic analysis; operator review required.'],
    );
    return { recommendationCreated: true };
  }
  if (job.name === 'fixture-ingestion') {
    const { rows } = await database.query(`SELECT id FROM data_sources WHERE provider_key='synthetic'`);
    if (!rows[0]) throw new Error('Synthetic fixture source is not configured');
    await database.query(
      `INSERT INTO ingestion_runs(source_id,status,started_at,completed_at,records_written,metadata)
       VALUES($1,'SUCCEEDED',now(),now(),1,'{"mode":"local-fixture"}'::jsonb)`,
      [rows[0].id],
    );
    return { fixtureRecorded: true };
  }
  if (job.name === 'ingest-weather-data') {
    const count = await ingestAllWeatherData();
    const { rows } = await database.query(`SELECT id FROM data_sources WHERE provider_key IN ('imd', 'nasa-gpm', 'openweather') LIMIT 1`);
    if (rows[0]) {
      await database.query(
        `INSERT INTO ingestion_runs(source_id,status,started_at,completed_at,records_written,metadata)
         VALUES($1,'SUCCEEDED',now(),now(),$2,'{"mode":"external-weather-feed"}'::jsonb)`,
        [rows[0].id, count],
      );
    }
    return { weatherRecordsIngested: count };
  }
  if (job.name === 'assess-external-risks') {
    const assessments = await assessZoneRisks();
    return { risksAssessed: assessments.length };
  }
  throw new Error(`Unsupported event type: ${job.name}`);
}, { connection, concurrency: 3 });

let stopping = false;
async function pollOutbox(): Promise<void> {
  while (!stopping) {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id,topic,payload FROM outbox_events WHERE published_at IS NULL
         ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED`,
      );
      for (const event of rows as { id: string; topic: string; payload: Record<string, unknown> }[]) {
        await queue.add(event.topic, event.payload, { jobId: event.id, attempts: 5, backoff: { type: 'exponential', delay: 1500 }, removeOnComplete: 1000 });
        await client.query('UPDATE outbox_events SET published_at=now() WHERE id=$1', [event.id]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Outbox poll failed:', error);
    } finally { client.release(); }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

console.log('MonsoonMesh worker started');
void pollOutbox();

// Schedule periodic data ingestion jobs
async function schedulePeriodicJobs(): Promise<void> {
  // Ingest weather data every 5 minutes
  setInterval(() => {
    void queue.add('ingest-weather-data', {}, { 
      repeat: { every: 300_000 }, // 5 minutes
      jobId: 'weather-ingestion-recurring',
      removeOnComplete: 5000,
    });
  }, 300_000);

  // Assess risks every 10 minutes
  setInterval(() => {
    void queue.add('assess-external-risks', {}, { 
      repeat: { every: 600_000 }, // 10 minutes
      jobId: 'risk-assessment-recurring',
      removeOnComplete: 5000,
    });
  }, 600_000);

  console.log('Periodic jobs scheduled: weather ingestion (5m), risk assessment (10m)');
}

void schedulePeriodicJobs();
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received; closing worker`);
  await worker.close();
  await queue.close();
  await database.end();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
