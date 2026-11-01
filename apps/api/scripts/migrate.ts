import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = path.resolve(here, '../../../database/migrations');
await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
)`);
for (const filename of (await fs.readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
  const present = await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1', [filename]);
  if (present.rowCount) continue;
  const sql = await fs.readFile(path.join(migrations, filename), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`Applied ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
await pool.end();
