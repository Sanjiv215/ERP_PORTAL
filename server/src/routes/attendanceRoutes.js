import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/requireRole.js';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  markDailyAttendance,
  getMonthGrid,
  getEmployeeCalendar,
  exportAttendanceSummary
} from '../services/attendanceService.js';
import { markAttendanceSchema, monthQuerySchema } from './attendanceSchemas.js';
import { generateAttendancePdf } from '../utils/pdfGenerator.js';
import { generateAttendanceExcel } from '../utils/excelGenerator.js';

export const attendanceRouter = Router();

function requestMeta(req) {
  return { ipAddress: req.ip };
}

function parseMonthQuery(query) {
  const result = monthQuerySchema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, 'Invalid year or month parameters', 'VALIDATION_ERROR');
  }
  return result.data;
}

attendanceRouter.use(resolveTenantContext);

// E1-03: Get monthly attendance grid
attendanceRouter.get(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const { year, month } = parseMonthQuery(req.query);
    const grid = await getMonthGrid(req.context, year, month);
    res.json(grid);
  })
);

// E1-03: Mark attendance (bulk mark all or individual overrides)
attendanceRouter.post(
  '/',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER]),
  validateBody(markAttendanceSchema),
  asyncHandler(async (req, res) => {
    await markDailyAttendance(req.context, req.body, requestMeta(req));
    res.status(204).end();
  })
);

// E1-04: Per-employee calendar view
attendanceRouter.get(
  '/:employeeId/calendar',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const { year, month } = parseMonthQuery(req.query);
    const calendar = await getEmployeeCalendar(req.context, req.params.employeeId, year, month);
    res.json({ calendar });
  })
);

// E1-06: Attendance summary export (CSV / JSON / PDF / XLSX)
attendanceRouter.get(
  '/export',
  requireRole([ROLES.TENANT_ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT]),
  asyncHandler(async (req, res) => {
    const { year, month } = parseMonthQuery(req.query);
    const format = (req.query.format || 'json').toLowerCase();
    const rows = await exportAttendanceSummary(req.context, year, month);
    const period = `${year}-${String(month).padStart(2, '0')}`;

    if (format === 'pdf') {
      const buffer = await generateAttendancePdf({ period, rows });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Attendance_${period}.pdf"`);
      return res.send(buffer);
    }

    if (format === 'xlsx' || format === 'excel') {
      const buffer = await generateAttendanceExcel({ period, rows });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Attendance_${period}.xlsx"`);
      return res.send(buffer);
    }

    if (format === 'json') {
      return res.json({
        period,
        rows
      });
    }

    const headers = [
      'employee_id',
      'employee_name',
      'period',
      'present_days',
      'half_days',
      'overtime_days',
      'absent_days',
      'leave_days',
      'total_day_equivalents',
      'wage_type',
      'wage_rate',
      'gross_payable'
    ];

    const csvLines = rows.map((r) => [
      r.employeeId,
      `"${(r.employeeName || '').replace(/"/g, '""')}"`,
      r.period,
      r.presentDays,
      r.halfDays,
      r.overtimeDays,
      r.absentDays,
      r.leaveDays,
      r.totalDayEquivalents,
      r.wageType,
      r.wageRate,
      r.grossPayable
    ].join(','));

    const csv = [headers.join(','), ...csvLines].join('\n');
    const filename = `attendance_${year}_${String(month).padStart(2, '0')}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  })
);

