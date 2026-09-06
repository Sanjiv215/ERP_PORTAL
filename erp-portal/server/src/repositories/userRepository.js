import { randomUUID } from 'node:crypto';

export async function listUsersByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, name, email, phone, role, is_active, created_at
     FROM users
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId]
  );

  return rows;
}

export async function findUserByTenantAndId(connection, tenantId, userId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, name, email, phone, role, is_active, created_at
     FROM users
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, userId]
  );

  return rows[0] || null;
}

export async function createTenantUser(connection, tenantId, payload) {
  const userId = randomUUID();

  await connection.execute(
    `INSERT INTO users (id, tenant_id, name, email, phone, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [userId, tenantId, payload.name, payload.email, payload.phone || null, payload.passwordHash, payload.role]
  );

  return findUserByTenantAndId(connection, tenantId, userId);
}

export async function updateTenantUserRole(connection, tenantId, userId, role) {
  await connection.execute(
    `UPDATE users
     SET role = ?
     WHERE tenant_id = ? AND id = ?`,
    [role, tenantId, userId]
  );

  return findUserByTenantAndId(connection, tenantId, userId);
}

export async function setTenantUserActive(connection, tenantId, userId, isActive) {
  await connection.execute(
    `UPDATE users
     SET is_active = ?
     WHERE tenant_id = ? AND id = ?`,
    [isActive, tenantId, userId]
  );

  return findUserByTenantAndId(connection, tenantId, userId);
}
