import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../db/pool.js';
import { ROLES } from '../constants/roles.js';
import { AppError } from '../middleware/errorHandler.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import {
  createTenantUser,
  listUsersByTenant,
  setTenantUserActive,
  updateTenantUserRole
} from '../repositories/userRepository.js';
import { hashPassword } from '../utils/password.js';
import { sendInviteEmail } from './emailService.js';

const TENANT_ASSIGNABLE_ROLES = new Set([
  ROLES.TENANT_ADMIN,
  ROLES.MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.EMPLOYEE
]);

function publicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenant_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: Boolean(user.is_active),
    createdAt: user.created_at
  };
}

export async function listTenantUsers(context) {
  const connection = await pool.getConnection();

  try {
    const rows = await listUsersByTenant(connection, context.tenantId);
    return rows.map(publicUser);
  } finally {
    connection.release();
  }
}

export async function inviteTenantUser(context, payload, requestMeta) {
  if (!TENANT_ASSIGNABLE_ROLES.has(payload.role)) {
    throw new AppError(400, 'Role cannot be assigned inside a tenant workspace', 'INVALID_ROLE');
  }

  const temporaryPassword = payload.temporaryPassword || `${randomUUID()}A1!`;
  const passwordHash = await hashPassword(temporaryPassword);

  return withTransaction(async (connection) => {
    const user = await createTenantUser(connection, context.tenantId, {
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone,
      role: payload.role,
      passwordHash
    });

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'user.invite',
      entity: 'user',
      entityId: user.id,
      ipAddress: requestMeta.ipAddress,
      metadata: { role: user.role }
    });

    await sendInviteEmail({
      to: user.email,
      name: user.name,
      temporaryPassword
    });

    return publicUser(user);
  });
}

export async function changeTenantUserRole(context, userId, payload, requestMeta) {
  if (!TENANT_ASSIGNABLE_ROLES.has(payload.role)) {
    throw new AppError(400, 'Role cannot be assigned inside a tenant workspace', 'INVALID_ROLE');
  }

  return withTransaction(async (connection) => {
    const user = await updateTenantUserRole(connection, context.tenantId, userId, payload.role);

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'user.role_change',
      entity: 'user',
      entityId: user.id,
      ipAddress: requestMeta.ipAddress,
      metadata: { role: user.role }
    });

    return publicUser(user);
  });
}

export async function changeTenantUserActiveStatus(context, userId, payload, requestMeta) {
  if (userId === context.userId && payload.isActive === false) {
    throw new AppError(400, 'You cannot deactivate your own user', 'SELF_DEACTIVATE_BLOCKED');
  }

  return withTransaction(async (connection) => {
    const user = await setTenantUserActive(connection, context.tenantId, userId, payload.isActive);

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: payload.isActive ? 'user.activate' : 'user.deactivate',
      entity: 'user',
      entityId: user.id,
      ipAddress: requestMeta.ipAddress
    });

    return publicUser(user);
  });
}

export async function getTenantSettings(context) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id, business_name, signature_data FROM tenants WHERE id = ? LIMIT 1`,
      [context.tenantId]
    );
    const tenant = rows[0];
    return {
      id: tenant?.id,
      businessName: tenant?.business_name,
      signatureData: tenant?.signature_data || null
    };
  } finally {
    connection.release();
  }
}

export async function updateTenantSettings(context, payload) {
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `UPDATE tenants SET signature_data = ? WHERE id = ?`,
      [payload.signatureData || null, context.tenantId]
    );
    const [rows] = await connection.execute(
      `SELECT id, business_name, signature_data FROM tenants WHERE id = ? LIMIT 1`,
      [context.tenantId]
    );
    const tenant = rows[0];
    return {
      id: tenant?.id,
      businessName: tenant?.business_name,
      signatureData: tenant?.signature_data || null
    };
  } finally {
    connection.release();
  }
}

