import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import { listTenants, updateTenantStatus } from '../repositories/tenantRepository.js';

export async function listPlatformTenants() {
  const connection = await pool.getConnection();

  try {
    const rows = await listTenants(connection);
    return rows.map((tenant) => ({
      id: tenant.id,
      businessName: tenant.business_name,
      gstNumber: tenant.gst_number,
      subscriptionPlan: tenant.subscription_plan,
      status: tenant.status,
      createdAt: tenant.created_at
    }));
  } finally {
    connection.release();
  }
}

export async function changeTenantStatus(context, tenantId, payload, requestMeta) {
  return withTransaction(async (connection) => {
    const tenant = await updateTenantStatus(connection, tenantId, payload.status);

    if (!tenant) {
      throw new AppError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
    }

    await appendAuditLog(connection, {
      tenantId,
      userId: context.userId,
      action: 'platform.tenant_status_change',
      entity: 'tenant',
      entityId: tenantId,
      ipAddress: requestMeta.ipAddress,
      metadata: { status: payload.status }
    });

    return {
      id: tenant.id,
      businessName: tenant.business_name,
      gstNumber: tenant.gst_number,
      subscriptionPlan: tenant.subscription_plan,
      status: tenant.status,
      createdAt: tenant.created_at
    };
  });
}
