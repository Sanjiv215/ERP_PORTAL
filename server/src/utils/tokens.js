import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getRedis } from '../redis/client.js';

export function signAccessToken(user, sessionId) {
  return jwt.sign(
    {
      tenant_id: user.tenant_id || user.tenantId,
      user_id: user.id || user.userId,
      role: user.role,
      session_id: sessionId || user.sessionId || user.session_id
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_TTL,
      subject: user.id || user.userId
    }
  );
}

export function signRefreshToken(user, tokenId) {
  return jwt.sign(
    {
      tenant_id: user.tenant_id,
      user_id: user.id,
      token_id: tokenId
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
      subject: user.id
    }
  );
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (decoded.type === 'download') {
    throw new Error('Download tickets cannot be used as Bearer access tokens');
  }
  return decoded;
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

const inMemoryRedeemed = new Map();

export function signDownloadTicket(context, ticketId = crypto.randomUUID()) {
  return jwt.sign(
    {
      tenant_id: context.tenantId || context.tenant_id,
      user_id: context.userId || context.user_id,
      role: context.role,
      type: 'download',
      ticket_id: ticketId
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: '60s'
    }
  );
}

export async function verifyAndRedeemDownloadTicket(ticket) {
  const decoded = jwt.verify(ticket, env.JWT_ACCESS_SECRET);

  if (decoded.type !== 'download' || !decoded.ticket_id) {
    throw new Error('Invalid download ticket scope');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const remainingTtl = Math.max(1, (decoded.exp || (nowSec + 60)) - nowSec);
  const redisKey = `download_ticket:${decoded.ticket_id}`;

  if (env.NODE_ENV === 'test') {
    const expMs = (decoded.exp || (nowSec + 60)) * 1000;
    if (inMemoryRedeemed.has(decoded.ticket_id)) {
      throw new Error('Download ticket has already been used');
    }
    inMemoryRedeemed.set(decoded.ticket_id, expMs);

    const currentTimeMs = Date.now();
    for (const [id, expMsVal] of inMemoryRedeemed.entries()) {
      if (currentTimeMs >= expMsVal) {
        inMemoryRedeemed.delete(id);
      }
    }
    return decoded;
  }

  try {
    const client = getRedis();
    if (client.status === 'end' || client.status === 'close' || client.status === 'wait') {
      await client.connect();
    }
    const result = await client.set(redisKey, '1', 'EX', remainingTtl, 'NX');
    if (!result) {
      throw new Error('Download ticket has already been used');
    }
  } catch (err) {
    if (err.message === 'Download ticket has already been used') {
      throw err;
    }
    throw new Error(`Download ticket store failure: ${err.message}`);
  }

  return decoded;
}
