/**
 * 🚀 CoinGecko Coins List Cache
 * 
 * Server-side singleton cache for CoinGecko's complete coins list
 * - Fetches 10,000+ coins with platform/address info on first request
 * - Caches for 24 hours in memory (server-side only)
 * - Enables auto-discovery of ANY token on CoinGecko
 * - Saves 99%+ API calls vs search-based lookup
 * 
 * Memory: ~2.5MB for 10,000+ coins (negligible for Node.js server)
 * Performance: < 1ms lookups after initialization
 */

import { logger } from '@/lib/logger';

interface CoinGeckoEntry {
  id: string;           // CoinGecko ID: 'dogwifcoin'
  symbol: string;       // Token symbol: 'wif'
  name: string;         // Full name: 'dogwifhat'
  platforms: Record<string, string>; // { solana: 'EKp...xyz', ethereum: '0x...' }
}

// ✅ Module-level singleton (server-side only - persists between requests)
let coinsCache: Map<string, CoinGeckoEntry[]> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Build multi-key index for fast lookups
 * Keys: "symbol:platform", "symbol:*"
 */
function buildIndex(coins: CoinGeckoEntry[]): Map<string, CoinGeckoEntry[]> {
  const index = new Map<string, CoinGeckoEntry[]>();
  
  logger.log(`🏗️ [CoinGecko Cache] Building index for ${coins.length} coins...`);
  
  for (const coin of coins) {
    const symbolLower = coin.symbol.toLowerCase();
    
    // Index by symbol + specific platform (e.g., "wif:solana")
    for (const platform of Object.keys(coin.platforms || {})) {
      const key = `${symbolLower}:${platform}`;
      const existing = index.get(key) || [];
      existing.push(coin);
      index.set(key, existing);
    }
    
    // Index by symbol only (fallback for any platform: "wif:*")
    const anyKey = `${symbolLower}:*`;
    const existingAny = index.get(anyKey) || [];
    existingAny.push(coin);
    index.set(anyKey, existingAny);
  }
  
  logger.log(`✅ [CoinGecko Cache] Index built: ${index.size} keys`);
  return index;
}

/**
 * Ensure cache is initialized and fresh
 * Lazy-loads on first request
 */
async function ensureCacheInitialized(): Promise<void> {
  const now = Date.now();
  
  // Check if cache exists and is fresh
  if (coinsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return; // Cache is fresh, no action needed
  }
  
  logger.log('🔄 [CoinGecko Cache] Initializing cache (this may take 1-2 seconds)...');
  
  try {
    // Determine API endpoint (Pro vs Free tier)
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const url = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true'
      : 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
      
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['x-cg-pro-api-key'] = apiKey;
    }
    
    logger.log(`📡 [CoinGecko Cache] Fetching from ${apiKey ? 'Pro API' : 'Free API'}...`);
    
    const response = await fetch(url, {
      headers,
      next: { revalidate: CACHE_TTL / 1000 }, // Next.js cache for 24h
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        logger.warn('⚠️ [CoinGecko Cache] Rate limit hit - using stale cache if available');
        // Keep using stale cache instead of failing
        if (coinsCache) {
          logger.log('ℹ️ [CoinGecko Cache] Using stale cache (better than nothing)');
          return;
        }
      }
      
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const coins: CoinGeckoEntry[] = await response.json();
    
    if (!Array.isArray(coins) || coins.length === 0) {
      throw new Error('Invalid response from CoinGecko: expected array of coins');
    }
    
    // Build optimized index
    coinsCache = buildIndex(coins);
    cacheTimestamp = now;
    
    logger.log(`✅ [CoinGecko Cache] Initialized successfully: ${coins.length} coins`);
    logger.log(`   Memory usage: ~${Math.round(coins.length * 0.25)}KB`);
    logger.log(`   Cache TTL: 24 hours`);
    
  } catch (error) {
    logger.error('❌ [CoinGecko Cache] Failed to initialize:', error);
    
    // Clear cache on error (will fallback to hardcoded mapping)
    coinsCache = null;
    cacheTimestamp = 0;
    
    throw error; // Propagate error to caller
  }
}

/**
 * Find CoinGecko ID for a token symbol
 * 
 * @param symbol - Token symbol (e.g., "TRUMP", "WIF")
 * @param platform - Platform to search (e.g., "solana", "ethereum") - optional
 * @returns CoinGecko ID or null if not found
 */
export async function findCoinId(
  symbol: string, 
  platform?: string
): Promise<string | null> {
  try {
    await ensureCacheInitialized();
  } catch (error) {
    // Cache init failed - return null to fallback to hardcoded mapping
    logger.warn(`⚠️ [CoinGecko Cache] Lookup failed for ${symbol}: cache not initialized`);
    return null;
  }
  
  if (!coinsCache) {
    logger.warn(`⚠️ [CoinGecko Cache] Cache is null for ${symbol}`);
    return null;
  }
  
  const symbolLower = symbol.toLowerCase();
  
  // Strategy 1: Try exact platform match first (most accurate)
  if (platform) {
    const key = `${symbolLower}:${platform}`;
    const matches = coinsCache.get(key);
    
    if (matches && matches.length > 0) {
      const coinId = matches[0].id;
      logger.log(`✅ [CoinGecko Cache] Found ${symbol} on ${platform}: ${coinId}`);
      
      // Warn if multiple matches (ambiguous)
      if (matches.length > 1) {
        logger.warn(`⚠️ [CoinGecko Cache] Multiple matches for ${symbol} on ${platform}, using first: ${coinId}`);
      }
      
      return coinId;
    }
  }
  
  // Strategy 2: Fallback to any platform
  const anyKey = `${symbolLower}:*`;
  const matches = coinsCache.get(anyKey);
  
  if (matches && matches.length > 0) {
    const coinId = matches[0].id;
    logger.log(`✅ [CoinGecko Cache] Found ${symbol} (any platform): ${coinId}`);
    
    // Warn if multiple matches (ambiguous)
    if (matches.length > 1) {
      const platforms = matches.map(m => Object.keys(m.platforms).join(',')).join(', ');
      logger.warn(`⚠️ [CoinGecko Cache] Multiple matches for ${symbol} across platforms [${platforms}], using first: ${coinId}`);
    }
    
    return coinId;
  }
  
  // Not found in cache
  logger.log(`ℹ️ [CoinGecko Cache] ${symbol} not found in cache (will try other sources)`);
  return null;
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  return {
    initialized: coinsCache !== null,
    size: coinsCache?.size || 0,
    ageMinutes: coinsCache ? Math.round((Date.now() - cacheTimestamp) / 60000) : 0,
    ttlHours: CACHE_TTL / 3600000,
  };
}

/**
 * Manually clear cache (for testing/debugging)
 */
export function clearCache() {
  logger.log('🗑️ [CoinGecko Cache] Manually clearing cache');
  coinsCache = null;
  cacheTimestamp = 0;
}

