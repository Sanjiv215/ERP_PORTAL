import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function parseKey(encodedOrBuffer) {
  if (!encodedOrBuffer) {
    throw new Error('Encryption key is required');
  }

  if (Buffer.isBuffer(encodedOrBuffer)) {
    if (encodedOrBuffer.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes');
    }
    return encodedOrBuffer;
  }

  const raw = String(encodedOrBuffer).replace(/^["']|["']$/g, '').trim();
  const key = Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error('EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes');
  }

  return key;
}

import { env } from '../config/env.js';

function getEncryptionKey() {
  const encoded = env.EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64 || process.env.EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64;
  if (!encoded) {
    throw new Error('EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64 is required for employee sensitive fields');
  }
  return parseKey(encoded);
}

export function encryptSensitiveField(value, explicitKey = null) {
  if (!value) {
    return null;
  }

  const key = explicitKey ? parseKey(explicitKey) : getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
}

export function decryptSensitiveField(encryptedValue, explicitKey = null) {
  if (!encryptedValue) {
    return null;
  }

  const [version, ivBase64, tagBase64, ciphertextBase64] = encryptedValue.split(':');

  if (version !== 'v1') {
    throw new Error('Unsupported encrypted field version');
  }

  const key = explicitKey ? parseKey(explicitKey) : getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function lastFour(value) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, '').slice(-4);
}
