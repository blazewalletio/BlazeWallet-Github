import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { findCoinId } from '@/lib/coingecko-coins-cache';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Server-side price fetching (avoids CORS issues)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols')?.split(',') || [];

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
  }

  try {
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
    logger.log(`📡 [Prices] Looking up CoinGecko IDs for: ${symbols.join(', ')}`);
    
    const coinIdMappings = await Promise.all(
      symbols.map(async (symbol) => {
        // Try hardcoded mapping first (fast path - no cache lookup needed)
        const hardcodedId = symbolToId[symbol.toUpperCase()];
        if (hardcodedId) {
          logger.log(`✅ [Prices] ${symbol} → ${hardcodedId} (hardcoded)`);
          return { symbol, id: hardcodedId };
        }
        
        // Fallback: Cache lookup for auto-discovery (prioritize Solana for SPL tokens)
        try {
          const cacheId = await findCoinId(symbol, 'solana');
          if (cacheId) {
            logger.log(`✅ [Prices] ${symbol} → ${cacheId} (cache - solana)`);
            return { symbol, id: cacheId };
          }
          
          // Try any platform if Solana didn't work
          const anyId = await findCoinId(symbol);
          if (anyId) {
            logger.log(`✅ [Prices] ${symbol} → ${anyId} (cache - any platform)`);
            return { symbol, id: anyId };
          }
        } catch (error) {
          logger.warn(`⚠️ [Prices] Cache lookup failed for ${symbol}:`, error);
        }
        
        // Not found anywhere
        logger.log(`ℹ️ [Prices] ${symbol} not found in mapping or cache`);
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

    // Fetch from CoinGecko (server-side, no CORS issues!)
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const apiKeyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true${apiKeyParam}`;
    
    logger.log(`📡 [Prices] Fetching from CoinGecko for ${coinIds.length} coins (API key: ${apiKey ? 'Yes' : 'No'})`);
    if (!apiKey) {
      logger.warn('⚠️ [Prices] No CoinGecko API key - using free tier (rate limited to 10-50 calls/min)');
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // ✅ Cache for 60 seconds (1 minute) for fresh change24h data
    });

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn('⚠️ [Prices] CoinGecko 401 Unauthorized - API key may be invalid or missing. Using free tier.');
        // Return empty result to trigger fallback to Binance/DexScreener
        const emptyResult: Record<string, { price: number; change24h: number }> = {};
        symbols.forEach(symbol => {
          emptyResult[symbol] = { price: 0, change24h: 0 };
        });
        return NextResponse.json(emptyResult);
      }
      if (response.status === 429) {
        logger.warn('⚠️ [Prices] CoinGecko rate limit hit - returning empty result for fallback');
        const emptyResult: Record<string, { price: number; change24h: number }> = {};
        symbols.forEach(symbol => {
          emptyResult[symbol] = { price: 0, change24h: 0 };
        });
        return NextResponse.json(emptyResult);
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert back to symbol-keyed format that PriceService expects
    const result: Record<string, { price: number; change24h: number }> = {};
    
    // Map CoinGecko response back to original symbols
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
        logger.log(`✅ [Prices] ${mapping.symbol} = $${result[mapping.symbol].price} (${mapping.id})`);
      } else {
        // CoinGecko returned no data for this ID
        result[mapping.symbol] = { price: 0, change24h: 0 };
        logger.warn(`⚠️ [Prices] CoinGecko returned no data for ${mapping.symbol} (${mapping.id}) - will fallback to Binance`);
      }
    }

    // ✅ Return flat format: { "SOL": { price: 202.5, change24h: 0.2 } }
    return NextResponse.json(result);

  } catch (error) {
    logger.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}




