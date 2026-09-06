import { describe, expect, it } from 'vitest';

function cleanStr(val) {
  if (typeof val !== 'string') return val;
  return val.trim().replace(/^["']|["']$/g, '').replace(/\\r/g, '').replace(/\\n/g, '').replace(/[\r\n]+/g, '').trim();
}

function sanitizeClientOrigin(raw) {
  if (typeof raw !== 'string') return 'http://localhost:5173';
  const cleaned = raw
    .split(/[\r\n,]+/)
    .map((o) => cleanStr(o)?.replace(/\/+$/, ''))
    .filter(Boolean)
    .join(',');
  return cleaned || 'http://localhost:5173';
}

function createCorsOriginChecker(rawClientOrigin) {
  const sanitized = sanitizeClientOrigin(rawClientOrigin);
  const allowedOrigins = sanitized.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);

  return (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return true;
    }
    if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) {
      return true;
    }
    return false;
  };
}

describe('CORS Defensive Sanitization', () => {
  it('allows origin when CLIENT_ORIGIN has stray newline characters', () => {
    const rawEnvValue = 'https://lms-business-nine.vercel.app \n\r';
    const isAllowed = createCorsOriginChecker(rawEnvValue);

    expect(isAllowed('https://lms-business-nine.vercel.app')).toBe(true);
  });

  it('allows origin when CLIENT_ORIGIN has a trailing slash in env', () => {
    const rawEnvValue = 'https://lms-business-nine.vercel.app/\n';
    const isAllowed = createCorsOriginChecker(rawEnvValue);

    expect(isAllowed('https://lms-business-nine.vercel.app')).toBe(true);
  });

  it('allows origin when browser sends origin without trailing slash', () => {
    const rawEnvValue = 'https://lms-business-nine.vercel.app';
    const isAllowed = createCorsOriginChecker(rawEnvValue);

    expect(isAllowed('https://lms-business-nine.vercel.app')).toBe(true);
  });

  it('supports multiple comma-separated origins with newlines and quotes', () => {
    const rawEnvValue = '"https://lms-business-nine.vercel.app/", \n "https://admin-lms.vercel.app" \n';
    const isAllowed = createCorsOriginChecker(rawEnvValue);

    expect(isAllowed('https://lms-business-nine.vercel.app')).toBe(true);
    expect(isAllowed('https://admin-lms.vercel.app')).toBe(true);
  });

  it('allows Vercel preview branch deployments', () => {
    const isAllowed = createCorsOriginChecker('https://lms-business-nine.vercel.app');
    expect(isAllowed('https://lms-frontend-git-feat-xyz.vercel.app')).toBe(true);
  });

  it('rejects unauthorized origins', () => {
    const isAllowed = createCorsOriginChecker('https://lms-business-nine.vercel.app');
    expect(isAllowed('https://evil-hacker.com')).toBe(false);
  });
});
