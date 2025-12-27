/**
 * Token Price History Service - MULTI-API FALLBACK
 * Fetches historical price data for ANY token/crypto on ANY chain
 * 
 * TIER 1: Jupiter API (Solana SPL tokens) - BEST for Solana
 * TIER 2: CoinGecko API (Major crypto + ERC20) - BEST for ETH/BTC
 * TIER 3: Birdeye API (All chains) - Fallback for everything
 * TIER 4: DexScreener (DEX tokens) - Ultimate fallback
 * 
 * ✅ IMPROVED: Now uses smart caching service
 */

import { logger } from '@/lib/logger';
import { priceHistoryCache } from './price-history-cache';

export interface PriceDataPoint {
  timestamp: number;
  price: number;
}

interface PriceHistoryResult {
  prices: PriceDataPoint[];
  success: boolean;
  error?: string;
  source?: string;
  coinGeckoId?: string;
}

/**
 * MAIN FUNCTION: Fetch price history with multi-API fallback
 * ✅ IMPROVED: Uses smart caching service
 */
export async function getTokenPriceHistory(
  symbol: string,
  days: number = 7,
  contractAddress?: string,
  chain?: string
): Promise<PriceHistoryResult> {
  console.log(`🔍 [TokenPriceHistory] ========== GET PRICE HISTORY START ==========`);
  console.log(`🔍 [TokenPriceHistory] Input: symbol=${symbol}, days=${days}, contractAddress=${contractAddress}, chain=${chain}`);
  
  // ✅ Check smart cache first
  const cached = priceHistoryCache.get(symbol, days, contractAddress, chain);
  if (cached) {
    console.log(`🔍 [TokenPriceHistory] ✅ Cache hit for ${symbol} (${days}d, chain=${chain})`);
    console.log(`🔍 [TokenPriceHistory] Cached data: ${cached.prices.length} points, source=${cached.source}, age=${Math.round((Date.now() - cached.timestamp) / 1000)}s`);
    logger.log(`📊 [TokenPriceHistory] Using cached data for ${symbol} (${days}d)`);
    return {
      prices: cached.prices,
      success: true,
      source: cached.source,
      coinGeckoId: cached.coinGeckoId,
    };
  }

  console.log(`🔍 [TokenPriceHistory] ❌ Cache miss - fetching fresh data for ${symbol} (${days}d, chain=${chain})...`);
  logger.log(`📊 [TokenPriceHistory] Fetching fresh data for ${symbol} (${days}d)...`);

  // TIER 1: Jupiter API for Solana SPL tokens
  if (chain?.toLowerCase() === 'solana' && contractAddress) {
    console.log(`🔍 [TokenPriceHistory] 🪐 Trying Jupiter API (Solana chain detected)`);
    const jupiterResult = await fetchJupiterPriceHistory(contractAddress, days);
    console.log(`🔍 [TokenPriceHistory] Jupiter result: success=${jupiterResult.success}, points=${jupiterResult.prices.length}, error=${jupiterResult.error || 'none'}`);
    if (jupiterResult.success) {
      console.log(`🔍 [TokenPriceHistory] ✅ Jupiter API succeeded, caching and returning`);
      // ✅ Cache the result
      priceHistoryCache.set(
        symbol,
        days,
        jupiterResult.prices,
        undefined,
        contractAddress,
        chain,
        jupiterResult.source || 'Jupiter'
      );
      return jupiterResult;
    } else {
      console.log(`🔍 [TokenPriceHistory] ⚠️ Jupiter API failed, falling back to CoinGecko`);
    }
  } else {
    console.log(`🔍 [TokenPriceHistory] ⏭️ Skipping Jupiter (chain=${chain}, contractAddress=${contractAddress ? 'present' : 'missing'})`);
  }

  // TIER 2: CoinGecko API for major tokens
  console.log(`🔍 [TokenPriceHistory] 🦎 Trying CoinGecko API`);
  const coinGeckoResult = await fetchCoinGeckoPriceHistory(symbol, days, contractAddress, chain);
  console.log(`🔍 [TokenPriceHistory] CoinGecko result: success=${coinGeckoResult.success}, points=${coinGeckoResult.prices.length}, coinGeckoId=${coinGeckoResult.coinGeckoId || 'none'}, error=${coinGeckoResult.error || 'none'}`);
  if (coinGeckoResult.success) {
    console.log(`🔍 [TokenPriceHistory] ✅ CoinGecko API succeeded, caching and returning`);
    // ✅ Cache the result
    priceHistoryCache.set(
      symbol,
      days,
      coinGeckoResult.prices,
      coinGeckoResult.coinGeckoId,
      contractAddress,
      chain,
      coinGeckoResult.source || 'CoinGecko'
    );
    return coinGeckoResult;
  } else {
    console.log(`🔍 [TokenPriceHistory] ⚠️ CoinGecko API failed, trying DexScreener`);
  }

  // TIER 3: DexScreener for DEX tokens
  if (contractAddress && chain) {
    console.log(`🔍 [TokenPriceHistory] 🔍 Trying DexScreener API (chain=${chain}, contractAddress=${contractAddress})`);
    const dexScreenerResult = await fetchDexScreenerPriceHistory(contractAddress, chain, days);
    console.log(`🔍 [TokenPriceHistory] DexScreener result: success=${dexScreenerResult.success}, points=${dexScreenerResult.prices.length}, error=${dexScreenerResult.error || 'none'}`);
    if (dexScreenerResult.success) {
      console.log(`🔍 [TokenPriceHistory] ✅ DexScreener API succeeded, caching and returning`);
      // ✅ Cache the result
      priceHistoryCache.set(
        symbol,
        days,
        dexScreenerResult.prices,
        undefined,
        contractAddress,
        chain,
        dexScreenerResult.source || 'DexScreener'
      );
      return dexScreenerResult;
    } else {
      console.log(`🔍 [TokenPriceHistory] ⚠️ DexScreener API failed`);
    }
  } else {
    console.log(`🔍 [TokenPriceHistory] ⏭️ Skipping DexScreener (contractAddress=${contractAddress ? 'present' : 'missing'}, chain=${chain || 'missing'})`);
  }

  // TIER 4: All APIs failed
  console.log(`🔍 [TokenPriceHistory] ❌ All APIs failed for ${symbol} (${days}d, chain=${chain})`);
  console.log(`🔍 [TokenPriceHistory] ========== GET PRICE HISTORY FAILED ==========`);
  logger.warn(`⚠️ [TokenPriceHistory] No price history available for ${symbol} from any API`);
  return { prices: [], success: false, error: 'No data available', source: 'none' };
}

/**
 * TIER 1: Jupiter API (Solana SPL tokens)
 * Best source for Solana tokens - free, no rate limit, excellent data
 */
async function fetchJupiterPriceHistory(
  contractAddress: string,
  days: number
): Promise<PriceHistoryResult> {
  try {
    logger.log(`🪐 [Jupiter] Fetching price history for ${contractAddress}...`);
    
    // Jupiter price API endpoint
    const response = await fetch(
      `https://price.jup.ag/v4/price?ids=${contractAddress}`,
      { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 900 } // 15 min cache
      }
    );

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const data = await response.json();
    const tokenData = data.data?.[contractAddress];
    
    if (!tokenData?.price) {
      throw new Error('No price data from Jupiter');
    }

    // ✅ REMOVED: No synthetic data generation
    // Jupiter only provides current price, not historical data
    // Return empty result to fallback to CoinGecko which has real historical data
    logger.warn(`⚠️ [Jupiter] Only current price available, no historical data - falling back to CoinGecko`);
    return { prices: [], success: false, error: 'Jupiter only provides current price, no historical data', source: 'Jupiter' };
    
  } catch (error) {
    logger.warn(`❌ [Jupiter] Failed:`, error);
    return { prices: [], success: false, error: String(error), source: 'Jupiter' };
  }
}

/**
 * TIER 2: CoinGecko API (Major crypto + ERC20)
 * Uses server-side API route to avoid client-side 401 errors
 */
async function fetchCoinGeckoPriceHistory(
  symbol: string,
  days: number,
  contractAddress?: string,
  chain?: string
): Promise<PriceHistoryResult> {
  try {
    console.log(`🔍 [CoinGecko] Fetching price history: symbol=${symbol}, days=${days}, contractAddress=${contractAddress}, chain=${chain}`);
    logger.log(`🦎 [CoinGecko] Fetching price history for ${symbol}...`);
    
    // Use server-side API route instead of direct CoinGecko call
    // This ensures API key is available and errors are handled gracefully
    const params = new URLSearchParams({
      symbol,
      days: days.toString(),
    });
    if (contractAddress) params.append('contractAddress', contractAddress);
    if (chain) params.append('chain', chain);
    
    const apiUrl = `/api/price-history?${params.toString()}`;
    console.log(`🔍 [CoinGecko] API URL: ${apiUrl}`);
    logger.log(`🦎 [CoinGecko] Using API route: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 900 } // 15 min cache
    });

    console.log(`🔍 [CoinGecko] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      // API route returns 200 even on errors, but check just in case
      console.log(`🔍 [CoinGecko] ❌ API route returned error status: ${response.status}`);
      logger.warn(`⚠️ [CoinGecko] API route returned ${response.status}`);
      return { prices: [], success: false, error: `API error: ${response.status}`, source: 'CoinGecko' };
    }

    const data = await response.json();
    console.log(`🔍 [CoinGecko] Response data: success=${data.success}, prices=${data.prices?.length || 0}, coinGeckoId=${data.coinGeckoId || 'none'}, error=${data.error || 'none'}`);
    
    if (!data.success || !data.prices || data.prices.length === 0) {
      console.log(`🔍 [CoinGecko] ❌ No price data: ${data.error || 'Unknown error'}`);
      logger.warn(`⚠️ [CoinGecko] No price data: ${data.error || 'Unknown error'}`);
      return { prices: [], success: false, error: data.error || 'No price data available', source: 'CoinGecko' };
    }

    if (data.prices.length > 0) {
      const oldestPrice = data.prices[0];
      const newestPrice = data.prices[data.prices.length - 1];
      const priceTimeSpan = (newestPrice.timestamp - oldestPrice.timestamp) / (1000 * 60 * 60);
      console.log(`🔍 [CoinGecko] ✅ Price data time span: ${priceTimeSpan.toFixed(2)} hours (${data.prices.length} points)`);
      console.log(`🔍 [CoinGecko] Price range: from ${new Date(oldestPrice.timestamp).toISOString()} to ${new Date(newestPrice.timestamp).toISOString()}`);
    }

    logger.log(`✅ [CoinGecko] Got ${data.prices.length} price points`);
    return { 
      prices: data.prices, 
      success: true, 
      source: 'CoinGecko',
      coinGeckoId: data.coinGeckoId, // ✅ Pass through CoinGecko ID for caching
    };
    
  } catch (error) {
    console.error(`🔍 [CoinGecko] ❌ Exception:`, error);
    logger.warn(`❌ [CoinGecko] Failed:`, error);
    return { prices: [], success: false, error: String(error), source: 'CoinGecko' };
  }
}

/**
 * Search CoinGecko by contract address
 */
async function searchCoinGeckoByContract(
  contractAddress: string,
  chain: string
): Promise<string | null> {
  try {
    const platformMap: Record<string, string> = {
      'ethereum': 'ethereum',
      'polygon': 'polygon-pos',
      'bsc': 'binance-smart-chain',
      'base': 'base',
      'avalanche': 'avalanche',
      'fantom': 'fantom',
      'arbitrum': 'arbitrum-one',
      'optimism': 'optimistic-ethereum',
    };

    const platform = platformMap[chain.toLowerCase()];
    if (!platform) return null;

    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    const apiKeyParam = apiKey ? `?x_cg_demo_api_key=${apiKey}` : '';
    const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}${apiKeyParam}`;
    
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 } // 1 hour cache
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.id || null;
  } catch {
    return null;
  }
}

/**
 * TIER 3: DexScreener API (DEX tokens on all chains)
 */
async function fetchDexScreenerPriceHistory(
  contractAddress: string,
  chain: string,
  days: number
): Promise<PriceHistoryResult> {
  try {
    logger.log(`🔍 [DexScreener] Fetching price history for ${contractAddress}...`);
    
    const chainMap: Record<string, string> = {
      'ethereum': 'ethereum',
      'bsc': 'bsc',
      'polygon': 'polygon',
      'solana': 'solana',
      'base': 'base',
      'avalanche': 'avalanche',
      'arbitrum': 'arbitrum',
      'optimism': 'optimism',
    };

    const dexChain = chainMap[chain.toLowerCase()];
    if (!dexChain) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 900 } // 15 min cache
      }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    const pair = data.pairs?.[0];
    
    if (!pair?.priceUsd) {
      throw new Error('No price data from DexScreener');
    }

    // ✅ REMOVED: No synthetic data generation
    // DexScreener doesn't provide historical data directly
    // Return empty result to fallback to CoinGecko which has real historical data
    logger.warn(`⚠️ [DexScreener] Only current price available, no historical data - falling back to CoinGecko`);
    return { prices: [], success: false, error: 'DexScreener only provides current price, no historical data', source: 'DexScreener' };
    
  } catch (error) {
    logger.warn(`❌ [DexScreener] Failed:`, error);
    return { prices: [], success: false, error: String(error), source: 'DexScreener' };
  }
}

/**
 * Map token symbol to CoinGecko ID (expanded list)
 */
function getCoinGeckoId(symbol: string): string | null {
  const mapping: Record<string, string> = {
    // Major cryptocurrencies
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
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'AVAX': 'avalanche-2',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
    'DAI': 'dai',
    'SHIB': 'shiba-inu',
    'TRX': 'tron',
    'FTM': 'fantom',
    'CRO': 'crypto-com-chain',
    'NEAR': 'near',
    'APT': 'aptos',
    
    // Popular SPL tokens
    'JUP': 'jupiter-exchange-solana',
    'RAY': 'raydium',
    'BONK': 'bonk',
    'WIF': 'dogwifcoin',
    'JTO': 'jito-governance-token',
    'PYTH': 'pyth-network',
    'ORCA': 'orca',
    'MNGO': 'mango-markets',
    'SRM': 'serum',
    'FIDA': 'bonfida',
    'SAMO': 'samoyedcoin',
    'SLND': 'solend',
    'PORT': 'port-finance',
    'TULIP': 'tulip-protocol',
    'COPE': 'cope',
    'STEP': 'step-finance',
    'MEDIA': 'media-network',
    'ROPE': 'rope-token',
    'LARIX': 'larix',
    'SUNNY': 'sunny-aggregator',
    
    // Popular ERC20 tokens
    'AAVE': 'aave',
    'MKR': 'maker',
    'COMP': 'compound-governance-token',
    'SUSHI': 'sushi',
    'GRT': 'the-graph',
    '1INCH': '1inch',
    'ENS': 'ethereum-name-service',
    'LDO': 'lido-dao',
    'CRV': 'curve-dao-token',
    'BAL': 'balancer',
    'SNX': 'havven',
    'YFI': 'yearn-finance',
    'PENDLE': 'pendle',
    'GMX': 'gmx',
    'PEPE': 'pepe',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'IMX': 'immutable-x',
    'RNDR': 'render-token',
    'FET': 'fetch-ai',
    'INJ': 'injective-protocol',
    'RUNE': 'thorchain',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
    'APE': 'apecoin',
    'LRC': 'loopring',
    'ENJ': 'enjincoin',
    'CHZ': 'chiliz',
    'GALA': 'gala',
  };

  return mapping[symbol.toUpperCase()] || null;
}

/**
 * Calculate price change percentage
 */
export function calculatePriceChange(prices: PriceDataPoint[]): number {
  if (prices.length < 2) return 0;
  
  const firstPrice = prices[0].price;
  const lastPrice = prices[prices.length - 1].price;
  
  return ((lastPrice - firstPrice) / firstPrice) * 100;
}

/**
 * Get min/max prices from history
 */
export function getPriceRange(prices: PriceDataPoint[]): { min: number; max: number } {
  if (prices.length === 0) return { min: 0, max: 0 };
  
  const priceValues = prices.map(p => p.price);
  return {
    min: Math.min(...priceValues),
    max: Math.max(...priceValues),
  };
}
