import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import { getMonthlyAttendanceSummary } from '../repositories/attendanceRepository.js';
import { findEmployeeByTenantAndId, listEmployeesByTenant } from '../repositories/employeeRepository.js';
import {
  getPayrollSettings,
  upsertPayrollSettings,
  createPayrollRun,
  findPayrollRun,
  findPayrollRunByPeriod,
  findPayrollRunByDateRange,
  listPayrollRuns,
  updatePayrollRunStatus,
  listLineItems,
  findLineItem,
  insertLineItem,
  deleteLineItemsByRunId,
  updateLineItemAdjustments,
  updateLineItemPaymentStatus,
  getEmployeeLastPayrollPeriod,
  findPayoutByIdempotency,
  recordPayoutTransaction
} from '../repositories/payrollRepository.js';
import { computeLineItem, applyAdjustments } from '../utils/payrollEngine.js';
import { decryptSensitiveField } from '../utils/encryption.js';

function publicLineItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    wageType: row.wage_type,
    wageRate: Number(row.wage_rate),
    workingDaysInMonth: row.working_days_in_month,
    periodStartDate: row.period_start_date || null,
    periodEndDate: row.period_end_date || null,
    presentDays: row.present_days,
    halfDays: row.half_days,
    overtimeDays: row.overtime_days,
    absentDays: row.absent_days,
    leaveDays: row.leave_days,
    dayEquivalents: Number(row.day_equivalents),
    totalDayEquivalents: Number(row.day_equivalents),
    grossAmount: Number(row.gross_amount),
    adjustments: row.adjustments_json
      ? (typeof row.adjustments_json === 'string' ? JSON.parse(row.adjustments_json) : row.adjustments_json)
      : [],
    netAmount: Number(row.net_amount),
    paymentStatus: row.payment_status,
    isLocked: Boolean(row.is_locked),
    lockedReason: row.locked_reason || null,
    paidAt: row.paid_at
  };
}

function publicRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    periodStartDate: row.period_start_date || null,
    periodEndDate: row.period_end_date || null,
    version: row.version || 1,
    supersedesRunId: row.supersedes_run_id || null,
    supersededBy: row.superseded_by || null,
    status: row.status,
    generatedBy: row.generated_by,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at
  };
}

export async function computeEmployeeRollingPeriod(connection, tenantId, employee, targetStartDate = null, targetEndDate = null) {
  let startDate = targetStartDate;
  let endDate = targetEndDate || new Date().toISOString().slice(0, 10);

  if (!startDate) {
    const lastRun = await getEmployeeLastPayrollPeriod(connection, tenantId, employee.id);
    if (lastRun && lastRun.period_end_date) {
      // Automatically default to the day AFTER the previous payroll run's period_end_date
      const prevEnd = new Date(lastRun.period_end_date);
      prevEnd.setDate(prevEnd.getDate() + 1);
      startDate = prevEnd.toISOString().slice(0, 10);
    } else if (lastRun && lastRun.period_year && lastRun.period_month) {
      // Legacy fallback: 1st of following month
      const y = Number(lastRun.period_year);
      const m = Number(lastRun.period_month);
      const nextMonth = new Date(Date.UTC(y, m, 1));
      startDate = nextMonth.toISOString().slice(0, 10);
    } else {
      // Very first payroll run: default to joining date or first attendance record date
      if (employee.joining_date) {
        startDate = new Date(employee.joining_date).toISOString().slice(0, 10);
      } else {
        const [earliestAtt] = await connection.execute(
          `SELECT TO_CHAR(MIN(work_date), 'YYYY-MM-DD') AS min_date FROM attendance_records WHERE tenant_id = ? AND employee_id = ?`,
          [tenantId, employee.id]
        );
        if (earliestAtt[0]?.min_date) {
          startDate = earliestAtt[0].min_date;
        } else {
          // Fallback to start of current month
          const now = new Date();
          startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
        }
      }
    }
  }

  // Sanity clamp: start date cannot exceed end date
  if (startDate > endDate) {
    startDate = endDate;
  }

  return { startDate, endDate };
}

export async function previewPayrollRun(context, options = {}) {
  const connection = await pool.getConnection();
  try {
    const { startDate = null, endDate = new Date().toISOString().slice(0, 10) } = options;
    const { getAttendanceSummaryForDateRange } = await import('../repositories/attendanceRepository.js');
    const { findUnadjustedAdvancesForDateRange, findOlderUnadjustedAdvances } = await import('../repositories/employeeRepository.js');

    const settings = await getPayrollSettings(connection, context.tenantId);
    const employees = await listEmployeesByTenant(connection, context.tenantId);
    const activeEmployees = employees.filter((e) => Boolean(e.is_active));

    const previewItems = [];
    let grandTotalGross = 0;
    let grandTotalNet = 0;
    let grandTotalOlderAdvances = 0;

    for (const emp of activeEmployees) {
      const { startDate: empStart, endDate: empEnd } = await computeEmployeeRollingPeriod(
        connection,
        context.tenantId,
        emp,
        startDate,
        endDate
      );

      const attRows = await getAttendanceSummaryForDateRange(connection, context.tenantId, empStart, empEnd, emp.id);
      const attRow = attRows[0] || {};
      const summary = {
        present: Number(attRow.present_days || 0),
        halfDay: Number(attRow.half_days || 0),
        overtime: Number(attRow.overtime_days || 0),
        absent: Number(attRow.absent_days || 0),
        leave: Number(attRow.leave_days || 0)
      };

      const lineCalc = computeLineItem(emp, summary, settings);

      // Scoped advances strictly within [empStart, empEnd]
      const scopedAdvances = await findUnadjustedAdvancesForDateRange(connection, context.tenantId, empStart, empEnd, emp.id);
      const adjustments = scopedAdvances.map((adv) => ({
        id: randomUUID(),
        advanceId: adv.id,
        type: 'deduction',
        label: `Advance on ${adv.advance_date}${adv.notes ? ` (${adv.notes})` : ''}`,
        amount: Number(adv.amount)
      }));

      const netAmount = applyAdjustments(lineCalc.grossAmount, adjustments);

      // Older unadjusted advances before empStart
      const olderAdvances = await findOlderUnadjustedAdvances(connection, context.tenantId, empStart, emp.id);
      const olderAdvancesTotal = olderAdvances.reduce((s, a) => s + Number(a.amount || 0), 0);

      grandTotalGross += lineCalc.grossAmount;
      grandTotalNet += netAmount;
      grandTotalOlderAdvances += olderAdvancesTotal;

      previewItems.push({
        employeeId: emp.id,
        employeeName: emp.name,
        wageType: emp.wage_type,
        wageRate: Number(emp.wage_rate),
        periodStartDate: empStart,
        periodEndDate: empEnd,
        attendance: summary,
        dayEquivalents: lineCalc.dayEquivalents,
        grossAmount: lineCalc.grossAmount,
        scopedAdvances: scopedAdvances.map((a) => ({
          id: a.id,
          amount: Number(a.amount),
          advanceDate: a.advance_date,
          notes: a.notes
        })),
        adjustments,
        netAmount,
        olderUnadjustedAdvances: olderAdvances.map((a) => ({
          id: a.id,
          amount: Number(a.amount),
          advanceDate: a.advance_date,
          notes: a.notes
        })),
        olderUnadjustedAdvancesTotal: olderAdvancesTotal
      });
    }

    return {
      periodStartDate: startDate || previewItems[0]?.periodStartDate || new Date().toISOString().slice(0, 10),
      periodEndDate: endDate,
      totalEmployees: activeEmployees.length,
      grandTotalGross: Math.round(grandTotalGross * 100) / 100,
      grandTotalNet: Math.round(grandTotalNet * 100) / 100,
      grandTotalOlderAdvances: Math.round(grandTotalOlderAdvances * 100) / 100,
      items: previewItems
    };
  } finally {
    connection.release();
  }
}

export async function syncDraftPayrollRunForPeriod(connection, tenantId, runIdOrYear, maybeMonth) {
  let run;
  if (typeof runIdOrYear === 'string' && runIdOrYear.length > 10) {
    run = await findPayrollRun(connection, tenantId, runIdOrYear);
  } else {
    run = await findPayrollRunByPeriod(connection, tenantId, Number(runIdOrYear), Number(maybeMonth));
  }

  if (!run || run.status !== 'draft') return null;

  const { getAttendanceSummaryForDateRange } = await import('../repositories/attendanceRepository.js');
  const { findUnadjustedAdvancesForDateRange, markAdvanceAdjustedInRun, resetAdvancesForRun } = await import('../repositories/employeeRepository.js');

  const settings = await getPayrollSettings(connection, tenantId);
  const employees = await listEmployeesByTenant(connection, tenantId);
  const existingLineItems = await listLineItems(connection, tenantId, run.id);

  const existingMap = {};
  const adjustmentsByEmployee = {};
  for (const item of existingLineItems) {
    existingMap[item.employee_id] = item;
    if (item.adjustments_json) {
      const parsed = typeof item.adjustments_json === 'string'
        ? JSON.parse(item.adjustments_json)
        : item.adjustments_json;
      // Filter out auto-advances so we can re-evaluate freshly
      adjustmentsByEmployee[item.employee_id] = parsed.filter((a) => !a.advanceId);
    }
  }

  await resetAdvancesForRun(connection, tenantId, run.id);
  await deleteLineItemsByRunId(connection, tenantId, run.id);

  for (const emp of employees.filter((e) => Boolean(e.is_active))) {
    const prevItem = existingMap[emp.id];
    let empStart = prevItem?.period_start_date || run.period_start_date;
    let empEnd = prevItem?.period_end_date || run.period_end_date;

    if (!empStart || !empEnd) {
      const computed = await computeEmployeeRollingPeriod(
        connection,
        tenantId,
        emp,
        run.period_start_date,
        run.period_end_date || new Date().toISOString().slice(0, 10)
      );
      empStart = computed.startDate;
      empEnd = computed.endDate;
    }

    const attRows = await getAttendanceSummaryForDateRange(connection, tenantId, empStart, empEnd, emp.id);
    const attRow = attRows[0] || {};
    const summary = {
      present: Number(attRow.present_days || 0),
      halfDay: Number(attRow.half_days || 0),
      overtime: Number(attRow.overtime_days || 0),
      absent: Number(attRow.absent_days || 0),
      leave: Number(attRow.leave_days || 0)
    };

    const lineCalc = computeLineItem(emp, summary, settings);
    const existingAdj = [...(adjustmentsByEmployee[emp.id] || [])];

    // Scoped advances strictly within [empStart, empEnd]
    const advances = await findUnadjustedAdvancesForDateRange(connection, tenantId, empStart, empEnd, emp.id);
    for (const adv of advances) {
      existingAdj.push({
        id: randomUUID(),
        advanceId: adv.id,
        type: 'deduction',
        label: `Advance on ${adv.advance_date}${adv.notes ? ` (${adv.notes})` : ''}`,
        amount: Number(adv.amount)
      });
      await markAdvanceAdjustedInRun(connection, tenantId, adv.id, run.id);
    }

    const netAmount = applyAdjustments(lineCalc.grossAmount, existingAdj);

    await insertLineItem(connection, {
      id: randomUUID(),
      runId: run.id,
      tenantId,
      employeeId: emp.id,
      employeeName: emp.name,
      wageType: emp.wage_type,
      wageRate: Number(emp.wage_rate),
      workingDaysInMonth: settings.workingDaysPerMonth,
      periodStartDate: empStart,
      periodEndDate: empEnd,
      presentDays: lineCalc.present,
      halfDays: lineCalc.halfDay,
      overtimeDays: lineCalc.overtime,
      absentDays: lineCalc.absent,
      leaveDays: lineCalc.leave,
      dayEquivalents: lineCalc.dayEquivalents,
      grossAmount: lineCalc.grossAmount,
      adjustmentsJson: existingAdj,
      netAmount,
      paymentStatus: 'pending',
      isLocked: false
    });
  }

  return run.id;
}

export async function resyncPayrollRun(context, runId, requestMeta) {
  return withTransaction(async (connection) => {
    const run = await findPayrollRun(connection, context.tenantId, runId);
    if (!run) throw new AppError(404, 'Payroll run not found', 'NOT_FOUND');
    if (run.status !== 'draft') {
      throw new AppError(409, 'Only draft payroll runs can be re-synced with attendance', 'RUN_LOCKED');
    }

    await syncDraftPayrollRunForPeriod(connection, context.tenantId, run.id);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'payroll.resync',
      entity: 'payroll_runs',
      entityId: run.id,
      ipAddress: requestMeta.ipAddress
    });

    const refreshedRun = await findPayrollRun(connection, context.tenantId, run.id);
    const lineItems = await listLineItems(connection, context.tenantId, run.id);
    return { run: publicRun(refreshedRun), lineItems: lineItems.map(publicLineItem) };
  });
}

export async function generatePayrollRun(context, arg1, arg2, arg3) {
  return withTransaction(async (connection) => {
    let year, month, startDate, endDate, requestMeta;

    if (typeof arg1 === 'object' && arg1 !== null) {
      startDate = arg1.startDate || arg1.periodStartDate || null;
      endDate = arg1.endDate || arg1.periodEndDate || new Date().toISOString().slice(0, 10);
      year = arg1.year ? Number(arg1.year) : new Date(endDate).getFullYear();
      month = arg1.month ? Number(arg1.month) : (new Date(endDate).getMonth() + 1);
      requestMeta = arg2 || {};
    } else {
      year = Number(arg1);
      month = Number(arg2);
      requestMeta = arg3 || {};
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      startDate = `${prefix}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${prefix}-${String(lastDay).padStart(2, '0')}`;
    }

    // Check for existing run by period or date range
    let existing = null;
    if (startDate && endDate) {
      existing = await findPayrollRunByDateRange(connection, context.tenantId, startDate, endDate);
    }
    if (!existing && year && month) {
      existing = await findPayrollRunByPeriod(connection, context.tenantId, year, month);
    }

    if (existing) {
      if (existing.status === 'draft') {
        return resyncPayrollRun(context, existing.id, requestMeta);
      }
      throw new AppError(
        409,
        `Payroll run for period ${existing.period_start_date || `${year}-${month}`} to ${existing.period_end_date || ''} already exists (Status: ${existing.status}). Use 'Regenerate Payroll' to create a superseding version.`,
        'RUN_ALREADY_EXISTS'
      );
    }

    const { getAttendanceSummaryForDateRange } = await import('../repositories/attendanceRepository.js');
    const { findUnadjustedAdvancesForDateRange, markAdvanceAdjustedInRun } = await import('../repositories/employeeRepository.js');

    const settings = await getPayrollSettings(connection, context.tenantId);
    const employees = await listEmployeesByTenant(connection, context.tenantId);
    const activeEmployees = employees.filter((e) => Boolean(e.is_active));

    // Determine overall run start & end date
    const runStartDate = startDate || new Date().toISOString().slice(0, 10);
    const runEndDate = endDate || new Date().toISOString().slice(0, 10);

    const runId = await createPayrollRun(
      connection,
      context.tenantId,
      year,
      month,
      context.userId,
      1,
      null,
      runStartDate,
      runEndDate
    );

    for (const emp of activeEmployees) {
      // Calculate per-employee rolling period!
      const { startDate: empStart, endDate: empEnd } = await computeEmployeeRollingPeriod(
        connection,
        context.tenantId,
        emp,
        startDate,
        endDate
      );

      // Attendance scoped strictly within [empStart, empEnd]
      const attRows = await getAttendanceSummaryForDateRange(connection, context.tenantId, empStart, empEnd, emp.id);
      const attRow = attRows[0] || {};
      const summary = {
        present: Number(attRow.present_days || 0),
        halfDay: Number(attRow.half_days || 0),
        overtime: Number(attRow.overtime_days || 0),
        absent: Number(attRow.absent_days || 0),
        leave: Number(attRow.leave_days || 0)
      };

      const lineCalc = computeLineItem(emp, summary, settings);

      // Advances scoped strictly within [empStart, empEnd]
      const scopedAdvances = await findUnadjustedAdvancesForDateRange(connection, context.tenantId, empStart, empEnd, emp.id);
      const adjustments = [];
      for (const adv of scopedAdvances) {
        adjustments.push({
          id: randomUUID(),
          advanceId: adv.id,
          type: 'deduction',
          label: `Advance on ${adv.advance_date}${adv.notes ? ` (${adv.notes})` : ''}`,
          amount: Number(adv.amount)
        });
        await markAdvanceAdjustedInRun(connection, context.tenantId, adv.id, runId);
      }

      const netAmount = applyAdjustments(lineCalc.grossAmount, adjustments);

      await insertLineItem(connection, {
        id: randomUUID(),
        runId,
        tenantId: context.tenantId,
        employeeId: emp.id,
        employeeName: emp.name,
        wageType: emp.wage_type,
        wageRate: Number(emp.wage_rate),
        workingDaysInMonth: settings.workingDaysPerMonth,
        periodStartDate: empStart,
        periodEndDate: empEnd,
        presentDays: lineCalc.present,
        halfDays: lineCalc.halfDay,
        overtimeDays: lineCalc.overtime,
        absentDays: lineCalc.absent,
        leaveDays: lineCalc.leave,
        dayEquivalents: lineCalc.dayEquivalents,
        grossAmount: lineCalc.grossAmount,
        adjustmentsJson: adjustments.length > 0 ? adjustments : null,
        netAmount,
        paymentStatus: 'pending',
        isLocked: false
      });
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'payroll.generate',
      entity: 'payroll_runs',
      entityId: runId,
      ipAddress: requestMeta.ipAddress
    });

    const run = await findPayrollRun(connection, context.tenantId, runId);
    const lineItems = await listLineItems(connection, context.tenantId, runId);
    return { run: publicRun(run), lineItems: lineItems.map(publicLineItem) };
  });
}

// ── Feature 2: Versioned Payroll Regeneration with Paid Employee Protection ──

export async function previewPayrollRegeneration(context, arg1, arg2) {
  const connection = await pool.getConnection();
  try {
    let run = null;
    if (typeof arg1 === 'string' && arg1.length > 10) {
      run = await findPayrollRun(connection, context.tenantId, arg1);
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      if (arg1.runId) run = await findPayrollRun(connection, context.tenantId, arg1.runId);
      else if (arg1.startDate && arg1.endDate) run = await findPayrollRunByDateRange(connection, context.tenantId, arg1.startDate, arg1.endDate);
      else if (arg1.year && arg1.month) run = await findPayrollRunByPeriod(connection, context.tenantId, Number(arg1.year), Number(arg1.month));
    } else if (arg1 && arg2) {
      run = await findPayrollRunByPeriod(connection, context.tenantId, Number(arg1), Number(arg2));
    }

    if (!run) {
      return {
        canRegenerate: false,
        message: 'No previous payroll run exists for this period.'
      };
    }

    const lineItems = await listLineItems(connection, context.tenantId, run.id);
    const lockedItems = lineItems.filter((li) => li.payment_status === 'paid' || li.is_locked);
    const pendingItems = lineItems.filter((li) => li.payment_status !== 'paid' && !li.is_locked);

    return {
      canRegenerate: true,
      previousRun: publicRun(run),
      nextVersion: (run.version || 1) + 1,
      totalEmployees: lineItems.length,
      lockedCount: lockedItems.length,
      pendingCount: pendingItems.length,
      lockedLineItems: lockedItems.map(publicLineItem),
      pendingLineItems: pendingItems.map(publicLineItem)
    };
  } finally {
    connection.release();
  }
}

export async function regeneratePayrollRun(context, arg1, arg2, arg3) {
  return withTransaction(async (connection) => {
    let previousRun = null;
    let requestMeta = {};

    if (typeof arg1 === 'object' && arg1 !== null) {
      if (arg1.runId) previousRun = await findPayrollRun(connection, context.tenantId, arg1.runId);
      else if (arg1.startDate && arg1.endDate) previousRun = await findPayrollRunByDateRange(connection, context.tenantId, arg1.startDate, arg1.endDate);
      else if (arg1.year && arg1.month) previousRun = await findPayrollRunByPeriod(connection, context.tenantId, Number(arg1.year), Number(arg1.month));
      requestMeta = arg2 || {};
    } else if (typeof arg1 === 'string' && arg1.length > 10) {
      previousRun = await findPayrollRun(connection, context.tenantId, arg1);
      requestMeta = arg2 || {};
    } else {
      previousRun = await findPayrollRunByPeriod(connection, context.tenantId, Number(arg1), Number(arg2));
      requestMeta = arg3 || {};
    }

    if (!previousRun) {
      throw new AppError(404, 'No previous payroll run found for this period to regenerate', 'NOT_FOUND');
    }

    if (previousRun.status === 'draft') {
      return resyncPayrollRun(context, previousRun.id, requestMeta);
    }

    const newVersion = (previousRun.version || 1) + 1;
    const newRunId = await createPayrollRun(
      connection,
      context.tenantId,
      previousRun.period_year,
      previousRun.period_month,
      context.userId,
      newVersion,
      previousRun.id,
      previousRun.period_start_date,
      previousRun.period_end_date
    );

    const { getAttendanceSummaryForDateRange } = await import('../repositories/attendanceRepository.js');
    const { findUnadjustedAdvancesForDateRange, markAdvanceAdjustedInRun } = await import('../repositories/employeeRepository.js');

    const settings = await getPayrollSettings(connection, context.tenantId);
    const employees = await listEmployeesByTenant(connection, context.tenantId);
    const previousLineItems = await listLineItems(connection, context.tenantId, previousRun.id);

    const prevMap = {};
    for (const item of previousLineItems) {
      prevMap[item.employee_id] = item;
    }

    const lockedEmployeeIds = [];
    const recalculatedEmployeeIds = [];

    for (const emp of employees.filter((e) => Boolean(e.is_active))) {
      const prevItem = prevMap[emp.id];

      // CRITICAL RULE: If previous payslip was already marked PAID, LOCK and PROTECT it untouched!
      if (prevItem && (prevItem.payment_status === 'paid' || prevItem.is_locked)) {
        lockedEmployeeIds.push(emp.id);
        const adj = prevItem.adjustments_json
          ? (typeof prevItem.adjustments_json === 'string' ? JSON.parse(prevItem.adjustments_json) : prevItem.adjustments_json)
          : [];

        await insertLineItem(connection, {
          id: randomUUID(),
          runId: newRunId,
          tenantId: context.tenantId,
          employeeId: emp.id,
          employeeName: emp.name,
          wageType: prevItem.wage_type,
          wageRate: Number(prevItem.wage_rate),
          workingDaysInMonth: prevItem.working_days_in_month,
          periodStartDate: prevItem.period_start_date || previousRun.period_start_date,
          periodEndDate: prevItem.period_end_date || previousRun.period_end_date,
          presentDays: prevItem.present_days,
          halfDays: prevItem.half_days,
          overtimeDays: prevItem.overtime_days,
          absentDays: prevItem.absent_days,
          leaveDays: prevItem.leave_days,
          dayEquivalents: Number(prevItem.day_equivalents),
          grossAmount: Number(prevItem.gross_amount),
          adjustmentsJson: adj,
          netAmount: Number(prevItem.net_amount),
          paymentStatus: 'paid',
          isLocked: true,
          lockedReason: 'already_paid_in_previous_run',
          paidAt: prevItem.paid_at || new Date()
        });
      } else {
        // Recalculate pending employee
        recalculatedEmployeeIds.push(emp.id);
        const empStart = prevItem?.period_start_date || previousRun.period_start_date;
        const empEnd = prevItem?.period_end_date || previousRun.period_end_date;

        const attRows = await getAttendanceSummaryForDateRange(connection, context.tenantId, empStart, empEnd, emp.id);
        const attRow = attRows[0] || {};
        const summary = {
          present: Number(attRow.present_days || 0),
          halfDay: Number(attRow.half_days || 0),
          overtime: Number(attRow.overtime_days || 0),
          absent: Number(attRow.absent_days || 0),
          leave: Number(attRow.leave_days || 0)
        };

        const lineCalc = computeLineItem(emp, summary, settings);

        // Previous manual adjustments (without old advance duplicates)
        const prevAdj = (prevItem?.adjustments_json
          ? (typeof prevItem.adjustments_json === 'string' ? JSON.parse(prevItem.adjustments_json) : prevItem.adjustments_json)
          : []).filter((a) => !a.advanceId);

        // Scoped advances strictly within [empStart, empEnd]
        const advances = await findUnadjustedAdvancesForDateRange(connection, context.tenantId, empStart, empEnd, emp.id);
        for (const adv of advances) {
          prevAdj.push({
            id: randomUUID(),
            advanceId: adv.id,
            type: 'deduction',
            label: `Advance on ${adv.advance_date}${adv.notes ? ` (${adv.notes})` : ''}`,
            amount: Number(adv.amount)
          });
          await markAdvanceAdjustedInRun(connection, context.tenantId, adv.id, newRunId);
        }

        const netAmount = applyAdjustments(lineCalc.grossAmount, prevAdj);

        await insertLineItem(connection, {
          id: randomUUID(),
          runId: newRunId,
          tenantId: context.tenantId,
          employeeId: emp.id,
          employeeName: emp.name,
          wageType: emp.wage_type,
          wageRate: Number(emp.wage_rate),
          workingDaysInMonth: settings.workingDaysPerMonth,
          periodStartDate: empStart,
          periodEndDate: empEnd,
          presentDays: lineCalc.present,
          halfDays: lineCalc.halfDay,
          overtimeDays: lineCalc.overtime,
          absentDays: lineCalc.absent,
          leaveDays: lineCalc.leave,
          dayEquivalents: lineCalc.dayEquivalents,
          grossAmount: lineCalc.grossAmount,
          adjustmentsJson: prevAdj,
          netAmount,
          paymentStatus: 'pending',
          isLocked: false
        });
      }
    }

    // Mark previous run as superseded
    await updatePayrollRunStatus(connection, context.tenantId, previousRun.id, 'superseded', null, newRunId);

    // Audit log
    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'payroll.regenerate',
      entity: 'payroll_runs',
      entityId: newRunId,
      ipAddress: requestMeta.ipAddress,
      metadata: {
        previousRunId: previousRun.id,
        version: newVersion,
        periodYear: previousRun.period_year,
        periodMonth: previousRun.period_month,
        periodStartDate: previousRun.period_start_date,
        periodEndDate: previousRun.period_end_date,
        lockedEmployeeIds,
        recalculatedEmployeeIds
      }
    });

    const newRun = await findPayrollRun(connection, context.tenantId, newRunId);
    const lineItems = await listLineItems(connection, context.tenantId, newRunId);
    return { run: publicRun(newRun), lineItems: lineItems.map(publicLineItem) };
  });
}

export async function addAdjustment(context, lineItemId, adjustment, requestMeta) {
  return withTransaction(async (connection) => {
    const item = await findLineItem(connection, context.tenantId, lineItemId);
    if (!item) throw new AppError(404, 'Line item not found', 'NOT_FOUND');

    const run = await findPayrollRun(connection, context.tenantId, item.run_id);
    if (run.status === 'finalized' || run.status === 'paid') {
      throw new AppError(409, 'Cannot adjust a finalized or paid payroll run', 'RUN_LOCKED');
    }

    const existingAdj = item.adjustments_json
      ? (typeof item.adjustments_json === 'string' ? JSON.parse(item.adjustments_json) : item.adjustments_json)
      : [];

    const newAdj = [...existingAdj, { id: randomUUID(), ...adjustment }];
    const netAmount = applyAdjustments(Number(item.gross_amount), newAdj);

    await updateLineItemAdjustments(connection, context.tenantId, lineItemId, newAdj, netAmount);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'payroll.adjustment',
      entity: 'payroll_line_items',
      entityId: lineItemId,
      ipAddress: requestMeta.ipAddress
    });

    const updated = await findLineItem(connection, context.tenantId, lineItemId);
    return publicLineItem(updated);
  });
}

export async function removeAdjustment(context, lineItemId, adjustmentId, requestMeta) {
  return withTransaction(async (connection) => {
    const item = await findLineItem(connection, context.tenantId, lineItemId);
    if (!item) throw new AppError(404, 'Line item not found', 'NOT_FOUND');

    const run = await findPayrollRun(connection, context.tenantId, item.run_id);
    if (run.status !== 'draft') {
      throw new AppError(409, 'Run is not in draft status', 'RUN_LOCKED');
    }

    const existingAdj = item.adjustments_json
      ? (typeof item.adjustments_json === 'string' ? JSON.parse(item.adjustments_json) : item.adjustments_json)
      : [];
    const newAdj = existingAdj.filter((a) => a.id !== adjustmentId);
    const netAmount = applyAdjustments(Number(item.gross_amount), newAdj);

    await updateLineItemAdjustments(connection, context.tenantId, lineItemId, newAdj, netAmount);

    const updated = await findLineItem(connection, context.tenantId, lineItemId);
    return publicLineItem(updated);
  });
}

export async function getPayrollRunDetail(context, runId) {
  const connection = await pool.getConnection();
  try {
    const run = await findPayrollRun(connection, context.tenantId, runId);
    if (!run) throw new AppError(404, 'Payroll run not found', 'NOT_FOUND');

    const lineItems = await listLineItems(connection, context.tenantId, runId);
    const totalGross = lineItems.reduce((s, li) => s + Number(li.gross_amount), 0);
    const totalNet = lineItems.reduce((s, li) => s + Number(li.net_amount), 0);

    const { findOlderUnadjustedAdvances } = await import('../repositories/employeeRepository.js');
    const olderAdvancesList = [];
    for (const li of lineItems) {
      const empStart = li.period_start_date || run.period_start_date;
      if (empStart) {
        const older = await findOlderUnadjustedAdvances(connection, context.tenantId, empStart, li.employee_id);
        for (const adv of older) {
          olderAdvancesList.push({
            id: adv.id,
            employeeId: adv.employee_id,
            employeeName: adv.employee_name,
            amount: Number(adv.amount),
            advanceDate: adv.advance_date,
            notes: adv.notes
          });
        }
      }
    }

    const totalOlderUnadjusted = olderAdvancesList.reduce((s, a) => s + a.amount, 0);

    return {
      run: publicRun(run),
      lineItems: lineItems.map(publicLineItem),
      olderUnadjustedAdvances: olderAdvancesList,
      summary: {
        totalEmployees: lineItems.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        pendingCount: lineItems.filter((li) => li.payment_status === 'pending').length,
        paidCount: lineItems.filter((li) => li.payment_status === 'paid').length,
        olderUnadjustedCount: olderAdvancesList.length,
        olderUnadjustedTotal: Math.round(totalOlderUnadjusted * 100) / 100
      }
    };
  } finally {
    connection.release();
  }
}

export async function listRuns(context) {
  const connection = await pool.getConnection();
  try {
    const runs = await listPayrollRuns(connection, context.tenantId);
    return runs.map(publicRun);
  } finally {
    connection.release();
  }
}

export async function finalizeRun(context, runId, requestMeta) {
  return withTransaction(async (connection) => {
    const run = await findPayrollRun(connection, context.tenantId, runId);
    if (!run) throw new AppError(404, 'Payroll run not found', 'NOT_FOUND');
    if (run.status !== 'draft') throw new AppError(409, 'Only draft runs can be finalized', 'RUN_NOT_DRAFT');

    await updatePayrollRunStatus(connection, context.tenantId, runId, 'finalized', new Date());

    const lineItems = await listLineItems(connection, context.tenantId, runId);
    const totalNet = lineItems.reduce((s, li) => s + Number(li.net_amount), 0);
    const rounded = Math.round(totalNet * 100) / 100;

    await connection.execute(
      `INSERT INTO expense_entries (id, tenant_id, entry_date, category, description, amount, reference_id, auto_posted)
       VALUES (?, ?, ?, 'salary', ?, ?, ?, TRUE)`,
      [
        randomUUID(),
        context.tenantId,
        new Date().toISOString().slice(0, 10),
        `Payroll ${run.period_year}-${String(run.period_month).padStart(2, '0')}`,
        rounded,
        runId
      ]
    );

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'payroll.finalize',
      entity: 'payroll_runs',
      entityId: runId,
      ipAddress: requestMeta.ipAddress
    });

    return getPayrollRunDetail(context, runId);
  });
}

export async function markLineItemPaid(context, lineItemId, requestMeta) {
  return withTransaction(async (connection) => {
    const item = await findLineItem(connection, context.tenantId, lineItemId);
    if (!item) throw new AppError(404, 'Line item not found', 'NOT_FOUND');

    const run = await findPayrollRun(connection, context.tenantId, item.run_id);
    if (run.status === 'draft') throw new AppError(409, 'Finalize the run before recording payments', 'RUN_DRAFT');

    await updateLineItemPaymentStatus(connection, context.tenantId, lineItemId, 'paid');

    const allItems = await listLineItems(connection, context.tenantId, item.run_id);
    const allPaid = allItems.every((li) => li.payment_status === 'paid' || li.id === item.id);
    if (allPaid) {
      await updatePayrollRunStatus(connection, context.tenantId, item.run_id, 'paid');
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'payroll.paid',
      entity: 'payroll_line_items',
      entityId: lineItemId,
      ipAddress: requestMeta.ipAddress
    });

    const updated = await findLineItem(connection, context.tenantId, lineItemId);
    return publicLineItem(updated);
  });
}

export async function getPayslipData(context, lineItemId) {
  const connection = await pool.getConnection();
  try {
    const item = await findLineItem(connection, context.tenantId, lineItemId);
    if (!item) throw new AppError(404, 'Line item not found', 'NOT_FOUND');

    const run = await findPayrollRun(connection, context.tenantId, item.run_id);
    const employee = await findEmployeeByTenantAndId(connection, context.tenantId, item.employee_id);
    const [tenantRows] = await connection.execute(
      `SELECT id, business_name, gst_number FROM tenants WHERE id = ? LIMIT 1`,
      [context.tenantId]
    );

    if (!run) throw new AppError(404, 'Payroll run not found', 'NOT_FOUND');

    const tenantRow = tenantRows[0] || {};
    const adjustments = item.adjustments_json
      ? (typeof item.adjustments_json === 'string' ? JSON.parse(item.adjustments_json) : item.adjustments_json)
      : [];

    const lineItemData = publicLineItem(item);
    lineItemData.totalDayEquivalents = lineItemData.dayEquivalents;

    return {
      tenant: {
        id: tenantRow.id || context.tenantId,
        businessName: tenantRow.business_name || 'ContractorOS',
        gstNumber: tenantRow.gst_number || null
      },
      employee: employee ? {
        id: employee.id,
        name: employee.name,
        phone: employee.phone || null,
        wageType: employee.wage_type,
        wageRate: Number(employee.wage_rate),
        bankDetailsLast4: employee.bank_details_last4 || null,
        upiIdLast4: employee.upi_id_last4 || null
      } : {
        id: item.employee_id,
        name: item.employee_name,
        phone: null,
        wageType: item.wage_type,
        wageRate: Number(item.wage_rate),
        bankDetailsLast4: null,
        upiIdLast4: null
      },
      run: publicRun(run),
      lineItem: lineItemData,
      adjustments
    };
  } finally {
    connection.release();
  }
}

export async function getSettings(context) {
  const connection = await pool.getConnection();
  try {
    return getPayrollSettings(connection, context.tenantId);
  } finally {
    connection.release();
  }
}

export async function saveSettings(context, settings) {
  return withTransaction(async (connection) => {
    await upsertPayrollSettings(connection, context.tenantId, settings);
    return getPayrollSettings(connection, context.tenantId);
  });
}
