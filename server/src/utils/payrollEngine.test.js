import { describe, expect, it } from 'vitest';
import {
  applyAdjustments,
  buildAttendanceSummary,
  calculateDailyWage,
  calculateDayEquivalents,
  calculateMonthlyWage,
  computeLineItem,
  DEFAULT_SETTINGS
} from './payrollEngine.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeRecords(counts) {
  const records = [];
  for (const [status, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) records.push({ status });
  }
  return records;
}

// ── Employee A: Daily wage ₹800/day, August 2026 ─────────────────────────────
// 23 present + 2 half-days + 1 overtime = 25.5 day-equivalents
// Gross = 25.5 × 800 = ₹20,400
// After −₹500 advance deduction: net = ₹19,900

describe('Employee A — Daily ₹800/day', () => {
  const employee = { wage_type: 'daily', wage_rate: '800.00' };
  const records = makeRecords({ present: 23, half_day: 2, overtime: 1 });

  it('builds attendance summary correctly', () => {
    const s = buildAttendanceSummary(records);
    expect(s.present).toBe(23);
    expect(s.halfDay).toBe(2);
    expect(s.overtime).toBe(1);
    expect(s.absent).toBe(0);
    expect(s.leave).toBe(0);
  });

  it('calculates day-equivalents = 25.5', () => {
    const s = buildAttendanceSummary(records);
    // 23×1.0 + 2×0.5 + 1×1.5 = 23 + 1 + 1.5 = 25.5
    expect(calculateDayEquivalents(s, DEFAULT_SETTINGS)).toBe(25.5);
  });

  it('gross = ₹20,400', () => {
    const s = buildAttendanceSummary(records);
    const { dayEquivalents, grossAmount } = calculateDailyWage(employee, s, DEFAULT_SETTINGS);
    expect(dayEquivalents).toBe(25.5);
    expect(grossAmount).toBe(20400);
  });

  it('net after ₹500 deduction = ₹19,900', () => {
    const net = applyAdjustments(20400, [{ type: 'deduction', label: 'Advance', amount: 500 }]);
    expect(net).toBe(19900);
  });

  it('net after bonus + deduction stacks correctly', () => {
    // +₹200 bonus, −₹500 deduction → 20400 + 200 − 500 = 20100
    const net = applyAdjustments(20400, [
      { type: 'bonus', label: 'Festival', amount: 200 },
      { type: 'deduction', label: 'Advance', amount: 500 }
    ]);
    expect(net).toBe(20100);
  });

  it('computeLineItem returns full snapshot', () => {
    const li = computeLineItem(employee, records, DEFAULT_SETTINGS);
    expect(li.present).toBe(23);
    expect(li.halfDay).toBe(2);
    expect(li.overtime).toBe(1);
    expect(li.dayEquivalents).toBe(25.5);
    expect(li.grossAmount).toBe(20400);
  });
});

// ── Employee B: Monthly salary ₹30,000/month, 26 working days ────────────────
// 24 present + 1 half-day + 1 absent = 24.5 day-equivalents
// perDayRate = 30000 / 26 = 1153.8462 (4dp)
// Gross = 24.5 × 1153.8462 = 28269.2319 → ₹28,269.23 (2dp)

describe('Employee B — Monthly ₹30,000/month', () => {
  const employee = { wage_type: 'monthly', wage_rate: '30000.00' };
  const records = makeRecords({ present: 24, half_day: 1, absent: 1 });

  it('builds attendance summary correctly', () => {
    const s = buildAttendanceSummary(records);
    expect(s.present).toBe(24);
    expect(s.halfDay).toBe(1);
    expect(s.absent).toBe(1);
  });

  it('day-equivalents = 24.5', () => {
    const s = buildAttendanceSummary(records);
    // 24×1.0 + 1×0.5 + 1×0 = 24.5
    expect(calculateDayEquivalents(s, DEFAULT_SETTINGS)).toBe(24.5);
  });

  it('per-day rate = 1153.8462 (4dp precision, avoids rounding error)', () => {
    const s = buildAttendanceSummary(records);
    const { perDayRate } = calculateMonthlyWage(employee, s, DEFAULT_SETTINGS);
    // 30000 / 26 = 1153.846153... stored at 4dp = 1153.8462
    expect(perDayRate).toBe(1153.8462);
  });

  it('gross = ₹28,269.23 (NOT ₹28,269.33 — that would be wrong rounding)', () => {
    const s = buildAttendanceSummary(records);
    const { grossAmount } = calculateMonthlyWage(employee, s, DEFAULT_SETTINGS);
    // 24.5 × 1153.8462 = 28269.2319 → round to 2dp = 28269.23
    expect(grossAmount).toBe(28269.23);
  });

  it('no adjustment → net equals gross', () => {
    expect(applyAdjustments(28269.23, [])).toBe(28269.23);
  });

  it('computeLineItem full snapshot', () => {
    const li = computeLineItem(employee, records, DEFAULT_SETTINGS);
    expect(li.dayEquivalents).toBe(24.5);
    expect(li.grossAmount).toBe(28269.23);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('all absent: gross = 0', () => {
    const emp = { wage_type: 'daily', wage_rate: '500.00' };
    const recs = makeRecords({ absent: 26 });
    const s = buildAttendanceSummary(recs);
    const { grossAmount } = calculateDailyWage(emp, s, DEFAULT_SETTINGS);
    expect(grossAmount).toBe(0);
  });

  it('custom overtime multiplier (2x)', () => {
    const emp = { wage_type: 'daily', wage_rate: '1000.00' };
    const s = { present: 0, halfDay: 0, overtime: 1, absent: 0, leave: 0 };
    const settings = { ...DEFAULT_SETTINGS, overtimeMultiplier: 2.0 };
    const { grossAmount } = calculateDailyWage(emp, s, settings);
    expect(grossAmount).toBe(2000);
  });

  it('custom working_days_per_month (25)', () => {
    const emp = { wage_type: 'monthly', wage_rate: '25000.00' };
    const s = { present: 25, halfDay: 0, overtime: 0, absent: 0, leave: 0 };
    const settings = { ...DEFAULT_SETTINGS, workingDaysPerMonth: 25 };
    // 25000/25 = 1000/day; 25 days × 1000 = 25000
    const { grossAmount } = calculateMonthlyWage(emp, s, settings);
    expect(grossAmount).toBe(25000);
  });

  it('applyAdjustments with no adjustments returns gross unchanged', () => {
    expect(applyAdjustments(10000, null)).toBe(10000);
    expect(applyAdjustments(10000, [])).toBe(10000);
  });

  it('applyAdjustments rounds to 2dp', () => {
    // 1000.001 bonus → 10000 + 1000.001 = 11000.001 → 11000
    expect(applyAdjustments(10000, [{ type: 'bonus', label: 'X', amount: 1000.001 }])).toBe(11000);
  });
});
