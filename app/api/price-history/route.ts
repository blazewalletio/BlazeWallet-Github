import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/price-history
 * Fetches price history from CoinGecko (server-side, with API key support)
 * 
 * Query params:
 * - symbol: Token symbol (e.g., "ETH", "BTC")
 * - days: Number of days (1, 7, 30, etc.)
 * - contractAddress: Optional contract address
 * - chain: Optional chain name
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const days = parseInt(searchParams.get('days') || '7', 10);
    const contractAddress = searchParams.get('contractAddress') || undefined;
    const chain = searchParams.get('chain') || undefined;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Missing symbol parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const apiKeyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
    const interval = days <= 1 ? 'hourly' : 'daily';
    let coinGeckoId: string | null = null;
    let url: string;

    // ✅ PRIORITY 1: Try contract address lookup (for EVM tokens)
    if (contractAddress && chain && chain !== 'solana') {
      const platformMap: Record<string, string> = {
        'ethereum': 'ethereum',
        'polygon': 'polygon-pos',
        'bsc': 'binance-smart-chain',
        'binance-smart-chain': 'binance-smart-chain',
        'base': 'base',
        'avalanche': 'avalanche',
        'fantom': 'fantom',
        'arbitrum': 'arbitrum-one',
        'optimism': 'optimistic-ethereum',
      };

      const platform = platformMap[chain.toLowerCase()];
      if (platform) {
        try {
          logger.log(`📡 [Price History] Trying contract address lookup: ${contractAddress} on ${platform}`);
          const contractUrl = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}${apiKeyParam ? '?' + apiKeyParam.substring(1) : ''}`;
          const contractResponse = await fetch(contractUrl, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 } // 1 hour cache
          });

          if (contractResponse.ok) {
            const contractData = await contractResponse.json();
            coinGeckoId = contractData.id;
            logger.log(`✅ [Price History] Found CoinGecko ID via contract: ${coinGeckoId}`);
          } else {
            logger.log(`⚠️ [Price History] Contract lookup failed (${contractResponse.status}), falling back to symbol`);
          }
        } catch (error) {
          logger.warn(`⚠️ [Price History] Contract lookup error:`, error);
        }
      }
    }

    // ✅ PRIORITY 2: Fallback to symbol-to-ID mapping
    if (!coinGeckoId) {
      const symbolToId: Record<string, string> = {
        ETH: 'ethereum',
        SOL: 'solana',
        BTC: 'bitcoin',
        MATIC: 'matic-network',
        BNB: 'binancecoin',
        ARB: 'arbitrum',
        BASE: 'base',
        OP: 'optimism',
        AVAX: 'avalanche-2',
        FTM: 'fantom',
        CRO: 'crypto-com-chain',
        LTC: 'litecoin',
        DOGE: 'dogecoin',
        BCH: 'bitcoin-cash',
        USDT: 'tether',
        USDC: 'usd-coin',
        BUSD: 'binance-usd',
        WBTC: 'wrapped-bitcoin',
        LINK: 'chainlink',
        RAY: 'raydium',
        BONK: 'bonk',
        JUP: 'jupiter-exchange-solana',
        WIF: 'dogwifcoin',
        JTO: 'jito-governance-token',
        PYTH: 'pyth-network',
        ORCA: 'orca',
        MNGO: 'mango-markets',
      };

      coinGeckoId = symbolToId[symbol.toUpperCase()] || null;
    }
    
    if (!coinGeckoId) {
      logger.warn(`[Price History] No CoinGecko ID found for ${symbol}${contractAddress ? ` (contract: ${contractAddress})` : ''}`);
      return NextResponse.json(
        { prices: [], success: false, error: 'Token not supported' },
        { status: 200 } // Return 200 with empty data (not an error)
      );
    }

    // Fetch from CoinGecko (server-side, with API key)
    url = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}${apiKeyParam}`;
    
    logger.log(`📡 [Price History] Fetching ${days} days (${interval}) for ${symbol} (${coinGeckoId})${contractAddress ? ` via contract ${contractAddress}` : ''} (API key: ${apiKey ? 'Yes' : 'No'})`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 900 }, // 15 min cache
    });

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn('⚠️ [Price History] CoinGecko 401 Unauthorized - API key may be invalid or missing');
        return NextResponse.json(
          { prices: [], success: false, error: 'CoinGecko API key invalid or missing' },
          { status: 200 } // Return 200 with empty data (not an error)
        );
      }
      if (response.status === 429) {
        logger.warn('⚠️ [Price History] CoinGecko rate limit hit');
        return NextResponse.json(
          { prices: [], success: false, error: 'Rate limited' },
          { status: 200 } // Return 200 with empty data (not an error)
        );
      }
      logger.error(`[Price History] CoinGecko API error: ${response.status}`);
      return NextResponse.json(
        { prices: [], success: false, error: `CoinGecko API error: ${response.status}` },
        { status: 200 } // Return 200 with empty data (not an error)
      );
    }

    const data = await response.json();
    
    if (!data.prices || data.prices.length === 0) {
      logger.warn(`[Price History] No price data from CoinGecko for ${symbol}`);
      return NextResponse.json(
        { prices: [], success: false, error: 'No price data available' },
        { status: 200 }
      );
    }

    // CoinGecko returns [[timestamp, price], ...]
    const prices = data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp,
      price,
    }));

    logger.log(`✅ [Price History] Got ${prices.length} price points for ${symbol}`);
    
    return NextResponse.json({
      prices,
      success: true,
      source: 'CoinGecko',
    });

  } catch (error: any) {
    logger.error('[Price History] Error:', error);
    return NextResponse.json(
      { prices: [], success: false, error: error.message || 'Unknown error' },
      { status: 200 } // Return 200 with empty data (not an error)
    );
  }
}

