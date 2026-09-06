import { randomUUID } from 'node:crypto';

export async function createPasswordResetToken(connection, payload) {
  const tokenId = randomUUID();

  await connection.execute(
    `INSERT INTO password_reset_tokens (id, tenant_id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tokenId, payload.tenantId, payload.userId, payload.tokenHash, payload.expiresAt]
  );

  return tokenId;
}

export async function findPasswordResetToken(connection, tokenHash) {
  const [rows] = await connection.execute(
    `SELECT id, tenant_id, user_id, token_hash, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  return rows[0] || null;
}

export async function markPasswordResetTokenUsed(connection, tokenId) {
  await connection.execute(
    `UPDATE password_reset_tokens
     SET used_at = CURRENT_TIMESTAMP
     WHERE id = ? AND used_at IS NULL`,
    [tokenId]
  );
}

export async function updateUserPassword(connection, userId, passwordHash) {
  await connection.execute(
    `UPDATE users
     SET password_hash = ?
     WHERE id = ?`,
    [passwordHash, userId]
  );
}
