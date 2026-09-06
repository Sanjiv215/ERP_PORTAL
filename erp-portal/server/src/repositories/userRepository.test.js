import { describe, expect, it, vi } from 'vitest';
import {
  findUserByTenantAndId,
  listUsersByTenant,
  setTenantUserActive,
  updateTenantUserRole
} from './userRepository.js';

function mockConnection(rows = []) {
  return {
    execute: vi.fn().mockResolvedValue([rows])
  };
}

describe('userRepository tenant scoping', () => {
  it('lists users with a tenant_id predicate', async () => {
    const connection = mockConnection([]);

    await listUsersByTenant(connection, 'tenant-a');

    expect(connection.execute.mock.calls[0][0]).toContain('WHERE tenant_id = ?');
    expect(connection.execute.mock.calls[0][1]).toEqual(['tenant-a']);
  });

  it('finds a user by tenant and user id together', async () => {
    const connection = mockConnection([]);

    await findUserByTenantAndId(connection, 'tenant-a', 'user-b');

    expect(connection.execute.mock.calls[0][0]).toContain('WHERE tenant_id = ? AND id = ?');
    expect(connection.execute.mock.calls[0][1]).toEqual(['tenant-a', 'user-b']);
  });

  it('updates role with tenant scope', async () => {
    const connection = mockConnection([]);

    await updateTenantUserRole(connection, 'tenant-a', 'user-b', 'Manager');

    expect(connection.execute.mock.calls[0][0]).toContain('WHERE tenant_id = ? AND id = ?');
    expect(connection.execute.mock.calls[0][1]).toEqual(['Manager', 'tenant-a', 'user-b']);
  });

  it('updates status with tenant scope', async () => {
    const connection = mockConnection([]);

    await setTenantUserActive(connection, 'tenant-a', 'user-b', false);

    expect(connection.execute.mock.calls[0][0]).toContain('WHERE tenant_id = ? AND id = ?');
    expect(connection.execute.mock.calls[0][1]).toEqual([false, 'tenant-a', 'user-b']);
  });
});
