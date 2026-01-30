/**
 * Token Market Data Service
 * Fetches market cap, volume, supply, rank from CoinGecko API
 */

import { logger } from '@/lib/logger';

export interface TokenMarketData {
  marketCap?: number;
  volume24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  marketCapRank?: number;
  fullyDilutedValuation?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  success: boolean;
  error?: string;
}

// Cache for market data (5 minutes TTL)
const marketDataCache = new Map<string, { data: TokenMarketData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get CoinGecko ID from symbol mapping
 */
function getCoinGeckoIdFromSymbol(symbol: string): string | null {
  const symbolMap: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'MATIC': 'matic-network',
    'DOT': 'polkadot',
    'SHIB': 'shiba-inu',
    'AVAX': 'avalanche-2',
    'UNI': 'uniswap',
    'LINK': 'chainlink',
    'ATOM': 'cosmos',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'XLM': 'stellar',
    'ALGO': 'algorand',
    'VET': 'vechain',
    'ICP': 'internet-computer',
    'FIL': 'filecoin',
    'HBAR': 'hedera-hashgraph',
    'APT': 'aptos',
    'NEAR': 'near',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'STX': 'blockstack',
    'IMX': 'immutable-x',
    'INJ': 'injective-protocol',
    'RUNE': 'thorchain',
    'AAVE': 'aave',
    'MKR': 'maker',
    'COMP': 'compound-governance-token',
    'CRV': 'curve-dao-token',
    'SNX': 'havven',
    'SUSHI': 'sushi',
    'YFI': 'yearn-finance',
    '1INCH': '1inch',
    'BAL': 'balancer',
    'UMA': 'uma',
    'ZRX': '0x',
    'LRC': 'loopring',
    'ENJ': 'enjincoin',
    'MANA': 'decentraland',
    'SAND': 'the-sandbox',
    'AXS': 'axie-infinity',
    'GALA': 'gala',
    'CHZ': 'chiliz',
    'FLOW': 'flow',
    'THETA': 'theta-token',
    'KLAY': 'klay-token',
    'FTM': 'fantom',
    'ONE': 'harmony',
    'ZIL': 'zilliqa',
    'WAVES': 'waves',
    'XTZ': 'tezos',
    'EGLD': 'elrond-erd-2',
    'CAKE': 'pancakeswap-token',
    'GRT': 'the-graph',
    'PENDLE': 'pendle',
    'LDO': 'lido-dao',
    'RPL': 'rocket-pool',
    'FXS': 'frax-share',
    'CVX': 'convex-finance',
  };

  return symbolMap[symbol.toUpperCase()] || null;
}

/**
 * Fetch token market data from CoinGecko
 */
export async function getTokenMarketData(
  symbol: string,
  contractAddress?: string,
  chain?: string
): Promise<TokenMarketData> {
  const cacheKey = `${symbol}-${contractAddress || 'native'}-${chain || 'unknown'}`;
  
  // Check cache
  const cached = marketDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.log(`[TokenMarketData] ✅ Using cached data for ${symbol}`);
    return cached.data;
  }

  logger.log(`[TokenMarketData] 🔄 Fetching market data`, {
    symbol,
    contractAddress: contractAddress || 'native',
    chain: chain || 'unknown',
  });

  try {
    // Get CoinGecko ID
    let coinGeckoId = getCoinGeckoIdFromSymbol(symbol);
    
    if (!coinGeckoId && contractAddress) {
      // Try to find by contract address
      logger.log(`[TokenMarketData] 🔍 Looking up CoinGecko ID by contract`, {
        contractAddress,
        chain,
      });
      
      // Map chain name to CoinGecko platform ID
      const platformMap: Record<string, string> = {
        'ethereum': 'ethereum',
        'solana': 'solana',
        'binance': 'binance-smart-chain',
        'polygon': 'polygon-pos',
        'avalanche': 'avalanche',
        'arbitrum': 'arbitrum-one',
        'optimism': 'optimistic-ethereum',
      };
      
      const platform = chain ? platformMap[chain.toLowerCase()] : 'ethereum';
      
      if (platform) {
        try {
          const searchResponse = await fetch(
            `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}`,
            {
              headers: {
                'Accept': 'application/json',
                ...(process.env.COINGECKO_API_KEY ? {
                  'x-cg-pro-api-key': process.env.COINGECKO_API_KEY
                } : {})
              },
              next: { revalidate: 300 } // 5 minutes
            }
          );
          
          if (searchResponse.ok) {
            const data = await searchResponse.json();
            coinGeckoId = data.id;
            logger.log(`[TokenMarketData] ✅ Found CoinGecko ID: ${coinGeckoId}`);
          }
        } catch (error) {
          logger.log(`[TokenMarketData] ⚠️ Contract lookup failed, will try symbol search`);
        }
      }
    }

    if (!coinGeckoId) {
      logger.log(`[TokenMarketData] ❌ No CoinGecko ID found for ${symbol}`);
      const errorResult: TokenMarketData = {
        success: false,
        error: 'Token not found in CoinGecko',
      };
      marketDataCache.set(cacheKey, { data: errorResult, timestamp: Date.now() });
      return errorResult;
    }

    // Fetch market data from CoinGecko
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';

    const url = `${baseUrl}/coins/${coinGeckoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

    logger.log(`[TokenMarketData] 📡 Fetching from CoinGecko`, {
      coinGeckoId,
      url: url.replace(apiKey || '', 'API_KEY_HIDDEN'),
    });

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {})
      },
      next: { revalidate: 300 } // 5 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[TokenMarketData] ❌ CoinGecko API error`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        coinGeckoId,
      });
      
      const errorResult: TokenMarketData = {
        success: false,
        error: `CoinGecko API error: ${response.status}`,
      };
      return errorResult;
    }

    const data = await response.json();
    const marketData = data.market_data;

    if (!marketData) {
      logger.error(`[TokenMarketData] ❌ No market data in response`, { coinGeckoId });
      const errorResult: TokenMarketData = {
        success: false,
        error: 'No market data available',
      };
      return errorResult;
    }

    const result: TokenMarketData = {
      marketCap: marketData.market_cap?.usd,
      volume24h: marketData.total_volume?.usd,
      circulatingSupply: marketData.circulating_supply,
      totalSupply: marketData.total_supply,
      maxSupply: marketData.max_supply,
      marketCapRank: data.market_cap_rank,
      fullyDilutedValuation: marketData.fully_diluted_valuation?.usd,
      priceChange24h: marketData.price_change_24h,
      priceChangePercentage24h: marketData.price_change_percentage_24h,
      success: true,
    };

    logger.log(`[TokenMarketData] ✅ Successfully fetched market data`, {
      symbol,
      coinGeckoId,
      marketCap: result.marketCap,
      volume24h: result.volume24h,
      rank: result.marketCapRank,
    });

    // Cache the result
    marketDataCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error: any) {
    logger.error(`[TokenMarketData] ❌ Failed to fetch market data`, {
      symbol,
      error: error?.message || 'Unknown error',
      stack: error?.stack,
    });

    const errorResult: TokenMarketData = {
      success: false,
      error: error?.message || 'Unknown error',
    };
    return errorResult;
  }
}

/**
 * Format large numbers (for market cap, volume, supply)
 */
export function formatLargeNumber(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '-';
  }

  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  } else if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
}

/**
 * Format supply numbers (no $ sign)
 */
export function formatSupply(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '-';
  }

  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  } else {
    return value.toFixed(0);
  }
}

