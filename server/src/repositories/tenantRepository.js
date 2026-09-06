export async function listTenants(connection) {
  const [rows] = await connection.execute(
    `SELECT id, business_name, gst_number, subscription_plan, status, created_at
     FROM tenants
     ORDER BY created_at DESC`
  );

  return rows;
}

export async function updateTenantStatus(connection, tenantId, status) {
  await connection.execute(
    `UPDATE tenants
     SET status = ?
     WHERE id = ?`,
    [status, tenantId]
  );

  const [rows] = await connection.execute(
    `SELECT id, business_name, gst_number, subscription_plan, status, created_at
     FROM tenants
     WHERE id = ?
     LIMIT 1`,
    [tenantId]
  );

  return rows[0] || null;
}
