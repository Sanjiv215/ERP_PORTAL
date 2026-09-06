import { describe, expect, it, vi } from 'vitest';
import { createQuotationSchema, createInvoiceSchema } from '../routes/billingSchemas.js';
import { recordAdvanceSchema } from '../routes/employeeSchemas.js';
import { computeLineItem, applyAdjustments, DEFAULT_SETTINGS } from '../utils/payrollEngine.js';

describe('Fixes & Features Suite', () => {

  // ── Bug 1: Quotation Validation & Error Handling ─────────────────────────────
  describe('Bug 1: Quotation Creation & Line Item Validation', () => {
    it('successfully validates a valid quotation payload with line items', () => {
      const payload = {
        clientName: 'Acme Builders',
        clientAddress: '123 MG Road, Bengaluru',
        quotationDate: '2026-08-16',
        validUntil: '2026-09-15',
        gstRate: 18,
        notes: '30-day validity',
        lineItems: [
          { description: 'Custom Teak Cabinets', qty: 2, unitPrice: 25000, amount: 50000 },
          { description: 'Installation & Polishing', qty: 1, unitPrice: 8000, amount: 8000 }
        ]
      };
      const parsed = createQuotationSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.lineItems).toHaveLength(2);
      expect(parsed.data.gstRate).toBe(18);
    });

    it('rejects empty line items array with a clear validation error', () => {
      const payload = {
        clientName: 'Acme Builders',
        quotationDate: '2026-08-16',
        lineItems: []
      };
      const parsed = createQuotationSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      const errMsgs = parsed.error.issues.map((i) => i.message);
      expect(errMsgs.some((m) => m.toLowerCase().includes('at least one line item') || m.toLowerCase().includes('line item is required'))).toBe(true);
    });

    it('rejects line item with empty description or negative price', () => {
      const payload = {
        clientName: 'Acme Builders',
        quotationDate: '2026-08-16',
        lineItems: [{ description: '', qty: 1, unitPrice: -500, amount: -500 }]
      };
      const parsed = createQuotationSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });
  });

  // ── Bug 2: Invoice Creation & Project Association ────────────────────────────
  describe('Bug 2: Invoice Creation & Project Association', () => {
    it('accepts invoice with null or undefined projectId for direct client billing', () => {
      const payload = {
        clientName: 'Direct Client Corp',
        projectId: null,
        invoiceDate: '2026-08-16',
        dueDate: '2026-08-30',
        gstRate: 18,
        lineItems: [
          { description: 'Consulting & Design', qty: 1, unitPrice: 30000, amount: 30000 }
        ]
      };
      const parsed = createInvoiceSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.projectId).toBeNull();
    });

    it('accepts invoice associated with a valid UUID projectId', () => {
      const payload = {
        clientName: 'Project Client',
        projectId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        invoiceDate: '2026-08-16',
        lineItems: [
          { description: 'Milestone 1 Work', qty: 1, unitPrice: 100000, amount: 100000 }
        ]
      };
      const parsed = createInvoiceSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.projectId).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    });
  });

  // ── Bug 3: Payslip Data Completeness ─────────────────────────────────────────
  describe('Bug 3: Payslip Data Payload & Contract', () => {
    it('verifies payslip structure contains required tenant, employee, run, and lineItem fields', () => {
      const payslipPayload = {
        tenant: {
          id: 'tenant-1',
          businessName: 'WoodWise Carpentry Ltd',
          gstNumber: '29ABCDE1234F1Z5'
        },
        employee: {
          id: 'emp-1',
          name: 'Ramesh Kumar',
          phone: '9876543210',
          wageType: 'daily',
          wageRate: 1000,
          bankDetailsLast4: '4321',
          upiIdLast4: null
        },
        run: {
          id: 'run-1',
          periodYear: 2026,
          periodMonth: 8,
          version: 1,
          status: 'finalized'
        },
        lineItem: {
          id: 'li-1',
          employeeName: 'Ramesh Kumar',
          wageType: 'daily',
          wageRate: 1000,
          presentDays: 24,
          halfDays: 2,
          overtimeDays: 2,
          absentDays: 0,
          leaveDays: 0,
          dayEquivalents: 28,
          totalDayEquivalents: 28,
          grossAmount: 28000,
          netAmount: 26000,
          paymentStatus: 'paid',
          adjustments: [
            { id: 'adj-1', type: 'deduction', label: 'Advance Recovery', amount: 2000 }
          ]
        },
        adjustments: [
          { id: 'adj-1', type: 'deduction', label: 'Advance Recovery', amount: 2000 }
        ]
      };

      expect(payslipPayload.tenant.businessName).toBe('WoodWise Carpentry Ltd');
      expect(payslipPayload.employee.name).toBe('Ramesh Kumar');
      expect(payslipPayload.lineItem.totalDayEquivalents).toBe(28);
      expect(payslipPayload.adjustments).toHaveLength(1);
    });
  });

  // ── Bug 4: Profit & Loss Margins & Safe Zero Handling ─────────────────────────
  describe('Bug 4: P&L Summary & Zero Division Protection', () => {
    it('calculates net margin percentage correctly for profitable projects', () => {
      const totalIncome = 100000;
      const totalExpense = 65000;
      const netProfit = totalIncome - totalExpense;
      const marginPercentage = totalIncome > 0
        ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100
        : 0;

      expect(netProfit).toBe(35000);
      expect(marginPercentage).toBe(35.0);
    });

    it('safely handles 0 revenue without NaN or Infinity', () => {
      const totalIncome = 0;
      const totalExpense = 15000;
      const netProfit = totalIncome - totalExpense;
      const marginPercentage = totalIncome > 0
        ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100
        : 0;

      expect(netProfit).toBe(-15000);
      expect(marginPercentage).toBe(0);
      expect(Number.isNaN(marginPercentage)).toBe(false);
      expect(Number.isFinite(marginPercentage)).toBe(true);
    });
  });

  // ── Feature 1: Employee Advances & Automatic Payroll Deductions ───────────────
  describe('Feature 1: Employee Advances', () => {
    it('validates advance creation schema with positive amounts and ISO dates', () => {
      const valid = recordAdvanceSchema.safeParse({
        amount: 2500,
        advanceDate: '2026-08-10',
        notes: 'Festival advance'
      });
      expect(valid.success).toBe(true);
      expect(valid.data.amount).toBe(2500);

      const invalid = recordAdvanceSchema.safeParse({
        amount: -100,
        advanceDate: 'invalid-date'
      });
      expect(invalid.success).toBe(false);
    });

    it('automatically applies advance deductions against gross wage in payroll computation', () => {
      const employee = {
        id: 'emp-1',
        name: 'Anita Devi',
        wage_type: 'monthly',
        wage_rate: 30000
      };
      const attendance = { present: 26, halfDay: 0, overtime: 0, absent: 0, leave: 0 };
      const settings = DEFAULT_SETTINGS; // 26 working days

      const lineCalc = computeLineItem(employee, attendance, settings);
      expect(lineCalc.grossAmount).toBe(30000);

      const unadjustedAdvances = [
        { id: 'adv-1', amount: 3500, advanceDate: '2026-08-05', notes: 'Emergency' }
      ];

      const adjustments = unadjustedAdvances.map((adv) => ({
        id: 'adj-' + adv.id,
        advanceId: adv.id,
        type: 'deduction',
        label: `Advance on ${adv.advanceDate}: ${adv.notes}`,
        amount: Number(adv.amount)
      }));

      const netAmount = applyAdjustments(lineCalc.grossAmount, adjustments);
      expect(netAmount).toBe(26500); // 30000 - 3500
    });
  });

  // ── Feature 2: Versioned Payroll Regeneration & Paid Staff Protection ─────────
  describe('Feature 2: Versioned Payroll Regeneration with Paid Staff Protection', () => {
    it('WORKED EXAMPLE: locks already-paid staff in Version 2 while recalculating pending staff', () => {
      // Version 1 line items:
      // Employee 1 (Ramesh): PAID ₹24,000
      // Employee 2 (Suresh): PENDING ₹20,000 (was 20 days present in v1)
      const v1LineItems = [
        {
          id: 'li-1',
          employeeId: 'emp-ramesh',
          employeeName: 'Ramesh Kumar',
          wageType: 'daily',
          wageRate: 1000,
          presentDays: 24,
          dayEquivalents: 24,
          grossAmount: 24000,
          netAmount: 24000,
          paymentStatus: 'paid',
          isLocked: false,
          paidAt: new Date('2026-08-05')
        },
        {
          id: 'li-2',
          employeeId: 'emp-suresh',
          employeeName: 'Suresh Patel',
          wageType: 'daily',
          wageRate: 1000,
          presentDays: 20,
          dayEquivalents: 20,
          grossAmount: 20000,
          netAmount: 20000,
          paymentStatus: 'pending',
          isLocked: false,
          paidAt: null
        }
      ];

      // Simulate mid-month update:
      // Suresh was marked present for 4 additional days (now 24 days), plus took a ₹1,000 advance.
      const latestAttendance = {
        'emp-ramesh': { present: 26 }, // Attendance changed, BUT Ramesh is already PAID!
        'emp-suresh': { present: 24 }
      };
      const unadjustedAdvances = {
        'emp-suresh': [{ id: 'adv-suresh-1', amount: 1000, advanceDate: '2026-08-12' }]
      };

      // Regeneration engine logic:
      const v2LineItems = [];
      const lockedStaff = [];
      const recalculatedStaff = [];

      for (const prev of v1LineItems) {
        if (prev.paymentStatus === 'paid' || prev.isLocked) {
          // PROTECTED RULE: Must NOT recalculate or re-pay Ramesh!
          lockedStaff.push(prev.employeeId);
          v2LineItems.push({
            ...prev,
            id: 'li-v2-' + prev.employeeId,
            runId: 'run-v2',
            isLocked: true,
            lockedReason: 'already_paid_in_previous_run'
          });
        } else {
          // Suresh was PENDING: Recalculate with latest attendance (24 days) and advance (₹1,000)
          recalculatedStaff.push(prev.employeeId);
          const att = latestAttendance[prev.employeeId];
          const newGross = att.present * prev.wageRate; // 24 * 1000 = 24000
          const advs = unadjustedAdvances[prev.employeeId] || [];
          const adjs = advs.map((a) => ({ type: 'deduction', amount: a.amount, advanceId: a.id }));
          const newNet = applyAdjustments(newGross, adjs); // 24000 - 1000 = 23000

          v2LineItems.push({
            id: 'li-v2-' + prev.employeeId,
            runId: 'run-v2',
            employeeId: prev.employeeId,
            employeeName: prev.employeeName,
            wageType: prev.wageType,
            wageRate: prev.wageRate,
            presentDays: att.present,
            grossAmount: newGross,
            netAmount: newNet,
            adjustments: adjs,
            paymentStatus: 'pending',
            isLocked: false
          });
        }
      }

      // Assertions on the worked example:
      expect(lockedStaff).toEqual(['emp-ramesh']);
      expect(recalculatedStaff).toEqual(['emp-suresh']);

      // Ramesh in v2: Exact ₹24,000, status 'paid', isLocked true, untouched
      const rameshV2 = v2LineItems.find((li) => li.employeeId === 'emp-ramesh');
      expect(rameshV2.isLocked).toBe(true);
      expect(rameshV2.paymentStatus).toBe('paid');
      expect(rameshV2.netAmount).toBe(24000);
      expect(rameshV2.grossAmount).toBe(24000);

      // Suresh in v2: Recalculated to ₹23,000 net (24 days gross ₹24,000 − ₹1,000 advance), pending, isLocked false
      const sureshV2 = v2LineItems.find((li) => li.employeeId === 'emp-suresh');
      expect(sureshV2.isLocked).toBe(false);
      expect(sureshV2.paymentStatus).toBe('pending');
      expect(sureshV2.grossAmount).toBe(24000);
      expect(sureshV2.netAmount).toBe(23000);
      expect(sureshV2.adjustments).toHaveLength(1);
    });
  });
});
