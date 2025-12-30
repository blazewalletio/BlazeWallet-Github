import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCoinGeckoClient } from '@/lib/coingecko-sdk-service';
import Coingecko from '@coingecko/coingecko-typescript';

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
  const requestStartTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const days = parseInt(searchParams.get('days') || '7', 10);
    const contractAddress = searchParams.get('contractAddress') || undefined;
    const chain = searchParams.get('chain') || undefined;

    logger.log(`[Price History API] 📥 Request received`, {
      symbol,
      days,
      contractAddress: contractAddress || 'none',
      chain: chain || 'none',
      url: request.url,
    });

    if (!symbol) {
      logger.error(`[Price History API] ❌ Missing symbol parameter`);
      return NextResponse.json(
        { error: 'Missing symbol parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const isDemoKey = apiKey?.startsWith('CG-');
    
    logger.log(`[Price History API] 🔑 CoinGecko API configuration`, {
      hasApiKeyInEnv: !!apiKey,
      keyType: isDemoKey ? 'demo' : apiKey ? 'pro' : 'none',
      keyLength: apiKey?.length || 0,
      note: 'SDK will handle API key automatically',
    });
    
    // ✅ EXACT CoinGecko granularity matching:
    // - 1 day: NO interval parameter → automatically gives 5-minute data (288 points)
    // - 1-90 days: interval=hourly → hourly data
    // - >90 days: interval=daily → daily data
    let interval: string | null = null;
    if (days === 1) {
      // ✅ 1D: No interval parameter = CoinGecko automatically gives 5-minute intervals
      interval = null; // Don't add interval parameter for 1D
    } else if (days <= 90) {
      interval = 'hourly'; // For 7D, 30D: hourly data
    } else {
      interval = 'daily'; // For 1J, ALLES: daily data
    }
    
    logger.log(`[Price History API] ⚙️ Interval calculation`, {
      days,
      interval: interval || 'null (auto 5-minute)',
      reason: days === 1 ? '1 day = auto 5-minute' : days <= 90 ? '1-90 days = hourly' : '>90 days = daily',
    });
    
    let coinGeckoId: string | null = null;
    let url: string;
    let isNativeToken = false;

      // ✅ PRIORITY 1: Try contract address lookup (for EVM tokens)
      if (contractAddress && chain && chain !== 'solana') {
        logger.log(`[Price History API] 🔍 Step 1: Contract address lookup`, {
          contractAddress,
          chain,
        });
        
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
        logger.log(`[Price History API] 🔍 Platform mapping`, {
          chain: chain.toLowerCase(),
          platform: platform || 'not found',
        });
        
        if (platform) {
          try {
            // ✅ Use free tier (no API key) for contract lookup
            const contractUrl = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}`;
            logger.log(`[Price History API] 📡 Contract lookup API call`, {
              url: contractUrl,
              platform,
              contractAddress,
            });
          
          const contractStartTime = Date.now();
          const contractResponse = await fetch(contractUrl, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 } // 1 hour cache
          });
          const contractDuration = Date.now() - contractStartTime;

          logger.log(`[Price History API] 📥 Contract lookup response`, {
            status: contractResponse.status,
            statusText: contractResponse.statusText,
            duration: `${contractDuration}ms`,
            ok: contractResponse.ok,
          });

          if (contractResponse.ok) {
            const contractData = await contractResponse.json();
            coinGeckoId = contractData.id;
            logger.log(`[Price History API] ✅ Found CoinGecko ID via contract`, {
              coinGeckoId,
              contractAddress,
              platform,
            });
          } else {
            logger.warn(`[Price History API] ⚠️ Contract lookup failed`, {
              status: contractResponse.status,
              statusText: contractResponse.statusText,
              contractAddress,
              platform,
            });
          }
        } catch (error: any) {
          logger.error(`[Price History API] ❌ Contract lookup error`, {
            error: error?.message || 'Unknown error',
            stack: error?.stack,
            contractAddress,
            platform,
          });
        }
      } else {
        logger.warn(`[Price History API] ⚠️ Platform not found in mapping`, {
          chain: chain.toLowerCase(),
        });
      }
    } else {
      logger.log(`[Price History API] ⏭️ Skipping contract lookup`, {
        hasContractAddress: !!contractAddress,
        hasChain: !!chain,
        isSolana: chain === 'solana',
      });
    }

    // ✅ PRIORITY 2: Native token detection and symbol-to-ID mapping
    if (!coinGeckoId) {
      logger.log(`[Price History API] 🔍 Step 2: Symbol-to-ID mapping`, {
        symbol,
      });
      
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
      logger.log(`[Price History API] 🔍 Symbol lookup result`, {
        symbol: symbol.toUpperCase(),
        coinGeckoId: coinGeckoId || 'not found',
      });
      
      if (coinGeckoId) {
        // Mark as native if it's a known native token
        const nativeTokens = ['ethereum', 'solana', 'bitcoin', 'polygon', 'binancecoin', 'arbitrum', 'base', 'optimism', 'avalanche-2', 'fantom', 'crypto-com-chain', 'litecoin', 'dogecoin', 'bitcoin-cash'];
        isNativeToken = nativeTokens.includes(coinGeckoId);
        logger.log(`[Price History API] ✅ Symbol mapped to CoinGecko ID`, {
          coinGeckoId,
          isNativeToken,
        });
      }
    }
    
    // ✅ PRIORITY 3: Try CoinGecko search API for unknown tokens
    if (!coinGeckoId) {
      logger.log(`[Price History API] 🔍 Step 3: CoinGecko search API`, {
        symbol,
      });
      
      try {
        // ✅ Use free tier (no API key) for search
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
        logger.log(`[Price History API] 📡 Search API call`, {
          url: searchUrl,
          symbol,
        });
        
        const searchStartTime = Date.now();
        const searchResponse = await fetch(searchUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 3600 } // 1 hour cache
        });
        const searchDuration = Date.now() - searchStartTime;

        logger.log(`[Price History API] 📥 Search API response`, {
          status: searchResponse.status,
          statusText: searchResponse.statusText,
          duration: `${searchDuration}ms`,
          ok: searchResponse.ok,
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const resultsCount = searchData.coins?.length || 0;
          logger.log(`[Price History API] 🔍 Search results`, {
            resultsCount,
            firstResult: searchData.coins?.[0] ? {
              id: searchData.coins[0].id,
              symbol: searchData.coins[0].symbol,
              name: searchData.coins[0].name,
            } : null,
          });
          
          // Find exact symbol match (case-insensitive)
          const exactMatch = searchData.coins?.find((coin: any) => 
            coin.symbol?.toUpperCase() === symbol.toUpperCase()
          );
          
          if (exactMatch) {
            coinGeckoId = exactMatch.id;
            logger.log(`[Price History API] ✅ Found exact match via search`, {
              coinGeckoId,
              symbol: exactMatch.symbol,
              name: exactMatch.name,
            });
          } else if (searchData.coins && searchData.coins.length > 0) {
            // Use first result if no exact match
            coinGeckoId = searchData.coins[0].id;
            logger.warn(`[Price History API] ⚠️ Using first search result (not exact match)`, {
              coinGeckoId,
              requestedSymbol: symbol,
              foundSymbol: searchData.coins[0].symbol,
            });
          } else {
            logger.warn(`[Price History API] ⚠️ No search results found`, {
              symbol,
            });
          }
        } else {
          logger.error(`[Price History API] ❌ Search API failed`, {
            status: searchResponse.status,
            statusText: searchResponse.statusText,
          });
        }
      } catch (error: any) {
        logger.error(`[Price History API] ❌ Search API error`, {
          error: error?.message || 'Unknown error',
          stack: error?.stack,
          symbol,
        });
      }
    }
    
    if (!coinGeckoId) {
      logger.error(`[Price History API] ❌ No CoinGecko ID found`, {
        symbol,
        contractAddress: contractAddress || 'none',
        chain: chain || 'none',
        triedContractLookup: !!(contractAddress && chain && chain !== 'solana'),
        triedSymbolMapping: true,
        triedSearchAPI: true,
      });
      return NextResponse.json(
        { prices: [], success: false, error: 'Token not found on CoinGecko' },
        { status: 200 } // Return 200 with empty data (not an error)
      );
    }

    // ✅ Use CoinGecko SDK for market chart data
    // SDK handles API key, retries, and error handling automatically
    const intervalLabel = interval || '5-minute (auto)';
    logger.log(`[Price History API] 📡 Step 4: Fetching market chart data via SDK`, {
      symbol,
      coinGeckoId,
      days,
      interval: intervalLabel,
      isNativeToken,
      contractAddress: contractAddress || 'none',
      hasApiKey: !!apiKey,
      keyType: isDemoKey ? 'demo' : apiKey ? 'pro' : 'free',
    });
    
    const marketChartStartTime = Date.now();
    let data: Coingecko.Coins.MarketChartGetResponse;
    
    try {
      const client = getCoinGeckoClient();
      
      // ✅ Build SDK params
      // SDK expects: get(id: string, query: MarketChartGetParams)
      // days as string, interval as optional 'hourly' | 'daily'
      const marketChartParams: Coingecko.Coins.MarketChartGetParams = {
        vs_currency: 'usd',
        days: days.toString(),
        // Only add interval if not null (1D uses null for auto 5-minute)
        ...(interval ? { interval: interval as 'hourly' | 'daily' } : {}),
      };
      
      logger.log(`[Price History API] 🔧 SDK params`, {
        coinId: coinGeckoId,
        params: marketChartParams,
      });
      
      // ✅ SDK call with automatic retries and error handling
      // get(id: string, query: MarketChartGetParams)
      data = await client.coins.marketChart.get(coinGeckoId, marketChartParams);
      
      const marketChartDuration = Date.now() - marketChartStartTime;
      
      logger.log(`[Price History API] 📥 SDK response received`, {
        ok: true,
        duration: `${marketChartDuration}ms`,
        hasPrices: !!data.prices,
        pricesLength: data.prices?.length || 0,
        hasMarketCaps: !!data.market_caps,
        hasTotalVolumes: !!data.total_volumes,
      });
      
    } catch (error: any) {
      const marketChartDuration = Date.now() - marketChartStartTime;
      
      // ✅ SDK provides typed errors
      if (error instanceof Coingecko.APIError) {
        logger.error(`[Price History API] ❌ SDK API Error`, {
          status: error.status,
          name: error.name,
          message: error.message,
          coinGeckoId,
          symbol,
          days,
          interval,
          duration: `${marketChartDuration}ms`,
        });
        
        if (error.status === 429) {
          logger.error(`[Price History API] ❌ 429 Rate limit hit`);
          return NextResponse.json(
            { prices: [], success: false, error: 'Rate limited - please try again in a moment' },
            { status: 200 }
          );
        }
        
        if (error.status === 404) {
          logger.error(`[Price History API] ❌ 404 Token not found`, {
            coinGeckoId,
            symbol,
          });
          return NextResponse.json(
            { prices: [], success: false, error: 'Token not found on CoinGecko' },
            { status: 200 }
          );
        }
        
        return NextResponse.json(
          { prices: [], success: false, error: `CoinGecko API error: ${error.status} - ${error.message}` },
          { status: 200 }
        );
      }
      
      // Re-throw for generic error handling
      logger.error(`[Price History API] ❌ SDK call failed`, {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
        coinGeckoId,
        symbol,
        days,
        interval,
        duration: `${marketChartDuration}ms`,
      });
      throw error;
    }

    const parseStartTime = Date.now();
    const parseDuration = Date.now() - parseStartTime;
    
    logger.log(`[Price History API] 📊 Response parsed`, {
      hasPrices: !!data.prices,
      pricesIsArray: Array.isArray(data.prices),
      pricesLength: data.prices?.length || 0,
      hasMarketCaps: !!data.market_caps,
      hasTotalVolumes: !!data.total_volumes,
      parseDuration: `${parseDuration}ms`,
    });
    
    if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
      logger.error(`[Price History API] ❌ No price data in response`, {
        symbol,
        coinGeckoId,
        days,
        interval,
        responseKeys: Object.keys(data),
        pricesType: typeof data.prices,
        pricesLength: data.prices?.length || 0,
      });
      return NextResponse.json(
        { prices: [], success: false, error: 'No price data available' },
        { status: 200 }
      );
    }

    // ✅ EXACT CoinGecko data - minimal filtering, preserve exact shape
    // Only filter out truly invalid data (null, NaN, negative)
    // Keep ALL valid data points to match CoinGecko's exact chart shape
    const filterStartTime = Date.now();
    const rawPricesCount = data.prices?.length || 0;
    
    // ✅ SDK returns Array<Array<number>> where each inner array is [timestamp, price]
    const pricesArray = (data.prices || []) as Array<[number, number]>;
    
    logger.log(`[Price History API] 🔍 Filtering price data`, {
      rawDataPoints: rawPricesCount,
      firstRawPoint: pricesArray[0] ? {
        timestamp: pricesArray[0][0],
        price: pricesArray[0][1],
      } : null,
      lastRawPoint: pricesArray[pricesArray.length - 1] ? {
        timestamp: pricesArray[pricesArray.length - 1][0],
        price: pricesArray[pricesArray.length - 1][1],
      } : null,
    });
    
    const prices = pricesArray
      .filter((point) => {
        const [timestamp, price] = point;
        return timestamp && price && price > 0 && !isNaN(price) && !isNaN(timestamp);
      })
      .map((point) => {
        const [timestamp, price] = point;
        return {
          timestamp: timestamp,
          price: price,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const filterDuration = Date.now() - filterStartTime;
    const filteredOut = rawPricesCount - prices.length;

    logger.log(`[Price History API] ✅ Data filtering complete`, {
      rawPoints: rawPricesCount,
      validPoints: prices.length,
      filteredOut,
      filterDuration: `${filterDuration}ms`,
      firstValidPoint: prices[0] ? {
        timestamp: prices[0].timestamp,
        price: prices[0].price,
        date: new Date(prices[0].timestamp).toISOString(),
      } : null,
      lastValidPoint: prices[prices.length - 1] ? {
        timestamp: prices[prices.length - 1].timestamp,
        price: prices[prices.length - 1].price,
        date: new Date(prices[prices.length - 1].timestamp).toISOString(),
      } : null,
    });

    if (prices.length === 0) {
      logger.error(`[Price History API] ❌ No valid price points after filtering`, {
        symbol,
        coinGeckoId,
        rawPoints: rawPricesCount,
        filteredOut,
      });
      return NextResponse.json(
        { prices: [], success: false, error: 'No valid price data' },
        { status: 200 }
      );
    }

    // ✅ NO data manipulation - use CoinGecko's exact data
    // CoinGecko already provides complete, accurate data:
    // - 1D: ~288 points (5-minute intervals)
    // - 7D: ~168 points (hourly intervals)
    // - 30D: ~720 points (hourly intervals)
    // - 1J: ~365 points (daily intervals)
    // Adding extra points would distort the chart shape and make it not match CoinGecko

    const totalDuration = Date.now() - requestStartTime;
    logger.log(`[Price History API] ✅ Successfully processed request`, {
      symbol,
      coinGeckoId,
      days,
      interval: intervalLabel,
      dataPoints: prices.length,
      totalDuration: `${totalDuration}ms`,
      isNativeToken,
    });
    
    return NextResponse.json({
      prices,
      success: true,
      source: 'CoinGecko SDK',
      coinGeckoId: coinGeckoId,
    });

  } catch (error: any) {
    const totalDuration = Date.now() - requestStartTime;
    logger.error('[Price History API] ❌ Fatal error', {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      totalDuration: `${totalDuration}ms`,
    });
    return NextResponse.json(
      { prices: [], success: false, error: error.message || 'Unknown error' },
      { status: 200 } // Return 200 with empty data (not an error)
    );
  }
}

