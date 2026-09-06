/**
 * payrollEngine.js — Pure calculation functions. No DB access.
 * All functions are side-effect-free and fully unit-testable.
 *
 * Wage model:
 *   Daily employee  : net = Σ(day_equivalents) × daily_rate
 *
 * Attendance multipliers (configurable via payroll_settings):
 *   present   → 1.0
 *   half_day  → halfDayMultiplier  (default 0.5)
 *   overtime  → overtimeMultiplier (default 1.5)
 *   absent    → 0.0
 *   leave     → 0.0
 *
 * Rounding: final gross/net rounded to 2dp.
 */

export const DEFAULT_SETTINGS = {
  workingDaysPerMonth: 26,
  overtimeMultiplier: 1.5,
  halfDayMultiplier: 0.5
};

/**
 * Count attendance records by status.
 * @param {Array<{status: string}>} records
 * @returns {{ present, halfDay, overtime, absent, leave }}
 */
export function buildAttendanceSummary(records) {
  let present = 0;
  let halfDay = 0;
  let overtime = 0;
  let absent = 0;
  let leave = 0;

  for (const r of records) {
    switch (r.status) {
      case 'present':  present++;  break;
      case 'half_day': halfDay++;  break;
      case 'overtime': overtime++; break;
      case 'absent':   absent++;   break;
      case 'leave':    leave++;    break;
    }
  }

  return { present, halfDay, overtime, absent, leave };
}

/**
 * Convert attendance summary to day-equivalents using the configured multipliers.
 * @param {{ present, halfDay, overtime, absent, leave }} summary
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {number}
 */
export function calculateDayEquivalents(summary, settings = DEFAULT_SETTINGS) {
  const { overtimeMultiplier, halfDayMultiplier } = { ...DEFAULT_SETTINGS, ...settings };

  return (
    summary.present   * 1.0 +
    summary.halfDay   * halfDayMultiplier +
    summary.overtime  * overtimeMultiplier +
    summary.absent    * 0.0 +
    summary.leave     * 0.0
  );
}

/**
 * Compute gross amount for a daily-wage employee.
 * gross = dayEquivalents × wageRate
 * @returns {{ dayEquivalents: number, grossAmount: number }}
 */
export function calculateDailyWage(employee, summary, settings = DEFAULT_SETTINGS) {
  const dayEquivalents = calculateDayEquivalents(summary, settings);
  const effectiveDailyRate = employee.wage_type === 'monthly'
    ? round4(Number(employee.wage_rate) / (settings.workingDaysPerMonth || 26))
    : Number(employee.wage_rate);
  const grossAmount = round2(dayEquivalents * effectiveDailyRate);
  return { dayEquivalents, grossAmount };
}

/**
 * Legacy monthly compatibility helper: routes through standard working days (26 days).
 */
export function calculateMonthlyWage(employee, summary, settings = DEFAULT_SETTINGS) {
  const { workingDaysPerMonth } = { ...DEFAULT_SETTINGS, ...settings };
  const perDayRate = round4(Number(employee.wage_rate) / workingDaysPerMonth);
  const dayEquivalents = calculateDayEquivalents(summary, settings);
  const grossAmount = round2(dayEquivalents * perDayRate);
  return { perDayRate, dayEquivalents, grossAmount };
}

/**
 * Apply manual adjustments (bonuses/deductions) to a gross amount.
 * adjustments: [{type: 'bonus'|'deduction', label: string, amount: number}]
 * @returns {number} netAmount rounded to 2dp
 */
export function applyAdjustments(grossAmount, adjustments = []) {
  if (!adjustments || adjustments.length === 0) return grossAmount;

  let net = grossAmount;
  for (const adj of adjustments) {
    const amount = Number(adj.amount);
    if (adj.type === 'bonus')     net += amount;
    if (adj.type === 'deduction') net -= amount;
  }

  return round2(net);
}

/**
 * Full line-item computation for one employee.
 * Computes day-equivalents, gross, and returns a snapshot
 * suitable for inserting into payroll_line_items.
 *
 * @param {{ wage_type: string, wage_rate: string|number }} employee
 * @param {Array<{status: string}>|Object} attendanceInput
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {{ present, halfDay, overtime, absent, leave, dayEquivalents, grossAmount }}
 */
export function computeLineItem(employee, attendanceInput, settings = DEFAULT_SETTINGS) {
  const summary = Array.isArray(attendanceInput)
    ? buildAttendanceSummary(attendanceInput)
    : {
        present: Number(attendanceInput?.present ?? attendanceInput?.present_days ?? 0),
        halfDay: Number(attendanceInput?.halfDay ?? attendanceInput?.half_days ?? 0),
        overtime: Number(attendanceInput?.overtime ?? attendanceInput?.overtime_days ?? 0),
        absent: Number(attendanceInput?.absent ?? attendanceInput?.absent_days ?? 0),
        leave: Number(attendanceInput?.leave ?? attendanceInput?.leave_days ?? 0)
      };

  const { dayEquivalents, grossAmount } = calculateDailyWage(employee, summary, settings);

  return {
    ...summary,
    dayEquivalents,
    grossAmount
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }
