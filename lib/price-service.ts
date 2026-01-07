// Live crypto price service with multi-API fallback system
import { dexScreenerService } from './dexscreener-service';
import { LRUCache } from './lru-cache'; // ✅ PERFORMANCE: LRU cache for better memory management
import { logger } from '@/lib/logger';

export class PriceService {
  // ✅ PERFORMANCE FIX: Use LRU cache instead of Map for automatic eviction
  private cache = new LRUCache<{ price: number; change24h: number; source: string }>(200); // Symbol cache
  private mintCache = new LRUCache<{ price: number; change24h: number; source: string }>(100); // Solana mint cache
  private addressCache = new LRUCache<{ price: number; change24h: number; source: string }>(100); // EVM address cache
  private cacheDuration = 0; // 🔥 NO CLIENT-SIDE CACHE - ALWAYS FRESH DATA (user requirement)
  private change24hCacheDuration = 0; // 🔥 NO CACHE - always fetch fresh 24h change
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
   * Get multiple prices AND 24h changes in batch (optimized)
   * ✅ CRITICAL FIX: Returns both price AND change24h in one call
   * This eliminates the need for separate get24hChange() calls!
   */
  async getMultiplePrices(symbols: string[]): Promise<Record<string, { price: number; change24h: number }>> {
    logger.log(`🔍 [PriceService] Fetching multiple prices + change24h for: ${symbols.join(', ')}`);

    // Check which symbols are in LRU cache
    const uncachedSymbols: string[] = [];
    const result: Record<string, { price: number; change24h: number }> = {};

    symbols.forEach(symbol => {
      const cached = this.cache.get(symbol);
      if (cached) {
        result[symbol] = { price: cached.price, change24h: cached.change24h };
      } else {
        uncachedSymbols.push(symbol);
      }
    });

    logger.log(`💾 [PriceService] Cache hits: ${symbols.length - uncachedSymbols.length}/${symbols.length}`);

    // If all cached, return immediately
    if (uncachedSymbols.length === 0) {
      return result;
    }

    // Fetch uncached prices + change24h with fallback
    const fetchedData = await this.fetchMultiplePricesWithFallback(uncachedSymbols);
    
    // Merge with cached results
    Object.keys(fetchedData).forEach(symbol => {
      result[symbol] = fetchedData[symbol];
    });

    return result;
  }

  /**
   * 🔥 NEW: Get native token price DIRECTLY from Binance API
   * This bypasses the broken /api/prices route but USES THE SAME CACHE as other tokens!
   * So cache clearing works consistently for ALL tokens (native + ERC-20/SPL)
   */
  async getNativePriceDirectFromBinance(symbol: string): Promise<{ price: number; change24h: number }> {
    // ✅ Check cache first (respects clearCache() calls!)
    const cached = this.cache.get(symbol);
    if (cached) {
      logger.log(`💰 [PriceService] Cache hit for native ${symbol}: $${cached.price} (${cached.source})`);
      return { price: cached.price, change24h: cached.change24h };
    }

    // Binance symbol mapping
    const binanceSymbolMap: Record<string, string> = {
      'SOL': 'SOLUSDT',
      'ETH': 'ETHUSDT',
      'BTC': 'BTCUSDT',
      'BNB': 'BNBUSDT',
      'MATIC': 'MATICUSDT',
      'AVAX': 'AVAXUSDT',
      'FTM': 'FTMUSDT',
      'LTC': 'LTCUSDT',
      'DOGE': 'DOGEUSDT',
      'BCH': 'BCHUSDT',
      'ARB': 'ARBUSDT',
      'OP': 'OPUSDT',
    };

    const binanceSymbol = binanceSymbolMap[symbol];
    
    if (!binanceSymbol) {
      logger.warn(`⚠️ [PriceService] ${symbol} not on Binance, falling back to CoinGecko`);
      // Fallback to regular method for chains not on Binance (e.g., CRO)
      return this.getMultiplePrices([symbol]).then(result => result[symbol] || { price: 0, change24h: 0 });
    }

    try {
      logger.log(`📡 [PriceService] Fetching ${symbol} DIRECT from Binance (${binanceSymbol})`);
      const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
      const binanceResponse = await fetch(binanceUrl, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (binanceResponse.ok) {
        const binanceData = await binanceResponse.json();
        const price = parseFloat(binanceData.lastPrice);
        const change24h = parseFloat(binanceData.priceChangePercent);
        
        // ✅ CRITICAL: Store in cache (respects clearCache()!)
        this.cache.set(symbol, {
          price,
          change24h,
          source: 'binance-direct',
        }, this.cacheDuration);
        
        logger.log(`✅ [PriceService] Binance ${symbol}: $${price} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)`);
        return { price, change24h };
      } else {
        throw new Error(`Binance returned ${binanceResponse.status}`);
      }
    } catch (error) {
      logger.warn(`⚠️ [PriceService] Binance failed for ${symbol}, trying CoinGecko fallback`);
      // Fallback to CoinGecko
      const cgPrices = await this.getMultiplePrices([symbol]);
      return cgPrices[symbol] || { price: 0, change24h: 0 };
    }
  }

  /**
   * Get 24h change with fallback
   * ✅ NOTE: This is now mainly used as fallback - prefer getMultiplePrices() for batch fetching!
   * For single symbol, use cached value if available, otherwise fetch fresh
   */
  async get24hChange(symbol: string, forceRefresh: boolean = false): Promise<number> {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.cache.get(symbol);
      if (cached) {
        return cached.change24h;
      }
    }

    // Fetch fresh data (will update cache)
    try {
      const response = await fetch(`${this.primaryApiUrl}?symbols=${symbol}`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data[symbol] && data[symbol].change24h !== undefined) {
          const change24h = data[symbol].change24h || 0;
          const price = data[symbol].price || 0;
          
          // Update cache
          this.cache.set(symbol, {
            price: price,
            change24h: change24h,
            source: 'coingecko',
          }, this.cacheDuration);
          
          return change24h;
        }
      }
    } catch (error) {
      // If fetch fails, try cached value
      const cached = this.cache.get(symbol);
      if (cached) {
        return cached.change24h;
      }
    }

    // Final fallback: fetch full price data (includes change24h)
    await this.getPrice(symbol);
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
    console.log(`\n🔎 DexScreener lookup voor mint: ${mint}`);

    try {
      console.log(`   📡 Calling DexScreener API...`);
      // Try DexScreener (best for DEX-traded tokens)
      const dexToken = await dexScreenerService.getTokenMetadata(mint);
      
      console.log(`   📦 Response ontvangen:`, {
        hasData: !!dexToken,
        priceUsd: dexToken?.priceUsd,
        priceChange24h: dexToken?.priceChange24h,
        symbol: dexToken?.symbol,
        name: dexToken?.name,
      });
      
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
        console.log(`   ✅ Prijs gevonden: $${price}`);
        console.log(`   📈 24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`);
        return { price, change24h };
      } else {
        console.log(`   ❌ Geen valide prijs gevonden (priceUsd: ${dexToken?.priceUsd || 'undefined'})`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`⚠️ [PriceService] DexScreener failed for ${mint.substring(0, 8)}...:`, errorMsg);
      console.log(`   ⚠️ DexScreener API error: ${errorMsg}`);
    }

    // If API fails, return 0 (LRU cache would have returned cached value if fresh)
    logger.error(`❌ [PriceService] Failed to get price by mint for ${mint.substring(0, 8)}...`);
    console.log(`   ❌ Geen prijs beschikbaar voor deze mint`);
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
        // ✅ Silent 400 - expected for unknown tokens (meme coins, new tokens)
        // Will fallback to Binance and then DexScreener
      }
    } catch (error) {
      // ✅ Don't log network/timeout errors - they're expected
      if (!(error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch')))) {
        logger.warn(`⚠️ [PriceService] CoinGecko failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Try Binance fallback
    try {
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
        // ✅ Silent 400 - token not in Binance either, will use DexScreener
      }
    } catch (error) {
      // ✅ Don't log network/timeout errors - they're expected
      if (!(error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch')))) {
        logger.warn(`⚠️ [PriceService] Binance failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Silent fail for getPrice() - DexScreener will be used as final fallback for tokens with addresses
    // For native tokens (MATIC, ETH, etc), if both CoinGecko and Binance fail, we return 0
    // This is expected behavior - the price will be fetched on next refresh or from cache
    const knownTokens = ['ETH', 'BTC', 'SOL', 'MATIC', 'BNB', 'USDT', 'USDC'];
    if (knownTokens.includes(symbol.toUpperCase())) {
      logger.warn(`⚠️ [PriceService] CoinGecko and Binance both failed for ${symbol} - price will be 0 until next refresh. Check API keys and rate limits.`);
    }
    return 0;
  }

  /**
   * Private: Fetch multiple prices + change24h with fallback (batch optimized)
   * ✅ CRITICAL FIX: Returns both price AND change24h in one call
   * CoinGecko API already returns both, so we use it directly!
   */
  private async fetchMultiplePricesWithFallback(symbols: string[]): Promise<Record<string, { price: number; change24h: number }>> {
    const result: Record<string, { price: number; change24h: number }> = {};

    // ✅ STEP 1: Try CoinGecko first (batch request - returns price + change24h!)
    try {
      logger.log(`📡 [PriceService] Trying CoinGecko batch for: ${symbols.join(', ')}`);
      // 🔥 CACHE BUSTING: Add timestamp to force Vercel to fetch fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`${this.primaryApiUrl}?symbols=${symbols.join(',')}&_t=${cacheBuster}`, {
        signal: AbortSignal.timeout(10000), // 10 second timeout for batch
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 🔍 DEBUG: Log RAW response from CoinGecko
        logger.log(`📦 [PriceService] RAW CoinGecko batch response:`, JSON.stringify(data, null, 2));

        symbols.forEach(symbol => {
          if (data[symbol] && data[symbol].price > 0) {
            const price = data[symbol].price;
            const change24h = data[symbol].change24h || 0;
            
            // 🔍 DEBUG: Log transformation
            logger.log(`🔍 [PriceService] Processing ${symbol}:`);
            logger.log(`   RAW: price=${data[symbol].price}, change24h=${data[symbol].change24h}`);
            logger.log(`   TRANSFORMED: price=$${price}, change24h=${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`);
            
            // ✅ Store both price AND change24h
            result[symbol] = { price, change24h };
            this.cache.set(symbol, { 
              price, 
              change24h, 
              source: 'coingecko'
            }, this.cacheDuration);
            
            logger.log(`✅ [PriceService] CACHED for ${this.cacheDuration/1000}s: ${symbol} = $${price}, change24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`);
          } else {
            // ⚠️ DON'T add to result yet - let fallbacks try first!
            logger.log(`⚠️ [PriceService] ${symbol}: NOT FOUND in CoinGecko (price: ${data[symbol]?.price || 0})`);
          }
        });
      } else if (response.status === 400) {
        // 400 is expected for unknown tokens - don't log as error
        logger.log(`⏭️ [PriceService] Some tokens not in CoinGecko (${response.status}), trying Binance...`);
      }
    } catch (error) {
      // Don't log fetch errors as warnings - they're expected for unknown tokens
      logger.log(`⏭️ [PriceService] CoinGecko batch fallthrough, trying Binance...`);
    }

    // ✅ STEP 2: Find symbols that still need prices (not found in CoinGecko)
    const missingSymbols = symbols.filter(s => !result[s] || result[s].price === 0);
    
    if (missingSymbols.length === 0) {
      logger.log(`✅ [PriceService] All ${symbols.length} symbols found via CoinGecko`);
      return result;
    }
    
    logger.log(`🔍 [PriceService] ${missingSymbols.length}/${symbols.length} symbols still missing, trying Binance fallback...`);

    // ✅ STEP 3: Try Binance fallback for missing symbols
    try {
      logger.log(`📡 [PriceService] Trying Binance batch for missing: ${missingSymbols.join(', ')}`);
      const response = await fetch(`${this.fallbackApiUrl}?symbols=${missingSymbols.join(',')}`, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        const data = await response.json();

        missingSymbols.forEach(symbol => {
          if (data[symbol] && data[symbol].price > 0) {
            const price = data[symbol].price;
            const change24h = data[symbol].change24h || 0;
            
            // ✅ Store both price AND change24h
            result[symbol] = { price, change24h };
            this.cache.set(symbol, { 
              price, 
              change24h, 
              source: 'binance'
            }, this.cacheDuration);
            
            logger.log(`✅ [PriceService] Binance: ${symbol} = $${price}, change24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`);
          } else {
            // ⚠️ Still not found - will try DexScreener fallback if mint/address available
            logger.log(`⚠️ [PriceService] ${symbol}: NOT FOUND in Binance either (price: ${data[symbol]?.price || 0})`);
          }
        });
      } else if (response.status === 400) {
        // 400 is expected for unknown tokens - don't log as error
        logger.log(`⏭️ [PriceService] Symbols not found in Binance either (${response.status}), will use DexScreener fallback`);
      }
    } catch (error) {
      // Don't log as warning - expected for unknown tokens
      logger.log(`⏭️ [PriceService] Binance batch fallthrough, will use DexScreener fallback`);
    }

    // ✅ STEP 4: Log final summary
    const foundSymbols = symbols.filter(s => result[s] && result[s].price > 0);
    const notFoundSymbols = symbols.filter(s => !result[s] || result[s].price === 0);
    
    logger.log(`\n📊 [PriceService] FINAL BATCH RESULT:`);
    logger.log(`   ✅ Found: ${foundSymbols.length}/${symbols.length} (${foundSymbols.join(', ') || 'none'})`);
    logger.log(`   ❌ Not Found: ${notFoundSymbols.length}/${symbols.length} (${notFoundSymbols.join(', ') || 'none'})`);
    logger.log(`   ℹ️  Not found tokens will use DexScreener fallback if mint/address available\n`);

    // ✅ Ensure all symbols are in result (even if 0) - required for consistency
    symbols.forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = { price: 0, change24h: 0 };
      }
    });

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

    console.log(`\n💰 [PriceService] Fetching prices by address...`);
    console.log(`   Chain: ${chain}`);
    console.log(`   Total addresses: ${addresses.length}`);
    logger.log(`\n🔍 [PriceService] Fetching prices for ${addresses.length} addresses on ${chain}`);

    const result = new Map<string, { price: number; change24h: number }>();
    const now = Date.now();
    const uncachedAddresses: string[] = [];

    // ✅ STEP 1: Check cache first (TTL handled internally by LRU)
    console.log(`\n📡 STEP 1: Checking cache...`);
    addresses.forEach(address => {
      const addressLower = address.toLowerCase();
      const cached = this.addressCache.get(addressLower);
      if (cached) {
        result.set(addressLower, { price: cached.price, change24h: cached.change24h });
        console.log(`   ✅ CACHE HIT: ${addressLower.substring(0, 10)}... = $${cached.price.toFixed(6)}`);
        logger.log(`💾 [PriceService] 🔴 CACHE HIT: ${addressLower.substring(0, 10)}... = $${cached.price.toFixed(6)}, change24h: ${cached.change24h.toFixed(2)}%`);
        logger.log(`   ⚠️ Using CACHED data - this may be up to 60 seconds old!`);
      } else {
        uncachedAddresses.push(addressLower);
        console.log(`   ❌ CACHE MISS: ${addressLower.substring(0, 10)}...`);
      }
    });

    if (uncachedAddresses.length === 0) {
      console.log(`✅ All addresses from cache (0 API calls!)`);
      logger.log(`✅ [PriceService] All ${addresses.length} addresses from cache (0 API calls!)`);
      return result;
    }

    console.log(`\n📡 STEP 2: Fetching ${uncachedAddresses.length} uncached addresses from API...`);
    logger.log(`📡 [PriceService] Fetching ${uncachedAddresses.length}/${addresses.length} uncached addresses...`);

    // ✅ STEP 2: Fetch from CoinGecko by address (batch request = efficient!)
    try {
      // 🔥 CACHE BUSTING: Add timestamp to force Vercel to fetch fresh data
      const cacheBuster = Date.now();
      const apiUrl = `${this.addressApiUrl}?addresses=${uncachedAddresses.join(',')}&chain=${chain}&_t=${cacheBuster}`;
      console.log(`   API URL: ${apiUrl.substring(0, 100)}...`);
      
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });

      console.log(`   Response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Response received, processing ${Object.keys(data).length} price entries...`);

        uncachedAddresses.forEach((address, idx) => {
          console.log(`\n   [${idx + 1}/${uncachedAddresses.length}] Processing ${address.substring(0, 10)}...`);

          // CoinGecko API route returns: { "0x...": { price: 5.42, change24h: -2.5 } }
          // (transformed from CoinGecko's { "0x...": { usd: 5.42, usd_24h_change: -2.5 } })
          const priceValue = data[address]?.price || data[address]?.usd || 0;
          console.log(`      Raw data:`, data[address]);
          console.log(`      Price value: ${priceValue}`);
          
          if (data[address] && priceValue > 0) {
            let price = priceValue;
            
            // 🛡️ SANITY CHECK: Detect abnormally high prices (>$10k per token)
            if (price > 10000) {
              console.log(`      ⚠️ SUSPICIOUS HIGH PRICE: $${price.toFixed(2)}`);
              console.log(`      → Setting to 0 (will try DexScreener)`);
              logger.warn(`⚠️ [PriceService] SUSPICIOUS HIGH PRICE detected for ${address.substring(0, 10)}...: $${price.toFixed(2)}`);
              price = 0;
            }
            
            // Get change24h from either format
            const change24h = data[address].change24h || data[address].usd_24h_change || 0;
            console.log(`      24h Change: ${change24h}%`);
            
            const priceData = {
              price,
              change24h,
            };
            
            // Only cache and use if price is valid (not 0 after sanity check)
            if (price > 0) {
              result.set(address, priceData);
              console.log(`      ✅ Price set: $${price.toFixed(6)}, change24h: ${change24h.toFixed(2)}%`);
              
              // Update cache with TTL
              this.addressCache.set(address, {
                ...priceData,
                source: 'coingecko-address',
              }, this.cacheDuration);
              
              logger.log(`✅ [PriceService] CoinGecko: ${address.substring(0, 10)}... = $${priceData.price.toFixed(6)}`);
            } else {
              console.log(`      ⚠️ Invalid price, skipping (will try DexScreener)`);
              logger.log(`⚠️ [PriceService] Skipping invalid price for ${address.substring(0, 10)}... (will try DexScreener)`);
            }
          } else {
            console.log(`      ❌ No price data in response`);
          }
        });
      } else {
        console.error(`   ❌ API failed: ${response.status} ${response.statusText}`);
        logger.error(`❌ [PriceService] CoinGecko address API failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`   ❌ Fetch error:`, error);
      logger.error('❌ [PriceService] Error fetching prices by address:', error);
    }

    // ✅ STEP 3: FALLBACK - Try DexScreener for addresses without prices OR with price === 0
    // This includes addresses that CoinGecko returned but with price: 0
    const missingAddresses = uncachedAddresses.filter(addr => {
      const existing = result.get(addr);
      return !existing || existing.price === 0;
    });
    
    if (missingAddresses.length > 0) {
      console.log(`\n📡 STEP 3: Trying DexScreener fallback for ${missingAddresses.length} addresses...`);
      logger.log(`\n🔄 [PriceService] Trying DexScreener fallback for ${missingAddresses.length} missing...`);
      
      // Limit to 10 DexScreener calls to avoid long waits (250ms * 10 = 2.5s max)
      const maxDexScreenerCalls = Math.min(missingAddresses.length, 10);
      
      for (let i = 0; i < maxDexScreenerCalls; i++) {
        const address = missingAddresses[i];
        console.log(`   [${i + 1}/${maxDexScreenerCalls}] Trying DexScreener for ${address.substring(0, 10)}...`);
        try {
          const tokenData = await dexScreenerService.getTokenMetadata(address);
          
          if (tokenData && tokenData.priceUsd && tokenData.priceUsd > 0) {
            let price = tokenData.priceUsd;
            console.log(`      ✅ DexScreener found price: $${price.toFixed(6)}`);
            
            // 🛡️ SANITY CHECK: Also check DexScreener prices for abnormalities
            if (price > 10000) {
              console.log(`      ⚠️ SUSPICIOUS HIGH PRICE, setting to 0`);
              logger.warn(`⚠️ [PriceService] SUSPICIOUS HIGH PRICE from DexScreener for ${address.substring(0, 10)}...: $${price.toFixed(2)}`);
              price = 0;
            }
            
            const priceData = {
              price,
              change24h: tokenData.priceChange24h || 0,
            };
            
            // Only set if price is valid after sanity check
            if (price > 0) {
              result.set(address, priceData);
              console.log(`      ✅ Price set: $${price.toFixed(6)}, change24h: ${priceData.change24h.toFixed(2)}%`);
              
              // Update cache with TTL
              this.addressCache.set(address, {
                ...priceData,
                source: 'dexscreener',
              }, this.cacheDuration);
              
              logger.log(`✅ [PriceService] DexScreener: ${address.substring(0, 10)}... = $${priceData.price}`);
            } else {
              console.log(`      ⚠️ Invalid price, skipping`);
              logger.log(`⚠️ [PriceService] Skipping invalid DexScreener price for ${address.substring(0, 10)}...`);
            }
          } else {
            console.log(`      ❌ No price data from DexScreener`);
          }
          
          // Rate limit: 250ms between requests (respects DexScreener 300/min limit)
          if (i < maxDexScreenerCalls - 1) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        } catch (error) {
          console.error(`      ❌ DexScreener error:`, error);
          logger.warn(`⚠️ [PriceService] DexScreener failed for ${address.substring(0, 10)}...:`, error);
        }
      }
      
      console.log(`\n✅ STEP 3 COMPLETE: DexScreener fallback finished`);
      
      if (missingAddresses.length > maxDexScreenerCalls) {
        logger.log(`ℹ️ [PriceService] Skipped ${missingAddresses.length - maxDexScreenerCalls} DexScreener lookups (performance optimization)`);
      }
    }

    // ✅ STEP 4: Try symbol-based fallback for known tokens without prices
    // This helps with tokens like PENDLE that might not be found by contract address
    const stillMissing = uncachedAddresses.filter(addr => {
      const existing = result.get(addr);
      return !existing || existing.price === 0;
    });
    
    if (stillMissing.length > 0) {
      console.log(`\n📡 STEP 4: Trying symbol-based fallback for ${stillMissing.length} addresses...`);
      
      // Map known contract addresses to symbols for fallback lookup
      const addressToSymbol: Record<string, string> = {
        '0x808507121b80c02388fad14726482e061b8da827': 'PENDLE', // Pendle Finance
      };
      
      for (const address of stillMissing) {
        const symbol = addressToSymbol[address];
        if (symbol) {
          console.log(`   Trying symbol lookup for ${symbol} (${address.substring(0, 10)}...)...`);
          try {
            const symbolPrices = await this.getMultiplePrices([symbol]);
            if (symbolPrices[symbol] && symbolPrices[symbol].price > 0) {
              const priceData = symbolPrices[symbol];
              result.set(address, priceData);
              console.log(`   ✅ Found via symbol: $${priceData.price.toFixed(6)}`);
              logger.log(`✅ [PriceService] Symbol fallback: ${symbol} = $${priceData.price}`);
            } else {
              console.log(`   ❌ No price found via symbol`);
            }
          } catch (error) {
            console.error(`   ❌ Symbol lookup error:`, error);
          }
        }
      }
    }

    // ✅ STEP 5: Fill in any remaining addresses with stale cache or 0
    // BUT: Apply sanity check to stale cache too!
    uncachedAddresses.forEach(address => {
      if (!result.has(address)) {
        const cached = this.addressCache.get(address);
        if (cached) {
          // 🛡️ SANITY CHECK: Don't use stale cache if price is abnormally high
          if (cached.price > 100000) {
            logger.warn(`⚠️ [PriceService] Stale cache has suspicious high price for ${address.substring(0, 10)}...: $${cached.price.toFixed(2)}`);
            logger.warn(`   Clearing stale cache and setting price to 0`);
            // Clear the bad cache entry
            this.addressCache.delete(address);
            result.set(address, { price: 0, change24h: 0 });
          } else {
            logger.warn(`⚠️ [PriceService] Using stale cache for ${address.substring(0, 10)}...: $${cached.price.toFixed(6)}`);
            result.set(address, { price: cached.price, change24h: cached.change24h });
          }
        } else {
          // No price available anywhere
          result.set(address, { price: 0, change24h: 0 });
        }
      }
    });

    console.log(`\n✅ [PriceService] Price fetching complete`);
    console.log(`   Total addresses processed: ${result.size}/${addresses.length}`);
    console.log(`\n💰 FINAL PRICE MAP:`);
    Array.from(result.entries()).forEach(([addr, data]) => {
      console.log(`   ${addr.substring(0, 10)}...: $${data.price.toFixed(6)} (${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%)`);
    });
    console.log(`\n`);

    logger.log(`✅ [PriceService] Final: ${result.size}/${addresses.length} addresses processed`);
    return result;
  }

  /**
   * Clear cache for specific address(es)
   * Useful for fixing incorrect cached prices
   */
  clearAddressCache(addresses: string | string[]): void {
    const addressesArray = Array.isArray(addresses) ? addresses : [addresses];
    addressesArray.forEach(address => {
      const addressLower = address.toLowerCase();
      this.addressCache.delete(addressLower);
      logger.log(`🗑️ [PriceService] Cleared cache for ${addressLower.substring(0, 10)}...`);
    });
  }

  /**
   * Clear all caches (useful for debugging or fixing widespread issues)
   */
  clearAllCaches(): void {
    this.cache.clear();
    this.mintCache.clear();
    this.addressCache.clear();
    logger.log(`🗑️ [PriceService] Cleared all caches`);
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
