import { env } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'erp_portal_refresh';

export function getCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  const isSecure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : isProduction;
  const sameSite = env.COOKIE_SAMESITE || (isProduction || isSecure ? 'none' : 'lax');
  const secure = sameSite === 'none' ? true : isSecure;
  const maxAgeMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: maxAgeMs,
    expires: new Date(Date.now() + maxAgeMs),
    partitioned: sameSite === 'none' // CHIPS (Cookies Having Independent Partitioned State) for cross-site persistence
  };
}

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, getCookieOptions());
}

export function clearRefreshCookie(res) {
  const options = { ...getCookieOptions() };
  delete options.maxAge;
  options.expires = new Date(0);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}
