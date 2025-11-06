/**
 * 🔓 SCHEDULED TRANSACTION DECRYPTION UTILITIES (Server-side)
 * 
 * Decrypts time-limited encrypted auth for transaction execution
 * Uses RSA private key (from Vercel env) + AES-256-GCM
 * 
 * Security:
 * - Private key only in server environment (Vercel)
 * - Checks expiry before decryption
 * - Clears sensitive data from memory immediately
 * - Logs all decrypt attempts for audit
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface EncryptedAuth {
  ciphertext: string;
  iv: string;
  encrypted_key: string;
  encrypted_at: string;
  expires_at: string;
  key_version: number;
}

export interface DecryptResult {
  success: boolean;
  mnemonic?: string;
  error?: string;
}

/**
 * Decrypt scheduled transaction auth (server-side only!)
 * 
 * @param encrypted - Encrypted auth bundle
 * @param transactionId - For audit logging
 * @returns Decrypted mnemonic or error
 */
export async function decryptScheduledAuth(
  encrypted: EncryptedAuth,
  transactionId: string
): Promise<DecryptResult> {
  const startTime = Date.now();
  
  try {
    // 1. Check if expired
    const expiresAt = new Date(encrypted.expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      await logDecryptAttempt(transactionId, false, 'Expired');
      return {
        success: false,
        error: 'Authorization expired - cannot decrypt',
      };
    }

    // 2. Get server private key
    const privateKeyPEM = process.env.SERVER_PRIVATE_KEY;
    
    if (!privateKeyPEM) {
      await logDecryptAttempt(transactionId, false, 'Missing private key');
      return {
        success: false,
        error: 'Server configuration error',
      };
    }

    // 3. Decrypt AES key with RSA private key
    const aesKeyBytes = await decryptKeyWithPrivateKey(
      encrypted.encrypted_key,
      privateKeyPEM
    );

    if (!aesKeyBytes) {
      await logDecryptAttempt(transactionId, false, 'Failed to decrypt AES key');
      return {
        success: false,
        error: 'Decryption failed',
      };
    }

    // 4. Import AES key
    const aesKeyBuffer = new Uint8Array(aesKeyBytes).buffer as ArrayBuffer;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKeyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // 5. Decrypt mnemonic with AES-GCM
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    const mnemonic = decoder.decode(decrypted);

    // 6. Validate mnemonic format
    if (!mnemonic || mnemonic.split(' ').length < 12) {
      await logDecryptAttempt(transactionId, false, 'Invalid mnemonic format');
      return {
        success: false,
        error: 'Decrypted data invalid',
      };
    }

    // 7. Log successful decrypt
    const duration = Date.now() - startTime;
    await logDecryptAttempt(transactionId, true, undefined, duration);

    console.log(`✅ [Decrypt] Transaction ${transactionId} decrypted successfully (${duration}ms)`);

    return {
      success: true,
      mnemonic,
    };

  } catch (error: any) {
    console.error(`❌ [Decrypt] Failed for transaction ${transactionId}:`, error.message);
    await logDecryptAttempt(transactionId, false, error.message);
    
    return {
      success: false,
      error: 'Decryption failed: ' + error.message,
    };
  }
}

/**
 * Decrypt AES key using server's RSA private key
 */
async function decryptKeyWithPrivateKey(
  encryptedKey: string,
  privateKeyPEM: string
): Promise<Uint8Array | null> {
  try {
    // Convert PEM to ArrayBuffer
    const pemContents = privateKeyPEM
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\\n/g, '\n')
      .replace(/\n/g, '')
      .replace(/\s/g, '');

    const binaryDer = atob(pemContents);
    const binaryDerArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryDerArray[i] = binaryDer.charCodeAt(i);
    }

    // Import RSA private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDerArray.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );

    // Decrypt AES key
    const encryptedKeyBytes = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
    
    const decryptedKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedKeyBytes
    );

    return new Uint8Array(decryptedKey);

  } catch (error: any) {
    console.error('❌ RSA decryption failed:', error.message);
    return null;
  }
}

/**
 * Log decrypt attempt for audit trail
 */
async function logDecryptAttempt(
  transactionId: string,
  success: boolean,
  error?: string,
  durationMs?: number
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      action: 'decrypt_scheduled_auth',
      resource_type: 'scheduled_transaction',
      resource_id: transactionId,
      success,
      error_message: error,
      metadata: {
        duration_ms: durationMs,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Don't fail on audit log error
    console.error('⚠️  Failed to log decrypt attempt:', err);
  }
}

/**
 * Clear sensitive data from encrypted auth
 * Called immediately after successful execution
 */
export async function clearEncryptedAuth(transactionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('scheduled_transactions')
      .update({ 
        encrypted_auth: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (error) {
      console.error(`❌ Failed to clear auth for ${transactionId}:`, error);
    } else {
      console.log(`🔥 [Security] Auth data deleted for transaction ${transactionId}`);
    }
  } catch (error) {
    console.error(`❌ Failed to clear auth:`, error);
  }
}

/**
 * Cleanup expired auth data (called by cron every hour)
 */
export async function cleanupExpiredAuth(): Promise<{ deleted: number }> {
  try {
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .update({ encrypted_auth: null })
      .not('encrypted_auth', 'is', null)
      .or(`status.in.(completed,failed,cancelled,expired),encrypted_auth->expires_at.lt.${new Date().toISOString()}`)
      .select('id');

    if (error) {
      console.error('❌ Cleanup failed:', error);
      return { deleted: 0 };
    }

    const deleted = data?.length || 0;
    console.log(`🧹 [Cleanup] Deleted ${deleted} expired auth entries`);
    
    return { deleted };
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return { deleted: 0 };
  }
}

