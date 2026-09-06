import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';
const { Pool } = pkg;
import { env } from '../config/env.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const isSslRequired = env.PG_SSL ?? (
  env.DATABASE_URL?.includes('render.com') ||
  (env.NODE_ENV === 'production' && !env.DATABASE_URL?.includes('127.0.0.1') && !env.DATABASE_URL?.includes('localhost'))
);

const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
    }
  : {
      host: env.PG_HOST || '127.0.0.1',
      port: Number(env.PG_PORT) || 5433,
      user: env.PG_USER || 'sanjiv',
      password: env.PG_PASSWORD || '',
      database: env.PG_DATABASE || 'contractoros',
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
    };

async function main() {
  console.log('Connecting to PostgreSQL database for migrations...');
  const pool = new Pool(poolConfig);
  const client = await pool.connect();

  try {
    // 1. Create schema_migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read and apply postgres_schema.sql if not applied
    const schemaFile = 'postgres_schema.sql';
    const migrationCheck = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [schemaFile]);

    if (migrationCheck.rows.length === 0) {
      console.log(`Applying PostgreSQL schema from ${schemaFile}...`);
      const schemaSql = await fs.readFile(path.join(dirname, schemaFile), 'utf8');
      await client.query(schemaSql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [schemaFile]);
      console.log(`✓ Schema ${schemaFile} applied successfully.`);
    } else {
      console.log(`✓ Database schema is already up to date (${schemaFile}).`);
    }

    // 3. Reconcile missing columns on existing tables
    console.log('Ensuring all table columns are up to date...');
    await client.query(`
      ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_info VARCHAR(255) NULL;
      ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NULL;
      ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS location_name VARCHAR(120) NULL;
      ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;
    `);
    console.log('✓ Column reconciliation completed.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
