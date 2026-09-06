import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

import { env } from '../config/env.js';

async function resetAndSeed() {
  console.log('Connecting to PostgreSQL database to truncate data...');
  const clientConfig = env.DATABASE_URL
    ? {
        connectionString: env.DATABASE_URL,
        ssl: env.PG_SSL ? { rejectUnauthorized: false } : undefined
      }
    : {
        host: env.PG_HOST || '127.0.0.1',
        port: Number(env.PG_PORT) || 5432,
        user: env.PG_USER || 'postgres',
        password: env.PG_PASSWORD || '',
        database: env.PG_DATABASE || 'erp_portal',
        ssl: env.PG_SSL ? { rejectUnauthorized: false } : undefined
      };

  const client = new Client(clientConfig);
  await client.connect();

  try {
    console.log('1. Truncating all existing application tables...');
    await client.query(`
      TRUNCATE TABLE
        tenants,
        users,
        refresh_tokens,
        password_reset_tokens,
        support_access_grants,
        audit_logs,
        projects,
        employees,
        employee_project_assignments,
        attendance_records,
        payroll_settings,
        payroll_runs,
        payroll_line_items,
        employee_advances,
        payout_transactions,
        income_entries,
        expense_entries,
        bills,
        quotations,
        invoices,
        document_sequences,
        meetings,
        meeting_attendees,
        meeting_notes,
        webhook_events
      CASCADE;
    `);
    console.log('✓ All application tables truncated successfully.');

    console.log('2. Ensuring system roles are present...');
    await client.query(`
      INSERT INTO roles (name)
      VALUES ('PlatformSuperAdmin'), ('TenantAdmin'), ('Manager'), ('Accountant'), ('Employee')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('===============================================================');
    console.log('✓ SUCCESS: Database truncated and reset to a clean, empty state.');
    console.log('  All application tables are empty. System roles initialized.');
    console.log('===============================================================');
  } finally {
    await client.end();
  }
}

resetAndSeed().catch((err) => {
  console.error('Reset database failed:', err);
  process.exit(1);
});
