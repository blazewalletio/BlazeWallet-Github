/**
 * Token Logo Cache Service
 * Multi-layer caching strategy for optimal performance
 * 
 * Architecture:
 * Layer 1: In-Memory Cache (instant, session-based)
 * Layer 2: IndexedDB Cache (persistent, 7 days TTL)
 * Layer 3: Server API Proxy (CoinGecko Pro API + fallbacks)
 */

interface CachedLogo {
  url: string | null;
  timestamp: number;
  isFailed?: boolean; // Mark failed lookups for shorter TTL
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
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'logos';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initDB();
    }
  }

  /**
   * Initialize IndexedDB
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
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
        }
      };
    });
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
            // Also update memory cache
            this.memoryCache.set(key, { url: result.url, timestamp: result.timestamp });
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
  private async store(key: string, url: string | null, isFailed: boolean = false): Promise<void> {
    const cached: CachedLogo = { url, timestamp: Date.now(), isFailed };

    // Store in memory
    this.memoryCache.set(key, cached);

    // Store in IndexedDB (only if successful or we want to cache the failure)
    if (this.db && url) { // Only cache successful lookups in IndexedDB
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.put({ key, ...cached });
      } catch (error) {
        console.warn('Failed to store in IndexedDB:', error);
      }
    }
  }

  /**
   * Fetch logo from server API proxy (CoinGecko Pro API)
   */
  private async fetchFromAPI(token: TokenIdentifier, logoURI?: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        address: token.address,
        chainKey: token.chainKey,
        symbol: token.symbol,
      });

      if (logoURI) {
        params.append('logoURI', logoURI);
      }

      const response = await fetch(`/api/token-logo?${params.toString()}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return url;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch logo from API:', error);
      return null;
    }
  }

  /**
   * Get token logo with multi-layer caching
   * 
   * @param token Token identifier
   * @param logoURI Optional direct logo URI
   * @returns Logo URL or null
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

    // Layer 3: Fetch from API
    const apiUrl = await this.fetchFromAPI(token, logoURI);
    
    // Store the result (success or failure)
    if (apiUrl) {
      // Successful lookup - cache for 7 days
      await this.store(cacheKey, apiUrl, false);
      return apiUrl;
    } else {
      // Failed lookup - cache for 5 minutes only (in memory only)
      await this.store(cacheKey, null, true);
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

