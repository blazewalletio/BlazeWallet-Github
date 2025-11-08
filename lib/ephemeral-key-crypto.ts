/**
 * 🔐 BLAZE WALLET - EPHEMERAL KEY ENCRYPTION
 * 
 * Client-side encryption utilities for mnemonics
 * - AES-256-GCM for mnemonic encryption
 * - RSA-OAEP-SHA256 for ephemeral key encryption with KMS public key
 */

// ✅ Node.js compatibility: Use webcrypto for backend
const getCrypto = () => {
  if (typeof window !== 'undefined') {
    // Browser environment
    return window.crypto;
  }
  
  // Node.js backend environment
  try {
    // Try Node.js 18+ built-in webcrypto
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto;
    }
    
    // Fallback to require('crypto').webcrypto
    const { webcrypto } = require('crypto');
    return webcrypto;
  } catch (error) {
    console.error('❌ Failed to load webcrypto:', error);
    throw new Error('Web Crypto API not available');
  }
};

export class EphemeralKeyCrypto {
  /**
   * Generate random ephemeral AES-256 key
   */
  static async generateEphemeralKey(): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    const _crypto = getCrypto();
    const raw = _crypto.getRandomValues(new Uint8Array(32)); // 256 bits
    
    const key = await _crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    return { key, raw };
  }

  /**
   * Encrypt mnemonic with ephemeral AES key
   */
  static async encryptMnemonic(
    mnemonic: string,
    ephemeralKey: CryptoKey
  ): Promise<string> {
    const _crypto = getCrypto();
    const iv = _crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encrypted = await _crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      ephemeralKey,
      new TextEncoder().encode(mnemonic)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined)); // Base64
  }

  /**
   * Encrypt ephemeral key with KMS public key (RSA)
   */
  static async encryptEphemeralKeyWithKMS(
    ephemeralKeyRaw: Uint8Array,
    kmsPublicKeyPem: string
  ): Promise<string> {
    const _crypto = getCrypto();
    // Import KMS public key
    const publicKey = await _crypto.subtle.importKey(
      'spki',
      this.pemToArrayBuffer(kmsPublicKeyPem),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );

    // Encrypt ephemeral key (convert Uint8Array to plain ArrayBuffer)
    const encrypted = await _crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      ephemeralKeyRaw as BufferSource
    );

    return btoa(String.fromCharCode(...new Uint8Array(encrypted))); // Base64
  }

  /**
   * Decrypt mnemonic (for backend execution)
   */
  static async decryptMnemonic(
    encryptedMnemonic: string,
    ephemeralKeyRaw: Uint8Array
  ): Promise<string> {
    const _crypto = getCrypto();
    const combined = Uint8Array.from(atob(encryptedMnemonic), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const ephemeralKey = await _crypto.subtle.importKey(
      'raw',
      ephemeralKeyRaw as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await _crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      ephemeralKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Convert PEM to ArrayBuffer
   */
  private static pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');
    
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * Securely zero memory
   */
  static zeroMemory(data: Uint8Array | ArrayBuffer | null) {
    if (data instanceof Uint8Array) {
      data.fill(0);
    } else if (data instanceof ArrayBuffer) {
      new Uint8Array(data).fill(0);
    }
    // Note: Strings are immutable in JS, best we can do is null it
  }
}

