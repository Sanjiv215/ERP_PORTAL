import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import { findProjectByTenantAndId } from '../repositories/projectRepository.js';
import {
  insertProjectExpense,
  insertProjectIncome,
  getBusinessPLSummary,
  getProjectPLSummary,
  listAllProjectsPL,
  getAnnualTrend
} from '../repositories/plRepository.js';

export async function addExpense(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    if (payload.projectId) {
      const project = await findProjectByTenantAndId(connection, context.tenantId, payload.projectId);
      if (!project) {
        throw new AppError(400, 'Invalid project for this tenant', 'INVALID_PROJECT');
      }
    }

    const id = await insertProjectExpense(connection, context.tenantId, payload, context.userId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'pl.expense_add',
      entity: 'expense_entries',
      entityId: id,
      ipAddress: requestMeta.ipAddress
    });

    return { id, message: 'Expense logged successfully' };
  });
}

export async function addIncome(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    if (payload.projectId) {
      const project = await findProjectByTenantAndId(connection, context.tenantId, payload.projectId);
      if (!project) {
        throw new AppError(400, 'Invalid project for this tenant', 'INVALID_PROJECT');
      }
    }

    const id = await insertProjectIncome(connection, context.tenantId, payload, context.userId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'pl.income_add',
      entity: 'income_entries',
      entityId: id,
      ipAddress: requestMeta.ipAddress
    });

    return { id, message: 'Income logged successfully' };
  });
}

export async function getBusinessPL(context, year, month) {
  const connection = await pool.getConnection();
  try {
    const summary = await getBusinessPLSummary(connection, context.tenantId, year, month);
    const trend = await getAnnualTrend(connection, context.tenantId, year);
    const projects = await listAllProjectsPL(connection, context.tenantId);

    return {
      summary,
      trend,
      projects
    };
  } finally {
    connection.release();
  }
}

export async function getProjectPL(context, projectId) {
  const connection = await pool.getConnection();
  try {
    const pl = await getProjectPLSummary(connection, context.tenantId, projectId);
    if (!pl) throw new AppError(404, 'Project not found', 'NOT_FOUND');
    return pl;
  } finally {
    connection.release();
  }
}
