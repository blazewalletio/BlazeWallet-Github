import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * Binance Fallback API
 * Used when CoinGecko fails or rate limits are hit
 * Binance API is free, no key required, and very reliable
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols')?.split(',') || [];

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
  }

  try {
    // Symbol to Binance ticker mapping
    const symbolToTicker: Record<string, string> = {
      // Native tokens
      ETH: 'ETHUSDT',
      SOL: 'SOLUSDT',
      BTC: 'BTCUSDT',
      MATIC: 'MATICUSDT',
      BNB: 'BNBUSDT',
      TBNB: 'BNBUSDT', // Testnet uses mainnet price
      ARB: 'ARBUSDT',
      // New EVM chains (Fase 1)
      OP: 'OPUSDT',
      AVAX: 'AVAXUSDT',
      FTM: 'FTMUSDT',
      CRO: 'CROUSDT',
      // Bitcoin forks (Fase 2)
      LTC: 'LTCUSDT',
      DOGE: 'DOGEUSDT',
      BCH: 'BCHUSDT',
      // zkSync and Linea use ETH, no separate token
      // Stablecoins
      USDT: 'USDCUSDT', // USDT price via USDC pair
      USDC: 'USDCUSDT',
      BUSD: 'BUSDUSDT',
      // Other popular tokens
      WBTC: 'BTCUSDT', // WBTC tracks BTC price
      LINK: 'LINKUSDT',
      // Solana SPL Tokens
      RAY: 'RAYUSDT',
      BONK: 'BONKUSDT',
      JUP: 'JUPUSDT',
      WIF: 'WIFUSDT',
      JTO: 'JTOUSDT',
      PYTH: 'PYTHUSDT',
      ORCA: 'ORCAUSDT',
      // Note: BASE, MNGO may not have Binance tickers, will fallback to CoinGecko
    };

    // Get tickers for all symbols
    const tickers = symbols
      .map(s => symbolToTicker[s.toUpperCase()])
      .filter(Boolean);

    if (tickers.length === 0) {
      // Return empty result instead of 400 error - frontend will fallback to DexScreener
      logger.log(`[BinanceAPI] Unknown symbols: ${symbols.join(', ')} - returning empty result for DexScreener fallback`);
      const emptyResult: Record<string, { price: number; change24h: number }> = {};
      symbols.forEach(symbol => {
        emptyResult[symbol] = { price: 0, change24h: 0 };
      });
      return NextResponse.json(emptyResult);
    }

    // Fetch 24h ticker data from Binance
    // Using Promise.all to fetch all prices in parallel
    const pricePromises = tickers.map(async (ticker) => {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}`,
          {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 10 }, // ✅ Cache for 10 seconds only (ultra-fresh)
          }
        );

        if (!response.ok) {
          logger.error(`Binance API error for ${ticker}:`, response.status);
          return null;
        }

        const data = await response.json();
        return {
          ticker,
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
        };
      } catch (error) {
        logger.error(`Error fetching ${ticker} from Binance:`, error);
        return null;
      }
    });

    const results = await Promise.all(pricePromises);
    const validResults = results.filter(r => r !== null);

    // Convert back to symbol-keyed format that PriceService expects
    const result: Record<string, { price: number; change24h: number }> = {};
    
    symbols.forEach(symbol => {
      const ticker = symbolToTicker[symbol.toUpperCase()];
      const data = validResults.find(r => r?.ticker === ticker);
      
      if (data) {
        result[symbol] = {
          price: data.price,
          change24h: data.change24h,
        };
      } else {
        // Include all symbols in result, even if not found (for consistency)
        result[symbol] = { price: 0, change24h: 0 };
      }
    });

    // ✅ Return flat format: { "SOL": { price: 202.5, change24h: 0.2 } }
    return NextResponse.json(result);

  } catch (error) {
    logger.error('Error fetching Binance prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices from Binance' },
      { status: 500 }
    );
  }
}

