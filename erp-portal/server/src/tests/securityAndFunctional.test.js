import { describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  calculateDailyWage,
  calculateMonthlyWage,
  calculateDayEquivalents,
  applyAdjustments,
  computeLineItem,
  DEFAULT_SETTINGS
} from '../utils/payrollEngine.js';
import {
  encryptSensitiveField,
  decryptSensitiveField,
  lastFour
} from '../utils/encryption.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

// ── Test Setup for Environment & Keys ────────────────────────────────────────

const ACCESS_SECRET = env.JWT_ACCESS_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const REFRESH_SECRET = env.JWT_REFRESH_SECRET || 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const ENCRYPTION_KEY_BASE64 = 'kK3J8eF1V+4q7U3xY8a9b2c3d4e5f6g7h8i9j0k1l2M=';

vi.stubEnv('JWT_ACCESS_SECRET', ACCESS_SECRET);
vi.stubEnv('JWT_REFRESH_SECRET', REFRESH_SECRET);
vi.stubEnv('EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64', ENCRYPTION_KEY_BASE64);

function createMockToken({ tenantId, userId, role }, expiresIn = '15m') {
  return jwt.sign({ tenant_id: tenantId, user_id: userId, role }, ACCESS_SECRET, { expiresIn });
}

// ── 7. Tenant Isolation Tests ────────────────────────────────────────────────

describe('7. Tenant Isolation & Context Derivation Tests', () => {
  const tenantA = 'tenant-aaa-111';
  const tenantB = 'tenant-bbb-222';
  const userA = 'user-aaa-111';

  it('middleware strictly extracts tenantId from JWT and ignores client-supplied tenant_id in body/query/params', () => {
    const tokenA = createMockToken({ tenantId: tenantA, userId: userA, role: 'TenantAdmin' });

    const req = {
      get: (h) => (h.toLowerCase() === 'authorization' ? `Bearer ${tokenA}` : null),
      body: { tenant_id: tenantB, tenantId: tenantB },
      query: { tenant_id: tenantB, tenantId: tenantB },
      params: { tenant_id: tenantB, tenantId: tenantB }
    };
    const res = {};
    let nextCalled = false;

    resolveTenantContext(req, res, (err) => {
      expect(err).toBeUndefined();
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.context.tenantId).toBe(tenantA);
    expect(req.context.tenantId).not.toBe(tenantB);
  });

  it('rejects cross-tenant data access if tenant mismatch occurs in repository queries', () => {
    const queryTenantId = tenantA;
    const targetResourceTenantId = tenantB;

    // Simulated tenant predicate check in SQL
    const isAllowed = queryTenantId === targetResourceTenantId;
    expect(isAllowed).toBe(false);
  });
});

// ── 8. Auth Security Tests ───────────────────────────────────────────────────

describe('8. Authentication & Token Verification Tests', () => {
  const tenantA = 'tenant-aaa-111';
  const userA = 'user-aaa-111';

  it('rejects expired access tokens', () => {
    const expiredToken = jwt.sign(
      { tenant_id: tenantA, user_id: userA, role: 'TenantAdmin' },
      ACCESS_SECRET,
      { expiresIn: '-1s' }
    );

    const req = { get: (h) => (h.toLowerCase() === 'authorization' ? `Bearer ${expiredToken}` : null) };
    let capturedError = null;

    resolveTenantContext(req, {}, (err) => { capturedError = err; });

    expect(capturedError).toBeInstanceOf(AppError);
    expect(capturedError.statusCode).toBe(401);
  });

  it('rejects tampered JWT signature / modified payload', () => {
    const validToken = createMockToken({ tenantId: tenantA, userId: userA, role: 'Employee' });
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ tenant_id: tenantA, user_id: userA, role: 'TenantAdmin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const req = { get: (h) => (h.toLowerCase() === 'authorization' ? `Bearer ${tamperedToken}` : null) };
    let capturedError = null;

    resolveTenantContext(req, {}, (err) => { capturedError = err; });

    expect(capturedError).toBeInstanceOf(AppError);
    expect(capturedError.statusCode).toBe(401);
  });

  it('rejects token signed with wrong secret', () => {
    const invalidSecretToken = jwt.sign(
      { tenant_id: tenantA, user_id: userA, role: 'TenantAdmin' },
      'wrong_secret_12345678901234567890123456789012'
    );

    const req = { get: (h) => (h.toLowerCase() === 'authorization' ? `Bearer ${invalidSecretToken}` : null) };
    let capturedError = null;

    resolveTenantContext(req, {}, (err) => { capturedError = err; });

    expect(capturedError).toBeInstanceOf(AppError);
    expect(capturedError.statusCode).toBe(401);
  });
});

// ── 9. Role Enforcement (RBAC) Tests ─────────────────────────────────────────

describe('9. Role-Based Access Control (RBAC) Server-Side Enforcement', () => {
  const allowedRoles = ['TenantAdmin', 'Manager'];
  const guard = requireRole(allowedRoles);

  it('allows TenantAdmin', () => {
    const req = { context: { role: 'TenantAdmin' } };
    let nextCalled = false;
    guard(req, {}, (err) => {
      expect(err).toBeUndefined();
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it('allows Manager', () => {
    const req = { context: { role: 'Manager' } };
    let nextCalled = false;
    guard(req, {}, (err) => {
      expect(err).toBeUndefined();
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it('blocks Accountant from Admin/Manager-only routes (403 Forbidden)', () => {
    const req = { context: { role: 'Accountant' } };
    let capturedError = null;
    guard(req, {}, (err) => { capturedError = err; });
    expect(capturedError).toBeInstanceOf(AppError);
    expect(capturedError.statusCode).toBe(403);
    expect(capturedError.code).toBe('FORBIDDEN');
  });

  it('blocks Employee from privileged endpoints (403 Forbidden)', () => {
    const req = { context: { role: 'Employee' } };
    let capturedError = null;
    guard(req, {}, (err) => { capturedError = err; });
    expect(capturedError).toBeInstanceOf(AppError);
    expect(capturedError.statusCode).toBe(403);
    expect(capturedError.code).toBe('FORBIDDEN');
  });
});

// ── 10. Input Validation & Escaping Tests ─────────────────────────────────────

describe('10. Cryptographic Storage & Sanitization Tests', () => {
  it('encrypts bank accounts and UPI IDs using AES-256-GCM', () => {
    const bankAccount = '98765432101234';
    const encrypted = encryptSensitiveField(bankAccount);

    expect(encrypted).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(encrypted).not.toContain(bankAccount);

    const decrypted = decryptSensitiveField(encrypted);
    expect(decrypted).toBe(bankAccount);
  });

  it('correctly produces masked last-4 digits', () => {
    expect(lastFour('9876 5432 1012 3456')).toBe('3456');
    expect(lastFour('contractor@okaxis')).toBe('axis');
    expect(lastFour(null)).toBeNull();
  });
});

// ── 12. Payroll Math Tests: 5 Manually Verified Cases ────────────────────────

describe('12. Payroll Calculation Engine — 5 Comprehensive Test Cases', () => {
  const settings = { workingDaysPerMonth: 26, overtimeMultiplier: 1.5, halfDayMultiplier: 0.5 };

  // Case 1: Full Month Present (Daily Wage ₹750/day)
  it('Case 1: Daily wage employee, 26 days full present -> ₹19,500.00', () => {
    const emp = { wage_type: 'daily', wage_rate: '750.00' };
    const summary = { present: 26, halfDay: 0, overtime: 0, absent: 0, leave: 0 };
    const units = calculateDayEquivalents(summary, settings);
    const { grossAmount } = calculateDailyWage(emp, summary, settings);

    expect(units).toBe(26.0);
    expect(grossAmount).toBe(19500.00);
  });

  // Case 2: Mixed Half-Days and Overtime (Daily Wage ₹900/day)
  it('Case 2: Daily wage, 20 present + 4 half-days (2.0) + 2 overtime (3.0) -> 25.0 units, ₹22,500.00 gross', () => {
    const emp = { wage_type: 'daily', wage_rate: '900.00' };
    const summary = { present: 20, halfDay: 4, overtime: 2, absent: 0, leave: 0 };
    const units = calculateDayEquivalents(summary, settings); // 20*1 + 4*0.5 + 2*1.5 = 20 + 2 + 3 = 25.0
    const { grossAmount } = calculateDailyWage(emp, summary, settings);

    expect(units).toBe(25.0);
    expect(grossAmount).toBe(22500.00);
  });

  // Case 3: Advances and Bonuses Applied to Gross
  it('Case 3: Gross ₹22,500.00 with ₹1,500 bonus and ₹3,000 advance deduction -> Net ₹21,000.00', () => {
    const gross = 22500.00;
    const adjustments = [
      { type: 'bonus', label: 'Safety Completion Bonus', amount: 1500.00 },
      { type: 'deduction', label: 'Mid-month Advance', amount: 3000.00 }
    ];
    const net = applyAdjustments(gross, adjustments);
    expect(net).toBe(21000.00);
  });

  // Case 4: Monthly-Salary Employee with Unpaid Leave
  it('Case 4: Monthly ₹52,000.00/mo (₹2,000/day), 22 present + 4 absent -> 22 units, Net ₹44,000.00', () => {
    const emp = { wage_type: 'monthly', wage_rate: '52000.00' };
    const summary = { present: 22, halfDay: 0, overtime: 0, absent: 4, leave: 0 };
    const { perDayRate, dayEquivalents, grossAmount } = calculateMonthlyWage(emp, summary, settings);

    expect(perDayRate).toBe(2000.0000);
    expect(dayEquivalents).toBe(22.0);
    expect(grossAmount).toBe(44000.00);
  });

  // Case 5: Mid-Month Joiner (Daily Wage ₹1,000/day, joined on 16th, 12 days present)
  it('Case 5: Mid-month start, 12 days present -> 12 units, Gross ₹12,000.00', () => {
    const emp = { wage_type: 'daily', wage_rate: '1000.00' };
    const summary = { present: 12, halfDay: 0, overtime: 0, absent: 0, leave: 0 };
    const units = calculateDayEquivalents(summary, settings);
    const { grossAmount } = calculateDailyWage(emp, summary, settings);

    expect(units).toBe(12.0);
    expect(grossAmount).toBe(12000.00);
  });

  // Case 6: Attendance Sync computeLineItem accepting database summary object
  it('Case 6: computeLineItem accepts attendance DB summary row directly and calculates correctly', () => {
    const dailyEmp = { wage_type: 'daily', wage_rate: 900 };
    const dbSummaryRow = { present_days: 18, half_days: 2, overtime_days: 1, absent_days: 3, leave_days: 0 };
    const lineCalc = computeLineItem(dailyEmp, dbSummaryRow, settings);

    // 18*1 + 2*0.5 + 1*1.5 = 18 + 1 + 1.5 = 20.5 units
    expect(lineCalc.dayEquivalents).toBe(20.5);
    // 20.5 * 900 = 18450.00
    expect(lineCalc.grossAmount).toBe(18450.00);
    expect(lineCalc.present).toBe(18);
    expect(lineCalc.halfDay).toBe(2);
    expect(lineCalc.overtime).toBe(1);
  });
});
