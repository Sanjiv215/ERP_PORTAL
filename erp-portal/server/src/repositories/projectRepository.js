import { randomUUID } from 'node:crypto';

export async function listProjectsByTenant(connection, tenantId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, name, client_name, status, start_date, created_at, updated_at
     FROM projects
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId]
  );

  return rows;
}

export async function findProjectByTenantAndId(connection, tenantId, projectId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, name, client_name, status, start_date, created_at, updated_at
     FROM projects
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    [tenantId, projectId]
  );

  return rows[0] || null;
}

export async function createProject(connection, tenantId, payload) {
  const projectId = randomUUID();

  await connection.execute(
    `INSERT INTO projects (id, tenant_id, name, client_name, status, start_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      tenantId,
      payload.name,
      payload.clientName || null,
      payload.status || 'active',
      payload.startDate || null
    ]
  );

  return findProjectByTenantAndId(connection, tenantId, projectId);
}

export async function updateProject(connection, tenantId, projectId, payload) {
  await connection.execute(
    `UPDATE projects
     SET name = ?, client_name = ?, status = ?, start_date = ?
     WHERE tenant_id = ? AND id = ?`,
    [
      payload.name,
      payload.clientName || null,
      payload.status,
      payload.startDate || null,
      tenantId,
      projectId
    ]
  );

  return findProjectByTenantAndId(connection, tenantId, projectId);
}

export async function deleteProject(connection, tenantId, projectId) {
  const [result] = await connection.execute(
    `DELETE FROM projects
     WHERE tenant_id = ? AND id = ?`,
    [tenantId, projectId]
  );

  return result.affectedRows > 0;
}
