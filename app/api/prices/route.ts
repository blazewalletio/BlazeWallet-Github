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
      const apiKeyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true${apiKeyParam}`;
      
      if (isDev) {
        logger.log(`📡 [Prices] Fetching from CoinGecko for ${coinIds.length} coins (API key: ${apiKey ? 'Yes' : 'No'})`);
        if (!apiKey) {
          logger.warn('⚠️ [Prices] No CoinGecko API key - using free tier (rate limited to 10-50 calls/min)');
        }
        logger.log(`🌐 [Prices API] CoinGecko URL: ${url.substring(0, 150)}...`);
      }
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }, // Cache for 60 seconds
        signal: AbortSignal.timeout(8000), // 8 second timeout (Vercel has 10s limit)
      });

      if (isDev) logger.log(`📊 [Prices API] CoinGecko response status: ${response.status}`);

      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('⚠️ [Prices] CoinGecko 401 Unauthorized - will try Binance fallback');
        } else if (response.status === 429) {
          logger.warn('⚠️ [Prices] CoinGecko rate limit hit - will try Binance fallback');
        } else {
          logger.warn(`⚠️ [Prices] CoinGecko error ${response.status} - will try Binance fallback`);
        }
        coinGeckoFailed = true;
      } else {
        data = await response.json();
        if (isDev) logger.log(`📦 [Prices API] CoinGecko data keys: ${Object.keys(data).join(', ')}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn('⚠️ [Prices] CoinGecko timeout (8s) - will try Binance fallback');
      } else {
        logger.warn(`⚠️ [Prices] CoinGecko fetch error: ${error.message} - will try Binance fallback`);
      }
      coinGeckoFailed = true;
    }

    // ⚡ TRY 2: Binance fallback for major tokens (SOL, BTC, ETH, BNB, MATIC)
    // Use Binance if:
    // 1. CoinGecko completely failed (coinGeckoFailed = true)
    // 2. CoinGecko returned 0 for any requested native token
    
    // 🔍 DEBUG: Log current state before Binance fallback decision
    logger.log(`\n🔍 [Prices] BINANCE FALLBACK CHECK:`);
    logger.log(`   coinGeckoFailed: ${coinGeckoFailed}`);
    logger.log(`   data exists: ${!!data}`);
    logger.log(`   data keys: ${data ? Object.keys(data).join(', ') : 'N/A'}`);
    
    symbols.forEach(symbol => {
      const coinId = symbolToId[symbol.toUpperCase()];
      if (coinId && data) {
        const price = data[coinId]?.usd || 0;
        logger.log(`   ${symbol} (${coinId}): price = $${price}, has zero price: ${price === 0}`);
      }
    });
    
    const needsBinanceFallback = coinGeckoFailed || !data || 
      symbols.some(symbol => {
        const coinId = symbolToId[symbol.toUpperCase()];
        if (!coinId) return false; // Not a major token, skip
        const price = data[coinId]?.usd || 0;
        return price === 0; // Need fallback if price is 0
      });
    
    logger.log(`   🎯 DECISION: needsBinanceFallback = ${needsBinanceFallback}\n`);
    
    if (needsBinanceFallback) {
      logger.log(`🔄 [Prices] Trying Binance fallback for major tokens...`);
      
      // ✅ COMPREHENSIVE: All native tokens supported by Binance
      // Note: CRO (Cronos) is NOT on Binance - will rely on CoinGecko for that
      const binanceSymbols: Record<string, string> = {
        // Layer 1 Blockchains
        'SOL': 'SOLUSDT',        // Solana
        'BTC': 'BTCUSDT',        // Bitcoin
        'ETH': 'ETHUSDT',        // Ethereum (also used by Arbitrum, Base, Optimism, zkSync, Linea)
        'BNB': 'BNBUSDT',        // BNB Smart Chain
        'tBNB': 'BNBUSDT',       // BSC Testnet (same price as mainnet)
        'MATIC': 'MATICUSDT',    // Polygon
        'AVAX': 'AVAXUSDT',      // Avalanche
        'FTM': 'FTMUSDT',        // Fantom
        
        // Bitcoin Forks
        'LTC': 'LTCUSDT',        // Litecoin
        'DOGE': 'DOGEUSDT',      // Dogecoin
        'BCH': 'BCHUSDT',        // Bitcoin Cash
        
        // Layer 2s (use ETH price)
        'ARB': 'ARBUSDT',        // Arbitrum (has its own token)
        'OP': 'OPUSDT',          // Optimism (has its own token)
      };

      if (!data) data = {}; // Initialize if CoinGecko completely failed
      
      for (const [symbol, binanceSymbol] of Object.entries(binanceSymbols)) {
        if (!symbols.includes(symbol)) continue;
        
        // Check if we already have a valid price from CoinGecko
        const coinId = symbolToId[symbol];
        if (coinId && data[coinId]?.usd && data[coinId].usd > 0) {
          logger.log(`✅ [Prices] ${symbol} already has valid CoinGecko price: $${data[coinId].usd}`);
          continue; // Skip Binance if we have a valid price
        }
        
        try {
          const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
          const binanceResponse = await fetch(binanceUrl, {
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          if (binanceResponse.ok) {
            const binanceData = await binanceResponse.json();
            if (coinId) {
              data[coinId] = {
                usd: parseFloat(binanceData.lastPrice),
                usd_24h_change: parseFloat(binanceData.priceChangePercent),
              };
              logger.log(`✅ [Prices] ${symbol} from Binance: $${data[coinId].usd} (${data[coinId].usd_24h_change >= 0 ? '+' : ''}${data[coinId].usd_24h_change.toFixed(2)}%)`);
            }
          }
        } catch (binanceError: any) {
          logger.warn(`⚠️ [Prices] Binance fallback failed for ${symbol}:`, binanceError.message);
        }
      }
    }

    // If both failed, return empty result (will trigger DexScreener fallback on client)
    if (!data || Object.keys(data).length === 0) {
      logger.warn('⚠️ [Prices] Both CoinGecko and Binance failed - returning empty result');
      const emptyResult: Record<string, { price: number; change24h: number }> = {};
      symbols.forEach(symbol => {
        emptyResult[symbol] = { price: 0, change24h: 0 };
      });
      return NextResponse.json(emptyResult);
    }
    
    if (isDev) logger.log(`📦 [Prices API] Processing data for ${Object.keys(data).length} coins...`);

    // Convert back to symbol-keyed format that PriceService expects
    const result: Record<string, { price: number; change24h: number }> = {};
    
    // Map CoinGecko/Binance response back to original symbols
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




