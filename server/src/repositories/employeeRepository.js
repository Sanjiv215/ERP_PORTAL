import { randomUUID } from 'node:crypto';

const EMPLOYEE_COLUMNS = `
  id, tenant_id, user_id_nullable, name, phone, wage_type, wage_rate,
  bank_details_last4, upi_id_last4, is_active, removed_at, created_at, updated_at
`;

export async function listEmployeesByTenant(connection, tenantId, includeRemoved = false) {
  const whereClause = includeRemoved
    ? `WHERE tenant_id = ?`
    : `WHERE tenant_id = ? AND removed_at IS NULL`;

  const [rows] = await connection.execute(
    `SELECT ${EMPLOYEE_COLUMNS}
     FROM employees
     ${whereClause}
     ORDER BY created_at DESC`,
    [tenantId]
  );

  return rows;
}

export async function findEmployeeByTenantAndId(connection, tenantId, employeeId) {
  const [rows] = await connection.execute(
    `SELECT ${EMPLOYEE_COLUMNS}
     FROM employees
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, employeeId]
  );

  return rows[0] || null;
}

export async function createEmployee(connection, tenantId, payload) {
  const employeeId = randomUUID();

  await connection.execute(
    `INSERT INTO employees (
       id, tenant_id, user_id_nullable, name, phone, wage_type, wage_rate,
       bank_details_encrypted, bank_details_last4, upi_id_encrypted, upi_id_last4, is_active
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [
      employeeId,
      tenantId,
      payload.userId || null,
      payload.name,
      payload.phone || null,
      payload.wageType,
      payload.wageRate,
      payload.bankDetailsEncrypted || null,
      payload.bankDetailsLast4 || null,
      payload.upiIdEncrypted || null,
      payload.upiIdLast4 || null
    ]
  );

  return findEmployeeByTenantAndId(connection, tenantId, employeeId);
}

export async function updateEmployee(connection, tenantId, employeeId, payload) {
  await connection.execute(
    `UPDATE employees
     SET user_id_nullable = ?, name = ?, phone = ?, wage_type = ?, wage_rate = ?,
         bank_details_encrypted = ?, bank_details_last4 = ?, upi_id_encrypted = ?, upi_id_last4 = ?,
         is_active = ?
     WHERE tenant_id = ? AND id = ?`,
    [
      payload.userId || null,
      payload.name,
      payload.phone || null,
      payload.wageType,
      payload.wageRate,
      payload.bankDetailsEncrypted || null,
      payload.bankDetailsLast4 || null,
      payload.upiIdEncrypted || null,
      payload.upiIdLast4 || null,
      payload.isActive,
      tenantId,
      employeeId
    ]
  );

  return findEmployeeByTenantAndId(connection, tenantId, employeeId);
}

export async function setEmployeeActive(connection, tenantId, employeeId, isActive) {
  await connection.execute(
    `UPDATE employees
     SET is_active = ?
     WHERE tenant_id = ? AND id = ?`,
    [isActive, tenantId, employeeId]
  );

  return findEmployeeByTenantAndId(connection, tenantId, employeeId);
}

export async function softDeleteEmployee(connection, tenantId, employeeId) {
  await connection.execute(
    `UPDATE employees
     SET is_active = FALSE, removed_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND id = ? AND removed_at IS NULL`,
    [tenantId, employeeId]
  );

  return findEmployeeByTenantAndId(connection, tenantId, employeeId);
}

export async function replaceEmployeeProjectAssignments(connection, tenantId, employeeId, projectIds) {
  await connection.execute(
    `DELETE FROM employee_project_assignments
     WHERE tenant_id = ? AND employee_id = ?`,
    [tenantId, employeeId]
  );

  for (const projectId of projectIds) {
    await connection.execute(
      `INSERT INTO employee_project_assignments (id, tenant_id, employee_id, project_id)
       VALUES (?, ?, ?, ?)`,
      [randomUUID(), tenantId, employeeId, projectId]
    );
  }
}

export async function listEmployeeProjectIds(connection, tenantId, employeeId) {
  const [rows] = await connection.execute(
    `SELECT project_id
     FROM employee_project_assignments
     WHERE tenant_id = ? AND employee_id = ?
     ORDER BY created_at ASC`,
    [tenantId, employeeId]
  );

  return rows.map((row) => row.project_id);
}

// ── Employee Advances (Feature 1) ────────────────────────────────────────────

export async function createEmployeeAdvanceRecord(connection, tenantId, employeeId, payload, createdBy) {
  const id = randomUUID();
  await connection.execute(
    `INSERT INTO employee_advances
       (id, tenant_id, employee_id, amount, advance_date, notes, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'unadjusted', ?)`,
    [
      id,
      tenantId,
      employeeId,
      payload.amount,
      payload.advanceDate,
      payload.notes || null,
      createdBy
    ]
  );

  const [rows] = await connection.execute(
    `SELECT * FROM employee_advances WHERE tenant_id = ? AND id = ? LIMIT 1`,
    [tenantId, id]
  );
  return rows[0] || null;
}

export async function listAdvancesByEmployee(connection, tenantId, employeeId) {
  const [rows] = await connection.execute(
    `SELECT ea.id, ea.tenant_id, ea.employee_id, ea.amount, ea.advance_date, ea.notes, ea.status, ea.adjusted_in_run_id, ea.adjusted_at, ea.created_at,
            pr.status AS run_status, pr.period_month AS run_month, pr.period_year AS run_year
     FROM employee_advances ea
     LEFT JOIN payroll_runs pr ON pr.id = ea.adjusted_in_run_id
     WHERE ea.tenant_id = ? AND ea.employee_id = ?
     ORDER BY ea.advance_date DESC, ea.created_at DESC`,
    [tenantId, employeeId]
  );
  return rows;
}

export async function findAdvanceByTenantAndId(connection, tenantId, advanceId) {
  const [rows] = await connection.execute(
    `SELECT ea.id, ea.tenant_id, ea.employee_id, ea.amount, ea.advance_date, ea.notes, ea.status, ea.adjusted_in_run_id, ea.adjusted_at, ea.created_at,
            pr.status AS run_status, pr.period_month AS run_month, pr.period_year AS run_year,
            e.name AS employee_name
     FROM employee_advances ea
     JOIN employees e ON e.id = ea.employee_id
     LEFT JOIN payroll_runs pr ON pr.id = ea.adjusted_in_run_id
     WHERE ea.tenant_id = ? AND ea.id = ?
     LIMIT 1`,
    [tenantId, advanceId]
  );
  return rows[0] || null;
}

export async function deleteEmployeeAdvanceRecord(connection, tenantId, advanceId) {
  await connection.execute(
    `DELETE FROM employee_advances WHERE tenant_id = ? AND id = ?`,
    [tenantId, advanceId]
  );
}

export async function listUnadjustedAdvancesByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT ea.id, ea.tenant_id, ea.employee_id, e.name AS employee_name, ea.amount, ea.advance_date, ea.notes, ea.status, ea.created_at,
            pr.status AS run_status
     FROM employee_advances ea
     JOIN employees e ON e.id = ea.employee_id
     LEFT JOIN payroll_runs pr ON pr.id = ea.adjusted_in_run_id
     WHERE ea.tenant_id = ?
       AND (ea.adjusted_in_run_id IS NULL OR pr.status IS NULL OR pr.status NOT IN ('finalized', 'paid', 'superseded'))
       AND ea.status != 'cancelled'
     ORDER BY ea.advance_date ASC`,
    [tenantId]
  );
  return rows;
}

export async function findUnadjustedAdvancesForPeriod(connection, tenantId, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, employee_id, amount, advance_date, notes, status
     FROM employee_advances
     WHERE tenant_id = ? AND status = 'unadjusted' AND advance_date < (?::date + INTERVAL '1 month')
     ORDER BY advance_date ASC`,
    [tenantId, `${prefix}-01`]
  );
  return rows;
}

export async function findUnadjustedAdvancesForDateRange(connection, tenantId, startDate, endDate, employeeId = null) {
  let sql = `
    SELECT id, tenant_id, employee_id, amount, advance_date, notes, status
    FROM employee_advances
    WHERE tenant_id = ? AND status = 'unadjusted' AND advance_date >= ?::date AND advance_date <= ?::date
  `;
  const params = [tenantId, startDate, endDate];

  if (employeeId) {
    sql += ` AND employee_id = ?`;
    params.push(employeeId);
  }

  sql += ` ORDER BY advance_date ASC`;
  const [rows] = await connection.execute(sql, params);
  return rows;
}

export async function findOlderUnadjustedAdvances(connection, tenantId, beforeDate, employeeId = null) {
  let sql = `
    SELECT ea.id, ea.tenant_id, ea.employee_id, e.name AS employee_name, ea.amount, ea.advance_date, ea.notes, ea.status
    FROM employee_advances ea
    JOIN employees e ON e.id = ea.employee_id
    WHERE ea.tenant_id = ? AND ea.status = 'unadjusted' AND ea.advance_date < ?::date
  `;
  const params = [tenantId, beforeDate];

  if (employeeId) {
    sql += ` AND ea.employee_id = ?`;
    params.push(employeeId);
  }

  sql += ` ORDER BY ea.advance_date ASC`;
  const [rows] = await connection.execute(sql, params);
  return rows;
}

export async function listAllAdvances(connection, tenantId, filters = {}) {
  let sql = `
    SELECT ea.id, ea.tenant_id, ea.employee_id, e.name AS employee_name, ea.amount,
           TO_CHAR(ea.advance_date, 'YYYY-MM-DD') AS advance_date,
           ea.notes, ea.status, ea.adjusted_in_run_id, ea.adjusted_at, ea.created_at,
           pr.status AS run_status, pr.period_month AS run_month, pr.period_year AS run_year,
           pr.period_start_date AS run_start_date, pr.period_end_date AS run_end_date
    FROM employee_advances ea
    JOIN employees e ON e.id = ea.employee_id
    LEFT JOIN payroll_runs pr ON pr.id = ea.adjusted_in_run_id
    WHERE ea.tenant_id = ?
  `;
  const params = [tenantId];

  if (filters.employeeId) {
    sql += ` AND ea.employee_id = ?`;
    params.push(filters.employeeId);
  }

  if (filters.status && filters.status !== 'all') {
    sql += ` AND ea.status = ?`;
    params.push(filters.status);
  }

  if (filters.startDate) {
    sql += ` AND ea.advance_date >= ?::date`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ` AND ea.advance_date <= ?::date`;
    params.push(filters.endDate);
  }

  sql += ` ORDER BY ea.advance_date DESC, ea.created_at DESC`;

  const [rows] = await connection.execute(sql, params);
  return rows;
}

export async function markAdvanceAdjustedInRun(connection, tenantId, advanceId, runId) {
  await connection.execute(
    `UPDATE employee_advances
     SET status = 'adjusted', adjusted_in_run_id = ?, adjusted_at = CURRENT_TIMESTAMP
     WHERE tenant_id = ? AND id = ?`,
    [runId, tenantId, advanceId]
  );
}

export async function resetAdvancesForRun(connection, tenantId, runId) {
  await connection.execute(
    `UPDATE employee_advances
     SET status = 'unadjusted', adjusted_in_run_id = NULL, adjusted_at = NULL
     WHERE tenant_id = ? AND adjusted_in_run_id = ?`,
    [tenantId, runId]
  );
}
