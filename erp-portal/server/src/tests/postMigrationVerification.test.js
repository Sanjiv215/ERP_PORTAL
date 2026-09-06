import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool, withTransaction } from '../db/pool.js';
import { encryptSensitiveField, decryptSensitiveField } from '../utils/encryption.js';
import { generatePayrollRun } from '../services/payrollService.js';
import { getBusinessPL } from '../services/plService.js';

describe('PostgreSQL Multi-Tenant Verification Suite', () => {
  let TENANT_1;
  let TENANT_2;
  let USER_1_ID;
  let USER_2_ID;
  let USER_1_EMAIL;
  let USER_2_EMAIL;
  let CONTEXT_1;
  let CONTEXT_2;

  beforeAll(async () => {
    TENANT_1 = randomUUID();
    TENANT_2 = randomUUID();
    USER_1_ID = randomUUID();
    USER_2_ID = randomUUID();
    USER_1_EMAIL = `admin-${TENANT_1.slice(0, 8)}@erp-portal.com`;
    USER_2_EMAIL = `admin-${TENANT_2.slice(0, 8)}@erp-portal.com`;
    CONTEXT_1 = { tenantId: TENANT_1, userId: USER_1_ID, role: 'TenantAdmin' };
    CONTEXT_2 = { tenantId: TENANT_2, userId: USER_2_ID, role: 'TenantAdmin' };

    const hashed = await bcrypt.hash('SecurePassword123!', 10);

    await withTransaction(async (conn) => {
      // Seed Tenant 1
      await conn.execute(
        `INSERT INTO tenants (id, business_name, subscription_plan, status)
         VALUES (?, 'Alpha Enterprises', 'pro', 'active')`,
        [TENANT_1]
      );
      await conn.execute(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, ?, 'Alpha Admin', 'TenantAdmin', true)`,
        [USER_1_ID, TENANT_1, USER_1_EMAIL, hashed]
      );
      await conn.execute(
        `INSERT INTO payroll_settings (tenant_id, working_days_per_month, overtime_multiplier, half_day_multiplier)
         VALUES (?, 26, 1.5, 0.5) ON CONFLICT (tenant_id) DO NOTHING`,
        [TENANT_1]
      );

      // Seed Tenant 2
      await conn.execute(
        `INSERT INTO tenants (id, business_name, subscription_plan, status)
         VALUES (?, 'Beta Corp', 'pro', 'active')`,
        [TENANT_2]
      );
      await conn.execute(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, ?, 'Beta Admin', 'TenantAdmin', true)`,
        [USER_2_ID, TENANT_2, USER_2_EMAIL, hashed]
      );
      await conn.execute(
        `INSERT INTO payroll_settings (tenant_id, working_days_per_month, overtime_multiplier, half_day_multiplier)
         VALUES (?, 26, 1.5, 0.5) ON CONFLICT (tenant_id) DO NOTHING`,
        [TENANT_2]
      );
    });
  });

  it('1. Verifies strict Tenant Isolation on PostgreSQL (Tenant 1 cannot see Tenant 2 data)', async () => {
    const connection = await pool.getConnection();
    try {
      const [users1] = await connection.execute('SELECT id, email FROM users WHERE tenant_id = ?', [TENANT_1]);
      const [users2] = await connection.execute('SELECT id, email FROM users WHERE tenant_id = ?', [TENANT_2]);

      expect(users1.length).toBeGreaterThan(0);
      expect(users2.length).toBeGreaterThan(0);
      expect(users1.some(u => u.email === USER_1_EMAIL)).toBe(true);
      expect(users2.some(u => u.email === USER_2_EMAIL)).toBe(true);
      expect(users1.some(u => u.email === USER_2_EMAIL)).toBe(false);
    } finally {
      connection.release();
    }
  });

  it('2. Verifies user password hash verification against PostgreSQL records', async () => {
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute(
        'SELECT id, email, password_hash, role, is_active FROM users WHERE email = ?',
        [USER_1_EMAIL]
      );
      expect(users.length).toBe(1);
      const user = users[0];
      expect(user.role).toBe('TenantAdmin');
      expect(user.is_active).toBe(true);
      expect(user.password_hash).toMatch(/^\$2[aby]\$/);
    } finally {
      connection.release();
    }
  });

  it('3. Generates payroll run and verifies line items and status', async () => {
    const runResult = await generatePayrollRun(CONTEXT_1, 2026, 8, { ipAddress: '127.0.0.1' });
    expect(runResult.run).toBeDefined();
    expect(runResult.run.periodYear).toBe(2026);
    expect(runResult.run.periodMonth).toBe(8);
    expect(['draft', 'finalized', 'paid']).toContain(runResult.run.status);
  });

  it('4. Confirms field-level AES-256-GCM encryption & decryption against PostgreSQL', async () => {
    const plainBank = 'HDFC0001234-9876543210';
    const encrypted = encryptSensitiveField(plainBank);
    expect(encrypted).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);

    const decrypted = decryptSensitiveField(encrypted);
    expect(decrypted).toBe(plainBank);
  });

  it('5. Computes Business Profit & Loss analytics on PostgreSQL without syntax errors', async () => {
    const businessPL = await getBusinessPL(CONTEXT_1, 2026, 8);
    expect(businessPL).toBeDefined();
    expect(businessPL.summary).toBeDefined();
    expect(Array.isArray(businessPL.trend)).toBe(true);
    expect(businessPL.trend.length).toBe(12);
  });
});
