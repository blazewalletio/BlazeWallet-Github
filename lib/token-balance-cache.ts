/**
 * Enhanced Token Balance Cache with Stale-While-Revalidate
 * 
 * Features:
 * - Persistent IndexedDB caching
 * - Stale-while-revalidate for instant loading
 * - Per-chain, per-address caching
 * - 15-minute TTL with stale data tolerance
 * - Automatic cleanup
 */

const CACHE_VERSION = 2; // ✅ Bump for Token-2022 support!

interface CachedTokenData {
  key: string;
  tokens: any[];
  nativeBalance: string;
  timestamp: number;
  expiresAt: number;
  version: number;
}

class TokenBalanceCache {
  private dbName = 'blaze_token_cache';
  private storeName = 'balances';
  private db: IDBDatabase | null = null;
  private memoryCache: Map<string, CachedTokenData> = new Map();
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initDB();
    }
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('⚠️ IndexedDB not available for token cache');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('❌ Failed to open token cache DB:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized for token balance cache');
        this.cleanupExpired();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });
          objectStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          objectStore.createIndex('version', 'version', { unique: false });
        }
      };
    });
  }

  /**
   * Get cached token balances with stale-while-revalidate support
   */
  async getStale(chain: string, address: string): Promise<{ 
    tokens: any[] | null; 
    nativeBalance: string | null;
    isStale: boolean 
  }> {
    if (this.initPromise) {
      await this.initPromise;
    }

    const key = `${chain}:${address}`;

    // Try IndexedDB first
    if (this.db) {
      try {
        const result = await this.getFromDB(key);
        if (result.tokens) {
          return result;
        }
      } catch (error) {
        console.warn('Token cache read failed:', error);
      }
    }

    // Fallback to memory cache
    return this.getFromMemory(key);
  }

  /**
   * Set cached token balances
   */
  async set(chain: string, address: string, tokens: any[], nativeBalance: string, ttl: number = 15 * 60 * 1000): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }

    const now = Date.now();
    const key = `${chain}:${address}`;
    
    const cached: CachedTokenData = {
      key,
      tokens,
      nativeBalance,
      timestamp: now,
      expiresAt: now + ttl,
      version: CACHE_VERSION,
    };

    // Save to IndexedDB
    if (this.db) {
      try {
        await this.setToDB(cached);
      } catch (error) {
        console.warn('Token cache write failed:', error);
      }
    }

    // Always save to memory cache
    this.memoryCache.set(key, cached);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = this.db!.transaction([this.storeName], 'readwrite');
          const objectStore = transaction.objectStore(this.storeName);
          const request = objectStore.clear();

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        console.log('✅ Cleared token balance cache');
      } catch (error) {
        console.error('Failed to clear token cache:', error);
      }
    }
  }

  private async cleanupExpired(): Promise<void> {
    if (!this.db) return;

    const now = Date.now();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const index = objectStore.index('expiresAt');
        const request = index.openCursor(IDBKeyRange.upperBound(now));

        let count = 0;
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            count++;
            cursor.continue();
          } else {
            if (count > 0) {
              console.log(`🧹 Cleaned up ${count} expired token cache entries`);
            }
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to cleanup token cache:', error);
    }

    // Cleanup memory cache
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expiresAt < now) {
        this.memoryCache.delete(key);
      }
    }
  }

  private async getFromDB(key: string): Promise<{ 
    tokens: any[] | null; 
    nativeBalance: string | null;
    isStale: boolean 
  }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const cached = request.result as CachedTokenData | undefined;
        
        if (!cached) {
          resolve({ tokens: null, nativeBalance: null, isStale: false });
          return;
        }

        // Check version
        if (cached.version !== CACHE_VERSION) {
          this.deleteFromDB(key);
          resolve({ tokens: null, nativeBalance: null, isStale: false });
          return;
        }

        const now = Date.now();
        const isExpired = cached.expiresAt < now;
        
        resolve({ 
          tokens: cached.tokens, 
          nativeBalance: cached.nativeBalance,
          isStale: isExpired 
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async setToDB(cached: CachedTokenData): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(cached);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromDB(key: string): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getFromMemory(key: string): { 
    tokens: any[] | null; 
    nativeBalance: string | null;
    isStale: boolean 
  } {
    const cached = this.memoryCache.get(key);
    
    if (!cached) {
      return { tokens: null, nativeBalance: null, isStale: false };
    }

    // Check version
    if (cached.version !== CACHE_VERSION) {
      this.memoryCache.delete(key);
      return { tokens: null, nativeBalance: null, isStale: false };
    }

    const now = Date.now();
    const isExpired = cached.expiresAt < now;

    return { 
      tokens: cached.tokens, 
      nativeBalance: cached.nativeBalance,
      isStale: isExpired 
    };
  }
}

// Singleton instance
export const tokenBalanceCache = new TokenBalanceCache();

