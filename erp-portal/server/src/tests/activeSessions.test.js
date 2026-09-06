import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const REFRESH_SECRET = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

vi.stubEnv('JWT_ACCESS_SECRET', ACCESS_SECRET);
vi.stubEnv('JWT_REFRESH_SECRET', REFRESH_SECRET);

describe('Active Sessions & Logged-in Devices Multi-Session Architecture', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('correctly parses user agent strings into friendly device/browser names', async () => {
    const { parseUserAgent, maskIpAddress } = await import('../utils/sessionHelper.js');

    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome on macOS');
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0')).toBe('Firefox on Windows');

    expect(maskIpAddress('103.21.127.42')).toBe('103.21.127.***');
    expect(maskIpAddress('127.0.0.1')).toBe('127.0.0.1 (Local)');
  });

  it('embeds session_id in signed access tokens and resolves req.context.sessionId', async () => {
    const { signAccessToken } = await import('../utils/tokens.js');
    const { resolveTenantContext } = await import('../middleware/resolveTenantContext.js');

    const sessionId = crypto.randomUUID();
    const token = signAccessToken(
      { id: 'user-123', tenant_id: 'tenant-456', role: 'Employee' },
      sessionId
    );

    const req = {
      get: () => `Bearer ${token}`
    };
    const next = vi.fn();

    await resolveTenantContext(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.context).toEqual({
      tenantId: 'tenant-456',
      userId: 'user-123',
      role: 'Employee',
      sessionId
    });
  });

  it('enforces strict tenant isolation and permission checks on session revocation', async () => {
    vi.mock('../db/pool.js', async (importOriginal) => {
      const original = await importOriginal();
      return {
        ...original,
        withTransaction: vi.fn(async (cb) => cb({}))
      };
    });

    vi.mock('../repositories/authRepository.js', async (importOriginal) => {
      const original = await importOriginal();
      return {
        ...original,
        findSessionById: vi.fn().mockResolvedValue({
          id: 'session-B',
          tenant_id: 'tenant-1',
          user_id: 'user-B'
        })
      };
    });

    const { revokeUserSessionService } = await import('../services/authService.js');

    // Context for regular employee User A in Tenant 1
    const userAContext = {
      userId: 'user-A',
      tenantId: 'tenant-1',
      role: 'Employee',
      sessionId: 'session-A'
    };

    await expect(
      revokeUserSessionService('session-B', userAContext, { ipAddress: '127.0.0.1' })
    ).rejects.toThrow('Permission denied');
  });
});
