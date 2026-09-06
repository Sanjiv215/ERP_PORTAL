import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { parseKey, encryptSensitiveField, decryptSensitiveField } from '../utils/encryption.js';

describe('Encryption Key Migration Logic', () => {
  const oldKey = crypto.randomBytes(32);
  const newKey = crypto.randomBytes(32);

  const sampleBank = 'HDFC0001234 9876543210';
  const sampleUpi = 'user@okicici';

  it('correctly re-encrypts sensitive fields from OLD key to NEW key', () => {
    // Encrypt fields using old key
    const encryptedBankOld = encryptSensitiveField(sampleBank, oldKey);
    const encryptedUpiOld = encryptSensitiveField(sampleUpi, oldKey);

    // Decrypting with new key directly should fail (AES-256-GCM auth tag mismatch)
    expect(() => decryptSensitiveField(encryptedBankOld, newKey)).toThrow();

    // Re-encrypt fields (decrypt with old key -> encrypt with new key)
    const decryptedBank = decryptSensitiveField(encryptedBankOld, oldKey);
    const decryptedUpi = decryptSensitiveField(encryptedUpiOld, oldKey);

    expect(decryptedBank).toBe(sampleBank);
    expect(decryptedUpi).toBe(sampleUpi);

    const encryptedBankNew = encryptSensitiveField(decryptedBank, newKey);
    const encryptedUpiNew = encryptSensitiveField(decryptedUpi, newKey);

    // Decrypting with new key now succeeds
    expect(decryptSensitiveField(encryptedBankNew, newKey)).toBe(sampleBank);
    expect(decryptSensitiveField(encryptedUpiNew, newKey)).toBe(sampleUpi);

    // Decrypting new ciphertext with old key fails
    expect(() => decryptSensitiveField(encryptedBankNew, oldKey)).toThrow();
  });

  it('validates 32-byte Base64 key formats cleanly', () => {
    const validBase64 = oldKey.toString('base64');
    expect(parseKey(validBase64)).toHaveLength(32);

    const invalidShortKey = Buffer.alloc(16).toString('base64');
    expect(() => parseKey(invalidShortKey)).toThrow('must decode to exactly 32 bytes');
  });
});
