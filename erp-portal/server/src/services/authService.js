import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createRefreshTokenRecord,
  createTenantWithAdmin,
  findRefreshToken,
  findSessionById,
  findUserByEmail,
  findUserById,
  listActiveTenantSessions,
  listActiveUserSessions,
  revokeAllOtherUserSessions,
  revokeRefreshToken,
  revokeUserSession,
  updateRefreshTokenSession
} from '../repositories/authRepository.js';
import { appendAuditLog } from '../repositories/auditRepository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  hashToken,
  refreshTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../utils/tokens.js';
import { revokeRefreshTokenSession, setRefreshTokenSession } from '../redis/client.js';
import { maskIpAddress, parseIpLocation, parseUserAgent } from '../utils/sessionHelper.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from './emailService.js';
import {
  createPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword
} from '../repositories/passwordResetRepository.js';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

function publicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenant_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role
  };
}

async function issueTokenPair(connection, user, requestMeta = {}) {
  const refreshTokenId = randomUUID();
  const accessToken = signAccessToken(user, refreshTokenId);
  const refreshToken = signRefreshToken(user, refreshTokenId);
  const expiresAt = refreshTokenExpiryDate();

  const deviceInfo = parseUserAgent(requestMeta.userAgent);
  const locationName = parseIpLocation(requestMeta.ipAddress);

  await createRefreshTokenRecord(connection, {
    id: refreshTokenId,
    tenantId: user.tenant_id,
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    deviceInfo,
    ipAddress: requestMeta.ipAddress,
    locationName,
    expiresAt
  });

  await setRefreshTokenSession(
    refreshTokenId,
    user.id,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );

  return { accessToken, refreshToken, sessionId: refreshTokenId };
}

export async function signupTenant(payload, requestMeta) {
  const passwordHash = await hashPassword(payload.password);

  return withTransaction(async (connection) => {
    const created = await createTenantWithAdmin(connection, {
      businessName: payload.businessName,
      gstNumber: payload.gstNumber,
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone,
      passwordHash
    });

    await appendAuditLog(connection, {
      tenantId: created.tenant.id,
      userId: created.user.id,
      action: 'tenant.signup',
      entity: 'tenant',
      entityId: created.tenant.id,
      ipAddress: requestMeta.ipAddress
    });

    const tokens = await issueTokenPair(connection, created.user, requestMeta);

    await sendWelcomeEmail({
      to: created.user.email,
      name: created.user.name,
      businessName: created.tenant.business_name
    });

    return {
      tenant: {
        id: created.tenant.id,
        businessName: created.tenant.business_name,
        gstNumber: created.tenant.gst_number,
        status: created.tenant.status
      },
      user: publicUser(created.user),
      ...tokens
    };
  });
}

export async function loginWithPassword(payload, requestMeta) {
  const connection = await pool.getConnection();

  try {
    const user = await findUserByEmail(connection, payload.email.toLowerCase());

    if (!user || !user.is_active) {
      throw new AppError(401, GENERIC_LOGIN_ERROR, 'INVALID_CREDENTIALS');
    }

    const passwordValid = await verifyPassword(payload.password, user.password_hash);

    if (!passwordValid) {
      await appendAuditLog(connection, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'auth.login_failed',
        entity: 'user',
        entityId: user.id,
        ipAddress: requestMeta.ipAddress
      });
      throw new AppError(401, GENERIC_LOGIN_ERROR, 'INVALID_CREDENTIALS');
    }

    const tokens = await issueTokenPair(connection, user, requestMeta);

    await appendAuditLog(connection, {
      tenantId: user.tenant_id,
      userId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      ipAddress: requestMeta.ipAddress
    });

    return {
      user: publicUser(user),
      ...tokens
    };
  } finally {
    connection.release();
  }
}

export async function refreshAccessToken(refreshToken, requestMeta = {}) {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
  }

  return withTransaction(async (connection) => {
    const tokenRecord = await findRefreshToken(connection, hashToken(refreshToken));

    if (
      !tokenRecord ||
      tokenRecord.revoked_at ||
      new Date(tokenRecord.expires_at).getTime() <= Date.now() ||
      tokenRecord.user_id !== decoded.user_id ||
      tokenRecord.id !== decoded.token_id
    ) {
      throw new AppError(401, 'Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
    }

    const user = await findUserById(connection, decoded.user_id);

    if (!user || !user.is_active || user.tenant_id !== decoded.tenant_id) {
      throw new AppError(401, 'Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
    }

    const oldTokenHash = hashToken(refreshToken);
    const newAccessToken = signAccessToken(user, tokenRecord.id);
    const newRefreshToken = signRefreshToken(user, tokenRecord.id);
    const expiresAt = refreshTokenExpiryDate();
    const deviceInfo = requestMeta.userAgent ? parseUserAgent(requestMeta.userAgent) : null;
    const locationName = requestMeta.ipAddress ? parseIpLocation(requestMeta.ipAddress) : null;

    const updated = await updateRefreshTokenSession(connection, {
      id: tokenRecord.id,
      oldTokenHash,
      tokenHash: hashToken(newRefreshToken),
      expiresAt,
      ipAddress: requestMeta.ipAddress,
      deviceInfo,
      locationName
    });

    if (!updated) {
      throw new AppError(401, 'Refresh token session rotation failed', 'INVALID_REFRESH_TOKEN');
    }

    await setRefreshTokenSession(
      tokenRecord.id,
      user.id,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    );

    await appendAuditLog(connection, {
      tenantId: user.tenant_id,
      userId: user.id,
      action: 'auth.refresh',
      entity: 'user',
      entityId: user.id,
      ipAddress: requestMeta.ipAddress
    });

    return {
      user: publicUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: tokenRecord.id
    };
  });
}

export async function logout(refreshToken, context, requestMeta) {
  if (!refreshToken) {
    return;
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  await withTransaction(async (connection) => {
    await revokeRefreshToken(connection, decoded.token_id);
    await revokeRefreshTokenSession(decoded.token_id);
    await appendAuditLog(connection, {
      tenantId: context?.tenantId || decoded.tenant_id,
      userId: context?.userId || decoded.user_id,
      action: 'auth.logout',
      entity: 'user',
      entityId: decoded.user_id,
      ipAddress: requestMeta.ipAddress
    });
  });
}

export async function requestPasswordReset(payload, requestMeta) {
  const connection = await pool.getConnection();

  try {
    const user = await findUserByEmail(connection, payload.email.toLowerCase());

    if (!user || !user.is_active) {
      return;
    }

    const resetToken = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await createPasswordResetToken(connection, {
      tenantId: user.tenant_id,
      userId: user.id,
      tokenHash: hashToken(resetToken),
      expiresAt
    });

    await appendAuditLog(connection, {
      tenantId: user.tenant_id,
      userId: user.id,
      action: 'auth.password_reset_requested',
      entity: 'user',
      entityId: user.id,
      ipAddress: requestMeta.ipAddress
    });

    await sendPasswordResetEmail({ to: user.email, resetToken });
  } finally {
    connection.release();
  }
}

export async function resetPassword(payload, requestMeta) {
  const passwordHash = await hashPassword(payload.password);

  await withTransaction(async (connection) => {
    const tokenRecord = await findPasswordResetToken(connection, hashToken(payload.token));

    if (
      !tokenRecord ||
      tokenRecord.used_at ||
      new Date(tokenRecord.expires_at).getTime() <= Date.now()
    ) {
      throw new AppError(400, 'Password reset token is invalid or expired', 'INVALID_RESET_TOKEN');
    }

    await updateUserPassword(connection, tokenRecord.user_id, passwordHash);
    await markPasswordResetTokenUsed(connection, tokenRecord.id);

    await appendAuditLog(connection, {
      tenantId: tokenRecord.tenant_id,
      userId: tokenRecord.user_id,
      action: 'auth.password_reset_completed',
      entity: 'user',
      entityId: tokenRecord.user_id,
      ipAddress: requestMeta.ipAddress
    });
  });
}

export async function getUserActiveSessionsService(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await listActiveUserSessions(connection, context.tenantId, context.userId);
    return rows.map((s) => ({
      id: s.id,
      deviceInfo: s.device_info || 'Unknown Device',
      ipAddress: maskIpAddress(s.ip_address),
      locationName: s.location_name || 'Unknown Location',
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      isCurrent: Boolean(context.sessionId && s.id === context.sessionId)
    }));
  } finally {
    connection.release();
  }
}

export async function getTenantActiveSessionsService(context) {
  const connection = await pool.getConnection();
  try {
    const rows = await listActiveTenantSessions(connection, context.tenantId);
    return rows.map((s) => ({
      id: s.id,
      userId: s.user_id,
      userName: s.user_name,
      userEmail: s.user_email,
      userRole: s.user_role,
      deviceInfo: s.device_info || 'Unknown Device',
      ipAddress: maskIpAddress(s.ip_address),
      locationName: s.location_name || 'Unknown Location',
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      isCurrent: Boolean(context.sessionId && s.id === context.sessionId)
    }));
  } finally {
    connection.release();
  }
}

export async function revokeUserSessionService(sessionId, context, requestMeta) {
  return withTransaction(async (connection) => {
    const session = await findSessionById(connection, sessionId);
    if (!session) {
      throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const isSelf = session.user_id === context.userId;
    const isAdminInTenant = (context.role === 'TenantAdmin' || context.role === 'PlatformSuperAdmin') &&
                            (session.tenant_id === context.tenantId || !session.tenant_id);

    if (!isSelf && !isAdminInTenant) {
      throw new AppError(403, 'Permission denied: Cannot revoke session of another user', 'FORBIDDEN');
    }

    const success = await revokeUserSession(connection, context.tenantId, sessionId);
    if (!success) {
      throw new AppError(404, 'Session already revoked or not found', 'SESSION_NOT_FOUND');
    }

    await revokeRefreshTokenSession(sessionId);

    await appendAuditLog(connection, {
      tenantId: context.tenantId || session.tenant_id,
      userId: context.userId,
      action: 'auth.session_revoked',
      entity: 'user_session',
      entityId: sessionId,
      ipAddress: requestMeta.ipAddress,
      metadataJson: JSON.stringify({
        revokedBy: context.userId,
        targetUserId: session.user_id,
        isSelf
      })
    });

    return { message: 'Session revoked successfully' };
  });
}

export async function revokeAllOtherSessionsService(context, requestMeta) {
  if (!context.sessionId) {
    throw new AppError(400, 'Current session ID missing from request', 'INVALID_SESSION');
  }

  return withTransaction(async (connection) => {
    const activeSessions = await listActiveUserSessions(connection, context.tenantId, context.userId);
    const otherSessions = activeSessions.filter((s) => s.id !== context.sessionId);

    const revokedCount = await revokeAllOtherUserSessions(connection, context.tenantId, context.userId, context.sessionId);

    for (const s of otherSessions) {
      await revokeRefreshTokenSession(s.id);
    }

    await appendAuditLog(connection, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'auth.all_other_sessions_revoked',
      entity: 'user_session',
      entityId: context.userId,
      ipAddress: requestMeta.ipAddress,
      metadataJson: JSON.stringify({
        revokedCount
      })
    });

    return { message: 'All other sessions revoked successfully', revokedCount };
  });
}
