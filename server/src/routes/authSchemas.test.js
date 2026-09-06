import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from './authSchemas.js';

describe('auth request schemas', () => {
  it('does not allow tenant_id through signup payload validation', () => {
    const parsed = signupSchema.parse({
      businessName: 'Acme Contractors',
      gstNumber: '',
      name: 'Asha Rao',
      email: 'ASHA@example.com',
      phone: '9999999999',
      password: 'correct-horse-1',
      acceptedTerms: true,
      tenant_id: 'attacker-controlled'
    });

    expect(parsed).not.toHaveProperty('tenant_id');
    expect(parsed.email).toBe('asha@example.com');
  });

  it('does not allow tenant_id through login payload validation', () => {
    const parsed = loginSchema.parse({
      email: 'user@example.com',
      password: 'correct-horse-1',
      tenant_id: 'attacker-controlled'
    });

    expect(parsed).not.toHaveProperty('tenant_id');
  });
});
