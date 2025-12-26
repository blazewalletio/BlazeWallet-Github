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
    
    // ✅ IMPROVED: Better interval selection based on timeframe
    // CoinGecko supports: hourly (1-90 days), daily (1-365 days), auto (auto-selects best)
    let interval = 'auto';
    if (days <= 1) {
      interval = 'hourly'; // For 1D, use hourly data
    } else if (days <= 90) {
      interval = 'daily'; // For 7D, 30D, use daily data
    } else {
      interval = 'daily'; // For 1J, ALLES, use daily data
    }
    
    let coinGeckoId: string | null = null;
    let url: string;
    let isNativeToken = false;

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
        'cronos': 'cronos',
        'zksync': 'zksync',
        'linea': 'linea',
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

    // ✅ PRIORITY 2: Native token detection and symbol-to-ID mapping
    if (!coinGeckoId) {
      const symbolToId: Record<string, string> = {
        // Major native tokens (correct IDs)
        ETH: 'ethereum',
        SOL: 'solana',
        BTC: 'bitcoin',
        MATIC: 'polygon', // ✅ FIXED: Use 'polygon' for native MATIC token (not 'matic-network')
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
        // Stablecoins
        USDT: 'tether',
        USDC: 'usd-coin',
        BUSD: 'binance-usd',
        DAI: 'dai',
        // Wrapped tokens
        WBTC: 'wrapped-bitcoin',
        WETH: 'ethereum', // WETH uses ETH price
        // Popular DeFi tokens
        LINK: 'chainlink',
        UNI: 'uniswap',
        AAVE: 'aave',
        MKR: 'maker',
        COMP: 'compound-governance-token',
        SUSHI: 'sushi',
        CRV: 'curve-dao-token',
        SNX: 'havven',
        YFI: 'yearn-finance',
        PENDLE: 'pendle',
        GMX: 'gmx',
        // Solana SPL tokens
        RAY: 'raydium',
        BONK: 'bonk',
        JUP: 'jupiter-exchange-solana',
        WIF: 'dogwifcoin',
        JTO: 'jito-governance-token',
        PYTH: 'pyth-network',
        ORCA: 'orca',
        MNGO: 'mango-markets',
        SRM: 'serum',
        FIDA: 'bonfida',
        SAMO: 'samoyedcoin',
        SLND: 'solend',
        PORT: 'port-finance',
        // Meme coins
        PEPE: 'pepe',
        SHIB: 'shiba-inu',
        FLOKI: 'floki',
        // Layer 2 tokens
        IMX: 'immutable-x',
        RNDR: 'render-token',
        FET: 'fetch-ai',
        INJ: 'injective-protocol',
        RUNE: 'thorchain',
        // Gaming tokens
        SAND: 'the-sandbox',
        MANA: 'decentraland',
        AXS: 'axie-infinity',
        APE: 'apecoin',
        // Other popular tokens
        LRC: 'loopring',
        ENJ: 'enjincoin',
        CHZ: 'chiliz',
        GALA: 'gala',
        GRT: 'the-graph',
        '1INCH': '1inch',
        ENS: 'ethereum-name-service',
        LDO: 'lido-dao',
        BAL: 'balancer',
      };

      coinGeckoId = symbolToId[symbol.toUpperCase()] || null;
      if (coinGeckoId) {
        // Mark as native if it's a known native token
        const nativeTokens = ['ethereum', 'solana', 'bitcoin', 'polygon', 'binancecoin', 'arbitrum', 'base', 'optimism', 'avalanche-2', 'fantom', 'crypto-com-chain', 'litecoin', 'dogecoin', 'bitcoin-cash'];
        isNativeToken = nativeTokens.includes(coinGeckoId);
      }
    }
    
    // ✅ PRIORITY 3: Try CoinGecko search API for unknown tokens
    if (!coinGeckoId) {
      try {
        logger.log(`🔍 [Price History] Searching CoinGecko for: ${symbol}`);
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}${apiKeyParam ? '&' + apiKeyParam.substring(1) : ''}`;
        const searchResponse = await fetch(searchUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 3600 } // 1 hour cache
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          // Find exact symbol match (case-insensitive)
          const exactMatch = searchData.coins?.find((coin: any) => 
            coin.symbol?.toUpperCase() === symbol.toUpperCase()
          );
          
          if (exactMatch) {
            coinGeckoId = exactMatch.id;
            logger.log(`✅ [Price History] Found CoinGecko ID via search: ${coinGeckoId}`);
          } else if (searchData.coins && searchData.coins.length > 0) {
            // Use first result if no exact match
            coinGeckoId = searchData.coins[0].id;
            logger.log(`⚠️ [Price History] Using first search result: ${coinGeckoId} (not exact match for ${symbol})`);
          }
        }
      } catch (error) {
        logger.warn(`⚠️ [Price History] Search API error:`, error);
      }
    }
    
    if (!coinGeckoId) {
      logger.warn(`[Price History] No CoinGecko ID found for ${symbol}${contractAddress ? ` (contract: ${contractAddress})` : ''}`);
      return NextResponse.json(
        { prices: [], success: false, error: 'Token not found on CoinGecko' },
        { status: 200 } // Return 200 with empty data (not an error)
      );
    }

    // ✅ IMPROVED: Fetch from CoinGecko with better error handling
    url = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}${apiKeyParam}`;
    
    logger.log(`📡 [Price History] Fetching ${days} days (${interval}) for ${symbol} (${coinGeckoId})${isNativeToken ? ' [Native]' : ''}${contractAddress ? ` via contract ${contractAddress}` : ''} (API key: ${apiKey ? 'Yes' : 'No'})`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: days <= 1 ? 300 : 900 }, // 5 min cache for 1D, 15 min for others
    });

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn('⚠️ [Price History] CoinGecko 401 Unauthorized - API key may be invalid or missing');
        return NextResponse.json(
          { prices: [], success: false, error: 'CoinGecko API key invalid or missing' },
          { status: 200 }
        );
      }
      if (response.status === 429) {
        logger.warn('⚠️ [Price History] CoinGecko rate limit hit');
        return NextResponse.json(
          { prices: [], success: false, error: 'Rate limited' },
          { status: 200 }
        );
      }
      if (response.status === 404) {
        logger.warn(`⚠️ [Price History] CoinGecko 404 - Token ${coinGeckoId} not found`);
        return NextResponse.json(
          { prices: [], success: false, error: 'Token not found on CoinGecko' },
          { status: 200 }
        );
      }
      logger.error(`❌ [Price History] CoinGecko API error: ${response.status}`);
      return NextResponse.json(
        { prices: [], success: false, error: `CoinGecko API error: ${response.status}` },
        { status: 200 }
      );
    }

    const data = await response.json();
    
    if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
      logger.warn(`⚠️ [Price History] No price data from CoinGecko for ${symbol} (${coinGeckoId})`);
      return NextResponse.json(
        { prices: [], success: false, error: 'No price data available' },
        { status: 200 }
      );
    }

    // ✅ IMPROVED: CoinGecko returns [[timestamp, price], ...]
    // Filter out invalid data points and ensure chronological order
    const prices = data.prices
      .filter(([timestamp, price]: [number, number]) => 
        timestamp && price && price > 0 && !isNaN(price) && !isNaN(timestamp)
      )
      .map(([timestamp, price]: [number, number]) => ({
        timestamp: timestamp,
        price: price,
      }))
      .sort((a: { timestamp: number; price: number }, b: { timestamp: number; price: number }) => a.timestamp - b.timestamp); // Ensure chronological order

    if (prices.length === 0) {
      logger.warn(`⚠️ [Price History] No valid price points after filtering for ${symbol}`);
      return NextResponse.json(
        { prices: [], success: false, error: 'No valid price data' },
        { status: 200 }
      );
    }

    // ✅ IMPROVED: For very short timeframes, ensure we have enough data points
    // If we have less than 10 points for 1D, try to interpolate or use current price
    if (days <= 1 && prices.length < 10) {
      logger.log(`⚠️ [Price History] Only ${prices.length} points for 1D, ensuring minimum data`);
      // Add current price if missing
      const now = Date.now();
      const lastPoint = prices[prices.length - 1];
      if (lastPoint && (now - lastPoint.timestamp) > 300000) { // More than 5 min old
        prices.push({
          timestamp: now,
          price: lastPoint.price, // Use last known price
        });
      }
    }

    logger.log(`✅ [Price History] Got ${prices.length} price points for ${symbol} (${coinGeckoId})`);
    
    return NextResponse.json({
      prices,
      success: true,
      source: 'CoinGecko',
      coinGeckoId: coinGeckoId,
    });

  } catch (error: any) {
    logger.error('[Price History] Error:', error);
    return NextResponse.json(
      { prices: [], success: false, error: error.message || 'Unknown error' },
      { status: 200 } // Return 200 with empty data (not an error)
    );
  }
}

