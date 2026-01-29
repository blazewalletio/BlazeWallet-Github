/**
 * Token Logo Cache Service
 * Hybrid caching strategy for optimal performance AND reliability
 * 
 * Architecture:
 * Layer 1: In-Memory Cache (instant, session-based) - base64 data URLs
 * Layer 2: IndexedDB Cache (persistent, 7 days TTL) - base64 data URLs
 * Layer 3: HTTPS URLs (fallback, always works)
 * 
 * Migration: Old blob URLs are automatically cleaned up
 */

interface CachedLogo {
  url: string | null; // base64 data URL or HTTPS URL
  timestamp: number;
  isFailed?: boolean; // Mark failed lookups for shorter TTL
  isDataURL?: boolean; // Track if it's a base64 data URL (persistent)
}

interface TokenIdentifier {
  symbol: string;
  address: string;
  chainKey: string;
}

class TokenLogoCacheService {
  private memoryCache: Map<string, CachedLogo> = new Map();
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for successful lookups
  private readonly FAILED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for failed lookups
  private readonly DB_NAME = 'blaze-token-logos';
  private readonly DB_VERSION = 2; // ✅ Bump version to trigger migration
  private readonly STORE_NAME = 'logos';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initDB();
    }
  }

  /**
   * Initialize IndexedDB with migration from old blob URLs
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        resolve(); // Don't reject, fallback to memory-only cache
      };

      request.onsuccess = () => {
        this.db = request.result;
        // ✅ Clean up old blob URLs on app start
        this.cleanupOldBlobURLs().catch(() => {});
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // ✅ Migration: Delete old store and create new one
        if (db.objectStoreNames.contains(this.STORE_NAME)) {
          db.deleteObjectStore(this.STORE_NAME);
          console.log('🧹 Cleaned up old blob URL cache');
        }
        
        // Create fresh store for data URLs
        db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
        console.log('✅ Created new token logo cache (data URLs)');
      };
    });
  }

  /**
   * Clean up any remaining blob URLs from old cache
   */
  private async cleanupOldBlobURLs(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cached = cursor.value;
          // Remove entries with blob URLs
          if (cached.url && cached.url.startsWith('blob:')) {
            console.log(`🧹 Removing old blob URL: ${cached.key}`);
            store.delete(cached.key);
          }
          cursor.continue();
        }
      };
    } catch (error) {
      console.warn('Failed to cleanup old blob URLs:', error);
    }
  }

  /**
   * Generate cache key for a token
   */
  private getCacheKey(token: TokenIdentifier): string {
    return `${token.chainKey}-${token.address.toLowerCase()}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isValid(cached: CachedLogo): boolean {
    const ttl = cached.isFailed ? this.FAILED_CACHE_TTL : this.CACHE_TTL;
    return Date.now() - cached.timestamp < ttl;
  }

  /**
   * Get logo from memory cache
   */
  private getFromMemory(key: string): string | null {
    const cached = this.memoryCache.get(key);
    if (cached && this.isValid(cached)) {
      return cached.url;
    }
    return null;
  }

  /**
   * Get logo from IndexedDB
   */
  private async getFromDB(key: string): Promise<string | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result && this.isValid(result)) {
            // ✅ Data URLs and HTTPS URLs work directly, no recreation needed!
            // Update memory cache
            this.memoryCache.set(key, { 
              url: result.url, 
              timestamp: result.timestamp,
              isDataURL: result.isDataURL
            });
            resolve(result.url);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        resolve(null);
      }
    });
  }

  /**
   * Store logo in both memory and IndexedDB
   * Can store both successful and failed lookups
   */
  private async store(key: string, url: string | null, isDataURL: boolean = false, isFailed: boolean = false): Promise<void> {
    const cached: CachedLogo = { 
      url, 
      timestamp: Date.now(), 
      isFailed,
      isDataURL 
    };

    // Store in memory
    this.memoryCache.set(key, cached);

    // Store in IndexedDB (only if successful)
    if (this.db && url && !isFailed) {
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.put({ key, url, timestamp: cached.timestamp, isDataURL });
      } catch (error) {
        console.warn('Failed to store in IndexedDB:', error);
      }
    }
  }

  /**
   * Fetch logo from server API proxy (CoinGecko Pro API)
   * Returns either base64 data URL (for caching) or HTTPS URL (for direct use)
   */
  private async fetchFromAPI(token: TokenIdentifier, logoURI?: string): Promise<{ url: string; isDataURL: boolean } | null> {
    try {
      const params = new URLSearchParams({
        address: token.address,
        chainKey: token.chainKey,
        symbol: token.symbol,
        returnUrl: 'true', // ✅ Request HTTPS URL instead of blob
      });

      if (logoURI) {
        params.append('logoURI', logoURI);
      }

      const response = await fetch(`/api/token-logo?${params.toString()}`);

      if (response.ok) {
        const contentType = response.headers.get('Content-Type');
        
        // ✅ API should return JSON with HTTPS URL
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          if (data.imageUrl) {
            console.log(`✅ [TokenLogoCache] Got HTTPS URL for ${token.symbol}: ${data.imageUrl}`);
            // HTTPS URLs work directly, no conversion needed!
            return { url: data.imageUrl, isDataURL: false };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch logo from API:', error);
      return null;
    }
  }

  /**
   * Get token logo with hybrid caching strategy
   * 
   * @param token Token identifier
   * @param logoURI Optional direct logo URI
   * @returns Logo URL (data URL or HTTPS URL) or null
   */
  async getTokenLogo(token: TokenIdentifier, logoURI?: string): Promise<string | null> {
    // Wait for DB initialization
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }

    const cacheKey = this.getCacheKey(token);

    // Layer 1: Check memory cache
    const memoryUrl = this.getFromMemory(cacheKey);
    if (memoryUrl !== null) {
      return memoryUrl;
    }

    // Layer 2: Check IndexedDB
    const dbUrl = await this.getFromDB(cacheKey);
    if (dbUrl) {
      return dbUrl;
    }

    // Layer 3: Fetch from API (returns data URL or HTTPS URL)
    const apiResult = await this.fetchFromAPI(token, logoURI);
    
    // Store the result (success or failure)
    if (apiResult) {
      // Successful lookup - cache with appropriate TTL
      await this.store(cacheKey, apiResult.url, apiResult.isDataURL, false);
      return apiResult.url;
    } else {
      // Failed lookup - cache for 5 minutes only (in memory only)
      await this.store(cacheKey, null, false, true);
      return null;
    }
  }

  /**
   * Clear all caches (useful for debugging)
   */
  async clearCache(): Promise<void> {
    // Clear memory
    this.memoryCache.clear();

    // Clear IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.clear();
        console.log('🧹 Token logo cache cleared');
      } catch (error) {
        console.warn('Failed to clear IndexedDB:', error);
      }
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): { memorySize: number; dbSupported: boolean } {
    return {
      memorySize: this.memoryCache.size,
      dbSupported: this.db !== null,
    };
  }
}

// Singleton instance
export const TokenLogoCache = new TokenLogoCacheService();


