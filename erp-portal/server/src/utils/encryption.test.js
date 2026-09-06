import { describe, expect, it, beforeAll } from 'vitest';

// Provide a valid 32-byte key in base64 for testing
process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 'k').toString('base64');

// Dynamic import after env is set
let encryptSensitiveField, decryptSensitiveField, lastFour;

beforeAll(async () => {
  const mod = await import('./encryption.js');
  encryptSensitiveField = mod.encryptSensitiveField;
  decryptSensitiveField = mod.decryptSensitiveField;
  lastFour = mod.lastFour;
});

describe('encryptSensitiveField', () => {
  it('returns null for falsy input', () => {
    expect(encryptSensitiveField(null)).toBeNull();
    expect(encryptSensitiveField('')).toBeNull();
    expect(encryptSensitiveField(undefined)).toBeNull();
  });

  it('returns a versioned colon-delimited ciphertext', () => {
    const result = encryptSensitiveField('1234567890');
    expect(result).toBeTruthy();
    const parts = result.split(':');
    // v1 : IV(base64) : AuthTag(base64) : Ciphertext(base64)
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    // IV must be 12 bytes → 16-char base64
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12);
    // Auth tag must be 16 bytes
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16);
  });

  it('produces different ciphertexts each call (random IV)', () => {
    const a = encryptSensitiveField('same-value');
    const b = encryptSensitiveField('same-value');
    expect(a).not.toBe(b);
  });
});

describe('decryptSensitiveField', () => {
  it('returns null for falsy input', () => {
    expect(decryptSensitiveField(null)).toBeNull();
    expect(decryptSensitiveField('')).toBeNull();
  });

  it('round-trips the original value correctly', () => {
    const values = ['1234567890', 'name@upi', 'HDFC0001234 56789012'];
    for (const v of values) {
      expect(decryptSensitiveField(encryptSensitiveField(v))).toBe(v);
    }
  });

  it('throws on unknown version prefix', () => {
    expect(() => decryptSensitiveField('v99:abc:def:ghi')).toThrow('Unsupported encrypted field version');
  });
});

describe('lastFour', () => {
  it('returns null for falsy input', () => {
    expect(lastFour(null)).toBeNull();
    expect(lastFour('')).toBeNull();
  });

  it('returns the last 4 digits after stripping spaces', () => {
    expect(lastFour('1234 5678 9012 3456')).toBe('3456');
    expect(lastFour('1234567890')).toBe('7890');
    expect(lastFour('name@upi')).toBe('@upi');
  });
});
