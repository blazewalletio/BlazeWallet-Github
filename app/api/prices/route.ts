import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { findCoinId } from '@/lib/coingecko-coins-cache';

// ⚡ CACHING DISABLED: We use client-side cache + Binance fallback for reliability
// Vercel edge caching was causing stale $0 responses to be served after fixes
export const revalidate = 0; // No server-side caching
export const dynamic = 'force-dynamic';

// 💾 In-memory cache for price data (survives across requests in same instance)
const priceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

// Server-side price fetching (avoids CORS issues)
export async function GET(request: Request) {
  let symbols: string[] = [];
  
  try {
    const { searchParams } = new URL(request.url);
    symbols = searchParams.get('symbols')?.split(',') || [];

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
    }
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      logger.log(`═══════════════════════════════════════════════════════════════`);
      logger.log(`🔍 [Prices API] REQUEST START`);
      logger.log(`   Symbols requested: ${symbols.join(', ')}`);
      logger.log(`═══════════════════════════════════════════════════════════════`);
    }
    
    // ✅ Check in-memory cache first (prevents rate limiting)
    const cacheKey = symbols.sort().join(',');
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (isDev) logger.log(`✅ [Prices] CACHE HIT for ${cacheKey}`);
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }
    
    // ✅ FAST PATH: Hardcoded mapping for popular tokens (instant lookup)
    // This avoids cache lookup for common tokens like ETH, BTC, SOL, etc.
    const symbolToId: Record<string, string> = {
      // Native tokens
      ETH: 'ethereum',
      SOL: 'solana',
      BTC: 'bitcoin',
      MATIC: 'matic-network', // CoinGecko still uses 'matic-network' for MATIC token
      POLYGON: 'polygon', // Polygon network native token (alternative name)
      BNB: 'binancecoin',
      TBNB: 'binancecoin', // Testnet BNB uses same price as mainnet BNB
      ARB: 'arbitrum',
      BASE: 'base',
      // New EVM chains (Fase 1)
      OP: 'optimism',
      AVAX: 'avalanche-2',
      FTM: 'fantom',
      CRO: 'crypto-com-chain',
      // Bitcoin forks (Fase 2)
      LTC: 'litecoin',
      DOGE: 'dogecoin',
      BCH: 'bitcoin-cash',
      // zkSync and Linea use ETH, no separate token
      // Stablecoins (work on all chains including Solana)
      USDT: 'tether',
      USDC: 'usd-coin',
      BUSD: 'binance-usd',
      // Other popular tokens
      WBTC: 'wrapped-bitcoin',
      LINK: 'chainlink',
      PENDLE: 'pendle',
      // Solana SPL Tokens
      RAY: 'raydium',
      BONK: 'bonk',
      JUP: 'jupiter-exchange-solana',
      WIF: 'dogwifcoin',
      JTO: 'jito-governance-token',
      PYTH: 'pyth-network',
      ORCA: 'orca',
      MNGO: 'mango-markets',
    };

    // ✅ HYBRID APPROACH: Hardcoded first (fast), then cache lookup (auto-discovery)
    if (isDev) logger.log(`📡 [Prices] Looking up CoinGecko IDs for: ${symbols.join(', ')}`);
    
    const coinIdMappings = await Promise.all(
      symbols.map(async (symbol) => {
        // Try hardcoded mapping first (fast path - no cache lookup needed)
        const hardcodedId = symbolToId[symbol.toUpperCase()];
        if (hardcodedId) {
          if (isDev) logger.log(`✅ [Prices] ${symbol} → ${hardcodedId} (hardcoded)`);
          return { symbol, id: hardcodedId };
        }
        
        // Fallback: Cache lookup for auto-discovery (prioritize Solana for SPL tokens)
        try {
          const cacheId = await findCoinId(symbol, 'solana');
          if (cacheId) {
            if (isDev) logger.log(`✅ [Prices] ${symbol} → ${cacheId} (cache - solana)`);
            return { symbol, id: cacheId };
          }
          
          // Try any platform if Solana didn't work
          const anyId = await findCoinId(symbol);
          if (anyId) {
            if (isDev) logger.log(`✅ [Prices] ${symbol} → ${anyId} (cache - any platform)`);
            return { symbol, id: anyId };
          }
        } catch (error) {
          logger.warn(`⚠️ [Prices] Cache lookup failed for ${symbol}:`, error);
        }
        
        // Not found anywhere
        if (isDev) logger.log(`ℹ️ [Prices] ${symbol} not found in mapping or cache`);
        return { symbol, id: null };
      })
    );

    const coinIds = coinIdMappings
      .filter(m => m.id !== null)
      .map(m => m.id as string);
    
    // Track which symbols were not found
    const notFoundSymbols = coinIdMappings
      .filter(m => m.id === null)
      .map(m => m.symbol);

    if (coinIds.length === 0) {
      // Return empty result instead of 400 error - frontend will fallback to DexScreener
      logger.log(`[PriceAPI] All symbols unknown: ${symbols.join(', ')} - returning empty result for DexScreener fallback`);
      const emptyResult: Record<string, { price: number; change24h: number }> = {};
      symbols.forEach(symbol => {
        emptyResult[symbol] = { price: 0, change24h: 0 };
      });
      return NextResponse.json(emptyResult);
    }
    
    // Log partial matches
    if (notFoundSymbols.length > 0) {
      logger.log(`ℹ️ [PriceAPI] Symbols not found (will use DexScreener fallback): ${notFoundSymbols.join(', ')}`);
    }

    // ⚡ TRY 1: CoinGecko (primary source with 24h change data)
    let data: any = null;
    let coinGeckoFailed = false;

    try {
      const apiKey = process.env.COINGECKO_API_KEY?.trim();
      
      // ✅ FIXED: Use pro-api.coingecko.com for Pro API keys
      const baseUrl = apiKey ? 'https://pro-api.coingecko.com' : 'https://api.coingecko.com';
      const url = `${baseUrl}/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
      
      logger.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      logger.log(`║  🔍 [API/prices] CoinGecko Pro Request - START              ║`);
      logger.log(`╚══════════════════════════════════════════════════════════════╝`);
      logger.log(`📡 Fetching from CoinGecko Pro for ${coinIds.length} coins`);
      logger.log(`🌐 Base URL: ${baseUrl} ${apiKey ? '(Pro API)' : '(Free API)'}`);
      logger.log(`🔑 API key present: ${apiKey ? 'YES' : 'NO'}`);
      logger.log(`🔑 API key length: ${apiKey ? apiKey.length : 0}`);
      logger.log(`🔑 API key first 10 chars: ${apiKey ? apiKey.substring(0, 10) + '...' : 'N/A'}`);
      logger.log(`🌐 URL: ${url.substring(0, 150)}...`);
      
      if (!apiKey) {
        logger.warn('⚠️ NO COINGECKO_API_KEY FOUND! Using free tier (rate limited to 10-50 calls/min)');
      }
      
      // ✅ CRITICAL FIX: Pro API keys must be sent as HEADER, not query parameter!
      // Pro API: Header 'x-cg-pro-api-key'
      // Demo API: Query param 'x_cg_demo_api_key'
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (apiKey) {
        headers['x-cg-pro-api-key'] = apiKey;
        logger.log(`🔐 Sending API key as header: x-cg-pro-api-key`);
      }
      
      const response = await fetch(url, {
        headers,
        next: { revalidate: 60 }, // Cache for 60 seconds
        signal: AbortSignal.timeout(8000), // 8 second timeout (Vercel has 10s limit)
      });

      logger.log(`\n📊 CoinGecko Pro response:`);
      logger.log(`   Status: ${response.status} ${response.statusText}`);
      logger.log(`   OK: ${response.ok}`);
      logger.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        logger.error(`❌ CoinGecko Pro error: ${response.status}`);
        
        // ⚠️ CRITICAL: Log response body for 400 errors
        let errorBody = '';
        try {
          errorBody = await response.text();
          logger.error(`   Response body: ${errorBody}`);
        } catch (e) {
          logger.error(`   Could not read response body`);
        }
        
        if (response.status === 401) {
          logger.error('   → 401 Unauthorized: API key is invalid or missing');
          logger.error(`   → API KEY CHECK: ${apiKey ? `Present (${apiKey.length} chars)` : 'MISSING!'}`);
        } else if (response.status === 429) {
          logger.error('   → 429 Rate Limit: Too many requests');
        } else if (response.status === 404) {
          logger.error('   → 404 Not Found: Coin IDs may be incorrect');
          logger.error(`   → Requested coin IDs: ${coinIds.join(', ')}`);
        } else if (response.status === 400) {
          logger.error('   → 400 Bad Request: Request parameters are invalid');
          logger.error(`   → Requested coin IDs: ${coinIds.join(', ')}`);
          logger.error(`   → API KEY: ${apiKey ? 'Present' : 'MISSING'}`);
          logger.error(`   → Full URL: ${url}`);
        }
        coinGeckoFailed = true;
      } else {
        data = await response.json();
        logger.log(`\n📦 CoinGecko Pro data received:`);
        logger.log(`   Type: ${typeof data}`);
        logger.log(`   Keys: ${Object.keys(data).join(', ')}`);
        logger.log(`   Full response:`, JSON.stringify(data, null, 2));
      }
    } catch (error: any) {
      logger.error(`\n❌ CoinGecko Pro fetch error:`);
      logger.error(`   Error type: ${error.name}`);
      logger.error(`   Error message: ${error.message}`);
      logger.error(`   Full error:`, error);
      if (error.name === 'AbortError') {
        logger.error('   → Timeout (8s) exceeded');
      }
      coinGeckoFailed = true;
    }

    logger.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    logger.log(`║  🔍 [API/prices] CoinGecko Pro Request - END                ║`);
    logger.log(`╚══════════════════════════════════════════════════════════════╝\n`);

    // If CoinGecko Pro failed completely, return empty result (will trigger DexScreener fallback on client)
    if (!data || Object.keys(data).length === 0) {
      logger.warn('⚠️ [Prices] CoinGecko Pro failed - returning empty result for DexScreener fallback');
      const emptyResult: Record<string, { price: number; change24h: number }> = {};
      symbols.forEach(symbol => {
        emptyResult[symbol] = { price: 0, change24h: 0 };
      });
      return NextResponse.json(emptyResult);
    }
    
    if (isDev) logger.log(`📦 [Prices API] Processing data for ${Object.keys(data).length} coins...`);

    // Convert back to symbol-keyed format that PriceService expects
    const result: Record<string, { price: number; change24h: number }> = {};
    
    // Map CoinGecko Pro response back to original symbols
    for (const mapping of coinIdMappings) {
      if (!mapping.id) {
        // Symbol not found - return 0 (will trigger DexScreener fallback)
        result[mapping.symbol] = { price: 0, change24h: 0 };
        continue;
      }
      
      const coinData = data[mapping.id];
      if (coinData && coinData.usd) {
        result[mapping.symbol] = {
          price: coinData.usd || 0,
          change24h: coinData.usd_24h_change || 0,
        };
        if (isDev) logger.log(`✅ [Prices] ${mapping.symbol} = $${result[mapping.symbol].price} (${mapping.id})`);
      } else {
        // No data for this ID
        result[mapping.symbol] = { price: 0, change24h: 0 };
        logger.warn(`⚠️ [Prices] No data for ${mapping.symbol} (${mapping.id}) - will fallback`);
      }
    }

    // ✅ Store in in-memory cache
    priceCache.set(cacheKey, { data: result, timestamp: Date.now() });

    if (isDev) {
      logger.log(`═══════════════════════════════════════════════════════════════`);
      logger.log(`✅ [Prices API] SUCCESS - Returning ${Object.keys(result).length} prices`);
      logger.log(`   Result:`, JSON.stringify(result, null, 2));
      logger.log(`═══════════════════════════════════════════════════════════════`);
    }
    
    // ✅ Return flat format: { "SOL": { price: 202.5, change24h: 0.2 } }
    return NextResponse.json(result, {
      headers: {
        // ✅ Cache for 60 seconds on CDN edge
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });

  } catch (error: any) {
    logger.error(`═══════════════════════════════════════════════════════════════`);
    logger.error(`❌ [Prices API] UNEXPECTED ERROR`);
    logger.error(`   Message: ${error.message}`);
    logger.error(`   Name: ${error.name}`);
    logger.error(`═══════════════════════════════════════════════════════════════`);
    
    // ⚠️ GRACEFUL DEGRADATION: Return empty result instead of 500 error
    // This allows client-side DexScreener fallback to work
    const emptyResult: Record<string, { price: number; change24h: number }> = {};
    symbols.forEach(symbol => {
      emptyResult[symbol] = { price: 0, change24h: 0 };
    });
    
    return NextResponse.json(emptyResult, {
      headers: {
        // Don't cache errors
        'Cache-Control': 'no-store',
      },
    });
  }
}




