import { describe, it, expect, beforeAll } from 'vitest';
import { pool, withTransaction } from '../db/pool.js';
import { randomUUID } from 'crypto';
import {
  recordEmployeeAdvance,
  getAllAdvances,
  getEmployeeAdvances
} from '../services/employeeService.js';
import { upsertAttendanceRecord } from '../repositories/attendanceRepository.js';
import {
  generatePayrollRun,
  previewPayrollRun,
  finalizeRun,
  markLineItemPaid,
  regeneratePayrollRun,
  getPayrollRunDetail
} from '../services/payrollService.js';
import { getTransactions } from '../services/transactionService.js';

describe('Feature: Flexible Rolling Payroll Periods & Transaction History', () => {
  let tenantId;
  let adminUserId;
  let managerUserId;
  let employee1Id;
  let employee2Id;
  let projectId;
  let clientId;
  let invoiceId;
  let mockAdminContext;
  let mockManagerContext;
  let requestMeta;

  beforeAll(async () => {
    tenantId = randomUUID();
    adminUserId = randomUUID();
    managerUserId = randomUUID();
    employee1Id = randomUUID();
    employee2Id = randomUUID();
    projectId = randomUUID();
    clientId = randomUUID();
    invoiceId = randomUUID();

    mockAdminContext = {
      tenantId,
      userId: adminUserId,
      role: 'TenantAdmin'
    };

    mockManagerContext = {
      tenantId,
      userId: managerUserId,
      role: 'Manager'
    };

    requestMeta = {
      ipAddress: '127.0.0.1'
    };

    await withTransaction(async (connection) => {
      // Seed tenant
      await connection.execute(
        `INSERT INTO tenants (id, business_name, subscription_plan, status)
         VALUES (?, 'WoodWorks Rolling Periods Ltd', 'pro', 'active')`,
        [tenantId]
      );

      // Seed payroll settings
      await connection.execute(
        `INSERT INTO payroll_settings (tenant_id, working_days_per_month, overtime_multiplier, half_day_multiplier)
         VALUES (?, 26, 1.5, 0.5) ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId]
      );

      // Seed admin user
      await connection.execute(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, '$2b$10$abcdefghijklmnopqrstuu', 'Admin Boss', 'TenantAdmin', true)`,
        [adminUserId, tenantId, `admin-${tenantId.slice(0, 8)}@example.com`]
      );

      // Seed manager user
      await connection.execute(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, '$2b$10$abcdefghijklmnopqrstuu', 'Site Manager', 'Manager', true)`,
        [managerUserId, tenantId, `manager-${tenantId.slice(0, 8)}@example.com`]
      );

      // Seed employee 1 (Senior Carpenter)
      await connection.execute(
        `INSERT INTO employees (id, tenant_id, name, wage_type, wage_rate, is_active, created_at)
         VALUES (?, ?, 'Rajesh Carpenter', 'daily', 1000, true, '2026-01-01 00:00:00')`,
        [employee1Id, tenantId]
      );

      // Seed employee 2 (Junior Joiner)
      await connection.execute(
        `INSERT INTO employees (id, tenant_id, name, wage_type, wage_rate, is_active, created_at)
         VALUES (?, ?, 'Sunil Joiner', 'daily', 600, true, '2026-01-10 00:00:00')`,
        [employee2Id, tenantId]
      );

      // Seed project
      await connection.execute(
        `INSERT INTO projects (id, tenant_id, name, client_name, status)
         VALUES (?, ?, 'Penthouse Wood Interior', 'Villa Royal Client', 'active')`,
        [projectId, tenantId]
      );
    });
  });

  it('1. Computes rolling period start date as joining date or earliest attendance for first run', async () => {
    // Record attendance for employee 1 (2026-01-05 to 2026-01-10)
    for (let day = 5; day <= 10; day++) {
      const dateStr = `2026-01-${String(day).padStart(2, '0')}`;
      const conn = await pool.getConnection();
      try {
        await upsertAttendanceRecord(conn, tenantId, employee1Id, dateStr, 'present', null, adminUserId);
      } finally {
        conn.release();
      }
    }

    // Preview payroll run up to 2026-01-15
    const preview = await previewPayrollRun(mockAdminContext, {
      endDate: '2026-01-15'
    });

    expect(preview).toBeDefined();
    expect(preview.items.length).toBe(2);
    const emp1Item = preview.items.find((i) => i.employeeId === employee1Id);
    expect(emp1Item).toBeDefined();
    expect(emp1Item.periodStartDate).toBe('2026-01-05'); // Earliest attendance start date
    expect(emp1Item.periodEndDate).toBe('2026-01-15');
    expect(emp1Item.attendance.present).toBe(6);
    expect(emp1Item.grossAmount).toBe(6000); // 6 days * 1000
  });

  it('2. Scopes advance deduction strictly to active rolling period and flags older unadjusted advances', async () => {
    // Give Employee 1 an older advance on 2025-12-20 (prior to period start 2026-01-01)
    const oldAdv = await recordEmployeeAdvance(mockAdminContext, employee1Id, {
      amount: 1500,
      advanceDate: '2025-12-20',
      notes: 'Old December Advance',
      paymentMode: 'cash'
    }, requestMeta);

    // Give Employee 1 a current advance on 2026-01-08 (inside period 2026-01-01 to 2026-01-15)
    const currentAdv = await recordEmployeeAdvance(mockAdminContext, employee1Id, {
      amount: 2000,
      advanceDate: '2026-01-08',
      notes: 'Current Cycle Advance',
      paymentMode: 'upi'
    }, requestMeta);

    // Generate first payroll run for period ending 2026-01-15
    const runResult = await generatePayrollRun(mockAdminContext, {
      startDate: '2026-01-01',
      endDate: '2026-01-15'
    }, requestMeta);

    expect(runResult.run).toBeDefined();
    expect(runResult.run.periodStartDate).toBe('2026-01-01');
    expect(runResult.run.periodEndDate).toBe('2026-01-15');

    const emp1Line = runResult.lineItems.find((li) => li.employeeId === employee1Id);
    expect(emp1Line).toBeDefined();
    // Gross: 6000, Deductions: 2000 (only current advance inside 2026-01-01 to 2026-01-15)
    expect(emp1Line.grossAmount).toBe(6000);
    expect(emp1Line.netAmount).toBe(4000);

    // Check that older unadjusted advances are returned and flagged in detail view
    const detail = await getPayrollRunDetail(mockAdminContext, runResult.run.id);
    expect(detail.olderUnadjustedAdvances).toBeDefined();
    expect(detail.olderUnadjustedAdvances.length).toBeGreaterThanOrEqual(1);
    const flagged = detail.olderUnadjustedAdvances.find((a) => a.id === oldAdv.id);
    expect(flagged).toBeDefined();
    expect(Number(flagged.amount)).toBe(1500);

    // Finalize run 1 and mark line item paid
    await finalizeRun(mockAdminContext, runResult.run.id, requestMeta);
    await markLineItemPaid(mockAdminContext, emp1Line.id, requestMeta);
  });

  it('3. Auto-defaults next payroll run start date to previous run end date + 1 day per employee', async () => {
    // Record attendance for Employee 1 from 2026-01-16 to 2026-01-20 (5 days)
    for (let day = 16; day <= 20; day++) {
      const dateStr = `2026-01-${String(day).padStart(2, '0')}`;
      const conn = await pool.getConnection();
      try {
        await upsertAttendanceRecord(conn, tenantId, employee1Id, dateStr, 'present', null, adminUserId);
      } finally {
        conn.release();
      }
    }

    // Preview next run up to 2026-01-31 without passing startDate (testing auto-rolling start date)
    const preview = await previewPayrollRun(mockAdminContext, {
      endDate: '2026-01-31'
    });

    const emp1Preview = preview.items.find((i) => i.employeeId === employee1Id);
    expect(emp1Preview).toBeDefined();
    // Start date must be 2026-01-16 (day after previous run end date 2026-01-15)
    expect(emp1Preview.periodStartDate).toBe('2026-01-16');
    expect(emp1Preview.periodEndDate).toBe('2026-01-31');
    expect(emp1Preview.attendance.present).toBe(5);
    expect(emp1Preview.grossAmount).toBe(5000); // 5 days * 1000
  });

  it('4. Master Ledger: listAllAdvances queries all advances with filters and totals', async () => {
    const allAdvRes = await getAllAdvances(mockAdminContext, {
      employeeId: employee1Id
    });

    expect(allAdvRes.advances).toBeDefined();
    expect(allAdvRes.advances.length).toBeGreaterThanOrEqual(2);
    expect(allAdvRes.summary).toBeDefined();
    expect(Number(allAdvRes.summary.totalAmount)).toBeGreaterThanOrEqual(3500);
    // 2000 was adjusted in run 1, 1500 is still unadjusted
    expect(Number(allAdvRes.summary.totalAdjusted)).toBeGreaterThanOrEqual(2000);
    expect(Number(allAdvRes.summary.totalUnadjusted)).toBeGreaterThanOrEqual(1500);
  });

  it('5. Transaction Timeline: Aggregates client payments, payroll payouts, and advances with role security', async () => {
    // Record a client invoice payment
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO invoices (id, tenant_id, invoice_number, client_name, client_address, invoice_date, due_date, subtotal, gst_rate, tax_amount, total_amount, paid_amount, status, line_items_json, created_by)
         VALUES (?, ?, 'INV-2026-001', 'Villa Royal Client', '123 Main St', '2026-01-10', '2026-01-25', 50000, 0, 0, 50000, 20000, 'partial', '[]', ?)`,
        [invoiceId, tenantId, adminUserId]
      );
    });

    // 1. TenantAdmin views all transactions
    const adminTimeline = await getTransactions(mockAdminContext, {
      startDate: '2025-12-01',
      endDate: '2026-02-01'
    });

    expect(adminTimeline.items).toBeDefined();
    expect(adminTimeline.items.length).toBeGreaterThanOrEqual(3);

    // Verify summary totals
    expect(adminTimeline.summary).toBeDefined();
    expect(adminTimeline.summary.totalIn).toBe(20000);
    // Outflow: 3500 (two advances)
    expect(adminTimeline.summary.totalOut).toBeGreaterThanOrEqual(3500);

    // 2. Manager views transactions (strictly restricted: no payroll or advance salary transactions)
    const managerTimeline = await getTransactions(mockManagerContext, {
      startDate: '2025-12-01',
      endDate: '2026-02-01'
    });

    expect(managerTimeline.items).toBeDefined();
    // Must ONLY contain client payments, zero payroll or advance items
    const hasPayroll = managerTimeline.items.some((t) => t.type === 'payroll' || t.type === 'advance');
    expect(hasPayroll).toBe(false);
    expect(managerTimeline.items.every((t) => t.type === 'client_payment')).toBe(true);
  });
});

