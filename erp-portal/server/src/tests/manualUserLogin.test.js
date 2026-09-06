import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { loginWithPassword } from '../services/authService.js';
import { verifyAccessToken } from '../utils/tokens.js';

describe('Manual DB Insert & Authentication Flow', () => {
  it('successfully authenticates a manually-inserted user with bcrypt cost factor 12', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const email = `manual_admin_${Date.now()}@erpportal.com`;
    const plainPassword = 'ManualPassword2026!';
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const connection = await pool.getConnection();
    try {
      // 1. Insert tenant manually into database
      await connection.execute(
        `INSERT INTO tenants (id, business_name, gst_number, status)
         VALUES (?, 'ERP Portal Manual Test Tenant', ?, 'active')`,
        [tenantId, `29ABCDE${Date.now().toString().slice(-4)}Z5`]
      );

      // 2. Insert user manually into database
      await connection.execute(
        `INSERT INTO users (id, tenant_id, name, email, phone, password_hash, role, is_active)
         VALUES (?, ?, 'Manual Admin User', ?, '9876543210', ?, 'TenantAdmin', true)`,
        [userId, tenantId, email, passwordHash]
      );

      // 3. Authenticate via loginWithPassword service / endpoint
      const result = await loginWithPassword(
        { email, password: plainPassword },
        { ipAddress: '127.0.0.1' }
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(userId);
      expect(result.user.tenantId).toBe(tenantId);
      expect(result.user.role).toBe('TenantAdmin');
      expect(result.user.email).toBe(email);

      // 4. Verify decoded access token payload contains proper tenant scoping
      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded.user_id).toBe(userId);
      expect(decoded.tenant_id).toBe(tenantId);
      expect(decoded.role).toBe('TenantAdmin');

      // Cleanup
      await connection.execute(`DELETE FROM audit_logs WHERE user_id = ?`, [userId]);
      await connection.execute(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);
      await connection.execute(`DELETE FROM users WHERE id = ?`, [userId]);
      await connection.execute(`DELETE FROM tenants WHERE id = ?`, [tenantId]);
    } finally {
      connection.release();
    }
  });
});
