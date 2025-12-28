import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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

    const coinIds = symbols
      .map(s => symbolToId[s.toUpperCase()])
      .filter(Boolean);

    if (coinIds.length === 0) {
      // Return empty result instead of 400 error - frontend will fallback to DexScreener
      logger.log(`[PriceAPI] Unknown symbols: ${symbols.join(', ')} - returning empty result for DexScreener fallback`);
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
    symbols.forEach(symbol => {
      const coinId = symbolToId[symbol.toUpperCase()];
      if (coinId && data[coinId]) {
        result[symbol] = {
          price: data[coinId].usd || 0,
          change24h: data[coinId].usd_24h_change || 0,
        };
        logger.log(`✅ [Prices] ${symbol} = $${result[symbol].price} (${coinId})`);
      } else {
        // Include all symbols in result, even if not found (for consistency)
        result[symbol] = { price: 0, change24h: 0 };
        if (coinId) {
          logger.warn(`⚠️ [Prices] CoinGecko returned no data for ${symbol} (${coinId}) - will fallback to Binance`);
        } else {
          logger.warn(`⚠️ [Prices] Unknown symbol ${symbol} - will fallback to Binance/DexScreener`);
        }
      }
    });

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




