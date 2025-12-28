import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// ✅ DEBUG: Always log for price debugging
const DEBUG = true;
const apiLog = (...args: any[]) => {
  if (DEBUG) console.log('[API/prices]', ...args);
};
const apiWarn = (...args: any[]) => {
  if (DEBUG) console.warn('[API/prices]', ...args);
};

// Server-side price fetching (avoids CORS issues)
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols')?.split(',') || [];

  apiLog(`\n========== PRICE API REQUEST ==========`);
  apiLog(`Requested symbols: ${symbols.join(', ')}`);

  if (symbols.length === 0) {
    apiWarn('No symbols provided');
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
  }

  try {
    // Symbol to CoinGecko ID mapping
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

    // Map symbols to CoinGecko IDs
    const symbolMapping: Record<string, string | null> = {};
    symbols.forEach(s => {
      const id = symbolToId[s.toUpperCase()];
      symbolMapping[s] = id || null;
      if (!id) {
        apiWarn(`Symbol ${s} has NO CoinGecko mapping!`);
      }
    });
    
    apiLog(`Symbol to CoinGecko ID mapping:`, symbolMapping);
    
    const coinIds = symbols
      .map(s => symbolToId[s.toUpperCase()])
      .filter(Boolean);

    apiLog(`Valid CoinGecko IDs: ${coinIds.join(', ')}`);
    apiLog(`Unmapped symbols: ${symbols.filter(s => !symbolToId[s.toUpperCase()]).join(', ') || 'NONE'}`);

    if (coinIds.length === 0) {
      // Return empty result instead of 400 error - frontend will fallback to DexScreener
      apiWarn(`ALL symbols unknown! Returning empty result for DexScreener fallback`);
      const emptyResult: Record<string, { price: number; change24h: number }> = {};
      symbols.forEach(symbol => {
        emptyResult[symbol] = { price: 0, change24h: 0 };
      });
      return NextResponse.json(emptyResult);
    }

    // Fetch from CoinGecko (server-side, no CORS issues!)
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const apiKeyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true${apiKeyParam}`;
    
    apiLog(`Fetching from CoinGecko...`);
    apiLog(`URL: ${url.replace(apiKey || '', 'API_KEY_HIDDEN')}`);
    apiLog(`API Key present: ${apiKey ? 'YES' : 'NO'}`);
    
    if (!apiKey) {
      apiWarn('No CoinGecko API key - using free tier (rate limited to 10-50 calls/min)');
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // ✅ Cache for 60 seconds (1 minute) for fresh change24h data
    });

    apiLog(`CoinGecko response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 401) {
        apiWarn('CoinGecko 401 Unauthorized - API key may be invalid or missing');
        // Return empty result to trigger fallback to Binance/DexScreener
        const emptyResult: Record<string, { price: number; change24h: number }> = {};
        symbols.forEach(symbol => {
          emptyResult[symbol] = { price: 0, change24h: 0 };
        });
        return NextResponse.json(emptyResult);
      }
      if (response.status === 429) {
        apiWarn('CoinGecko rate limit hit (429)');
        const emptyResult: Record<string, { price: number; change24h: number }> = {};
        symbols.forEach(symbol => {
          emptyResult[symbol] = { price: 0, change24h: 0 };
        });
        return NextResponse.json(emptyResult);
      }
      apiWarn(`CoinGecko error: ${response.status}`);
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    apiLog(`CoinGecko raw response:`, JSON.stringify(data, null, 2));

    // Convert back to symbol-keyed format that PriceService expects
    const result: Record<string, { price: number; change24h: number }> = {};
    
    apiLog(`\nMapping CoinGecko response to symbols:`);
    symbols.forEach(symbol => {
      const coinId = symbolToId[symbol.toUpperCase()];
      if (coinId && data[coinId]) {
        result[symbol] = {
          price: data[coinId].usd || 0,
          change24h: data[coinId].usd_24h_change || 0,
        };
        apiLog(`  ✅ ${symbol} (${coinId}): $${result[symbol].price}, 24h: ${result[symbol].change24h >= 0 ? '+' : ''}${result[symbol].change24h?.toFixed(2)}%`);
      } else {
        // Include all symbols in result, even if not found (for consistency)
        result[symbol] = { price: 0, change24h: 0 };
        if (coinId) {
          apiWarn(`  ❌ ${symbol} (${coinId}): NO DATA in CoinGecko response`);
        } else {
          apiWarn(`  ❌ ${symbol}: NO COINGECKO MAPPING - will fallback to Binance/DexScreener`);
        }
      }
    });

    const foundCount = Object.values(result).filter(r => r.price > 0).length;
    const duration = Date.now() - startTime;
    apiLog(`\n========== PRICE API RESPONSE ==========`);
    apiLog(`Found: ${foundCount}/${symbols.length} prices`);
    apiLog(`Duration: ${duration}ms`);
    apiLog(`========================================\n`);

    // ✅ Return flat format: { "SOL": { price: 202.5, change24h: 0.2 } }
    return NextResponse.json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    apiWarn(`\n========== PRICE API ERROR ==========`);
    apiWarn(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    apiWarn(`Duration: ${duration}ms`);
    apiWarn(`=====================================\n`);
    logger.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}




