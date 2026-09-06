import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

async function resetAndSeed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in .env');
  }

  console.log('Connecting to PostgreSQL database to truncate data and seed new admin...');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

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

    console.log('3. Creating new Tenant (id: 001)...');
    await client.query(
      `INSERT INTO tenants (id, business_name, gst_number, subscription_plan, status)
       VALUES ($1, $2, $3, $4, $5)`,
      ['001', 'TheWoodWise', '29ABCDE1234F1Z5', 'enterprise', 'active']
    );

    console.log('4. Hashing password and creating new Admin user (virendra)...');
    const passwordPlain = process.env.ADMIN_ACCOUNT_PASSWORD || randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(passwordPlain, BCRYPT_COST);

    await client.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        '001',
        '001',
        'virendra',
        'virendraprasad360@gmail.com',
        passwordHash,
        'TenantAdmin',
        true
      ]
    );

    console.log('5. Initializing default document sequences & payroll settings for tenant 001...');
    const currentYear = new Date().getFullYear();
    await client.query(
      `INSERT INTO document_sequences (tenant_id, doc_type, year, last_seq)
       VALUES 
         ('001', 'quotation', $1, 0),
         ('001', 'invoice', $1, 0)
       ON CONFLICT (tenant_id, doc_type, year) DO NOTHING`,
      [currentYear]
    );

    await client.query(
      `INSERT INTO payroll_settings (tenant_id, working_days_per_month, overtime_multiplier, half_day_multiplier)
       VALUES ('001', 26, 1.50, 0.50)
       ON CONFLICT (tenant_id) DO NOTHING`
    );

    console.log('===============================================================');
    console.log('✓ SUCCESS: Database truncated and new user seeded successfully!');
    console.log('  ID:        001');
    console.log('  Name:      virendra');
    console.log('  Email:     virendraprasad360@gmail.com');
    console.log('  Role:      TenantAdmin (Admin)');
    console.log('  Active:    true');
    console.log('===============================================================');

    // Verify user in DB
    const res = await client.query('SELECT id, name, email, role, is_active FROM users;');
    console.log('Current users in DB:');
    console.table(res.rows);

  } finally {
    await client.end();
  }
}

resetAndSeed().catch((err) => {
  console.error('Reset and seed failed:', err);
  process.exit(1);
});
