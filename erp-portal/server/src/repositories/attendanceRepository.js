import { randomUUID } from 'node:crypto';

export async function upsertAttendanceRecord(connection, tenantId, employeeId, workDate, status, note, recordedBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO attendance_records (id, tenant_id, employee_id, work_date, status, note, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, employee_id, work_date) DO UPDATE SET
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       recorded_by = EXCLUDED.recorded_by,
       updated_at = CURRENT_TIMESTAMP`,
    [id, tenantId, employeeId, workDate, status, note || null, recordedBy || null]
  );
}

export async function getMonthlyAttendanceByTenant(connection, tenantId, year, month) {
  const [rows] = await connection.execute(
    `SELECT id, employee_id, TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date, status, note
     FROM attendance_records
     WHERE tenant_id = ? AND EXTRACT(YEAR FROM work_date) = ? AND EXTRACT(MONTH FROM work_date) = ?
     ORDER BY work_date ASC, employee_id ASC`,
    [tenantId, Number(year), Number(month)]
  );
  return rows;
}

export async function getEmployeeMonthCalendar(connection, tenantId, employeeId, year, month) {
  const [rows] = await connection.execute(
    `SELECT id, TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date, status, note
     FROM attendance_records
     WHERE tenant_id = ? AND employee_id = ? AND EXTRACT(YEAR FROM work_date) = ? AND EXTRACT(MONTH FROM work_date) = ?
     ORDER BY work_date ASC`,
    [tenantId, employeeId, Number(year), Number(month)]
  );
  return rows;
}

export async function getMonthlyAttendanceSummary(connection, tenantId, year, month) {
  const [rows] = await connection.execute(
    `SELECT
       a.employee_id,
       e.name AS employee_name,
       e.wage_type,
       e.wage_rate,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_days,
       SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END) AS half_days,
       SUM(CASE WHEN a.status = 'overtime' THEN 1 ELSE 0 END) AS overtime_days,
       SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
       SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) AS leave_days
     FROM attendance_records a
     JOIN employees e ON e.id = a.employee_id AND e.tenant_id = a.tenant_id
     WHERE a.tenant_id = ? AND EXTRACT(YEAR FROM a.work_date) = ? AND EXTRACT(MONTH FROM a.work_date) = ?
     GROUP BY a.employee_id, e.name, e.wage_type, e.wage_rate
     ORDER BY e.name ASC`,
    [tenantId, Number(year), Number(month)]
  );
  return rows;
}

export async function getAttendanceSummaryForDateRange(connection, tenantId, startDate, endDate, employeeId = null) {
  let sql = `
    SELECT
       a.employee_id,
       e.name AS employee_name,
       e.wage_type,
       e.wage_rate,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_days,
       SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END) AS half_days,
       SUM(CASE WHEN a.status = 'overtime' THEN 1 ELSE 0 END) AS overtime_days,
       SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
       SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) AS leave_days
     FROM attendance_records a
     JOIN employees e ON e.id = a.employee_id AND e.tenant_id = a.tenant_id
     WHERE a.tenant_id = ? AND a.work_date >= ?::date AND a.work_date <= ?::date
  `;
  const params = [tenantId, startDate, endDate];

  if (employeeId) {
    sql += ` AND a.employee_id = ?`;
    params.push(employeeId);
  }

  sql += ` GROUP BY a.employee_id, e.name, e.wage_type, e.wage_rate ORDER BY e.name ASC`;

  const [rows] = await connection.execute(sql, params);
  return rows;
}

