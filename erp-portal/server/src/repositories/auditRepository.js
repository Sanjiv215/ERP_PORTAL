export async function appendAuditLog(connection, payload) {
  await connection.execute(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, ip_address, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.tenantId || null,
      payload.userId || null,
      payload.action,
      payload.entity,
      payload.entityId || null,
      payload.ipAddress || null,
      payload.metadata ? JSON.stringify(payload.metadata) : null
    ]
  );
}
