/**
 * Enhanced SPL Token Metadata Service with Persistent Caching
 * 
 * Features:
 * - Persistent IndexedDB cache (24-hour TTL)
 * - Stale-while-revalidate for instant loading
 * - Hardcoded popular tokens for reliability
 * - Jupiter API fallback with comprehensive coverage
 * - Batch optimized metadata lookups
 */

export interface SPLTokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

/**
 * Top 10 Most Popular SPL Tokens (Hardcoded for reliability)
 * These will work even if Jupiter API is down
 */
export const POPULAR_SPL_TOKENS: Record<string, SPLTokenMetadata> = {
  // USDC - Most used stablecoin on Solana
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin',
  },
  // USDT - Tether
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    coingeckoId: 'tether',
  },
  // RAY - Raydium
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    coingeckoId: 'raydium',
  },
  // BONK - Bonk
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    coingeckoId: 'bonk',
  },
  // JUP - Jupiter
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png',
    coingeckoId: 'jupiter-exchange-solana',
  },
  // WIF - dogwifhat
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    logoURI: '/crypto-wif.png', // ✅ LOCAL FILE: No more IPFS issues!
    coingeckoId: 'dogwifcoin',
  },
  // JTO - Jito
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': {
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    symbol: 'JTO',
    name: 'Jito',
    decimals: 9,
    logoURI: 'https://metadata.jito.network/token/jto/image',
    coingeckoId: 'jito-governance-token',
  },
  // PYTH - Pyth Network
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    logoURI: 'https://pyth.network/token.svg',
    coingeckoId: 'pyth-network',
  },
  // ORCA - Orca
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': {
    mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    symbol: 'ORCA',
    name: 'Orca',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
    coingeckoId: 'orca',
  },
  // MNGO - Mango
  'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac': {
    mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
    symbol: 'MNGO',
    name: 'Mango',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/logo.png',
    coingeckoId: 'mango-markets',
  },
};

/**
 * ✅ NEW: Persistent Jupiter Token Cache with IndexedDB
 * 24-hour cache with stale-while-revalidate support
 */
class JupiterTokenCache {
  private dbName = 'blaze_jupiter_cache';
  private storeName = 'tokens';
  private db: IDBDatabase | null = null;
  private memoryCache: Map<string, SPLTokenMetadata> | null = null;
  private cacheTime: number = 0;
  private cacheDuration = 24 * 60 * 60 * 1000; // ✅ 24 hours (was 1 hour)
  private initPromise: Promise<void> | null = null;
  private isFetching = false; // ✅ Prevent concurrent fetches

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initDB();
    }
  }

  /**
   * Initialize IndexedDB for persistent caching
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('⚠️ IndexedDB not available for Jupiter cache');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('❌ Failed to open Jupiter cache DB:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized for Jupiter token cache');
        
        // ✅ Load cache from IndexedDB on startup
        this.loadFromDB().then(() => {
          console.log('⚡ Jupiter tokens loaded from persistent cache');
          resolve();
        });
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'mint' });
          objectStore.createIndex('symbol', 'symbol', { unique: false });
          console.log('✅ Created IndexedDB object store for Jupiter tokens');
        }
      };
    });
  }

  /**
   * ✅ Load cache from IndexedDB (called on startup)
   */
  private async loadFromDB(): Promise<void> {
    if (!this.db) return;

    try {
      const tokens = await new Promise<SPLTokenMetadata[]>((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      if (tokens.length > 0) {
        this.memoryCache = new Map();
        tokens.forEach(token => {
          this.memoryCache!.set(token.mint, token);
        });
        this.cacheTime = Date.now(); // Assume recently cached
        console.log(`⚡ Loaded ${tokens.length} Jupiter tokens from IndexedDB`);
      }
    } catch (error) {
      console.warn('Failed to load Jupiter cache from IndexedDB:', error);
    }
  }

  /**
   * ✅ Save cache to IndexedDB (background operation)
   */
  private async saveToDB(tokens: Map<string, SPLTokenMetadata>): Promise<void> {
    if (!this.db) return;

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        
        // Clear old data
        objectStore.clear();
        
        // Insert new data
        tokens.forEach(token => {
          objectStore.put(token);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      console.log(`💾 Saved ${tokens.size} Jupiter tokens to IndexedDB`);
    } catch (error) {
      console.warn('Failed to save Jupiter cache to IndexedDB:', error);
    }
  }

  async getTokenList(): Promise<Map<string, SPLTokenMetadata>> {
    // Wait for DB initialization
    if (this.initPromise) {
      await this.initPromise;
    }

    // ✅ STALE-WHILE-REVALIDATE: Return cached data immediately
    const now = Date.now();
    const isStale = !this.memoryCache || (now - this.cacheTime > this.cacheDuration);

    if (this.memoryCache && this.memoryCache.size > 0) {
      console.log(`⚡ Using ${isStale ? 'stale' : 'fresh'} Jupiter cache (${this.memoryCache.size} tokens)`);
      
      // If stale, refresh in background
      if (isStale && !this.isFetching) {
        console.log('🔄 Refreshing Jupiter token list in background...');
        this.refreshCache(); // Fire and forget
      }
      
      return this.memoryCache;
    }

    // No cache - fetch now
    return await this.refreshCache();
  }

  /**
   * ✅ Refresh cache (can be called in background)
   */
  private async refreshCache(): Promise<Map<string, SPLTokenMetadata>> {
    if (this.isFetching) {
      // Already fetching, return current cache or empty map
      return this.memoryCache || new Map();
    }

    this.isFetching = true;

    try {
      console.log('🔍 [SPLTokenMetadata] Fetching Jupiter token list...');
      
      const response = await fetch('/api/jupiter-tokens', {
        cache: 'default',
      });
      
      if (!response.ok) {
        throw new Error(`Jupiter API proxy error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Jupiter API returned error');
      }
      
      const tokens: any[] = Array.isArray(data) ? data : (data.tokens || []);
      
      console.log(`🪐 [SPLTokenMetadata] Loaded ${tokens.length} tokens from Jupiter API`);
      
      // Convert to Map for fast lookup
      const tokenMap = new Map<string, SPLTokenMetadata>();
      
      tokens.forEach((token) => {
        if (token.address) {
          tokenMap.set(token.address, {
            mint: token.address,
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || 'Unknown Token',
            decimals: token.decimals || 9,
            logoURI: token.logoURI,
            coingeckoId: token.extensions?.coingeckoId,
          });
        }
      });

      this.memoryCache = tokenMap;
      this.cacheTime = Date.now();
      
      // ✅ Save to IndexedDB in background
      this.saveToDB(tokenMap);
      
      console.log(`✅ [SPLTokenMetadata] Cached ${tokenMap.size} tokens from Jupiter`);
      
      return tokenMap;
    } catch (error) {
      console.error('❌ [SPLTokenMetadata] Failed to fetch Jupiter token list:', error);
      
      // Return existing cache or empty map
      if (!this.memoryCache) {
        this.memoryCache = new Map();
      }
      
      return this.memoryCache;
    } finally {
      this.isFetching = false;
    }
  }

  clearCache() {
    this.memoryCache = null;
    this.cacheTime = 0;
    
    // Clear IndexedDB
    if (this.db) {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      objectStore.clear();
      console.log('🧹 Cleared Jupiter token cache');
    }
  }
}

const jupiterCache = new JupiterTokenCache();

/**
 * Get metadata for an SPL token
 * Uses hybrid approach: Hardcoded → Jupiter Cache → Fallback
 */
export async function getSPLTokenMetadata(mint: string): Promise<SPLTokenMetadata> {
  // Try 1: Check hardcoded popular tokens (instant)
  if (POPULAR_SPL_TOKENS[mint]) {
    return POPULAR_SPL_TOKENS[mint];
  }

  // Try 2: Check Jupiter cache (instant after first load)
  try {
    const jupiterTokens = await jupiterCache.getTokenList();
    const jupiterToken = jupiterTokens.get(mint);
    
    if (jupiterToken) {
      return jupiterToken;
    }
  } catch (error) {
    console.warn(`⚠️ [SPLTokenMetadata] Jupiter cache failed for ${mint}`, error);
  }

  // Fallback: Return basic metadata with mint address
  console.log(`⚠️ [SPLTokenMetadata] Unknown token ${mint}, using fallback`);
  return {
    mint,
    symbol: mint.slice(0, 4) + '...' + mint.slice(-4),
    name: 'Unknown Token',
    decimals: 9,
  };
}

/**
 * Get metadata for multiple SPL tokens (batch optimized)
 */
export async function getMultipleSPLTokenMetadata(
  mints: string[]
): Promise<Map<string, SPLTokenMetadata>> {
  const result = new Map<string, SPLTokenMetadata>();

  // ✅ Load Jupiter cache once for all tokens (instant after first load)
  const jupiterTokens = await jupiterCache.getTokenList();

  for (const mint of mints) {
    // Try hardcoded first
    if (POPULAR_SPL_TOKENS[mint]) {
      result.set(mint, POPULAR_SPL_TOKENS[mint]);
      continue;
    }

    // Try Jupiter cache
    const jupiterToken = jupiterTokens.get(mint);
    if (jupiterToken) {
      result.set(mint, jupiterToken);
      continue;
    }

    // Fallback
    result.set(mint, {
      mint,
      symbol: mint.slice(0, 4) + '...' + mint.slice(-4),
      name: 'Unknown Token',
      decimals: 9,
    });
  }

  return result;
}

/**
 * Clear Jupiter cache (useful for manual refresh)
 */
export function clearSPLTokenCache() {
  jupiterCache.clearCache();
}
