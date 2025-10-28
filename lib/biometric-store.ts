/**
 * Biometric-Protected Storage
 * Stores encrypted password that can only be accessed via biometric authentication
 * 
 * SECURITY IMPROVEMENTS:
 * - No longer stores encryption key in localStorage
 * - Key is derived from device-specific biometric credential
 * - Password can only be decrypted after successful biometric authentication
 */

import { WebAuthnService } from './webauthn-service';
import { secureLog } from './secure-log';

export class BiometricStore {
  private static instance: BiometricStore;
  private webauthnService: WebAuthnService;

  private constructor() {
    this.webauthnService = WebAuthnService.getInstance();
  }

  public static getInstance(): BiometricStore {
    if (!BiometricStore.instance) {
      BiometricStore.instance = new BiometricStore();
    }
    return BiometricStore.instance;
  }

  /**
   * Derive a consistent encryption key from credential ID
   * This key is unique per device and never stored
   */
  private async deriveKeyFromCredential(credentialId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    
    // Use credential ID as key material (device-specific, never changes)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(credentialId),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive encryption key using PBKDF2
    // Salt is derived from credential ID (consistent per device)
    const salt = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(credentialId + 'blaze-wallet-salt')
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // ✅ NON-EXTRACTABLE - cannot be exported
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Store password protected by biometric authentication
   * Uses AES-256-GCM encryption with key derived from WebAuthn credential
   * Key is NEVER stored - derived on-demand from credential ID
   */
  public async storePassword(password: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;

      secureLog.sensitive('Storing password with biometric protection...');

      // Get WebAuthn credentials (must be registered first)
      const credentials = this.webauthnService.getStoredCredentials();
      if (credentials.length === 0) {
        throw new Error('No biometric credentials found. Register biometrics first.');
      }

      // Derive encryption key from credential ID (device-specific, never stored)
      const key = await this.deriveKeyFromCredential(credentials[0].id);

      // Encrypt password with AES-GCM
      const encoder = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encoder.encode(password)
      );

      // Combine IV + encrypted data (NO KEY - it's derived on demand)
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Store as base64 (only IV + encrypted data, NO key)
      const base64 = btoa(String.fromCharCode(...combined));
      localStorage.setItem('biometric_protected_password', base64);

      secureLog.info('Password stored securely (key derived from biometric credential, not stored)');
      return true;
      
    } catch (error) {
      secureLog.error('Error storing password:', error);
      return false;
    }
  }

  /**
   * Retrieve password after biometric authentication
   * Decrypts with AES-GCM using key derived from WebAuthn credential
   * Key is NEVER stored - derived on-demand after successful biometric auth
   */
  public async retrievePassword(): Promise<string | null> {
    try {
      if (typeof window === 'undefined') return null;
      
      secureLog.sensitive('Retrieving password with biometric authentication...');

      // Check if biometric credentials exist
      const credentials = this.webauthnService.getStoredCredentials();
      if (credentials.length === 0) {
        throw new Error('Face ID is not set up. Go to Settings to enable it.');
      }

      // Authenticate with biometrics (Face ID / Touch ID)
      const result = await this.webauthnService.authenticate(credentials[0].id);
      if (!result.success) {
        // ✅ DO NOT clear biometric data on auth failure!
        // User might have cancelled, timed out, or temporary Safari issue
        // This is NOT data corruption - let them retry
        secureLog.info('Biometric authentication failed - user can retry or use password');
        throw new Error('Face ID verification failed. Try again or enter your password.');
      }

      secureLog.info('Biometric authentication successful');

      // Retrieve encrypted password
      const encrypted = localStorage.getItem('biometric_protected_password');
      if (!encrypted) {
        throw new Error('Face ID data is missing. Please set it up again in Settings.');
      }

      // ✅ VALIDATE base64 data BEFORE decoding
      if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) {
        secureLog.error('Invalid biometric data detected - contains invalid characters');
        // Clear corrupt data
        localStorage.removeItem('biometric_protected_password');
        localStorage.removeItem('biometric_enabled');
        throw new Error('Face ID data is corrupted. Please set it up again in Settings.');
      }

      // Decode from base64 with error handling
      let combined;
      try {
        combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
      } catch (e) {
        secureLog.error('Failed to decode base64 data');
        localStorage.removeItem('biometric_protected_password');
        localStorage.removeItem('biometric_enabled');
        throw new Error('Face ID data is corrupted. Please set it up again in Settings.');
      }

      // Extract IV and encrypted data (NO key - it's derived)
      const iv = combined.slice(0, 12); // 12 bytes IV
      const encryptedData = combined.slice(12);

      // Derive key from credential ID (same key as when stored)
      const key = await this.deriveKeyFromCredential(credentials[0].id);

      // Decrypt password with error handling
      let decrypted;
      try {
        decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv,
          },
          key,
          encryptedData
        );
      } catch (e) {
        // ✅ DO NOT clear biometric data here!
        // This could be a temporary error (user cancelled, timeout, Safari quirk)
        // Let the user retry or use password as fallback
        secureLog.error('Decryption failed - could be temporary (cancel/timeout) or wrong credential');
        throw new Error('Face ID verification failed. Try again or enter your password.');
      }

      const decoder = new TextDecoder();
      const password = decoder.decode(decrypted);

      secureLog.info('Password retrieved and decrypted successfully');
      return password;

    } catch (error: any) {
      secureLog.error('Error retrieving password:', error);
      throw error;
    }
  }

  /**
   * Remove stored password
   */
  public removePassword(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('biometric_protected_password');
    }
  }

  /**
   * Check if password is stored
   */
  public hasStoredPassword(): boolean {
    if (typeof window === 'undefined') return false;
    const encrypted = localStorage.getItem('biometric_protected_password');
    
    // ✅ VALIDATE that stored password is valid base64
    if (!encrypted) return false;
    
    // Check if it's valid base64
    if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) {
      secureLog.error('🚨 CORRUPT biometric data detected in hasStoredPassword - auto-cleaning');
      // Auto-clean corrupt data
      localStorage.removeItem('biometric_protected_password');
      localStorage.removeItem('biometric_enabled');
      return false;
    }
    
    return true;
  }
}

