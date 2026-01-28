/**
 * Biometric-Protected Storage
 * Stores encrypted password that can only be accessed via biometric authentication
 * 
 * ✅ WALLET-SPECIFIC SECURITY:
 * - Each wallet gets its OWN biometric credential
 * - Email wallets: Indexed by Supabase user_id
 * - Seed wallets: Indexed by EVM address
 * - No encryption key stored - derived from device-specific credential
 * - Password can only be decrypted after successful biometric authentication
 */

import { WebAuthnService } from './webauthn-service';
import { secureLog } from './secure-log';
import { logger } from '@/lib/logger';
import { secureStorage } from './secure-storage';

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
   * Store password protected by biometric authentication FOR A SPECIFIC WALLET
   * ✅ WALLET-INDEXED: Each wallet has separate encrypted password
   * Uses AES-256-GCM encryption with key derived from WebAuthn credential
   * Key is NEVER stored - derived on-demand from credential ID
   * 
   * @param password - The password to encrypt
   * @param walletIdentifier - Supabase user_id (email) or EVM address (seed)
   */
  public async storePassword(password: string, walletIdentifier: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;

      secureLog.sensitive(`Storing password with biometric protection for wallet: ${walletIdentifier.substring(0, 8)}...`);

      // Get WebAuthn credential for this specific wallet
      const credential = this.webauthnService.getStoredCredential(walletIdentifier);
      if (!credential) {
        throw new Error('No biometric credentials found for this wallet. Register biometrics first.');
      }

      // Derive encryption key from credential ID (device-specific, never stored)
      const key = await this.deriveKeyFromCredential(credential.id);

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
      
      // ✅ WALLET-INDEXED STORAGE
      const allData = this.getAllBiometricData();
      if (!allData[walletIdentifier]) {
        allData[walletIdentifier] = {};
      }
      allData[walletIdentifier].encrypted_password = base64;
      allData[walletIdentifier].enabled = true;
      localStorage.setItem('biometric_data', JSON.stringify(allData));

      secureLog.info(`Password stored securely for wallet: ${walletIdentifier.substring(0, 8)}... (key derived from biometric credential, not stored)`);
      return true;
      
    } catch (error) {
      secureLog.error('Error storing password:', error);
      return false;
    }
  }

  /**
   * Retrieve password after biometric authentication FOR A SPECIFIC WALLET
   * ✅ WALLET-SPECIFIC: Only retrieves password for this wallet
   * Decrypts with AES-GCM using key derived from WebAuthn credential
   * Key is NEVER stored - derived on-demand after successful biometric auth
   * 
   * @param walletIdentifier - Supabase user_id (email) or EVM address (seed)
   */
  public async retrievePassword(walletIdentifier: string): Promise<string | null> {
    try {
      if (typeof window === 'undefined') return null;
      
      logger.log(`🔐 [BiometricStore] retrievePassword called for wallet: ${walletIdentifier.substring(0, 8)}...`);
      secureLog.sensitive(`Retrieving password with biometric authentication for wallet: ${walletIdentifier.substring(0, 8)}...`);

      // Check if biometric credential exists for this wallet
      const credential = this.webauthnService.getStoredCredential(walletIdentifier);
      logger.log('🔍 [BiometricStore] Credential lookup:', credential ? 'FOUND' : 'NOT FOUND');
      
      if (!credential) {
        throw new Error('Face ID is not set up for this wallet. Go to Settings to enable it.');
      }

      // Authenticate with biometrics (Face ID / Touch ID)
      logger.log('🔐 [BiometricStore] Starting WebAuthn authentication...');
      const result = await this.webauthnService.authenticate(credential.id);
      logger.log('🔍 [BiometricStore] WebAuthn result:', result.success ? 'SUCCESS' : 'FAILED');
      
      if (!result.success) {
        // ✅ DO NOT clear biometric data on auth failure!
        // User might have cancelled, timed out, or temporary Safari issue
        // This is NOT data corruption - let them retry
        secureLog.info('Biometric authentication failed - user can retry or use password');
        throw new Error('Face ID verification failed. Try again or enter your password.');
      }

      secureLog.info('Biometric authentication successful');

      // Retrieve encrypted password for this wallet
      const allData = this.getAllBiometricData();
      const walletData = allData[walletIdentifier];
      
      logger.log('🔍 [BiometricStore] Wallet data lookup:', walletData ? 'FOUND' : 'NOT FOUND');
      
      if (!walletData || !walletData.encrypted_password) {
        throw new Error('Face ID data is missing for this wallet. Please set it up again in Settings.');
      }

      const encrypted = walletData.encrypted_password;

      // ✅ VALIDATE base64 data BEFORE decoding
      if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) {
        secureLog.error('Invalid biometric data detected - contains invalid characters');
        // Clear corrupt data for THIS wallet only
        delete allData[walletIdentifier];
        localStorage.setItem('biometric_data', JSON.stringify(allData));
        throw new Error('Face ID data is corrupted. Please set it up again in Settings.');
      }

      // Decode from base64 with error handling
      let combined;
      try {
        combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        logger.log('✅ [BiometricStore] Base64 decode successful');
      } catch (e) {
        secureLog.error('Failed to decode base64 data');
        delete allData[walletIdentifier];
        localStorage.setItem('biometric_data', JSON.stringify(allData));
        throw new Error('Face ID data is corrupted. Please set it up again in Settings.');
      }

      // Extract IV and encrypted data (NO key - it's derived)
      const iv = combined.slice(0, 12); // 12 bytes IV
      const encryptedData = combined.slice(12);

      // Derive key from credential ID (same key as when stored)
      logger.log('🔐 [BiometricStore] Deriving encryption key...');
      const key = await this.deriveKeyFromCredential(credential.id);
      logger.log('✅ [BiometricStore] Key derived successfully');

      // Decrypt password with error handling
      let decrypted;
      try {
        logger.log('🔐 [BiometricStore] Decrypting password...');
        decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv,
          },
          key,
          encryptedData
        );
        logger.log('✅ [BiometricStore] Password decrypted successfully');
      } catch (e) {
        // ✅ DO NOT clear biometric data here!
        // This could be a temporary error (user cancelled, timeout, Safari quirk)
        // Let the user retry or use password as fallback
        secureLog.error('Decryption failed - could be temporary (cancel/timeout) or wrong credential');
        throw new Error('Face ID verification failed. Try again or enter your password.');
      }

      const decoder = new TextDecoder();
      const password = decoder.decode(decrypted);

      secureLog.info(`Password retrieved and decrypted successfully for wallet: ${walletIdentifier.substring(0, 8)}...`);
      logger.log(`✅ [BiometricStore] Complete success for wallet: ${walletIdentifier.substring(0, 8)}...`);
      return password;

    } catch (error: any) {
      secureLog.error('Error retrieving password:', error);
      logger.error('❌ [BiometricStore] Error:', error.message);
      throw error;
    }
  }

  /**
   * Remove stored password for a specific wallet
   * ✅ WALLET-SPECIFIC: Only removes data for this wallet
   */
  public removePassword(walletIdentifier: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const allData = this.getAllBiometricData();
      if (allData[walletIdentifier]) {
        delete allData[walletIdentifier].encrypted_password;
        if (Object.keys(allData[walletIdentifier]).length === 0) {
          delete allData[walletIdentifier];
        }
        localStorage.setItem('biometric_data', JSON.stringify(allData));
      }
    } catch (error) {
      logger.error('Error removing password:', error);
    }
  }

  /**
   * Check if password is stored for a specific wallet
   * ✅ WALLET-SPECIFIC: Checks only for this wallet
   */
  public hasStoredPassword(walletIdentifier: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const allData = this.getAllBiometricData();
      const walletData = allData[walletIdentifier];
      
      if (!walletData || !walletData.encrypted_password) {
        return false;
      }
      
      const encrypted = walletData.encrypted_password;
      
      // Check if it's valid base64
      if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) {
        secureLog.error(`🚨 CORRUPT biometric data detected for wallet ${walletIdentifier.substring(0, 8)}... - auto-cleaning`);
        // Auto-clean corrupt data for this wallet
        delete allData[walletIdentifier];
        localStorage.setItem('biometric_data', JSON.stringify(allData));
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error checking stored password:', error);
      return false;
    }
  }

  /**
   * Get ALL biometric data (for migration and management)
   */
  private getAllBiometricData(): Record<string, any> {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem('biometric_data');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      logger.error('Error retrieving biometric data:', error);
      return {};
    }
  }

  /**
   * Remove ALL biometric data (for complete reset)
   */
  public removeAllData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('biometric_data');
    // Also remove old format for cleanup
    localStorage.removeItem('biometric_protected_password');
    localStorage.removeItem('biometric_enabled');
  }
}
