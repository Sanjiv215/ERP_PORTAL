import { AppError } from './errorHandler.js';
import { verifyAccessToken, verifyAndRedeemDownloadTicket } from '../utils/tokens.js';

export async function resolveTenantContext(req, _res, next) {
  const authHeader = req.get('authorization') || '';
  const match = authHeader.trim().match(/^Bearer\s+(.+)$/i);

  let token = null;
  let isTicket = false;

  if (match) {
    token = match[1].trim();
  } else if (req.query && req.query.ticket) {
    token = req.query.ticket;
    isTicket = true;
  }

  if (!token) {
    return next(new AppError(401, 'Authentication required', 'AUTH_REQUIRED'));
  }

  try {
    const decoded = isTicket
      ? await verifyAndRedeemDownloadTicket(token)
      : verifyAccessToken(token);

    if (!decoded.user_id || !decoded.role) {
      throw new Error('Token missing required claims');
    }

    req.tokenType = isTicket ? 'ticket' : 'bearer';
    req.context = {
      tenantId: decoded.tenant_id || null,
      userId: decoded.user_id,
      role: decoded.role,
      sessionId: decoded.session_id || decoded.ticket_id || null
    };

    return next();
  } catch {
    return next(new AppError(401, 'Authentication required', 'AUTH_REQUIRED'));
  }
}

export function requireAccessToken(req, res, next) {
  return resolveTenantContext(req, res, (err) => {
    if (err) return next(err);
    if (req.tokenType !== 'bearer') {
      return next(new AppError(401, 'Access token required to generate download ticket', 'AUTH_REQUIRED'));
    }
    return next();
  });
}
