import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import {
  createProject,
  deleteProject,
  findProjectByTenantAndId,
  listProjectsByTenant,
  updateProject
} from '../repositories/projectRepository.js';

function publicProject(project) {
  return {
    id: project.id,
    tenantId: project.tenant_id,
    name: project.name,
    clientName: project.client_name,
    status: project.status,
    startDate: project.start_date,
    createdAt: project.created_at,
    updatedAt: project.updated_at
  };
}

export async function listProjects(context) {
  const connection = await pool.getConnection();

  try {
    const rows = await listProjectsByTenant(connection, context.tenantId);
    return rows.map(publicProject);
  } finally {
    connection.release();
  }
}

export async function createTenantProject(context, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const project = await createProject(connection, context.tenantId, payload);

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'project.create',
      entity: 'project',
      entityId: project.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicProject(project);
  });
}

export async function updateTenantProject(context, projectId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const project = await updateProject(connection, context.tenantId, projectId, payload);

    if (!project) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'project.update',
      entity: 'project',
      entityId: project.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicProject(project);
  });
}

export async function deleteTenantProject(context, projectId, requestMeta) {
  await withTransaction(async (connection) => {
    const existing = await findProjectByTenantAndId(connection, context.tenantId, projectId);

    if (!existing) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    const deleted = await deleteProject(connection, context.tenantId, projectId);

    if (!deleted) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'project.delete',
      entity: 'project',
      entityId: projectId,
      ipAddress: requestMeta.ipAddress
    });
  });
}
