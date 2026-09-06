import { describe, it, expect, beforeAll } from 'vitest';
import { pool, withTransaction } from '../db/pool.js';
import { randomUUID } from 'crypto';
import {
  recordEmployeeAdvance,
  removeEmployeeAdvance,
  getEmployeeAdvances,
  getUnadjustedAdvances
} from '../services/employeeService.js';
import { upsertAttendanceRecord } from '../repositories/attendanceRepository.js';
import { generatePayrollRun, finalizeRun } from '../services/payrollService.js';

describe('Feature: Employee Advance Payment Removal & Finalized Payroll Protection', () => {
  let tenantId;
  let adminUserId;
  let employeeId;
  let mockContext;
  let requestMeta;

  beforeAll(async () => {
    tenantId = randomUUID();
    adminUserId = randomUUID();
    employeeId = randomUUID();

    mockContext = {
      tenantId,
      userId: adminUserId,
      role: 'TenantAdmin'
    };

    requestMeta = {
      ipAddress: '127.0.0.1'
    };

    await withTransaction(async (connection) => {
      // Seed tenant
      await connection.execute(
        `INSERT INTO tenants (id, business_name, subscription_plan, status)
         VALUES (?, 'Advance Test Contractor', 'pro', 'active')`,
        [tenantId]
      );

      // Seed admin user
      await connection.execute(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, '$2b$10$abcdefghijklmnopqrstuu', 'Test Admin', 'TenantAdmin', true)`,
        [adminUserId, tenantId, `admin-${tenantId.slice(0, 8)}@example.com`]
      );

      // Seed employee
      await connection.execute(
        `INSERT INTO employees (id, tenant_id, name, wage_type, wage_rate, is_active)
         VALUES (?, ?, 'Ramesh Kumar (Plywood Worker)', 'daily', 800, true)`,
        [employeeId, tenantId]
      );
    });
  });

  it('1. Creates an advance and removes it before any payroll run — confirms hard delete and audit log', async () => {
    // Record advance
    const advance = await recordEmployeeAdvance(
      mockContext,
      employeeId,
      {
        amount: 3500,
        advanceDate: '2026-03-10',
        notes: 'Festival advance for Holi'
      },
      requestMeta
    );

    expect(advance.id).toBeDefined();
    expect(advance.amount).toBe(3500);
    expect(advance.status).toBe('unadjusted');

    // Verify it appears in unadjusted list
    const unadjustedBefore = await getUnadjustedAdvances(mockContext);
    expect(unadjustedBefore.some((a) => a.id === advance.id)).toBe(true);

    // Remove advance before any payroll run touches it
    const removeResult = await removeEmployeeAdvance(
      mockContext,
      employeeId,
      advance.id,
      requestMeta
    );

    expect(removeResult.success).toBe(true);
    expect(removeResult.removedAdvanceId).toBe(advance.id);

    // Verify it is hard-deleted from DB
    const listAfter = await getEmployeeAdvances(mockContext, employeeId);
    expect(listAfter.some((a) => a.id === advance.id)).toBe(false);

    const unadjustedAfter = await getUnadjustedAdvances(mockContext);
    expect(unadjustedAfter.some((a) => a.id === advance.id)).toBe(false);

    // Verify audit log entry
    await withTransaction(async (connection) => {
      const [logs] = await connection.execute(
        `SELECT * FROM audit_logs WHERE tenant_id = ? AND action = 'employee.advance_remove' AND entity_id = ?`,
        [tenantId, advance.id]
      );
      expect(logs.length).toBe(1);
      expect(logs[0].user_id).toBe(adminUserId);
      const rawMeta = logs[0].metadata_json || logs[0].metadata;
      const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : (rawMeta || {});
      expect(meta.employeeId).toBe(employeeId);
      expect(Number(meta.amount)).toBe(3500);
    });
  });

  it('2. Blocks removal of an advance that has been applied in a FINALIZED payroll run', async () => {
    // Record advance for March 2026
    const advance = await recordEmployeeAdvance(
      mockContext,
      employeeId,
      {
        amount: 2000,
        advanceDate: '2026-03-05',
        notes: 'Tool repair advance'
      },
      requestMeta
    );

    // Seed attendance for March 2026 so payroll has line items
    await withTransaction(async (conn) => {
      await upsertAttendanceRecord(conn, tenantId, employeeId, '2026-03-01', 'present', 'Work day', adminUserId);
    });

    // Generate payroll run for March 2026 (applies unadjusted advance)
    const runResult = await generatePayrollRun(mockContext, 2026, 3, requestMeta);
    const runId = runResult.run.id;

    // Finalize the payroll run
    await finalizeRun(mockContext, runId, requestMeta);

    // Attempt to remove the applied advance — MUST BE BLOCKED
    await expect(
      removeEmployeeAdvance(mockContext, employeeId, advance.id, requestMeta)
    ).rejects.toThrow(/already applied in the March 2026 payroll run/i);

    // Verify advance record remains intact in DB
    const advances = await getEmployeeAdvances(mockContext, employeeId);
    const existingAdv = advances.find((a) => a.id === advance.id);
    expect(existingAdv).toBeDefined();
    expect(existingAdv.status).toBe('adjusted');
    expect(existingAdv.adjustedInRunId).toBe(runId);
  });

  it('3. Enforces strict multi-tenant isolation on advance removal', async () => {
    const otherTenantId = randomUUID();
    const otherContext = {
      tenantId: otherTenantId,
      userId: randomUUID(),
      role: 'TenantAdmin'
    };

    // Create advance under tenant A
    const advance = await recordEmployeeAdvance(
      mockContext,
      employeeId,
      {
        amount: 1200,
        advanceDate: '2026-04-01',
        notes: 'Advance for April'
      },
      requestMeta
    );

    // Tenant B attempts to remove Tenant A's advance — MUST THROW 404
    await expect(
      removeEmployeeAdvance(otherContext, employeeId, advance.id, requestMeta)
    ).rejects.toThrow(/Advance payment record not found/i);
  });
});
