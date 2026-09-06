import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAccessToken, resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getTenantActiveSessionsService,
  getUserActiveSessionsService,
  revokeAllOtherSessionsService,
  revokeUserSessionService
} from '../services/authService.js';

export const sessionRouter = Router();

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

function requestMeta(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || '127.0.0.1',
    userAgent: req.get('user-agent') || ''
  };
}

sessionRouter.use(requireAccessToken);
sessionRouter.use(sessionLimiter);

// ── GET /api/v1/sessions ─────────────────────────────────────────────────────
sessionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessions = await getUserActiveSessionsService(req.context);
    res.json({ sessions });
  })
);

// ── GET /api/v1/sessions/tenant (Tenant Admin visibility) ────────────────────
sessionRouter.get(
  '/tenant',
  requireRole('TenantAdmin', 'PlatformSuperAdmin'),
  asyncHandler(async (req, res) => {
    const sessions = await getTenantActiveSessionsService(req.context);
    res.json({ sessions });
  })
);

// ── DELETE /api/v1/sessions/other (Revoke all other devices) ─────────────────
sessionRouter.delete(
  '/other',
  asyncHandler(async (req, res) => {
    const result = await revokeAllOtherSessionsService(req.context, requestMeta(req));
    res.json(result);
  })
);

// ── DELETE /api/v1/sessions/:sessionId (Revoke specific device) ─────────────
sessionRouter.delete(
  '/:sessionId',
  asyncHandler(async (req, res) => {
    const result = await revokeUserSessionService(req.params.sessionId, req.context, requestMeta(req));
    res.json(result);
  })
);
