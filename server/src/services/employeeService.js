import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import {
  createEmployee,
  findEmployeeByTenantAndId,
  listEmployeeProjectIds,
  listEmployeesByTenant,
  replaceEmployeeProjectAssignments,
  setEmployeeActive,
  softDeleteEmployee,
  updateEmployee
} from '../repositories/employeeRepository.js';
import { findProjectByTenantAndId } from '../repositories/projectRepository.js';
import { encryptSensitiveField, lastFour } from '../utils/encryption.js';

function publicEmployee(employee, projectIds = []) {
  return {
    id: employee.id,
    tenantId: employee.tenant_id,
    userId: employee.user_id_nullable,
    name: employee.name,
    phone: employee.phone,
    wageType: employee.wage_type,
    wageRate: Number(employee.wage_rate),
    bankDetailsMasked: employee.bank_details_last4 ? `****${employee.bank_details_last4}` : null,
    upiIdMasked: employee.upi_id_last4 ? `****${employee.upi_id_last4}` : null,
    isActive: Boolean(employee.is_active),
    isRemoved: Boolean(employee.removed_at),
    removedAt: employee.removed_at || null,
    projectIds,
    createdAt: employee.created_at,
    updatedAt: employee.updated_at
  };
}

async function assertProjectsBelongToTenant(connection, tenantId, projectIds) {
  for (const projectId of projectIds) {
    const project = await findProjectByTenantAndId(connection, tenantId, projectId);

    if (!project) {
      throw new AppError(400, 'One or more projects are invalid for this tenant', 'INVALID_PROJECT');
    }
  }
}

function sensitivePayload(payload) {
  return {
    ...payload,
    bankDetailsEncrypted: encryptSensitiveField(payload.bankDetails),
    bankDetailsLast4: lastFour(payload.bankDetails),
    upiIdEncrypted: encryptSensitiveField(payload.upiId),
    upiIdLast4: lastFour(payload.upiId)
  };
}

export async function listEmployees(context, includeRemoved = false) {
  const connection = await pool.getConnection();

  try {
    const rows = await listEmployeesByTenant(connection, context.tenantId, includeRemoved);
    const employees = [];

    for (const employee of rows) {
      const projectIds = await listEmployeeProjectIds(connection, context.tenantId, employee.id);
      employees.push(publicEmployee(employee, projectIds));
    }

    return employees;
  } finally {
    connection.release();
  }
}

export async function createTenantEmployee(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const projectIds = payload.projectIds || [];
    await assertProjectsBelongToTenant(connection, context.tenantId, projectIds);

    const employee = await createEmployee(connection, context.tenantId, sensitivePayload(payload));
    await replaceEmployeeProjectAssignments(connection, context.tenantId, employee.id, projectIds);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'employee.create',
      entity: 'employee',
      entityId: employee.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicEmployee(employee, projectIds);
  });
}

export async function updateTenantEmployee(context, employeeId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findEmployeeByTenantAndId(connection, context.tenantId, employeeId);

    if (!existing || existing.removed_at) {
      throw new AppError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
    }

    const projectIds = payload.projectIds || [];
    await assertProjectsBelongToTenant(connection, context.tenantId, projectIds);

    const employee = await updateEmployee(connection, context.tenantId, employeeId, sensitivePayload(payload));
    await replaceEmployeeProjectAssignments(connection, context.tenantId, employee.id, projectIds);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'employee.update',
      entity: 'employee',
      entityId: employee.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicEmployee(employee, projectIds);
  });
}

export async function changeEmployeeActiveStatus(context, employeeId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findEmployeeByTenantAndId(connection, context.tenantId, employeeId);

    if (!existing || existing.removed_at) {
      throw new AppError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
    }

    const employee = await setEmployeeActive(connection, context.tenantId, employeeId, payload.isActive);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: payload.isActive ? 'employee.activate' : 'employee.deactivate',
      entity: 'employee',
      entityId: employee.id,
      ipAddress: requestMeta.ipAddress
    });

    const projectIds = await listEmployeeProjectIds(connection, context.tenantId, employee.id);
    return publicEmployee(employee, projectIds);
  });
}

export async function removeEmployee(context, employeeId, requestMeta) {
  return withTransaction(async (connection) => {
    const existing = await findEmployeeByTenantAndId(connection, context.tenantId, employeeId);

    if (!existing || existing.removed_at) {
      throw new AppError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
    }

    const employee = await softDeleteEmployee(connection, context.tenantId, employeeId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'employee.remove',
      entity: 'employee',
      entityId: employee.id,
      ipAddress: requestMeta.ipAddress,
      metadata: { employeeName: existing.name }
    });

    const projectIds = await listEmployeeProjectIds(connection, context.tenantId, employee.id);
    return publicEmployee(employee, projectIds);
  });
}

// ── Employee Advances Service (Feature 1) ───────────────────────────────────

export async function recordEmployeeAdvance(context, employeeId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const employee = await findEmployeeByTenantAndId(connection, context.tenantId, employeeId);
    if (!employee || employee.removed_at) {
      throw new AppError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
    }

    const advance = await (await import('../repositories/employeeRepository.js')).createEmployeeAdvanceRecord(
      connection,
      context.tenantId,
      employeeId,
      payload,
      context.userId
    );

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'employee.advance_create',
      entity: 'employee_advances',
      entityId: advance.id,
      ipAddress: requestMeta.ipAddress,
      metadata: {
        employeeId,
        amount: Number(payload.amount),
        advanceDate: payload.advanceDate
      }
    });

    return {
      id: advance.id,
      tenantId: advance.tenant_id,
      employeeId: advance.employee_id,
      amount: Number(advance.amount),
      advanceDate: advance.advance_date,
      notes: advance.notes,
      status: advance.status,
      createdAt: advance.created_at
    };
  });
}

export async function getEmployeeAdvances(context, employeeId) {
  const connection = await pool.getConnection();
  try {
    const employee = await findEmployeeByTenantAndId(connection, context.tenantId, employeeId);
    if (!employee) {
      throw new AppError(404, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
    }

    const rows = await (await import('../repositories/employeeRepository.js')).listAdvancesByEmployee(
      connection,
      context.tenantId,
      employeeId
    );

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      employeeId: r.employee_id,
      amount: Number(r.amount),
      advanceDate: r.advance_date,
      notes: r.notes,
      status: r.status,
      adjustedInRunId: r.adjusted_in_run_id,
      adjustedAt: r.adjusted_at,
      createdAt: r.created_at,
      runStatus: r.run_status,
      runMonth: r.run_month,
      runYear: r.run_year
    }));
  } finally {
    connection.release();
  }
}

export async function removeEmployeeAdvance(context, employeeId, advanceId, requestMeta) {
  return withTransaction(async (connection) => {
    const empRepo = await import('../repositories/employeeRepository.js');
    const advance = await empRepo.findAdvanceByTenantAndId(connection, context.tenantId, advanceId);

    if (!advance) {
      throw new AppError(404, 'Advance payment record not found', 'ADVANCE_NOT_FOUND');
    }

    if (employeeId && advance.employee_id !== employeeId) {
      throw new AppError(404, 'Advance payment record not found for this employee', 'ADVANCE_NOT_FOUND');
    }

    // Check if advance was already applied in a FINALIZED (or paid/superseded) payroll run
    if (advance.adjusted_in_run_id && ['finalized', 'paid', 'superseded'].includes(advance.run_status)) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[(Number(advance.run_month) || 1) - 1];
      const year = advance.run_year || '';
      throw new AppError(
        400,
        `This advance of ₹${Number(advance.amount).toFixed(2)} was already applied in the ${monthName} ${year} payroll run and cannot be removed.`,
        'ADVANCE_ALREADY_APPLIED'
      );
    }

    // Perform hard delete for unadjusted or draft-associated advance
    await empRepo.deleteEmployeeAdvanceRecord(connection, context.tenantId, advanceId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'employee.advance_remove',
      entity: 'employee_advances',
      entityId: advance.id,
      ipAddress: requestMeta.ipAddress,
      metadata: {
        employeeId: advance.employee_id,
        employeeName: advance.employee_name,
        amount: Number(advance.amount),
        advanceDate: advance.advance_date
      }
    });

    return {
      success: true,
      message: 'Advance payment record removed successfully',
      removedAdvanceId: advance.id
    };
  });
}

export async function getUnadjustedAdvances(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await (await import('../repositories/employeeRepository.js')).listUnadjustedAdvancesByTenant(
      connection,
      context.tenantId
    );

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      amount: Number(r.amount),
      advanceDate: r.advance_date,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at
    }));
  } finally {
    connection.release();
  }
}

export async function getAllAdvances(context, filters = {}) {
  const connection = await pool.getConnection();
  try {
    const { listAllAdvances } = await import('../repositories/employeeRepository.js');
    const rows = await listAllAdvances(connection, context.tenantId, filters);

    let totalAmount = 0;
    let totalUnadjusted = 0;
    let totalAdjusted = 0;
    let totalCancelled = 0;

    const advances = rows.map((r) => {
      const amt = Number(r.amount);
      totalAmount += amt;
      if (r.status === 'unadjusted') totalUnadjusted += amt;
      else if (r.status === 'adjusted') totalAdjusted += amt;
      else if (r.status === 'cancelled') totalCancelled += amt;

      return {
        id: r.id,
        tenantId: r.tenant_id,
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        amount: amt,
        advanceDate: r.advance_date,
        notes: r.notes,
        status: r.status,
        adjustedInRunId: r.adjusted_in_run_id,
        adjustedAt: r.adjusted_at,
        runStatus: r.run_status,
        runMonth: r.run_month,
        runYear: r.run_year,
        runStartDate: r.run_start_date,
        runEndDate: r.run_end_date,
        createdAt: r.created_at
      };
    });

    return {
      advances,
      summary: {
        totalCount: advances.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalUnadjusted: Math.round(totalUnadjusted * 100) / 100,
        totalAdjusted: Math.round(totalAdjusted * 100) / 100,
        totalCancelled: Math.round(totalCancelled * 100) / 100
      }
    };
  } finally {
    connection.release();
  }
}
