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
 * 🚀 OPTIE 1: Lazy Token Registry with On-Demand IndexedDB Lookup
 * 
 * Key Features:
 * - NO memory loading of 287k tokens (instant startup!)
 * - Direct IndexedDB queries with mint index
 * - Background sync without blocking UI
 * - Scales to millions of tokens
 */
class JupiterTokenCache {
  private dbName = 'blaze_jupiter_cache_v2'; // ✅ New version to force fresh schema
  private storeName = 'tokens';
  private metaStoreName = 'metadata';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isSyncing = false; // Track background sync
  private lastSyncTime = 0;
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initDB();
    }
  }

  /**
   * Initialize IndexedDB with mint index for fast queries
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('⚠️ IndexedDB not available for Jupiter cache');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, 2); // Version 2 with metadata store

      request.onerror = () => {
        console.error('❌ Failed to open Jupiter cache DB:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized for Jupiter token cache (lazy mode)');
        
        // Check if we need to sync in background
        this.checkAndSync().then(() => resolve());
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create or update tokens store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const tokenStore = db.createObjectStore(this.storeName, { keyPath: 'mint' });
          tokenStore.createIndex('mint', 'mint', { unique: true }); // ✅ Index for fast lookup
          tokenStore.createIndex('symbol', 'symbol', { unique: false });
          console.log('✅ Created Jupiter tokens store with mint index');
        }
        
        // Create metadata store for sync tracking
        if (!db.objectStoreNames.contains(this.metaStoreName)) {
          const metaStore = db.createObjectStore(this.metaStoreName, { keyPath: 'key' });
          console.log('✅ Created metadata store for sync tracking');
        }
      };
    });
  }

  /**
   * 🎯 NEW: Get single token metadata directly from IndexedDB
   * This is the KEY method - instant lookup without loading all tokens!
   */
  async getMintMetadata(mint: string): Promise<SPLTokenMetadata | null> {
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.db) return null;

    try {
      const token = await new Promise<SPLTokenMetadata | undefined>((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.get(mint); // Direct lookup by mint!

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return token || null;
    } catch (error) {
      console.warn(`IndexedDB lookup failed for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Check if sync is needed and trigger in background
   */
  private async checkAndSync(): Promise<void> {
    if (!this.db) return;

    try {
      // Check last sync time from metadata store
      const meta = await new Promise<any>((resolve) => {
        const transaction = this.db!.transaction([this.metaStoreName], 'readonly');
        const objectStore = transaction.objectStore(this.metaStoreName);
        const request = objectStore.get('lastSync');
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });

      this.lastSyncTime = meta?.timestamp || 0;
      const now = Date.now();
      const isStale = now - this.lastSyncTime > this.cacheDuration;

      if (isStale) {
        console.log('🔄 Jupiter token cache is stale, syncing in background...');
        this.syncInBackground(); // Fire and forget
      } else {
        console.log(`⚡ Jupiter token cache is fresh (synced ${Math.floor((now - this.lastSyncTime) / 3600000)}h ago)`);
      }
    } catch (error) {
      console.warn('Failed to check sync status:', error);
    }
  }

  /**
   * Sync Jupiter tokens in background WITHOUT blocking
   */
  private async syncInBackground(): Promise<void> {
    if (this.isSyncing || !this.db) return;

    this.isSyncing = true;

    try {
      console.log('🔄 [Background] Fetching Jupiter token list...');
      
      const response = await fetch('/api/jupiter-tokens', {
        cache: 'default',
      });
      
      if (!response.ok) {
        throw new Error(`Jupiter API proxy error: ${response.status}`);
      }

      const data = await response.json();
      const tokens: any[] = Array.isArray(data) ? data : (data.tokens || []);
      
      console.log(`🪐 [Background] Got ${tokens.length} tokens from Jupiter API`);
      
      // Save to IndexedDB in batches (non-blocking)
      const batchSize = 1000;
      let saved = 0;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        
        await new Promise<void>((resolve, reject) => {
          const transaction = this.db!.transaction([this.storeName], 'readwrite');
          const objectStore = transaction.objectStore(this.storeName);
          
          batch.forEach((token) => {
            if (token.address) {
              objectStore.put({
                mint: token.address,
                symbol: token.symbol || 'UNKNOWN',
                name: token.name || 'Unknown Token',
                decimals: token.decimals || 9,
                logoURI: token.logoURI,
                coingeckoId: token.extensions?.coingeckoId,
              });
            }
          });

          transaction.oncomplete = () => {
            saved += batch.length;
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        });

        // Yield to UI every batch
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Update sync timestamp
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.metaStoreName], 'readwrite');
        const objectStore = transaction.objectStore(this.metaStoreName);
        objectStore.put({ key: 'lastSync', timestamp: Date.now() });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      this.lastSyncTime = Date.now();
      console.log(`✅ [Background] Synced ${saved} Jupiter tokens to IndexedDB`);
      
    } catch (error) {
      console.error('❌ [Background] Failed to sync Jupiter tokens:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Legacy method for compatibility - now triggers background sync
   */
  async getTokenList(): Promise<Map<string, SPLTokenMetadata>> {
    console.warn('⚠️ getTokenList() is deprecated - use getMintMetadata() for instant lookup');
    
    // Trigger sync if needed
    if (this.initPromise) {
      await this.initPromise;
    }
    
    return new Map(); // Return empty map, no longer loading all tokens
  }

  clearCache() {
    if (!this.db) return;
    
    const transaction = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
    transaction.objectStore(this.storeName).clear();
    transaction.objectStore(this.metaStoreName).clear();
    
    this.lastSyncTime = 0;
    console.log('🧹 Cleared Jupiter token cache');
  }
}

const jupiterCache = new JupiterTokenCache();

/**
 * 🚀 Get metadata for an SPL token (INSTANT via IndexedDB lookup!)
 * Uses hybrid approach: Hardcoded → Direct IndexedDB Query → Fallback
 */
export async function getSPLTokenMetadata(mint: string): Promise<SPLTokenMetadata> {
  // Try 1: Check hardcoded popular tokens (instant, zero latency)
  if (POPULAR_SPL_TOKENS[mint]) {
    return POPULAR_SPL_TOKENS[mint];
  }

  // Try 2: Direct IndexedDB lookup (instant, no memory load!)
  try {
    const jupiterToken = await jupiterCache.getMintMetadata(mint);
    
    if (jupiterToken) {
      return jupiterToken;
    }
  } catch (error) {
    console.warn(`⚠️ [SPLTokenMetadata] IndexedDB lookup failed for ${mint}`, error);
  }

  // Fallback: Return basic metadata with mint address
  console.log(`⚠️ [SPLTokenMetadata] Unknown token ${mint}, using fallback`);
  return {
    mint,
    symbol: mint.slice(0, 4) + '...' + mint.slice(-4),
    name: 'Unknown Token',
    decimals: 9,
    logoURI: '/crypto-solana.png', // ✅ FIX: Fallback logo to prevent undefined
  };
}

/**
 * 🚀 Get metadata for multiple SPL tokens (parallel IndexedDB lookups!)
 */
export async function getMultipleSPLTokenMetadata(
  mints: string[]
): Promise<Map<string, SPLTokenMetadata>> {
  const result = new Map<string, SPLTokenMetadata>();

  // Fetch all in parallel (IndexedDB can handle concurrent reads!)
  await Promise.all(
    mints.map(async (mint) => {
      // Try hardcoded first
      if (POPULAR_SPL_TOKENS[mint]) {
        result.set(mint, POPULAR_SPL_TOKENS[mint]);
        return;
      }

      // Try direct IndexedDB lookup
      try {
        const jupiterToken = await jupiterCache.getMintMetadata(mint);
        if (jupiterToken) {
          result.set(mint, jupiterToken);
          return;
        }
      } catch (error) {
        console.warn(`Failed to lookup ${mint}:`, error);
      }

      // Fallback
      result.set(mint, {
        mint,
        symbol: mint.slice(0, 4) + '...' + mint.slice(-4),
        name: 'Unknown Token',
        decimals: 9,
        logoURI: '/crypto-solana.png', // ✅ FIX: Fallback logo
      });
    })
  );

  return result;
}

/**
 * Clear Jupiter cache (useful for manual refresh)
 */
export function clearSPLTokenCache() {
  jupiterCache.clearCache();
}
