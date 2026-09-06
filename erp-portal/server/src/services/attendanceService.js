import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import { listEmployeesByTenant } from '../repositories/employeeRepository.js';
import {
  upsertAttendanceRecord,
  getMonthlyAttendanceByTenant,
  getEmployeeMonthCalendar,
  getMonthlyAttendanceSummary
} from '../repositories/attendanceRepository.js';
import {
  calculateDayEquivalents,
  calculateDailyWage,
  calculateMonthlyWage,
  DEFAULT_SETTINGS
} from '../utils/payrollEngine.js';
import { syncDraftPayrollRunForPeriod } from './payrollService.js';

const VALID_STATUSES = ['present', 'absent', 'half_day', 'overtime', 'leave'];

export async function markDailyAttendance(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    for (const record of payload.records) {
      if (!VALID_STATUSES.includes(record.status)) {
        throw new AppError(400, `Invalid status: ${record.status}`, 'INVALID_STATUS');
      }

      await upsertAttendanceRecord(
        connection,
        context.tenantId,
        record.employeeId,
        payload.workDate,
        record.status,
        record.note || null,
        context.userId
      );
    }

    // Auto-sync any existing draft payroll run for this month
    const year = parseInt(payload.workDate.slice(0, 4), 10);
    const month = parseInt(payload.workDate.slice(5, 7), 10);
    await syncDraftPayrollRunForPeriod(connection, context.tenantId, year, month);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'attendance.mark',
      entity: 'attendance_records',
      entityId: payload.workDate,
      ipAddress: requestMeta.ipAddress
    });
  });
}

export async function getMonthGrid(context, year, month) {
  const connection = await pool.getConnection();

  try {
    const [employees, records] = await Promise.all([
      listEmployeesByTenant(connection, context.tenantId),
      getMonthlyAttendanceByTenant(connection, context.tenantId, year, month)
    ]);

    const byEmployee = {};
    for (const r of records) {
      const dateStr = typeof r.work_date === 'string'
        ? r.work_date
        : new Date(r.work_date).toISOString().slice(0, 10);

      if (!byEmployee[r.employee_id]) {
        byEmployee[r.employee_id] = {};
      }

      byEmployee[r.employee_id][dateStr] = {
        status: r.status,
        note: r.note
      };
    }

    return {
      year,
      month,
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        wageType: e.wage_type,
        wageRate: Number(e.wage_rate),
        isActive: Boolean(e.is_active)
      })),
      attendance: byEmployee
    };
  } finally {
    connection.release();
  }
}

export async function getEmployeeCalendar(context, employeeId, year, month) {
  const connection = await pool.getConnection();

  try {
    const records = await getEmployeeMonthCalendar(connection, context.tenantId, employeeId, year, month);
    return records.map((r) => ({
      date: typeof r.work_date === 'string'
        ? r.work_date
        : new Date(r.work_date).toISOString().slice(0, 10),
      status: r.status,
      note: r.note
    }));
  } finally {
    connection.release();
  }
}

export async function exportAttendanceSummary(context, year, month, settings = DEFAULT_SETTINGS) {
  const connection = await pool.getConnection();

  try {
    const rows = await getMonthlyAttendanceSummary(connection, context.tenantId, year, month);

    return rows.map((r) => {
      const summary = {
        present: Number(r.present_days || 0),
        halfDay: Number(r.half_days || 0),
        overtime: Number(r.overtime_days || 0),
        absent: Number(r.absent_days || 0),
        leave: Number(r.leave_days || 0)
      };

      const dayEquivalents = calculateDayEquivalents(summary, settings);
      const empObj = { wage_type: r.wage_type, wage_rate: r.wage_rate };

      let grossPayable;
      if (r.wage_type === 'daily') {
        ({ grossAmount: grossPayable } = calculateDailyWage(empObj, summary, settings));
      } else {
        ({ grossAmount: grossPayable } = calculateMonthlyWage(empObj, summary, settings));
      }

      return {
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        period: `${year}-${String(month).padStart(2, '0')}`,
        presentDays: summary.present,
        halfDays: summary.halfDay,
        overtimeDays: summary.overtime,
        absentDays: summary.absent,
        leaveDays: summary.leave,
        totalDayEquivalents: dayEquivalents,
        wageType: r.wage_type,
        wageRate: Number(r.wage_rate),
        grossPayable
      };
    });
  } finally {
    connection.release();
  }
}
