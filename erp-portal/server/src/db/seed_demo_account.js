import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

async function seedDemoAccount() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in .env');
  }

  console.log('Connecting to PostgreSQL database to create separate demo account...');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const tenantId = '002';
    const userId = '002';
    const email = 'sanjiv@gmail.com';
    const passwordPlain = process.env.DEMO_ACCOUNT_PASSWORD || randomBytes(16).toString('hex');
    const name = 'sanjiv';
    const role = 'TenantAdmin'; // Admin for the demo workspace to allow demonstrating all features

    console.log('1. Creating isolated demo Tenant (id: 002)...');
    await client.query(
      `INSERT INTO tenants (id, business_name, gst_number, subscription_plan, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET 
         business_name = EXCLUDED.business_name,
         status = EXCLUDED.status`,
      [tenantId, 'TheWoodWise', '29DEMO1234F1Z9', 'trial', 'active']
    );

    console.log('2. Hashing password and creating Demo User (002)...');
    const passwordHash = await bcrypt.hash(passwordPlain, BCRYPT_COST);

    await client.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active`,
      [userId, tenantId, name, email, passwordHash, role, true]
    );

    console.log('3. Initializing document sequences and settings for demo tenant...');
    const currentYear = new Date().getFullYear();
    await client.query(
      `INSERT INTO document_sequences (tenant_id, doc_type, year, last_seq)
       VALUES 
         ($1, 'quotation', $2, 0),
         ($1, 'invoice', $2, 0)
       ON CONFLICT (tenant_id, doc_type, year) DO NOTHING`,
      [tenantId, currentYear]
    );

    await client.query(
      `INSERT INTO payroll_settings (tenant_id, working_days_per_month, overtime_multiplier, half_day_multiplier)
       VALUES ($1, 26, 1.50, 0.50)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );

    console.log('===============================================================');
    console.log('✓ SUCCESS: Demo account created in an isolated workspace!');
    console.log('  User ID:    002');
    console.log('  Tenant ID:  002 (Demo Interiors & Carpentry)');
    console.log('  Name:       sanjiv');
    console.log('  Email:      sanjiv@gmail.com');
    console.log('  Role:       TenantAdmin (Full Demo Privileges)');
    console.log('  Status:     Active (true)');
    console.log('===============================================================');

    const res = await client.query('SELECT id, tenant_id, name, email, role, is_active FROM users;');
    console.log('All Users in DB:');
    console.table(res.rows);

  } finally {
    await client.end();
  }
}

seedDemoAccount().catch((err) => {
  console.error('Demo account creation failed:', err);
  process.exit(1);
});
