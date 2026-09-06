import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../db/pool.js';
import { ROLES } from '../constants/roles.js';
import {
  createTenantEmployee,
  updateTenantEmployee,
  changeEmployeeActiveStatus,
  recordEmployeeAdvance,
  listEmployees,
  removeEmployee
} from '../services/employeeService.js';
import {
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToInvoice,
  createInvoice,
  deleteInvoice,
  updateInvoiceStatus
} from '../services/billingService.js';
import { markDailyAttendance, getMonthGrid } from '../services/attendanceService.js';
import { AppError } from '../middleware/errorHandler.js';

describe('Three Modifications: Deletions, Retention & Attendance Cleanup', () => {
  let tenantId;
  let adminContext;
  let managerContext;
  let requestMeta;

  beforeAll(async () => {
    tenantId = randomUUID();
    const adminId = randomUUID();
    const managerId = randomUUID();

    adminContext = { tenantId, userId: adminId, role: ROLES.TENANT_ADMIN };
    managerContext = { tenantId, userId: managerId, role: ROLES.MANAGER };
    requestMeta = { ipAddress: '127.0.0.1' };

    // Insert dummy tenant and users in DB for foreign keys
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO tenants (id, business_name, subscription_plan, status) VALUES (?, 'Test Business', 'trial', 'active')`,
        [tenantId]
      );
      await conn.execute(
        `INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES (?, ?, 'Admin', ?, 'hash', 'TenantAdmin')`,
        [adminId, tenantId, `admin-${randomUUID()}@test.com`]
      );
      await conn.execute(
        `INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES (?, ?, 'Manager', ?, 'hash', 'Manager')`,
        [managerId, tenantId, `mgr-${randomUUID()}@test.com`]
      );
    });
  });

  describe('FEATURE 1 — Employee Removal & Historical Retention', () => {
    it('soft deletes employee as TenantAdmin and verifies active list exclusion vs includeRemoved toggle', async () => {
      const emp = await createTenantEmployee(
        adminContext,
        { name: 'Emp To Remove', wageType: 'daily', wageRate: 500 },
        requestMeta
      );

      // Verify present in active list
      let activeList = await listEmployees(adminContext, false);
      expect(activeList.some((e) => e.id === emp.id)).toBe(true);

      // Soft delete employee
      const removedEmp = await removeEmployee(adminContext, emp.id, requestMeta);
      expect(removedEmp.isRemoved).toBe(true);
      expect(removedEmp.isActive).toBe(false);
      expect(removedEmp.removedAt).not.toBeNull();

      // Verify excluded from default list
      activeList = await listEmployees(adminContext, false);
      expect(activeList.some((e) => e.id === emp.id)).toBe(false);

      // Verify included when includeRemoved = true
      const allList = await listEmployees(adminContext, true);
      const found = allList.find((e) => e.id === emp.id);
      expect(found).toBeDefined();
      expect(found.isRemoved).toBe(true);
    });

    it('preserves historical attendance records after employee removal', async () => {
      const emp = await createTenantEmployee(
        adminContext,
        { name: 'Hist Emp', wageType: 'daily', wageRate: 600 },
        requestMeta
      );

      // Mark attendance
      await markDailyAttendance(
        adminContext,
        { workDate: '2026-08-20', records: [{ employeeId: emp.id, status: 'present' }] },
        requestMeta
      );

      // Remove employee
      await removeEmployee(adminContext, emp.id, requestMeta);

      // Attendance grid for August 2026 excludes removed employee from current grid
      const grid = await getMonthGrid(adminContext, 2026, 8);
      expect(grid.employees.some((e) => e.id === emp.id)).toBe(false);

      // Verify attendance record still exists in DB
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(
          `SELECT * FROM attendance_records WHERE tenant_id = ? AND employee_id = ?`,
          [tenantId, emp.id]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].status).toBe('present');
      } finally {
        conn.release();
      }
    });

    it('records audit log for employee removal', async () => {
      const emp = await createTenantEmployee(
        adminContext,
        { name: 'Audit Emp', wageType: 'daily', wageRate: 700 },
        requestMeta
      );

      await removeEmployee(adminContext, emp.id, requestMeta);

      const conn = await pool.getConnection();
      try {
        const [logs] = await conn.execute(
          `SELECT * FROM audit_logs WHERE tenant_id = ? AND action = 'employee.remove' AND entity_id = ?`,
          [tenantId, emp.id]
        );
        expect(logs.length).toBe(1);
        expect(logs[0].entity).toBe('employee');
      } finally {
        conn.release();
      }
    });
  });

  describe('FEATURE 2 — Attendance Individual Marking', () => {
    it('confirms per-employee attendance marking works for all status types', async () => {
      const emp = await createTenantEmployee(
        adminContext,
        { name: 'Attendance Test Emp', wageType: 'daily', wageRate: 800 },
        requestMeta
      );

      const statuses = ['present', 'half_day', 'overtime', 'absent', 'leave'];
      for (let i = 0; i < statuses.length; i++) {
        const dateStr = `2026-08-${String(i + 1).padStart(2, '0')}`;
        await markDailyAttendance(
          adminContext,
          { workDate: dateStr, records: [{ employeeId: emp.id, status: statuses[i] }] },
          requestMeta
        );
      }

      const grid = await getMonthGrid(adminContext, 2026, 8);
      const empAtt = grid.attendance[emp.id];
      expect(empAtt['2026-08-01'].status).toBe('present');
      expect(empAtt['2026-08-02'].status).toBe('half_day');
      expect(empAtt['2026-08-03'].status).toBe('overtime');
      expect(empAtt['2026-08-04'].status).toBe('absent');
      expect(empAtt['2026-08-05'].status).toBe('leave');
    });
  });

  describe('FEATURE 3 — Delete Quotation & Invoice', () => {
    it('deletes draft quotation and audit logs action', async () => {
      const q = await createQuotation(
        adminContext,
        {
          clientName: 'Draft Client',
          quotationDate: '2026-08-01',
          lineItems: [{ description: 'Wood frame', qty: 1, unitPrice: 1000, amount: 1000 }]
        },
        requestMeta
      );

      const result = await deleteQuotation(adminContext, q.id, requestMeta);
      expect(result.id).toBe(q.id);

      const conn = await pool.getConnection();
      try {
        const [logs] = await conn.execute(
          `SELECT * FROM audit_logs WHERE tenant_id = ? AND action = 'quotation.delete' AND entity_id = ?`,
          [tenantId, q.id]
        );
        expect(logs.length).toBe(1);
      } finally {
        conn.release();
      }
    });

    it('blocks deletion of quotation converted to an invoice', async () => {
      const q = await createQuotation(
        adminContext,
        {
          clientName: 'Converted Client',
          quotationDate: '2026-08-01',
          lineItems: [{ description: 'Custom Cabinet', qty: 2, unitPrice: 5000, amount: 10000 }]
        },
        requestMeta
      );

      // Convert quotation to invoice
      await convertQuotationToInvoice(adminContext, q.id, requestMeta);

      // Attempt to delete converted quotation
      await expect(deleteQuotation(adminContext, q.id, requestMeta)).rejects.toThrow(
        'This quotation has been converted to an invoice and cannot be deleted'
      );
    });

    it('deletes draft invoice with 0 payments and audit logs action', async () => {
      const inv = await createInvoice(
        adminContext,
        {
          clientName: 'Draft Invoice Client',
          invoiceDate: '2026-08-01',
          lineItems: [{ description: 'Carpentry Services', qty: 1, unitPrice: 1500, amount: 1500 }]
        },
        requestMeta
      );

      const result = await deleteInvoice(adminContext, inv.id, requestMeta);
      expect(result.id).toBe(inv.id);

      const conn = await pool.getConnection();
      try {
        const [logs] = await conn.execute(
          `SELECT * FROM audit_logs WHERE tenant_id = ? AND action = 'invoice.delete' AND entity_id = ?`,
          [tenantId, inv.id]
        );
        expect(logs.length).toBe(1);
      } finally {
        conn.release();
      }
    });

    it('blocks deletion of invoice with payment history (paid or partial status)', async () => {
      const inv = await createInvoice(
        adminContext,
        {
          clientName: 'Paid Invoice Client',
          invoiceDate: '2026-08-01',
          lineItems: [{ description: 'Timber Installation', qty: 1, unitPrice: 8000, amount: 8000 }]
        },
        requestMeta
      );

      // Mark invoice paid
      await updateInvoiceStatus(adminContext, inv.id, { status: 'paid', paidAmount: 8000 }, requestMeta);

      // Attempt to delete paid invoice
      await expect(deleteInvoice(adminContext, inv.id, requestMeta)).rejects.toThrow(
        'Invoices with payment history cannot be deleted. Use Cancel/Void status instead.'
      );
    });

    it('blocks update, status toggle, or cash advance attempts on a soft-deleted employee', async () => {
      const emp = await createTenantEmployee(
        adminContext,
        { name: 'Emp To Soft Delete Guard Test', wageType: 'daily', wageRate: 500 },
        requestMeta
      );

      await removeEmployee(adminContext, emp.id, requestMeta);

      // Attempting to update employee details
      await expect(
        updateTenantEmployee(adminContext, emp.id, { name: 'Updated Name' }, requestMeta)
      ).rejects.toThrow('Employee not found');

      // Attempting to change active status
      await expect(
        changeEmployeeActiveStatus(adminContext, emp.id, { isActive: true }, requestMeta)
      ).rejects.toThrow('Employee not found');

      // Attempting to record cash advance
      await expect(
        recordEmployeeAdvance(adminContext, emp.id, { amount: 1000, advanceDate: '2026-08-20' }, requestMeta)
      ).rejects.toThrow('Employee not found');
    });

    it('blocks update or conversion attempts on a soft-deleted quotation or invoice', async () => {
      const q = await createQuotation(
        adminContext,
        {
          clientName: 'Soft Deleted Quote Client',
          quotationDate: '2026-08-01',
          lineItems: [{ description: 'Item 1', qty: 1, unitPrice: 500, amount: 500 }]
        },
        requestMeta
      );

      await deleteQuotation(adminContext, q.id, requestMeta);

      await expect(
        updateQuotation(adminContext, q.id, { clientName: 'New Name' }, requestMeta)
      ).rejects.toThrow('Quotation not found');

      await expect(
        convertQuotationToInvoice(adminContext, q.id, requestMeta)
      ).rejects.toThrow('Quotation not found');

      const inv = await createInvoice(
        adminContext,
        {
          clientName: 'Soft Deleted Inv Client',
          invoiceDate: '2026-08-01',
          lineItems: [{ description: 'Item 1', qty: 1, unitPrice: 500, amount: 500 }]
        },
        requestMeta
      );

      await deleteInvoice(adminContext, inv.id, requestMeta);

      await expect(
        updateInvoiceStatus(adminContext, inv.id, { status: 'paid' }, requestMeta)
      ).rejects.toThrow('Invoice not found');
    });
  });
});
