// Live crypto price service with multi-API fallback system
import { dexScreenerService } from './dexscreener-service';
import { LRUCache } from './lru-cache'; // ✅ PERFORMANCE: LRU cache for better memory management
import { logger } from '@/lib/logger';

export class PriceService {
  // ✅ PERFORMANCE FIX: Use LRU cache instead of Map for automatic eviction
  private cache = new LRUCache<{ price: number; change24h: number; source: string }>(200); // Symbol cache
  private mintCache = new LRUCache<{ price: number; change24h: number; source: string }>(100); // Solana mint cache
  private addressCache = new LRUCache<{ price: number; change24h: number; source: string }>(100); // EVM address cache
  private cacheDuration = 600000; // ✅ 10 minutes cache (efficient for token prices)
  private primaryApiUrl = '/api/prices'; // CoinGecko (primary)
  private fallbackApiUrl = '/api/prices-binance'; // Binance (fallback)
  private addressApiUrl = '/api/prices-by-address'; // CoinGecko by address (NEW!)

  /**
   * Get single price with fallback system
   */
  async getPrice(symbol: string): Promise<number> {
    // Check LRU cache first (auto-evicts old entries)
    const cached = this.cache.get(symbol);
    if (cached) {
      logger.log(`💰 [PriceService] Cache hit for ${symbol}: $${cached.price} (${cached.source})`);
      return cached.price;
    }

    logger.log(`🔍 [PriceService] Fetching price for ${symbol}...`);

    // Try primary API (CoinGecko)
    const price = await this.fetchPriceWithFallback(symbol);
    
    // Return price (0 if not found - will use DexScreener)
    return price;
  }

  /**
   * Get multiple prices in batch (optimized)
   */
  async getMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
    logger.log(`🔍 [PriceService] Fetching multiple prices for: ${symbols.join(', ')}`);

    // Check which symbols are in LRU cache
    const uncachedSymbols: string[] = [];
    const result: Record<string, number> = {};

    symbols.forEach(symbol => {
      const cached = this.cache.get(symbol);
      if (cached) {
        result[symbol] = cached.price;
      } else {
        uncachedSymbols.push(symbol);
      }
    });

    logger.log(`💾 [PriceService] Cache hits: ${symbols.length - uncachedSymbols.length}/${symbols.length}`);

    // If all cached, return immediately
    if (uncachedSymbols.length === 0) {
      return result;
    }

    // Fetch uncached prices with fallback
    const fetchedPrices = await this.fetchMultiplePricesWithFallback(uncachedSymbols);
    
    // Merge with cached results
    Object.keys(fetchedPrices).forEach(symbol => {
      result[symbol] = fetchedPrices[symbol];
    });

    return result;
  }

  /**
   * Get 24h change with fallback
   */
  async get24hChange(symbol: string): Promise<number> {
    // Check LRU cache first (TTL handled internally)
    const cached = this.cache.get(symbol);
    if (cached) {
      return cached.change24h;
    }

    // Fetch fresh data (will update cache)
    await this.getPrice(symbol);
    
    // Return from cache (now updated)
    const updated = this.cache.get(symbol);
    return updated?.change24h || 0;
  }

  /**
   * 🔥 NEW: Get price by mint address (for SPL tokens not on CoinGecko/Binance)
   * Uses DexScreener as primary source for DEX-traded tokens
   */
  async getPriceByMint(mint: string): Promise<{ price: number; change24h: number }> {
    // Check mint cache first (TTL handled internally)
    const cached = this.mintCache.get(mint);
    if (cached) {
      logger.log(`💰 [PriceService] Mint cache hit for ${mint.substring(0, 8)}...: $${cached.price} (${cached.source})`);
      return { price: cached.price, change24h: cached.change24h };
    }

    logger.log(`🔍 [PriceService] Fetching price by mint for ${mint.substring(0, 8)}...`);

    try {
      // Try DexScreener (best for DEX-traded tokens)
      const dexToken = await dexScreenerService.getTokenMetadata(mint);
      
      if (dexToken && dexToken.priceUsd && dexToken.priceUsd > 0) {
        const price = dexToken.priceUsd;
        const change24h = dexToken.priceChange24h || 0;
        
        // Update mint cache with TTL
        this.mintCache.set(mint, {
          price,
          change24h,
          source: 'dexscreener',
        }, this.cacheDuration);
        
        logger.log(`✅ [PriceService] DexScreener: ${mint.substring(0, 8)}... = $${price}`);
        return { price, change24h };
      }
    } catch (error) {
      logger.warn(`⚠️ [PriceService] DexScreener failed for ${mint.substring(0, 8)}...:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // If API fails, return 0 (LRU cache would have returned cached value if fresh)
    logger.error(`❌ [PriceService] Failed to get price by mint for ${mint.substring(0, 8)}...`);
    return { price: 0, change24h: 0 };
  }

  /**
   * 🔥 NEW: Get prices for multiple SPL tokens by mint address
   * Optimized batch method with rate limiting for DexScreener
   */
  async getPricesByMints(mints: string[]): Promise<Map<string, { price: number; change24h: number }>> {
    logger.log(`🔍 [PriceService] Fetching prices for ${mints.length} mints...`);
    
    const result = new Map<string, { price: number; change24h: number }>();
    const now = Date.now();
    const uncachedMints: string[] = [];

    // Check cache first (TTL handled internally by LRU)
    mints.forEach(mint => {
      const cached = this.mintCache.get(mint);
      if (cached) {
        result.set(mint, { price: cached.price, change24h: cached.change24h });
      } else {
        uncachedMints.push(mint);
      }
    });

    logger.log(`💾 [PriceService] Mint cache hits: ${result.size}/${mints.length}`);

    if (uncachedMints.length === 0) {
      return result;
    }

    // Fetch uncached mints from DexScreener (sequential with rate limiting)
    for (const mint of uncachedMints) {
      const priceData = await this.getPriceByMint(mint);
      result.set(mint, priceData);
      
      // Small delay to respect DexScreener rate limits (250ms = 240 req/min, well under 300 limit)
      if (uncachedMints.indexOf(mint) < uncachedMints.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    return result;
  }

  /**
   * Private: Fetch price with fallback logic
   */
  private async fetchPriceWithFallback(symbol: string): Promise<number> {
    // Try CoinGecko first
    try {
      logger.log(`📡 [PriceService] Trying CoinGecko for ${symbol}...`);
      const response = await fetch(`${this.primaryApiUrl}?symbols=${symbol}`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data[symbol] && data[symbol].price > 0) {
          const price = data[symbol].price;
          const change24h = data[symbol].change24h || 0;
          
          // Update cache with TTL
          this.cache.set(symbol, { 
            price, 
            change24h, 
            source: 'coingecko',
          }, this.cacheDuration);
          
          logger.log(`✅ [PriceService] CoinGecko: ${symbol} = $${price}`);
          return price;
        }
      } else if (response.status === 400) {
        // 400 = Token not in CoinGecko mapping, silently try fallback
        logger.log(`⏭️ [PriceService] ${symbol} not in CoinGecko, trying fallback...`);
      }
    } catch (error) {
      logger.warn(`⚠️ [PriceService] CoinGecko failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Try Binance fallback
    try {
      logger.log(`📡 [PriceService] Trying Binance for ${symbol}...`);
      const response = await fetch(`${this.fallbackApiUrl}?symbols=${symbol}`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data[symbol] && data[symbol].price > 0) {
          const price = data[symbol].price;
          const change24h = data[symbol].change24h || 0;
          
          // Update cache with TTL
          this.cache.set(symbol, { 
            price, 
            change24h, 
            source: 'binance',
          }, this.cacheDuration);
          
          logger.log(`✅ [PriceService] Binance: ${symbol} = $${price}`);
          return price;
        }
      } else if (response.status === 400) {
        // 400 = Token not in Binance either, will use DexScreener
        logger.log(`⏭️ [PriceService] ${symbol} not in Binance, will use DexScreener fallback`);
      }
    } catch (error) {
      logger.warn(`⚠️ [PriceService] Binance failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Silent fail for getPrice() - DexScreener will be used as final fallback
    // Only log if it's a well-known token (not a meme coin)
    const knownTokens = ['ETH', 'BTC', 'SOL', 'MATIC', 'BNB', 'USDT', 'USDC'];
    if (knownTokens.includes(symbol.toUpperCase())) {
      logger.error(`❌ [PriceService] All APIs failed for ${symbol}`);
    }
    return 0;
  }

  /**
   * Private: Fetch multiple prices with fallback (batch optimized)
   */
  private async fetchMultiplePricesWithFallback(symbols: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    // Try CoinGecko first (batch request)
    try {
      logger.log(`📡 [PriceService] Trying CoinGecko batch for: ${symbols.join(', ')}`);
      const response = await fetch(`${this.primaryApiUrl}?symbols=${symbols.join(',')}`, {
        signal: AbortSignal.timeout(10000), // 10 second timeout for batch
      });
      
      if (response.ok) {
        const data = await response.json();
        const now = Date.now();

        symbols.forEach(symbol => {
          if (data[symbol] && data[symbol].price > 0) {
            const price = data[symbol].price;
            const change24h = data[symbol].change24h || 0;
            
            result[symbol] = price;
            this.cache.set(symbol, { 
              price, 
              change24h, 
              source: 'coingecko'
            }, this.cacheDuration);
            
            logger.log(`✅ [PriceService] CoinGecko: ${symbol} = $${price}`);
          }
        });

        // If we got all symbols, return
        if (Object.keys(result).length === symbols.length) {
          return result;
        }
      } else if (response.status === 400) {
        // Some tokens not in CoinGecko, try fallback
        logger.log(`⏭️ [PriceService] Some tokens not in CoinGecko, trying Binance...`);
      }
    } catch (error) {
      logger.warn(`⚠️ [PriceService] CoinGecko batch failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Find symbols that still need prices
    const missingSymbols = symbols.filter(s => !result[s]);
    
    if (missingSymbols.length === 0) {
      return result;
    }

    // Try Binance fallback for missing symbols
    try {
      logger.log(`📡 [PriceService] Trying Binance batch for missing: ${missingSymbols.join(', ')}`);
      const response = await fetch(`${this.fallbackApiUrl}?symbols=${missingSymbols.join(',')}`, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const now = Date.now();

        missingSymbols.forEach(symbol => {
          if (data[symbol] && data[symbol].price > 0) {
            const price = data[symbol].price;
            const change24h = data[symbol].change24h || 0;
            
            result[symbol] = price;
            this.cache.set(symbol, { 
              price, 
              change24h, 
              source: 'binance'
            }, this.cacheDuration);
            
            logger.log(`✅ [PriceService] Binance: ${symbol} = $${price}`);
          }
        });
      }
    } catch (error) {
      logger.warn(`⚠️ [PriceService] Binance batch failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * 🔥 NEW: Get prices by contract addresses (EVM tokens)
   * Uses CoinGecko's token_price endpoint with contract addresses
   * This is WAY more reliable than symbol-based lookup!
   * 
   * Returns: Map<address, { price, change24h }>
   */
  async getPricesByAddresses(
    addresses: string[], 
    chain: string = 'ethereum'
  ): Promise<Map<string, { price: number; change24h: number }>> {
    if (addresses.length === 0) {
      return new Map();
    }

    logger.log(`\n🔍 [PriceService] Fetching prices for ${addresses.length} addresses on ${chain}`);

    const result = new Map<string, { price: number; change24h: number }>();
    const now = Date.now();
    const uncachedAddresses: string[] = [];

    // ✅ STEP 1: Check cache first (TTL handled internally by LRU)
    addresses.forEach(address => {
      const addressLower = address.toLowerCase();
      const cached = this.addressCache.get(addressLower);
      if (cached) {
        result.set(addressLower, { price: cached.price, change24h: cached.change24h });
        logger.log(`💾 [PriceService] Cache hit: ${addressLower.substring(0, 10)}... = $${cached.price}`);
      } else {
        uncachedAddresses.push(addressLower);
      }
    });

    if (uncachedAddresses.length === 0) {
      logger.log(`✅ [PriceService] All ${addresses.length} addresses from cache (0 API calls!)`);
      return result;
    }

    logger.log(`📡 [PriceService] Fetching ${uncachedAddresses.length}/${addresses.length} uncached addresses...`);

    // ✅ STEP 2: Fetch from CoinGecko by address (batch request = efficient!)
    try {
      const response = await fetch(
        `${this.addressApiUrl}?addresses=${uncachedAddresses.join(',')}&chain=${chain}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (response.ok) {
        const data = await response.json();

        uncachedAddresses.forEach(address => {
          if (data[address] && data[address].price > 0) {
            const priceData = {
              price: data[address].price,
              change24h: data[address].change24h || 0,
            };
            
            result.set(address, priceData);
            
            // Update cache with TTL
            this.addressCache.set(address, {
              ...priceData,
              source: 'coingecko-address',
            }, this.cacheDuration);
            
            logger.log(`✅ [PriceService] CoinGecko: ${address.substring(0, 10)}... = $${priceData.price}`);
          }
        });
      } else {
        logger.error(`❌ [PriceService] CoinGecko address API failed: ${response.status}`);
      }
    } catch (error) {
      logger.error('❌ [PriceService] Error fetching prices by address:', error);
    }

    // ✅ STEP 3: FALLBACK - Try DexScreener for addresses without prices (sequential with rate limit)
    const missingAddresses = uncachedAddresses.filter(addr => !result.has(addr));
    
    if (missingAddresses.length > 0) {
      logger.log(`\n🔄 [PriceService] Trying DexScreener fallback for ${missingAddresses.length} missing...`);
      
      // Limit to 5 DexScreener calls to avoid long waits (250ms * 5 = 1.25s max)
      const maxDexScreenerCalls = Math.min(missingAddresses.length, 5);
      
      for (let i = 0; i < maxDexScreenerCalls; i++) {
        const address = missingAddresses[i];
        try {
          const tokenData = await dexScreenerService.getTokenMetadata(address);
          
          if (tokenData && tokenData.priceUsd && tokenData.priceUsd > 0) {
            const priceData = {
              price: tokenData.priceUsd,
              change24h: tokenData.priceChange24h || 0,
            };
            
            result.set(address, priceData);
            
            // Update cache with TTL
            this.addressCache.set(address, {
              ...priceData,
              source: 'dexscreener',
            }, this.cacheDuration);
            
            logger.log(`✅ [PriceService] DexScreener: ${address.substring(0, 10)}... = $${priceData.price}`);
          }
          
          // Rate limit: 250ms between requests (respects DexScreener 300/min limit)
          if (i < maxDexScreenerCalls - 1) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        } catch (error) {
          logger.warn(`⚠️ [PriceService] DexScreener failed for ${address.substring(0, 10)}...:`, error);
        }
      }
      
      if (missingAddresses.length > maxDexScreenerCalls) {
        logger.log(`ℹ️ [PriceService] Skipped ${missingAddresses.length - maxDexScreenerCalls} DexScreener lookups (performance optimization)`);
      }
    }

    // ✅ STEP 4: Fill in any remaining addresses with stale cache or 0
    uncachedAddresses.forEach(address => {
      if (!result.has(address)) {
        const cached = this.addressCache.get(address);
        if (cached) {
          logger.warn(`⚠️ [PriceService] Using stale cache for ${address.substring(0, 10)}...: $${cached.price}`);
          result.set(address, { price: cached.price, change24h: cached.change24h });
        } else {
          // No price available anywhere
          result.set(address, { price: 0, change24h: 0 });
        }
      }
    });

    logger.log(`✅ [PriceService] Final: ${result.size}/${addresses.length} addresses processed`);
    return result;
  }

  /**
   * Get cache stats (for debugging)
   */
  getCacheStats() {
    return {
      symbolCache: this.cache.size,
      addressCache: this.addressCache.size,
      mintCache: this.mintCache.size,
      cacheStats: this.cache.getStats(), // ✅ LRU cache stats
      entries: Array.from(this.cache.entries()).map(([symbol, entry]) => ({
        symbol,
        price: entry.value.price,
        source: entry.value.source,
        age: Math.round((Date.now() - entry.timestamp) / 1000) + 's',
      })),
    };
  }

  /**
   * Clear cache (for manual refresh / force update)
   */
  clearCache() {
    logger.log('🗑️ [PriceService] Clearing all caches (manual refresh)');
    this.cache.clear();
    this.mintCache.clear();
    this.addressCache.clear(); // ✅ NEW: Also clear address cache
  }
}

// Export singleton instance
export const priceService = new PriceService();
