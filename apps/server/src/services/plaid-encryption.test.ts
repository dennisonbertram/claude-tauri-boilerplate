import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { encrypt, decrypt } from './plaid-encryption';

// Set up a valid 32-byte hex key for testing
const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
const TEST_KEY_ID = 'test-v1';

beforeAll(() => {
  process.env.PLAID_ENCRYPTION_KEY = TEST_KEY;
  process.env.PLAID_ENCRYPTION_KEY_ID = TEST_KEY_ID;
  // Clear any legacy keys
  delete process.env.PLAID_ENCRYPTION_KEY_LEGACY;
});

afterAll(() => {
  delete process.env.PLAID_ENCRYPTION_KEY;
  delete process.env.PLAID_ENCRYPTION_KEY_ID;
});

describe('Plaid Encryption', () => {
  test('encrypt/decrypt roundtrip preserves plaintext', () => {
    const plaintext = 'access-sandbox-abc123-def456-789';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test('encrypt/decrypt roundtrip with unicode content', () => {
    const plaintext = 'token-with-unicode-\u00e9\u00e8\u00ea';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test('different plaintexts produce different ciphertexts', () => {
    const enc1 = encrypt('secret-one');
    const enc2 = encrypt('secret-two');
    expect(enc1).not.toBe(enc2);
  });

  test('same plaintext encrypted twice produces different ciphertexts (random IV)', () => {
    const enc1 = encrypt('same-value');
    const enc2 = encrypt('same-value');
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(decrypt(enc1)).toBe('same-value');
    expect(decrypt(enc2)).toBe('same-value');
  });

  test('encrypted value has v1 format with 5 colon-separated parts', () => {
    const encrypted = encrypt('test-token');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toBe(TEST_KEY_ID);
  });

  test('tampered ciphertext throws on decrypt', () => {
    const encrypted = encrypt('original-value');
    const parts = encrypted.split(':');
    // Corrupt the ciphertext (last part)
    parts[4] = Buffer.from('corrupted-data').toString('base64');
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });

  test('tampered authTag throws on decrypt', () => {
    const encrypted = encrypt('original-value');
    const parts = encrypted.split(':');
    // Corrupt the auth tag (4th part)
    parts[3] = Buffer.from('bad-auth-tag-1234').toString('base64');
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });

  test('tampered IV throws on decrypt', () => {
    const encrypted = encrypt('original-value');
    const parts = encrypted.split(':');
    // Corrupt the IV (3rd part)
    parts[2] = Buffer.from('bad-iv-12345').toString('base64');
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });

  test('invalid format (wrong number of parts) throws', () => {
    expect(() => decrypt('v1:only-three:parts')).toThrow('Invalid encrypted value format');
  });

  test('unsupported version throws', () => {
    expect(() => decrypt('v2:key:iv:tag:data')).toThrow('Unsupported encryption version');
  });

  test('encrypt throws on empty string', () => {
    expect(() => encrypt('')).toThrow('Cannot encrypt empty or null value');
  });

  test('decrypt throws on empty string', () => {
    expect(() => decrypt('')).toThrow('Cannot decrypt empty or null value');
  });

  test('missing encryption key throws descriptive error', () => {
    const original = process.env.PLAID_ENCRYPTION_KEY;
    delete process.env.PLAID_ENCRYPTION_KEY;

    try {
      expect(() => encrypt('test')).toThrow('Missing PLAID_ENCRYPTION_KEY');
    } finally {
      process.env.PLAID_ENCRYPTION_KEY = original;
    }
  });

  test('invalid key length throws descriptive error', () => {
    const original = process.env.PLAID_ENCRYPTION_KEY;
    process.env.PLAID_ENCRYPTION_KEY = 'tooshort';

    try {
      expect(() => encrypt('test')).toThrow('must be exactly 64 hex characters');
    } finally {
      process.env.PLAID_ENCRYPTION_KEY = original;
    }
  });
});
