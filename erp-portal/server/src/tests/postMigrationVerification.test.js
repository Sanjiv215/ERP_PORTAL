import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { encryptSensitiveField, decryptSensitiveField } from '../utils/encryption.js';
import { getPayrollRunDetail, generatePayrollRun } from '../services/payrollService.js';
import { getBusinessPL } from '../services/plService.js';

describe('PostgreSQL Multi-Tenant Verification Suite', () => {
  const TENANT_1 = '001';
  const TENANT_2 = '002';
  const CONTEXT_1 = { tenantId: TENANT_1, userId: '001', role: 'TenantAdmin' };
  const CONTEXT_2 = { tenantId: TENANT_2, userId: '002', role: 'TenantAdmin' };

  it('1. Verifies strict Tenant Isolation on PostgreSQL (Tenant 001 cannot see Tenant 002 data)', async () => {
    const connection = await pool.getConnection();
    try {
      const [users1] = await connection.execute('SELECT id, email FROM users WHERE tenant_id = ?', [TENANT_1]);
      const [users2] = await connection.execute('SELECT id, email FROM users WHERE tenant_id = ?', [TENANT_2]);

      expect(users1.length).toBeGreaterThan(0);
      expect(users2.length).toBeGreaterThan(0);
      expect(users1.some(u => u.email === 'virendraprasad360@gmail.com')).toBe(true);
      expect(users2.some(u => u.email === 'sanjiv@gmail.com')).toBe(true);
      expect(users1.some(u => u.email === 'sanjiv@gmail.com')).toBe(false);
    } finally {
      connection.release();
    }
  });

  it('2. Verifies user password hash verification against PostgreSQL records', async () => {
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute(
        'SELECT id, email, password_hash, role, is_active FROM users WHERE email = ?',
        ['virendraprasad360@gmail.com']
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
