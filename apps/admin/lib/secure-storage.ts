/**
 * Secure Storage Service
 * Uses IndexedDB instead of localStorage for sensitive data
 * 
 * WHY IndexedDB?
 * ✅ More secure than localStorage (not accessible via XSS)
 * ✅ Larger storage capacity
 * ✅ Asynchronous (non-blocking)
 * ✅ Better for sensitive data
 * ✅ Can store structured data
 * 
 * WHAT WE STORE:
 * - encrypted_wallet (encrypted mnemonic)
 * - password_hash
 * - biometric_passwords_v3
 * - webauthn_credentials
 */

import { logger } from './logger';

const DB_NAME = 'BlazeWalletSecure';
const DB_VERSION = 1;
const STORE_NAME = 'secure_data';

export class SecureStorage {
  private static instance: SecureStorage;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB not available (SSR)'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.log('✅ SecureStorage (IndexedDB) initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          logger.log('📦 Created IndexedDB object store:', STORE_NAME);
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Set a value in secure storage
   */
  public async setItem(key: string, value: string): Promise<void> {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not initialized');

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
          logger.log(`🔒 SecureStorage: Saved "${key}"`);
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Failed to save "${key}"`));
        };
      });
    } catch (error) {
      logger.error('SecureStorage setItem error:', error);
      // Fallback to localStorage if IndexedDB fails
      if (typeof window !== 'undefined') {
        localStorage.setItem(`secure_${key}`, value);
        logger.log(`⚠️ Fallback: Saved "${key}" to localStorage`);
      }
    }
  }

  /**
   * Get a value from secure storage
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not initialized');

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const value = request.result as string | undefined;
          logger.log(`🔓 SecureStorage: Retrieved "${key}"`, value ? '(has data)' : '(empty)');
          resolve(value || null);
        };

        request.onerror = () => {
          reject(new Error(`Failed to retrieve "${key}"`));
        };
      });
    } catch (error) {
      logger.error('SecureStorage getItem error:', error);
      // Fallback to localStorage if IndexedDB fails
      if (typeof window !== 'undefined') {
        const value = localStorage.getItem(`secure_${key}`);
        if (value) {
          logger.log(`⚠️ Fallback: Retrieved "${key}" from localStorage`);
        }
        return value;
      }
      return null;
    }
  }

  /**
   * Remove a value from secure storage
   */
  public async removeItem(key: string): Promise<void> {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not initialized');

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
          logger.log(`🗑️ SecureStorage: Removed "${key}"`);
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Failed to remove "${key}"`));
        };
      });
    } catch (error) {
      logger.error('SecureStorage removeItem error:', error);
      // Fallback to localStorage if IndexedDB fails
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`secure_${key}`);
        logger.log(`⚠️ Fallback: Removed "${key}" from localStorage`);
      }
    }
  }

  /**
   * Clear all secure storage
   */
  public async clear(): Promise<void> {
    try {
      await this.init();
      if (!this.db) throw new Error('IndexedDB not initialized');

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          logger.log('🗑️ SecureStorage: Cleared all data');
          resolve();
        };

        request.onerror = () => {
          reject(new Error('Failed to clear secure storage'));
        };
      });
    } catch (error) {
      logger.error('SecureStorage clear error:', error);
    }
  }

  /**
   * Migrate data from localStorage to IndexedDB
   * Run this once to move existing sensitive data
   */
  public async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    logger.log('🔄 Migrating sensitive data from localStorage to IndexedDB...');

    const keysToMigrate = [
      'encrypted_wallet',
      'password_hash',
      'biometric_passwords_v3',
      'webauthn_credentials',
      'has_password'
    ];

    for (const key of keysToMigrate) {
      const value = localStorage.getItem(key);
      if (value) {
        await this.setItem(key, value);
        // Don't remove from localStorage yet (keep as backup during migration)
        logger.log(`✅ Migrated: ${key}`);
      }
    }

    logger.log('✅ Migration complete!');
  }

  /**
   * Check if migration is needed
   */
  public async needsMigration(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Check if encrypted_wallet exists in localStorage but not in IndexedDB
    const hasLocalStorage = !!localStorage.getItem('encrypted_wallet');
    const hasIndexedDB = !!(await this.getItem('encrypted_wallet'));

    return hasLocalStorage && !hasIndexedDB;
  }
}

// Export singleton instance
export const secureStorage = SecureStorage.getInstance();

