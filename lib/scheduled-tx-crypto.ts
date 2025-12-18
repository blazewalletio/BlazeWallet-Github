/**
 * 🔐 Scheduled Transaction Crypto (Symmetric)
 *
 * Replaces the AWS KMS dependency with a simple symmetric key that lives
 * in Vercel env vars: SCHEDULED_TX_ENCRYPTION_KEY (base64, 32 bytes).
 *
 * - We still use the existing `encrypted_mnemonic` (AES-256-GCM via EphemeralKeyCrypto)
 * - This module ONLY encrypts/decrypts the ephemeral AES key itself.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const ENV_KEY_NAME = 'SCHEDULED_TX_ENCRYPTION_KEY';

function getSymmetricKey(): Buffer {
  const raw = process.env[ENV_KEY_NAME];
  if (!raw) {
    logger.error(`❌ ${ENV_KEY_NAME} is not set. Scheduled transactions cannot decrypt keys.`);
    throw new Error(`${ENV_KEY_NAME} is missing`);
  }

  try {
    const key = Buffer.from(raw.trim(), 'base64');
    if (key.length !== 32) {
      throw new Error(`Expected 32 bytes, got ${key.length}`);
    }
    return key;
  } catch (error: any) {
    logger.error(`❌ Failed to parse ${ENV_KEY_NAME}:`, error?.message || error);
    throw new Error(`${ENV_KEY_NAME} is invalid`);
  }
}

/**
 * Encrypt raw ephemeral key (base64-encoded) with AES-256-GCM.
 * Returns base64(iv | tag | ciphertext).
 */
export function encryptEphemeralKeySymmetric(rawBase64: string): string {
  const key = getSymmetricKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM

  const plaintext = Buffer.from(rawBase64, 'base64');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, ciphertext]);
  return combined.toString('base64');
}

/**
 * Decrypt previously encrypted ephemeral key (base64(iv | tag | ciphertext))
 * back into the original raw key bytes.
 */
export function decryptEphemeralKeySymmetric(encryptedBase64: string): Uint8Array {
  const key = getSymmetricKey();
  const buf = Buffer.from(encryptedBase64, 'base64');

  if (buf.length < 12 + 16) {
    throw new Error('Encrypted ephemeral key is too short');
  }

  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return new Uint8Array(decrypted);
}


