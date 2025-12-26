/**
 * 💰 PRICE HISTORY CACHE SERVICE
 * 
 * Slim caching systeem voor price history data
 * - Voorkomt onnodige API calls
 * - Altijd actuele data wanneer nodig
 * - Timeframe-specifieke refresh intervals
 * 
 * Strategie (zoals Bitvavo/Coinbase):
 * - LIVE: 1-2 seconden refresh (WebSocket simulatie via polling)
 * - 1D: 1 minuut refresh
 * - 7D: 5 minuten refresh
 * - 30D: 10 minuten refresh
 * - 1J/ALLES: 30 minuten refresh
 */

import { logger } from './logger';

export interface PriceHistoryCacheEntry {
  prices: Array<{ timestamp: number; price: number }>;
  timestamp: number;
  coinGeckoId?: string;
  source: string;
}

interface CacheKey {
  symbol: string;
  contractAddress?: string;
  chain?: string;
  days: number;
}

class PriceHistoryCache {
  private cache = new Map<string, PriceHistoryCacheEntry>();
  
  // ✅ Timeframe-specifieke cache durations (in milliseconds)
  private readonly CACHE_DURATIONS = {
    LIVE: 2000,      // 2 seconden voor live data
    '1D': 60000,     // 1 minuut voor 1D
    '7D': 5 * 60000, // 5 minuten voor 7D
    '30D': 10 * 60000, // 10 minuten voor 30D
    '1J': 30 * 60000, // 30 minuten voor 1J
    'ALLES': 30 * 60000, // 30 minuten voor ALLES
  };

  /**
   * Generate cache key
   */
  private getCacheKey(key: CacheKey): string {
    const parts = [
      key.symbol.toUpperCase(),
      key.contractAddress || 'native',
      key.chain || 'unknown',
      key.days.toString(),
    ];
    return parts.join('|');
  }

  /**
   * Get cache duration for timeframe
   */
  private getCacheDuration(days: number): number {
    if (days <= 1) return this.CACHE_DURATIONS['1D'];
    if (days <= 7) return this.CACHE_DURATIONS['7D'];
    if (days <= 30) return this.CACHE_DURATIONS['30D'];
    return this.CACHE_DURATIONS['1J'];
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: PriceHistoryCacheEntry, days: number): boolean {
    const age = Date.now() - entry.timestamp;
    const maxAge = this.getCacheDuration(days);
    return age < maxAge;
  }

  /**
   * Get cached price history
   * Returns null if not cached or stale
   */
  get(
    symbol: string,
    days: number,
    contractAddress?: string,
    chain?: string
  ): PriceHistoryCacheEntry | null {
    const key = this.getCacheKey({ symbol, contractAddress, chain, days });
    const entry = this.cache.get(key);

    if (!entry) {
      logger.log(`📊 [PriceHistoryCache] Cache miss for ${symbol} (${days}d)`);
      return null;
    }

    if (!this.isCacheValid(entry, days)) {
      logger.log(`📊 [PriceHistoryCache] Cache expired for ${symbol} (${days}d, age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
      this.cache.delete(key);
      return null;
    }

    const age = Math.round((Date.now() - entry.timestamp) / 1000);
    logger.log(`✅ [PriceHistoryCache] Cache hit for ${symbol} (${days}d, age: ${age}s)`);
    return entry;
  }

  /**
   * Set cached price history
   */
  set(
    symbol: string,
    days: number,
    prices: Array<{ timestamp: number; price: number }>,
    coinGeckoId?: string,
    contractAddress?: string,
    chain?: string,
    source: string = 'CoinGecko'
  ): void {
    const key = this.getCacheKey({ symbol, contractAddress, chain, days });
    const entry: PriceHistoryCacheEntry = {
      prices,
      timestamp: Date.now(),
      coinGeckoId,
      source,
    };
    
    this.cache.set(key, entry);
    logger.log(`💾 [PriceHistoryCache] Cached ${symbol} (${days}d, ${prices.length} points)`);
  }

  /**
   * Check if data needs refresh (for background updates)
   */
  needsRefresh(
    symbol: string,
    days: number,
    contractAddress?: string,
    chain?: string
  ): boolean {
    const entry = this.get(symbol, days, contractAddress, chain);
    if (!entry) return true;

    const age = Date.now() - entry.timestamp;
    const maxAge = this.getCacheDuration(days);
    
    // Refresh when 80% of cache duration has passed (stale-while-revalidate)
    return age > (maxAge * 0.8);
  }

  /**
   * Clear cache for specific token
   */
  clear(symbol: string, days?: number, contractAddress?: string, chain?: string): void {
    if (days !== undefined) {
      const key = this.getCacheKey({ symbol, contractAddress, chain, days });
      this.cache.delete(key);
      logger.log(`🗑️ [PriceHistoryCache] Cleared cache for ${symbol} (${days}d)`);
    } else {
      // Clear all entries for this symbol
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(`${symbol.toUpperCase()}|`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.log(`🗑️ [PriceHistoryCache] Cleared all cache for ${symbol}`);
    }
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
    logger.log(`🗑️ [PriceHistoryCache] Cleared all cache`);
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const entries: Array<{ key: string; age: number }> = [];
    this.cache.forEach((entry, key) => {
      entries.push({
        key,
        age: Date.now() - entry.timestamp,
      });
    });
    return {
      size: this.cache.size,
      entries,
    };
  }
}

// Singleton instance
export const priceHistoryCache = new PriceHistoryCache();

