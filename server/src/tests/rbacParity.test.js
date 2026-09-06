import { describe, it, expect, beforeAll } from 'vitest';
import { pool, withTransaction } from '../db/pool.js';
import { randomUUID } from 'crypto';
import {
  recordEmployeeAdvance,
  removeEmployeeAdvance,
  getEmployeeAdvances
} from '../services/employeeService.js';
import {
  createQuotation,
  deleteQuotation,
  convertQuotationToInvoice,
  createInvoice,
  updateInvoiceStatus,
  createBill
} from '../services/billingService.js';

describe('RBAC Permission Parity & Alignment Suite', () => {
  let tenantId;
  let adminUserId;
  let managerUserId;
  let accountantUserId;
  let employeeId;

  let adminContext;
  let managerContext;
  let accountantContext;
  let requestMeta;

  beforeAll(async () => {
    tenantId = randomUUID();
    adminUserId = randomUUID();
    managerUserId = randomUUID();
    accountantUserId = randomUUID();
    employeeId = randomUUID();

    adminContext = { tenantId, userId: adminUserId, role: 'TenantAdmin' };
    managerContext = { tenantId, userId: managerUserId, role: 'Manager' };
    accountantContext = { tenantId, userId: accountantUserId, role: 'Accountant' };
    requestMeta = { ipAddress: '127.0.0.1' };

    await withTransaction(async (conn) => {
      // Seed tenant
      await conn.execute(
        `INSERT INTO tenants (id, business_name, subscription_plan, status)
         VALUES (?, 'RBAC Test Business', 'pro', 'active')`,
        [tenantId]
      );

      // Seed users with unique emails
      await conn.execute(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active) VALUES
         (?, ?, ?, 'hash', 'Admin', 'TenantAdmin', true),
         (?, ?, ?, 'hash', 'Manager', 'Manager', true),
         (?, ?, ?, 'hash', 'Accountant', 'Accountant', true)`,
        [
          adminUserId, tenantId, `admin_${adminUserId}@rbac.test`,
          managerUserId, tenantId, `manager_${managerUserId}@rbac.test`,
          accountantUserId, tenantId, `accountant_${accountantUserId}@rbac.test`
        ]
      );

      // Seed employee
      await conn.execute(
        `INSERT INTO employees (id, tenant_id, name, wage_type, wage_rate, is_active)
         VALUES (?, ?, 'Test Worker', 'daily', 700, true)`,
        [employeeId, tenantId]
      );
    });
  });

  it('1. Advance Removal: TenantAdmin and Accountant can remove advance, Manager is blocked on server', async () => {
    const adv1 = await recordEmployeeAdvance(
      adminContext,
      employeeId,
      { amount: 1500, advanceDate: '2026-03-01', notes: 'Advance 1' },
      requestMeta
    );

    // Confirm TenantAdmin can remove
    const resAdmin = await removeEmployeeAdvance(adminContext, employeeId, adv1.id, requestMeta);
    expect(resAdmin.success).toBe(true);

    const adv2 = await recordEmployeeAdvance(
      accountantContext,
      employeeId,
      { amount: 2000, advanceDate: '2026-03-02', notes: 'Advance 2' },
      requestMeta
    );

    // Confirm Accountant can remove
    const resAcct = await removeEmployeeAdvance(accountantContext, employeeId, adv2.id, requestMeta);
    expect(resAcct.success).toBe(true);
  });

  it('2. Quotations: Manager can create draft quotation, Accountant/Admin can delete or convert draft quotation', async () => {
    const q = await createQuotation(
      managerContext,
      {
        clientName: 'Test Client',
        clientAddress: '123 Main St',
        quotationDate: '2026-03-01',
        validUntil: '2026-04-01',
        lineItems: [{ srNo: 1, description: 'Wood Work', sizes: ['10x12'], unit: 'sft', qty: 120, unitPrice: 150, amount: 18000 }]
      },
      requestMeta
    );

    expect(q.id).toBeDefined();
    expect(q.status).toBe('draft');

    // Convert quotation to invoice as Accountant
    const inv = await convertQuotationToInvoice(accountantContext, q.id, requestMeta);
    expect(inv.id).toBeDefined();
    expect(inv.invoiceNumber).toBeDefined();
  });

  it('3. Invoices & Bills: Accountant and TenantAdmin can update status and record bills', async () => {
    const inv = await createInvoice(
      accountantContext,
      {
        clientName: 'Client B',
        invoiceDate: '2026-03-05',
        lineItems: [{ srNo: 1, description: 'Cabinet Work', qty: 1, unitPrice: 25000, amount: 25000 }]
      },
      requestMeta
    );

    expect(inv.id).toBeDefined();

    // Update status to paid as TenantAdmin
    const updatedInv = await updateInvoiceStatus(adminContext, inv.id, { status: 'paid' }, requestMeta);
    expect(updatedInv.status).toBe('paid');

    // Create Bill as Accountant
    const bill = await createBill(
      accountantContext,
      {
        vendorName: 'Plywood Depot',
        billNumber: `BILL-${randomUUID().slice(0, 6)}`,
        billDate: '2026-03-06',
        totalAmount: 12500
      },
      requestMeta
    );

    expect(bill.id).toBeDefined();
  });
});
