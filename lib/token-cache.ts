/**
 * 🚀 Smart Token Cache with IndexedDB
 * 
 * Caches ALL tokens in IndexedDB for instant client-side search
 * Background sync keeps cache fresh
 * 
 * Features:
 * - Instant client-side search (no API calls needed)
 * - Background sync (tokens load in background)
 * - Progressive loading (popular tokens first, rest later)
 * - Works offline (uses cached tokens)
 */

import { logger } from '@/lib/logger';

export interface CachedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI: string;
  priceUSD: string;
}

class TokenCache {
  private dbName = 'blaze_token_cache_v1';
  private storeName = 'tokens';
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.isInitialized && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        logger.error('❌ [TokenCache] IndexedDB open failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        logger.log('✅ [TokenCache] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: ['chainId', 'address'] });
          objectStore.createIndex('chainId', 'chainId', { unique: false });
          objectStore.createIndex('symbol', 'symbol', { unique: false });
          objectStore.createIndex('name', 'name', { unique: false });
          logger.log('✅ [TokenCache] Created object store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Store tokens in cache
   */
  async storeTokens(chainId: number, tokens: CachedToken[]): Promise<void> {
    await this.init();

    if (!this.db) {
      logger.error('❌ [TokenCache] DB not initialized');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);

      // Clear existing tokens for this chain
      const index = objectStore.index('chainId');
      const clearRequest = index.openKeyCursor(IDBKeyRange.only(chainId));
      
      clearRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          objectStore.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // All cleared, now add new tokens
          let added = 0;
          tokens.forEach(token => {
            const request = objectStore.put({
              ...token,
              chainId,
            });
            request.onsuccess = () => {
              added++;
              if (added === tokens.length) {
                logger.log(`✅ [TokenCache] Stored ${tokens.length} tokens for chain ${chainId}`);
                resolve();
              }
            };
            request.onerror = () => {
              logger.error('❌ [TokenCache] Failed to store token:', request.error);
            };
          });

          if (tokens.length === 0) {
            resolve();
          }
        }
      };

      clearRequest.onerror = () => {
        logger.error('❌ [TokenCache] Failed to clear tokens:', clearRequest.error);
        reject(clearRequest.error);
      };
    });
  }

  /**
   * Get tokens from cache
   */
  async getTokens(chainId: number): Promise<CachedToken[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('chainId');
      const request = index.getAll(chainId);

      request.onsuccess = () => {
        const tokens = request.result as CachedToken[];
        logger.log(`✅ [TokenCache] Retrieved ${tokens.length} tokens for chain ${chainId}`);
        resolve(tokens);
      };

      request.onerror = () => {
        logger.error('❌ [TokenCache] Failed to get tokens:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Search tokens in cache (client-side, instant!)
   * Searches through ALL cached tokens - no limits on search scope
   */
  async searchTokens(chainId: number, query: string, limit: number = 200): Promise<CachedToken[]> {
    await this.init();

    if (!this.db || !query || query.length < 2) {
      return [];
    }

    const allTokens = await this.getTokens(chainId);
    const queryLower = query.toLowerCase().trim();

    logger.log(`🔍 [TokenCache] Searching through ${allTokens.length} tokens for "${query}"...`);

    // Smart search: symbol first, then name, then address
    // Searches through ALL tokens - no limit on search scope
    const results = allTokens
      .filter(token => {
        const symbol = (token.symbol || '').toLowerCase();
        const name = (token.name || '').toLowerCase();
        const address = (token.address || '').toLowerCase();
        
        return symbol.includes(queryLower) || 
               name.includes(queryLower) || 
               address.includes(queryLower);
      })
      .sort((a, b) => {
        // Prioritize exact symbol matches (TRUMP = TRUMP)
        const aExact = a.symbol.toLowerCase() === queryLower;
        const bExact = b.symbol.toLowerCase() === queryLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then prioritize symbol starts with (TRUMP > TRUMPET)
        const aSymbolMatch = a.symbol.toLowerCase().startsWith(queryLower);
        const bSymbolMatch = b.symbol.toLowerCase().startsWith(queryLower);
        if (aSymbolMatch && !bSymbolMatch) return -1;
        if (!aSymbolMatch && bSymbolMatch) return 1;
        
        // Then prioritize name starts with
        const aNameMatch = a.name.toLowerCase().startsWith(queryLower);
        const bNameMatch = b.name.toLowerCase().startsWith(queryLower);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        // Then prioritize shorter symbols (TRUMP before TRUMPET)
        if (aSymbolMatch && bSymbolMatch) {
          return a.symbol.length - b.symbol.length;
        }
        
        return 0;
      })
      .slice(0, limit); // Only limit displayed results, not search scope

    logger.log(`✅ [TokenCache] Found ${results.length} tokens matching "${query}" (searched ${allTokens.length} total tokens)`);
    return results;
  }

  /**
   * Check if cache has tokens for chain
   */
  async hasTokens(chainId: number): Promise<boolean> {
    const tokens = await this.getTokens(chainId);
    return tokens.length > 0;
  }

  /**
   * Get cache size for chain
   */
  async getCacheSize(chainId: number): Promise<number> {
    const tokens = await this.getTokens(chainId);
    return tokens.length;
  }
}

export const tokenCache = new TokenCache();

