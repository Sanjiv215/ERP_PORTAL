import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../utils/cookies.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './authSchemas.js';
import {
  loginWithPassword,
  logout,
  requestPasswordReset,
  refreshAccessToken,
  resetPassword,
  signupTenant
} from '../services/authService.js';
import { verifyAccessToken, signDownloadTicket } from '../utils/tokens.js';
import { resolveTenantContext, requireAccessToken } from '../middleware/resolveTenantContext.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

function requestMeta(req) {
  return {
    ipAddress: req.ip
  };
}

authRouter.post(
  '/signup',
  authLimiter,
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await signupTenant(req.body, requestMeta(req));
    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
      tenant: result.tenant
    });
  })
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginWithPassword(req.body, requestMeta(req));
    setRefreshCookie(res, result.refreshToken);

    res.json({
      accessToken: result.accessToken,
      user: result.user
    });
  })
);

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
    const result = await refreshAccessToken(refreshToken, requestMeta(req));
    setRefreshCookie(res, result.refreshToken);

    res.json({
      accessToken: result.accessToken,
      user: result.user
    });
  })
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    await requestPasswordReset(req.body, requestMeta(req));
    res.json({ message: 'If that account exists, a reset link has been sent.' });
  })
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body, requestMeta(req));
    res.status(204).send();
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
    const authHeader = req.get('authorization') || '';
    const [scheme, token] = authHeader.split(' ');
    let context = null;

    if (scheme === 'Bearer' && token) {
      try {
        const decoded = verifyAccessToken(token);
        context = {
          tenantId: decoded.tenant_id || null,
          userId: decoded.user_id,
          role: decoded.role
        };
      } catch {
        // Access token expired, continue with refresh token revocation
      }
    }

    await logout(refreshToken, context, requestMeta(req));
    clearRefreshCookie(res);
    res.status(204).send();
  })
);

authRouter.post(
  '/download-ticket',
  requireAccessToken,
  asyncHandler(async (req, res) => {
    const ticket = signDownloadTicket(req.context);
    res.json({ ticket });
  })
);
