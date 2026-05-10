/**
 * AES-256-GCM Encryption Library
 *
 * Uses Node.js `crypto` module for encrypting/decrypting sensitive values
 * stored in the EncryptedSetting table.
 *
 * The encryption key is read from ENCRYPTION_KEY env var.
 * If not set, a fixed development-only key is used (NEVER in production).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;    // 96-bit IV for GCM
const TAG_LENGTH = 16;   // 128-bit auth tag

/**
 * Get the encryption key. Uses ENCRYPTION_KEY from env if available,
 * otherwise falls back to a fixed dev-only key.
 */
function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    // If the key is hex-encoded (64 chars = 32 bytes)
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    // If it's a plain string, hash it to get exactly 32 bytes
    return crypto.createHash('sha256').update(envKey).digest();
  }
  // Dev-only fallback — DO NOT use in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  return crypto.createHash('sha256').update('dev-only-encryption-key-suq-shamel').digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing: iv + ciphertext + authTag
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine: iv (12 bytes) + authTag (16 bytes) + ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted value produced by `encrypt()`.
 * Extracts iv, authTag, and ciphertext from the combined buffer.
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  const combined = Buffer.from(encrypted, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
