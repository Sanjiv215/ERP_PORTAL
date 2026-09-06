import { randomUUID } from 'node:crypto';

export async function findUserByEmail(connection, email) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, name, email, phone, password_hash, role, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

export async function findUserById(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, name, email, phone, role, is_active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

export async function createTenantWithAdmin(connection, payload) {
  const tenantId = randomUUID();
  const userId = randomUUID();

  await connection.execute(
    `INSERT INTO tenants (id, business_name, gst_number, subscription_plan, status)
     VALUES (?, ?, ?, 'trial', 'trial')`,
    [tenantId, payload.businessName, payload.gstNumber || null]
  );

  await connection.execute(
    `INSERT INTO users (id, tenant_id, name, email, phone, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 'TenantAdmin', TRUE)`,
    [userId, tenantId, payload.name, payload.email, payload.phone || null, payload.passwordHash]
  );

  return {
    tenant: {
      id: tenantId,
      business_name: payload.businessName,
      gst_number: payload.gstNumber || null,
      status: 'trial'
    },
    user: {
      id: userId,
      tenant_id: tenantId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      role: 'TenantAdmin',
      is_active: 1
    }
  };
}

export async function createRefreshTokenRecord(connection, payload) {
  try {
    await connection.execute(
      `INSERT INTO refresh_tokens (id, tenant_id, user_id, token_hash, device_info, ip_address, location_name, expires_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        payload.id,
        payload.tenantId,
        payload.userId,
        payload.tokenHash,
        payload.deviceInfo || null,
        payload.ipAddress || null,
        payload.locationName || null,
        payload.expiresAt
      ]
    );
  } catch (err) {
    console.warn('Session metadata insert skipped, falling back to basic refresh token record:', err.message);
    await connection.execute(
      `INSERT INTO refresh_tokens (id, tenant_id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.id, payload.tenantId, payload.userId, payload.tokenHash, payload.expiresAt]
    );
  }
}

export async function updateRefreshTokenSession(connection, payload) {
  try {
    const [result] = await connection.execute(
      `UPDATE refresh_tokens
       SET token_hash = ?, expires_at = ?, last_active_at = CURRENT_TIMESTAMP,
           ip_address = COALESCE(?, ip_address), device_info = COALESCE(?, device_info), location_name = COALESCE(?, location_name)
       WHERE id = ? AND token_hash = ? AND revoked_at IS NULL`,
      [
        payload.tokenHash,
        payload.expiresAt,
        payload.ipAddress || null,
        payload.deviceInfo || null,
        payload.locationName || null,
        payload.id,
        payload.oldTokenHash
      ]
    );

    if ((result.affectedRows || result.rowCount || 0) > 0) {
      return true;
    }
  } catch (err) {
    console.warn('Session metadata update skipped, falling back to basic refresh token update:', err.message);
  }

  const [fallbackResult] = await connection.execute(
    `UPDATE refresh_tokens
     SET token_hash = ?, expires_at = ?
     WHERE id = ? AND token_hash = ? AND revoked_at IS NULL`,
    [payload.tokenHash, payload.expiresAt, payload.id, payload.oldTokenHash]
  );

  return (fallbackResult.affectedRows || fallbackResult.rowCount || 0) > 0;
}

export async function findRefreshToken(connection, tokenHash) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, user_id, token_hash, device_info, ip_address, location_name, expires_at, revoked_at, last_active_at, created_at
     FROM refresh_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  return rows[0] || null;
}

export async function findSessionById(connection, sessionId) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, user_id, device_info, ip_address, location_name, expires_at, revoked_at, last_active_at, created_at
     FROM refresh_tokens
     WHERE id = ?
     LIMIT 1`,
    [sessionId]
  );

  return rows[0] || null;
}

export async function revokeRefreshToken(connection, tokenId) {
  await connection.execute(
    `UPDATE refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = ? AND revoked_at IS NULL`,
    [tokenId]
  );
}

export async function listActiveUserSessions(connection, tenantId, userId) {
  try {
    const [rows] = await connection.execute(
      `SELECT id, tenant_id, user_id, device_info, ip_address, location_name, expires_at, last_active_at, created_at
       FROM refresh_tokens
       WHERE user_id = ? AND (tenant_id = ? OR tenant_id IS NULL) AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [userId, tenantId]
    );
    return rows;
  } catch (err) {
    console.warn('Full active session listing skipped, falling back to basic token listing:', err.message);
    const [fallbackRows] = await connection.execute(
      `SELECT id, tenant_id, user_id, expires_at, created_at
       FROM refresh_tokens
       WHERE user_id = ? AND (tenant_id = ? OR tenant_id IS NULL) AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [userId, tenantId]
    );
    return fallbackRows;
  }
}

export async function listActiveTenantSessions(connection, tenantId) {
  try {
    const [rows] = await connection.execute(
      `SELECT rt.id, rt.tenant_id, rt.user_id, u.name as user_name, u.email as user_email, u.role as user_role,
              rt.device_info, rt.ip_address, rt.location_name, rt.expires_at, rt.last_active_at, rt.created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.tenant_id = ? AND rt.revoked_at IS NULL AND rt.expires_at > CURRENT_TIMESTAMP
       ORDER BY rt.created_at DESC`,
      [tenantId]
    );
    return rows;
  } catch (err) {
    console.warn('Full tenant active session listing skipped, falling back to basic listing:', err.message);
    const [fallbackRows] = await connection.execute(
      `SELECT rt.id, rt.tenant_id, rt.user_id, u.name as user_name, u.email as user_email, u.role as user_role,
              rt.expires_at, rt.created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.tenant_id = ? AND rt.revoked_at IS NULL AND rt.expires_at > CURRENT_TIMESTAMP
       ORDER BY rt.created_at DESC`,
      [tenantId]
    );
    return fallbackRows;
  }
}

export async function revokeUserSession(connection, tenantId, sessionId, targetUserId = null) {
  const params = [sessionId];
  let sql = `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL`;

  if (tenantId) {
    sql += ` AND tenant_id = ?`;
    params.push(tenantId);
  }

  if (targetUserId) {
    sql += ` AND user_id = ?`;
    params.push(targetUserId);
  }

  const [result] = await connection.execute(sql, params);
  return (result.affectedRows || result.rowCount || 0) > 0;
}

export async function revokeAllOtherUserSessions(connection, tenantId, userId, currentSessionId) {
  const params = [userId, currentSessionId];
  let sql = `UPDATE refresh_tokens
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND id != ? AND revoked_at IS NULL`;

  if (tenantId) {
    sql += ` AND (tenant_id = ? OR tenant_id IS NULL)`;
    params.push(tenantId);
  }

  const [result] = await connection.execute(sql, params);
  return result.affectedRows || result.rowCount || 0;
}
