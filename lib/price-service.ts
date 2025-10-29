// Live crypto price service with multi-API fallback system
export class PriceService {
  private cache: Map<string, { price: number; change24h: number; timestamp: number; source: string }> = new Map();
  private cacheDuration = 10000; // ✅ 10 seconds cache (ultra-fresh, max 10s old)
  private primaryApiUrl = '/api/prices'; // CoinGecko (primary)
  private fallbackApiUrl = '/api/prices-binance'; // Binance (fallback)

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
      
      // ✅ Check if response is OK OR if it's a 400 (no Binance ticker available)
      if (response.ok) {
        const data = await response.json();
        
        // ✅ Handle empty response (no valid Binance ticker for this symbol)
        if (Object.keys(data).length === 0) {
          console.log(`ℹ️ [PriceService] Binance has no ticker for: ${symbol}`);
        } else if (data[symbol] && data[symbol].price > 0) {
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
      } else if (response.status === 400) {
        // ✅ 400 Bad Request is OK - means no valid symbol for Binance
        console.log(`ℹ️ [PriceService] Binance doesn't support: ${symbol}`);
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
      
      // ✅ Check if response is OK OR if it returns an empty object (graceful failure)
      if (response.ok) {
        const data = await response.json();
        const now = Date.now();

        // ✅ Handle empty response (no valid Binance tickers for these symbols)
        if (Object.keys(data).length === 0) {
          console.log(`ℹ️ [PriceService] Binance has no tickers for: ${missingSymbols.join(', ')}`);
        } else {
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
      } else if (response.status === 400) {
        // ✅ 400 Bad Request is OK - means no valid symbols for Binance
        console.log(`ℹ️ [PriceService] Binance doesn't support: ${missingSymbols.join(', ')}`);
      }
    } catch (error) {
      console.warn(`⚠️ [PriceService] Binance batch failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Get cache stats (for debugging)
   */
  getCacheStats() {
    return {
      size: this.cache.size,
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
    console.log('🗑️ [PriceService] Clearing cache (manual refresh)');
    this.cache.clear();
  }
}

// Export singleton instance
export const priceService = new PriceService();
