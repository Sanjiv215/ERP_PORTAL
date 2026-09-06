import { randomUUID } from 'node:crypto';

// ── Payroll Settings ──────────────────────────────────────────────────────────

export async function getPayrollSettings(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT working_days_per_month, overtime_multiplier, half_day_multiplier
     FROM payroll_settings
     WHERE tenant_id = ?
     LIMIT 1`,
    [tenantId]
  );

  if (rows[0]) {
    return {
      workingDaysPerMonth: rows[0].working_days_per_month,
      overtimeMultiplier: Number(rows[0].overtime_multiplier),
      halfDayMultiplier: Number(rows[0].half_day_multiplier)
    };
  }

  return { workingDaysPerMonth: 26, overtimeMultiplier: 1.5, halfDayMultiplier: 0.5 };
}

export async function upsertPayrollSettings(connection, tenantId, settings) {
  await connection.execute(
    `INSERT INTO payroll_settings (tenant_id, working_days_per_month, overtime_multiplier, half_day_multiplier)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (tenant_id) DO UPDATE SET
       working_days_per_month = EXCLUDED.working_days_per_month,
       overtime_multiplier = EXCLUDED.overtime_multiplier,
       half_day_multiplier = EXCLUDED.half_day_multiplier,
       updated_at = CURRENT_TIMESTAMP`,
    [tenantId, settings.workingDaysPerMonth, settings.overtimeMultiplier, settings.halfDayMultiplier]
  );
}

// ── Payroll Runs ──────────────────────────────────────────────────────────────

export async function findPayrollRun(connection, tenantId, runId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, period_year, period_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            version, supersedes_run_id, superseded_by, status, generated_by, finalized_at, created_at, updated_at
     FROM payroll_runs
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, runId]
  );
  return rows[0] || null;
}

export async function findPayrollRunByPeriod(connection, tenantId, year, month) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, period_year, period_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            version, supersedes_run_id, superseded_by, status, generated_by, finalized_at, created_at, updated_at
     FROM payroll_runs
     WHERE tenant_id = ? AND period_year = ? AND period_month = ?
     ORDER BY version DESC
     LIMIT 1`,
    [tenantId, year, month]
  );
  return rows[0] || null;
}

export async function findPayrollRunByDateRange(connection, tenantId, startDate, endDate) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, period_year, period_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            version, supersedes_run_id, superseded_by, status, generated_by, finalized_at, created_at, updated_at
     FROM payroll_runs
     WHERE tenant_id = ? AND period_start_date = ?::date AND period_end_date = ?::date
     ORDER BY version DESC
     LIMIT 1`,
    [tenantId, startDate, endDate]
  );
  return rows[0] || null;
}

export async function listPayrollRunsByPeriod(connection, tenantId, year, month) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, period_year, period_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            version, supersedes_run_id, superseded_by, status, generated_by, finalized_at, created_at
     FROM payroll_runs
     WHERE tenant_id = ? AND period_year = ? AND period_month = ?
     ORDER BY version DESC`,
    [tenantId, year, month]
  );
  return rows;
}

export async function listPayrollRuns(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, period_year, period_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            version, supersedes_run_id, superseded_by, status, generated_by, finalized_at, created_at
     FROM payroll_runs
     WHERE tenant_id = ?
     ORDER BY COALESCE(period_end_date, TO_DATE(period_year || '-' || LPAD(period_month::text, 2, '0') || '-01', 'YYYY-MM-DD')) DESC, version DESC`,
    [tenantId]
  );
  return rows;
}

export async function createPayrollRun(
  connection,
  tenantId,
  year,
  month,
  generatedBy,
  version = 1,
  supersedesRunId = null,
  periodStartDate = null,
  periodEndDate = null
) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO payroll_runs (id, tenant_id, period_year, period_month, period_start_date, period_end_date, version, supersedes_run_id, generated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, year, month, periodStartDate || null, periodEndDate || null, version, supersedesRunId, generatedBy]
  );
  return id;
}

export async function updatePayrollRunStatus(connection, tenantId, runId, status, finalizedAt = null, supersededBy = null) {
  await connection.execute(
    `UPDATE payroll_runs
     SET status = ?, finalized_at = ?, superseded_by = COALESCE(?, superseded_by)
     WHERE tenant_id = ? AND id = ?`,
    [status, finalizedAt, supersededBy, tenantId, runId]
  );
}

// ── Line Items ────────────────────────────────────────────────────────────────

export async function listLineItems(connection, tenantId, runId) {
  const [rows] = await connection.execute(
    `SELECT id, run_id, tenant_id, employee_id, employee_name, wage_type, wage_rate,
            working_days_in_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            present_days, half_days, overtime_days, absent_days, leave_days,
            day_equivalents, gross_amount, adjustments_json, net_amount, payment_status, is_locked, locked_reason, paid_at
     FROM payroll_line_items
     WHERE tenant_id = ? AND run_id = ?
     ORDER BY employee_name ASC`,
    [tenantId, runId]
  );
  return rows;
}

export async function findLineItem(connection, tenantId, lineItemId) {
  const [rows] = await connection.execute(
    `SELECT id, run_id, tenant_id, employee_id, employee_name, wage_type, wage_rate,
            working_days_in_month,
            TO_CHAR(period_start_date, 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(period_end_date, 'YYYY-MM-DD') AS period_end_date,
            present_days, half_days, overtime_days, absent_days, leave_days,
            day_equivalents, gross_amount, adjustments_json, net_amount, payment_status, is_locked, locked_reason, paid_at
     FROM payroll_line_items
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, lineItemId]
  );
  return rows[0] || null;
}

export async function deleteLineItemsByRunId(connection, tenantId, runId) {
  await connection.execute(
    `DELETE FROM payroll_line_items WHERE tenant_id = ? AND run_id = ? AND is_locked = FALSE`,
    [tenantId, runId]
  );
}

export async function insertLineItem(connection, item) {
  await connection.execute(
    `INSERT INTO payroll_line_items
       (id, run_id, tenant_id, employee_id, employee_name, wage_type, wage_rate,
        working_days_in_month, period_start_date, period_end_date,
        present_days, half_days, overtime_days, absent_days, leave_days,
        day_equivalents, gross_amount, adjustments_json, net_amount, payment_status, is_locked, locked_reason, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.runId,
      item.tenantId,
      item.employeeId,
      item.employeeName,
      item.wageType,
      item.wageRate,
      item.workingDaysInMonth,
      item.periodStartDate || null,
      item.periodEndDate || null,
      item.presentDays,
      item.halfDays,
      item.overtimeDays,
      item.absentDays,
      item.leaveDays,
      item.dayEquivalents,
      item.grossAmount,
      item.adjustmentsJson ? JSON.stringify(item.adjustmentsJson) : null,
      item.netAmount,
      item.paymentStatus || 'pending',
      Boolean(item.isLocked),
      item.lockedReason || null,
      item.paidAt || null
    ]
  );
}

export async function getEmployeeLastPayrollPeriod(connection, tenantId, employeeId) {
  const [rows] = await connection.execute(
    `SELECT pli.id, pli.run_id,
            TO_CHAR(COALESCE(pli.period_start_date, pr.period_start_date), 'YYYY-MM-DD') AS period_start_date,
            TO_CHAR(COALESCE(pli.period_end_date, pr.period_end_date), 'YYYY-MM-DD') AS period_end_date,
            pr.period_year, pr.period_month, pr.status AS run_status, pli.payment_status
     FROM payroll_line_items pli
     JOIN payroll_runs pr ON pr.id = pli.run_id
     WHERE pli.tenant_id = ? AND pli.employee_id = ? AND pr.status != 'superseded'
     ORDER BY COALESCE(pli.period_end_date, pr.period_end_date, TO_DATE(pr.period_year || '-' || LPAD(pr.period_month::text, 2, '0') || '-01', 'YYYY-MM-DD')) DESC, pr.created_at DESC
     LIMIT 1`,
    [tenantId, employeeId]
  );
  return rows[0] || null;
}

export async function updateLineItemAdjustments(connection, tenantId, lineItemId, adjustments, netAmount) {
  await connection.execute(
    `UPDATE payroll_line_items
     SET adjustments_json = ?, net_amount = ?
     WHERE tenant_id = ? AND id = ?`,
    [JSON.stringify(adjustments), netAmount, tenantId, lineItemId]
  );
}

export async function updateLineItemPaymentStatus(connection, tenantId, lineItemId, status) {
  const paidAt = status === 'paid' ? new Date() : null;
  await connection.execute(
    `UPDATE payroll_line_items
     SET payment_status = ?, paid_at = ?
     WHERE tenant_id = ? AND id = ?`,
    [status, paidAt, tenantId, lineItemId]
  );
}

// ── Payout Transactions (E2-06) ───────────────────────────────────────────────

export async function findPayoutByIdempotency(connection, tenantId, idempotencyKey) {
  const [rows] = await connection.execute(
    `SELECT * FROM payout_transactions
     WHERE tenant_id = ? AND idempotency_key = ?
     LIMIT 1`,
    [tenantId, idempotencyKey]
  );
  return rows[0] || null;
}

export async function recordPayoutTransaction(connection, payout) {
  await connection.execute(
    `INSERT INTO payout_transactions
       (id, tenant_id, line_item_id, employee_id, payout_id, idempotency_key, amount, currency, mode, status, utr, raw_response_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payout.id,
      payout.tenantId,
      payout.lineItemId,
      payout.employeeId,
      payout.payoutId,
      payout.idempotencyKey,
      payout.amount,
      payout.currency || 'INR',
      payout.mode || 'UPI',
      payout.status || 'processing',
      payout.utr || null,
      payout.rawResponse ? JSON.stringify(payout.rawResponse) : null
    ]
  );
}

export async function updatePayoutStatusByRazorpayId(connection, payoutId, status, utr = null, failureReason = null) {
  await connection.execute(
    `UPDATE payout_transactions
     SET status = ?, utr = COALESCE(?, utr), failure_reason = ?, updated_at = CURRENT_TIMESTAMP
     WHERE payout_id = ?`,
    [status, utr, failureReason, payoutId]
  );

  const [rows] = await connection.execute(
    `SELECT * FROM payout_transactions WHERE payout_id = ? LIMIT 1`,
    [payoutId]
  );
  return rows[0] || null;
}
