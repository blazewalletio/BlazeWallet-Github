/**
 * 🔐 SCHEDULED TRANSACTION ENCRYPTION UTILITIES
 * 
 * Time-limited encryption for scheduled transactions
 * Uses hybrid RSA + AES-256-GCM encryption
 * 
 * Security model:
 * 1. User unlocks wallet (mnemonic in memory)
 * 2. Generate random AES-256 key
 * 3. Encrypt mnemonic with AES-256-GCM
 * 4. Encrypt AES key with server's RSA public key
 * 5. Send encrypted bundle to server
 * 6. Server stores encrypted (time-limited)
 * 7. Cron job decrypts when ready to execute
 * 8. Auth data deleted immediately after execution
 */

export interface EncryptedAuth {
  ciphertext: string;        // Base64 encrypted mnemonic
  iv: string;                // Base64 initialization vector
  encrypted_key: string;     // Base64 RSA-encrypted AES key
  encrypted_at: string;      // ISO timestamp
  expires_at: string;        // ISO timestamp
  key_version: number;       // For key rotation
}

/**
 * Encrypt mnemonic for time-limited server storage
 * 
 * @param mnemonic - Wallet mnemonic (12/24 words)
 * @param expiresAt - When this auth expires (Date object)
 * @returns Encrypted auth bundle
 */
export async function encryptForScheduling(
  mnemonic: string,
  expiresAt: Date
): Promise<EncryptedAuth> {
  try {
    // 1. Generate random AES-256 key
    const aesKey = crypto.getRandomValues(new Uint8Array(32));

    // 2. Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 3. Import AES key for encryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );

    // 4. Encrypt mnemonic with AES-GCM
    const encoder = new TextEncoder();
    const encryptedMnemonic = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encoder.encode(mnemonic)
    );

    // 5. Encrypt AES key with server's RSA public key
    const encryptedKey = await encryptKeyForServer(aesKey);

    // 6. Return encrypted bundle
    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedMnemonic))),
      iv: btoa(String.fromCharCode(...iv)),
      encrypted_key: encryptedKey,
      encrypted_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      key_version: 1,
    };
  } catch (error) {
    console.error('❌ Encryption failed:', error);
    throw new Error('Failed to encrypt authorization');
  }
}

/**
 * Encrypt AES key with server's RSA public key
 */
async function encryptKeyForServer(aesKey: Uint8Array): Promise<string> {
  try {
    // Get server's public key from environment
    // ✅ FIX: Access from process.env with proper type safety
    const publicKeyPEM = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;
    
    if (!publicKeyPEM) {
      console.error('❌ RSA public key not found in environment');
      console.error('🔍 Debugging: process.env exists?', typeof process !== 'undefined');
      console.error('🔍 Debugging: NEXT_PUBLIC_SERVER_PUBLIC_KEY value:', publicKeyPEM);
      throw new Error('Server public key not configured - check Vercel environment variables');
    }

    console.log('✅ RSA public key found, length:', publicKeyPEM.length);

    // Convert PEM to ArrayBuffer
    const pemContents = publicKeyPEM
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\\n/g, '')
      .replace(/\s/g, '');

    const binaryDer = atob(pemContents);
    const binaryDerArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryDerArray[i] = binaryDer.charCodeAt(i);
    }

    // Import RSA public key
    const publicKeyBuffer = new Uint8Array(binaryDerArray).buffer as ArrayBuffer;
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );

    // Encrypt AES key with RSA
    const aesKeyBuffer = new Uint8Array(aesKey).buffer as ArrayBuffer;
    const encryptedKey = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKeyBuffer
    );

    return btoa(String.fromCharCode(...new Uint8Array(encryptedKey)));
  } catch (error) {
    console.error('❌ RSA encryption failed:', error);
    throw new Error('Failed to encrypt key for server');
  }
}

/**
 * Verify that encryption is working (client-side test)
 */
export async function testEncryption(): Promise<boolean> {
  try {
    const testMnemonic = 'test test test test test test test test test test test junk';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const encrypted = await encryptForScheduling(testMnemonic, expiresAt);
    
    console.log('✅ Encryption test passed:', {
      ciphertext_length: encrypted.ciphertext.length,
      has_iv: !!encrypted.iv,
      has_encrypted_key: !!encrypted.encrypted_key,
      key_version: encrypted.key_version,
    });
    
    return true;
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    return false;
  }
}

