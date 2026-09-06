import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveTenantContext', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('JWT_ACCESS_SECRET', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('JWT_REFRESH_SECRET', 'abcdef0123456789abcdef0123456789');
    vi.stubEnv('EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64', Buffer.alloc(32, 'k').toString('base64'));
  });

  it('derives tenant context from the verified JWT and ignores request tenant input', async () => {
    const { signAccessToken } = await import('../utils/tokens.js');
    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const token = signAccessToken({
      id: 'user-1',
      tenant_id: 'tenant-from-token',
      role: 'TenantAdmin'
    });
    const req = {
      body: { tenant_id: 'tenant-from-body' },
      query: { tenant_id: 'tenant-from-query' },
      params: { tenantId: 'tenant-from-url' },
      get: () => `Bearer ${token}`
    };
    const next = vi.fn();

    resolveTenantContext(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.context).toEqual({
      tenantId: 'tenant-from-token',
      userId: 'user-1',
      role: 'TenantAdmin',
      sessionId: null
    });
  });

  it('handles Bearer tokens with multiple spaces in a whitespace-aware manner', async () => {
    const { signAccessToken } = await import('../utils/tokens.js');
    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const token = signAccessToken({
      id: 'user-1',
      tenant_id: 'tenant-multi-space',
      role: 'TenantAdmin'
    });
    const req = {
      get: () => `Bearer   ${token}  `
    };
    const next = vi.fn();

    await resolveTenantContext(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.context).toEqual({
      tenantId: 'tenant-multi-space',
      userId: 'user-1',
      role: 'TenantAdmin',
      sessionId: null
    });
  });

  it('authenticates via single-use short-lived download ticket and prevents ticket reuse', async () => {
    const { signDownloadTicket } = await import('../utils/tokens.js');
    const { resolveTenantContext } = await import('./resolveTenantContext.js');

    const ticket = signDownloadTicket({
      tenantId: 'tenant-ticket-1',
      userId: 'user-ticket-1',
      role: 'TenantAdmin'
    });

    const req1 = {
      query: { ticket },
      get: () => ''
    };
    const next1 = vi.fn();

    await resolveTenantContext(req1, {}, next1);

    expect(next1).toHaveBeenCalledWith();
    expect(req1.context).toEqual({
      tenantId: 'tenant-ticket-1',
      userId: 'user-ticket-1',
      role: 'TenantAdmin',
      sessionId: expect.any(String)
    });

    // Attempting to reuse the exact same download ticket must be rejected as unauthenticated (single-use)
    const req2 = {
      query: { ticket },
      get: () => ''
    };
    const next2 = vi.fn();

    await resolveTenantContext(req2, {}, next2);

    expect(next2).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED'
    }));
  });

  it('rejects raw access tokens passed in query params', async () => {
    const { signAccessToken } = await import('../utils/tokens.js');
    const { resolveTenantContext } = await import('./resolveTenantContext.js');

    const rawAccessToken = signAccessToken({
      id: 'user-raw',
      tenant_id: 'tenant-raw',
      role: 'TenantAdmin'
    });

    const req = {
      query: { ticket: rawAccessToken },
      get: () => ''
    };
    const next = vi.fn();

    await resolveTenantContext(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED'
    }));
  });

  it('rejects download tickets when requireAccessToken middleware is used', async () => {
    const { signDownloadTicket } = await import('../utils/tokens.js');
    const { requireAccessToken } = await import('./resolveTenantContext.js');

    const ticket = signDownloadTicket({
      tenantId: 'tenant-ticket-2',
      userId: 'user-ticket-2',
      role: 'TenantAdmin'
    });

    const req = {
      query: { ticket },
      get: () => ''
    };
    const next = vi.fn();

    await requireAccessToken(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED'
    }));
  });

  it('rejects a download ticket supplied in the Bearer Authorization header', async () => {
    const { signDownloadTicket } = await import('../utils/tokens.js');
    const { resolveTenantContext } = await import('./resolveTenantContext.js');

    const downloadTicket = signDownloadTicket({
      tenantId: 'tenant-bearer-ticket',
      userId: 'user-bearer-ticket',
      role: 'TenantAdmin'
    });

    const req = {
      get: () => `Bearer ${downloadTicket}`
    };
    const next = vi.fn();

    await resolveTenantContext(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED'
    }));
  });
});
