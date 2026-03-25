import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const VERSION = 'v1';

interface EncryptionKey {
  id: string;
  key: Buffer;
}

/**
 * Parse the primary encryption key from environment variables.
 * Key must be a 32-byte hex string (64 hex chars).
 */
function getPrimaryKey(): EncryptionKey {
  const hex = process.env.PLAID_ENCRYPTION_KEY;
  const keyId = process.env.PLAID_ENCRYPTION_KEY_ID || 'v1';

  if (!hex) {
    throw new Error(
      'Missing PLAID_ENCRYPTION_KEY environment variable. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  if (hex.length !== 64) {
    throw new Error(
      `PLAID_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${hex.length} characters.`,
    );
  }

  return { id: keyId, key: Buffer.from(hex, 'hex') };
}

/**
 * Parse legacy encryption keys for key rotation support.
 * Format: comma-separated "keyId:hexKey" pairs.
 * e.g. "v0:abcdef0123...,v-1:fedcba9876..."
 */
function getLegacyKeys(): EncryptionKey[] {
  const raw = process.env.PLAID_ENCRYPTION_KEY_LEGACY;
  if (!raw) return [];

  return raw.split(',').filter(Boolean).map((entry) => {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) {
      throw new Error(
        `Invalid PLAID_ENCRYPTION_KEY_LEGACY format. Expected "keyId:hexKey", got "${entry.slice(0, 20)}..."`,
      );
    }
    const id = entry.slice(0, colonIdx);
    const hex = entry.slice(colonIdx + 1);
    if (hex.length !== 64) {
      throw new Error(
        `Legacy key "${id}" must be exactly 64 hex characters (32 bytes). Got ${hex.length} characters.`,
      );
    }
    return { id, key: Buffer.from(hex, 'hex') };
  });
}

/**
 * Encrypt a plaintext string (e.g. a Plaid access token).
 *
 * Storage format: `v1:<keyId>:<iv>:<authTag>:<ciphertext>`
 *   - v1       — version prefix for future migration
 *   - keyId    — identifies which key was used (supports rotation)
 *   - iv       — 12-byte initialization vector (base64)
 *   - authTag  — 16-byte authentication tag (base64)
 *   - ciphertext — encrypted payload (base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty or null value');
  }

  const primary = getPrimaryKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, primary.key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    primary.id,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a previously encrypted value.
 * Tries the current key first, then falls back to legacy keys.
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) {
    throw new Error('Cannot decrypt empty or null value');
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 5) {
    throw new Error(
      'Invalid encrypted value format. Expected "v1:keyId:iv:authTag:ciphertext".',
    );
  }

  const [version, keyId, ivB64, authTagB64, ciphertextB64] = parts;

  if (version !== VERSION) {
    throw new Error(`Unsupported encryption version "${version}". Only "${VERSION}" is supported.`);
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  // Gather all available keys: primary first, then legacy
  const primary = getPrimaryKey();
  const allKeys = [primary, ...getLegacyKeys()];

  // Try to find a matching key by ID first
  const matchingKey = allKeys.find((k) => k.id === keyId);
  if (matchingKey) {
    return decryptWithKey(matchingKey.key, iv, authTag, ciphertext);
  }

  // If no key ID match, try all keys (handles mismatched key IDs after rotation)
  const errors: string[] = [];
  for (const candidate of allKeys) {
    try {
      return decryptWithKey(candidate.key, iv, authTag, ciphertext);
    } catch (err) {
      errors.push(`Key "${candidate.id}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `Failed to decrypt value with key ID "${keyId}". Tried ${allKeys.length} key(s):\n${errors.join('\n')}`,
  );
}

function decryptWithKey(
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer,
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
