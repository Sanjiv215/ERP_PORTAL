import { describe, expect, it, vi } from 'vitest';
import { requireRole } from './requireRole.js';

describe('requireRole', () => {
  it('blocks roles outside the allowlist', () => {
    const req = { context: { role: 'Employee' } };
    const next = vi.fn();

    requireRole(['TenantAdmin'])(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('allows listed roles', () => {
    const req = { context: { role: 'TenantAdmin' } };
    const next = vi.fn();

    requireRole(['TenantAdmin'])(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
