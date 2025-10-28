import { NextResponse } from 'next/server';

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
      MATIC: 'matic-network',
      BNB: 'binancecoin',
      TBNB: 'binancecoin', // Testnet BNB uses same price as mainnet BNB
      ARB: 'arbitrum',
      BASE: 'base',
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
      return NextResponse.json({ error: 'No valid symbols' }, { status: 400 });
    }

    // Fetch from CoinGecko (server-side, no CORS issues!)
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 10 }, // ✅ Cache for 10 seconds only (ultra-fresh)
      }
    );

    if (!response.ok) {
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
      }
    });

    // ✅ Return flat format: { "SOL": { price: 202.5, change24h: 0.2 } }
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}




