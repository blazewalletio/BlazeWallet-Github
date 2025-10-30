// Live crypto price service with multi-API fallback system
import { dexScreenerService } from './dexscreener-service';

export class PriceService {
  private cache: Map<string, { price: number; change24h: number; timestamp: number; source: string }> = new Map();
  private mintCache: Map<string, { price: number; change24h: number; timestamp: number; source: string }> = new Map(); // ✅ Cache by mint address (Solana)
  private addressCache: Map<string, { price: number; change24h: number; timestamp: number; source: string }> = new Map(); // ✅ NEW: Cache by contract address (EVM)
  private cacheDuration = 600000; // ✅ 10 minutes cache (efficient for token prices)
  private primaryApiUrl = '/api/prices'; // CoinGecko (primary)
  private fallbackApiUrl = '/api/prices-binance'; // Binance (fallback)
  private addressApiUrl = '/api/prices-by-address'; // CoinGecko by address (NEW!)

  /**
   * Get single price with fallback system
   */
  async getPrice(symbol: string): Promise<number> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`💰 [PriceService] Cache hit for ${symbol}: $${cached.price} (${cached.source})`);
      return cached.price;
    }

    console.log(`🔍 [PriceService] Fetching price for ${symbol}...`);

    // Try primary API (CoinGecko)
    const price = await this.fetchPriceWithFallback(symbol);
    
    if (price > 0) {
      return price;
    }

    // If all APIs fail, return cached price if available
    if (cached) {
      console.warn(`⚠️ [PriceService] All APIs failed, using stale cache for ${symbol}: $${cached.price}`);
      return cached.price;
    }

    console.error(`❌ [PriceService] Failed to get price for ${symbol}, returning 0`);
    return 0;
  }

  /**
   * Get multiple prices in batch (optimized)
   */
  async getMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
    console.log(`🔍 [PriceService] Fetching multiple prices for: ${symbols.join(', ')}`);

    // Check which symbols are cached
    const now = Date.now();
    const cachedSymbols: string[] = [];
    const uncachedSymbols: string[] = [];
    const result: Record<string, number> = {};

    symbols.forEach(symbol => {
      const cached = this.cache.get(symbol);
      if (cached && now - cached.timestamp < this.cacheDuration) {
        cachedSymbols.push(symbol);
        result[symbol] = cached.price;
      } else {
        uncachedSymbols.push(symbol);
      }
    });

    console.log(`💾 [PriceService] Cache hits: ${cachedSymbols.length}/${symbols.length}`);

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

    // Fill in any remaining symbols with cached values (even stale)
    uncachedSymbols.forEach(symbol => {
      if (!result[symbol]) {
        const cached = this.cache.get(symbol);
        if (cached) {
          console.warn(`⚠️ [PriceService] Using stale cache for ${symbol}: $${cached.price}`);
          result[symbol] = cached.price;
        }
      }
    });

    return result;
  }

  /**
   * Get 24h change with fallback
   */
  async get24hChange(symbol: string): Promise<number> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
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
    // Check mint cache first
    const cached = this.mintCache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`💰 [PriceService] Mint cache hit for ${mint.substring(0, 8)}...: $${cached.price} (${cached.source})`);
      return { price: cached.price, change24h: cached.change24h };
    }

    console.log(`🔍 [PriceService] Fetching price by mint for ${mint.substring(0, 8)}...`);

    try {
      // Try DexScreener (best for DEX-traded tokens)
      const dexToken = await dexScreenerService.getTokenMetadata(mint);
      
      if (dexToken && dexToken.priceUsd && dexToken.priceUsd > 0) {
        const price = dexToken.priceUsd;
        const change24h = dexToken.priceChange24h || 0;
        
        // Update mint cache
        this.mintCache.set(mint, {
          price,
          change24h,
          timestamp: Date.now(),
          source: 'dexscreener',
        });
        
        console.log(`✅ [PriceService] DexScreener: ${mint.substring(0, 8)}... = $${price}`);
        return { price, change24h };
      }
    } catch (error) {
      console.warn(`⚠️ [PriceService] DexScreener failed for ${mint.substring(0, 8)}...:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // If DexScreener fails, return cached if available
    if (cached) {
      console.warn(`⚠️ [PriceService] Using stale mint cache for ${mint.substring(0, 8)}...: $${cached.price}`);
      return { price: cached.price, change24h: cached.change24h };
    }

    console.error(`❌ [PriceService] Failed to get price by mint for ${mint.substring(0, 8)}...`);
    return { price: 0, change24h: 0 };
  }

  /**
   * 🔥 NEW: Get prices for multiple SPL tokens by mint address
   * Optimized batch method with rate limiting for DexScreener
   */
  async getPricesByMints(mints: string[]): Promise<Map<string, { price: number; change24h: number }>> {
    console.log(`🔍 [PriceService] Fetching prices for ${mints.length} mints...`);
    
    const result = new Map<string, { price: number; change24h: number }>();
    const now = Date.now();
    const uncachedMints: string[] = [];

    // Check cache first
    mints.forEach(mint => {
      const cached = this.mintCache.get(mint);
      if (cached && now - cached.timestamp < this.cacheDuration) {
        result.set(mint, { price: cached.price, change24h: cached.change24h });
      } else {
        uncachedMints.push(mint);
      }
    });

    console.log(`💾 [PriceService] Mint cache hits: ${result.size}/${mints.length}`);

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
      console.log(`📡 [PriceService] Trying CoinGecko for ${symbol}...`);
      const response = await fetch(`${this.primaryApiUrl}?symbols=${symbol}`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data[symbol] && data[symbol].price > 0) {
          const price = data[symbol].price;
          const change24h = data[symbol].change24h || 0;
          
          // Update cache
          this.cache.set(symbol, { 
            price, 
            change24h, 
            timestamp: Date.now(),
            source: 'coingecko'
          });
          
          console.log(`✅ [PriceService] CoinGecko: ${symbol} = $${price}`);
          return price;
        }
      }
    } catch (error) {
      console.warn(`⚠️ [PriceService] CoinGecko failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Try Binance fallback
    try {
      console.log(`📡 [PriceService] Trying Binance for ${symbol}...`);
      const response = await fetch(`${this.fallbackApiUrl}?symbols=${symbol}`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data[symbol] && data[symbol].price > 0) {
          const price = data[symbol].price;
          const change24h = data[symbol].change24h || 0;
          
          // Update cache
          this.cache.set(symbol, { 
            price, 
            change24h, 
            timestamp: Date.now(),
            source: 'binance'
          });
          
          console.log(`✅ [PriceService] Binance: ${symbol} = $${price}`);
          return price;
        }
      }
    } catch (error) {
      console.warn(`⚠️ [PriceService] Binance failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    console.error(`❌ [PriceService] All APIs failed for ${symbol}`);
    return 0;
  }

  /**
   * Private: Fetch multiple prices with fallback (batch optimized)
   */
  private async fetchMultiplePricesWithFallback(symbols: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    // Try CoinGecko first (batch request)
    try {
      console.log(`📡 [PriceService] Trying CoinGecko batch for: ${symbols.join(', ')}`);
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
              timestamp: now,
              source: 'coingecko'
            });
            
            console.log(`✅ [PriceService] CoinGecko: ${symbol} = $${price}`);
          }
        });

        // If we got all symbols, return
        if (Object.keys(result).length === symbols.length) {
          return result;
        }
      }
    } catch (error) {
      console.warn(`⚠️ [PriceService] CoinGecko batch failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Find symbols that still need prices
    const missingSymbols = symbols.filter(s => !result[s]);
    
    if (missingSymbols.length === 0) {
      return result;
    }

    // Try Binance fallback for missing symbols
    try {
      console.log(`📡 [PriceService] Trying Binance batch for missing: ${missingSymbols.join(', ')}`);
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
              timestamp: now,
              source: 'binance'
            });
            
            console.log(`✅ [PriceService] Binance: ${symbol} = $${price}`);
          }
        });
      }
    } catch (error) {
      console.warn(`⚠️ [PriceService] Binance batch failed:`, error instanceof Error ? error.message : 'Unknown error');
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

    console.log(`\n🔍 [PriceService] Fetching prices for ${addresses.length} addresses on ${chain}`);

    const result = new Map<string, { price: number; change24h: number }>();
    const now = Date.now();
    const uncachedAddresses: string[] = [];

    // ✅ STEP 1: Check cache first (10 min cache = highly efficient)
    addresses.forEach(address => {
      const addressLower = address.toLowerCase();
      const cached = this.addressCache.get(addressLower);
      if (cached && now - cached.timestamp < this.cacheDuration) {
        result.set(addressLower, { price: cached.price, change24h: cached.change24h });
        console.log(`💾 [PriceService] Cache hit: ${addressLower.substring(0, 10)}... = $${cached.price}`);
      } else {
        uncachedAddresses.push(addressLower);
      }
    });

    if (uncachedAddresses.length === 0) {
      console.log(`✅ [PriceService] All ${addresses.length} addresses from cache (0 API calls!)`);
      return result;
    }

    console.log(`📡 [PriceService] Fetching ${uncachedAddresses.length}/${addresses.length} uncached addresses...`);

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
            
            // Update cache
            this.addressCache.set(address, {
              ...priceData,
              timestamp: now,
              source: 'coingecko-address',
            });
            
            console.log(`✅ [PriceService] CoinGecko: ${address.substring(0, 10)}... = $${priceData.price}`);
          }
        });
      } else {
        console.error(`❌ [PriceService] CoinGecko address API failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [PriceService] Error fetching prices by address:', error);
    }

    // ✅ STEP 3: FALLBACK - Try DexScreener for addresses without prices (sequential with rate limit)
    const missingAddresses = uncachedAddresses.filter(addr => !result.has(addr));
    
    if (missingAddresses.length > 0) {
      console.log(`\n🔄 [PriceService] Trying DexScreener fallback for ${missingAddresses.length} missing...`);
      
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
            
            // Update cache
            this.addressCache.set(address, {
              ...priceData,
              timestamp: now,
              source: 'dexscreener',
            });
            
            console.log(`✅ [PriceService] DexScreener: ${address.substring(0, 10)}... = $${priceData.price}`);
          }
          
          // Rate limit: 250ms between requests (respects DexScreener 300/min limit)
          if (i < maxDexScreenerCalls - 1) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        } catch (error) {
          console.warn(`⚠️ [PriceService] DexScreener failed for ${address.substring(0, 10)}...:`, error);
        }
      }
      
      if (missingAddresses.length > maxDexScreenerCalls) {
        console.log(`ℹ️ [PriceService] Skipped ${missingAddresses.length - maxDexScreenerCalls} DexScreener lookups (performance optimization)`);
      }
    }

    // ✅ STEP 4: Fill in any remaining addresses with stale cache or 0
    uncachedAddresses.forEach(address => {
      if (!result.has(address)) {
        const cached = this.addressCache.get(address);
        if (cached) {
          console.warn(`⚠️ [PriceService] Using stale cache for ${address.substring(0, 10)}...: $${cached.price}`);
          result.set(address, { price: cached.price, change24h: cached.change24h });
        } else {
          // No price available anywhere
          result.set(address, { price: 0, change24h: 0 });
        }
      }
    });

    console.log(`✅ [PriceService] Final: ${result.size}/${addresses.length} addresses processed`);
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
      entries: Array.from(this.cache.entries()).map(([symbol, data]) => ({
        symbol,
        price: data.price,
        source: data.source,
        age: Math.round((Date.now() - data.timestamp) / 1000) + 's',
      })),
    };
  }

  /**
   * Clear cache (for manual refresh / force update)
   */
  clearCache() {
    console.log('🗑️ [PriceService] Clearing all caches (manual refresh)');
    this.cache.clear();
    this.mintCache.clear();
    this.addressCache.clear(); // ✅ NEW: Also clear address cache
  }
}

// Export singleton instance
export const priceService = new PriceService();
