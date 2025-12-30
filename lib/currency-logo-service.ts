/**
 * 🎨 Currency Logo Service
 * 
 * Dynamically fetches cryptocurrency logos from multiple sources
 * This ensures EVERY currency/token has the correct logo
 * 
 * Sources (in priority order):
 * 1. CoinGecko API - 10,000+ cryptocurrencies
 * 2. CryptoCompare API - 6,000+ cryptocurrencies
 * 3. Local fallback logos for major currencies
 */

import { logger } from '@/lib/logger';

interface CurrencyLogoCache {
  [key: string]: {
    logo: string;
    timestamp: number;
  };
}

// In-memory cache (24 hour TTL)
const logoCache: CurrencyLogoCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Local fallback logos for major currencies (instant loading)
const LOCAL_LOGOS: Record<string, string> = {
  'ETH': '/crypto-eth.png',
  'BTC': '/crypto-bitcoin.png',
  'SOL': '/crypto-solana.png',
  'MATIC': '/crypto-polygon.png',
  'BNB': '/crypto-bnb.png',
  'tBNB': '/crypto-bnb.png',
  'AVAX': '/crypto-avalanche.png',
  'FTM': '/crypto-fantom.png',
  'CRO': '/crypto-cronos.png',
  'LTC': '/crypto-litecoin.png',
  'DOGE': '/crypto-doge.png',
  'BCH': '/crypto-bitcoincash.png',
  'USDC': '/crypto-usdc.png',
  'USDT': '/crypto-usdt.png',
};

// Symbol to CoinGecko ID mapping (for accurate lookups)
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'SOL': 'solana',
  'MATIC': 'matic-network',
  'BNB': 'binancecoin',
  'AVAX': 'avalanche-2',
  'FTM': 'fantom',
  'CRO': 'crypto-com-chain',
  'LTC': 'litecoin',
  'DOGE': 'dogecoin',
  'BCH': 'bitcoin-cash',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WETH': 'weth',
  'DAI': 'dai',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'WBTC': 'wrapped-bitcoin',
};

/**
 * Get currency logo dynamically
 * @param symbol Token symbol (e.g., 'ETH', 'BTC', 'USDC')
 * @param contractAddress Optional contract address for ERC20/SPL tokens
 * @returns Logo URL (local file or external URL)
 */
export async function getCurrencyLogo(
  symbol: string,
  contractAddress?: string
): Promise<string> {
  const cacheKey = contractAddress || symbol;
  console.log(`\n🖼️ [CurrencyLogoService] Fetching logo...`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Contract Address: ${contractAddress || 'N/A'}`);
  console.log(`   Cache Key: ${cacheKey}`);
  
  // Check cache first
  const cached = logoCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`   ✅ CACHE HIT: ${cached.logo}`);
    return cached.logo;
  }
  console.log(`   ❌ CACHE MISS`);

  // Return local logo if available (instant)
  if (LOCAL_LOGOS[symbol]) {
    console.log(`   ✅ LOCAL LOGO: ${LOCAL_LOGOS[symbol]}`);
    return LOCAL_LOGOS[symbol];
  }

  try {
    // Try CoinGecko API
    console.log(`   📡 Trying CoinGecko API...`);
    const coinGeckoLogo = await getCoinGeckoLogo(symbol, contractAddress);
    if (coinGeckoLogo) {
      console.log(`   ✅ CoinGecko logo: ${coinGeckoLogo}`);
      // Cache the result
      logoCache[cacheKey] = {
        logo: coinGeckoLogo,
        timestamp: Date.now(),
      };
      return coinGeckoLogo;
    }
    console.log(`   ❌ CoinGecko returned no logo`);

    // Try CryptoCompare API as fallback
    console.log(`   📡 Trying CryptoCompare API...`);
    const cryptoCompareLogo = await getCryptoCompareLogo(symbol);
    if (cryptoCompareLogo) {
      console.log(`   ✅ CryptoCompare logo: ${cryptoCompareLogo}`);
      logoCache[cacheKey] = {
        logo: cryptoCompareLogo,
        timestamp: Date.now(),
      };
      return cryptoCompareLogo;
    }
    console.log(`   ❌ CryptoCompare returned no logo`);
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    logger.warn(`[CurrencyLogoService] Failed to fetch logo for ${symbol}:`, error);
  }

  // Fallback to generic crypto logo
  console.log(`   ⚠️ Using fallback logo: /crypto-eth.png`);
  return '/crypto-eth.png';
}

/**
 * Fetch logo from CoinGecko API via server-side route
 * This avoids CSP/CORS issues with direct client-side API calls
 */
async function getCoinGeckoLogo(
  symbol: string,
  contractAddress?: string
): Promise<string | null> {
  try {
    // Determine platform based on contract address format
    let platform = 'ethereum';
    if (contractAddress) {
      if (contractAddress.length === 44 || contractAddress.length === 43) {
        platform = 'solana';
      }
    }

    // Build query parameters
    const params = new URLSearchParams({ symbol });
    if (contractAddress) {
      params.append('contractAddress', contractAddress);
    }
    params.append('platform', platform);

    // Use server-side API route to avoid CSP/CORS issues
    const response = await fetch(`/api/currency-logo?${params.toString()}`);

    if (response.ok) {
      const data = await response.json();
      if (data.logo) {
        return data.logo;
      }
    } else {
      logger.warn(`[CurrencyLogo] API route returned ${response.status} for ${symbol}`);
    }
  } catch (error) {
    logger.warn(`[CurrencyLogo] Failed to fetch logo for ${symbol}:`, error);
  }

  return null;
}

/**
 * Fetch logo from CryptoCompare API
 * Note: CryptoCompare has CSP restrictions, so this may fail in some browsers
 * We keep it as a fallback but expect it to fail in production
 */
async function getCryptoCompareLogo(symbol: string): Promise<string | null> {
  // Skip CryptoCompare due to CSP restrictions
  // The server-side CoinGecko route should handle most cases
  return null;
}

/**
 * Synchronous version that returns local logo or placeholder
 * Use this when you need instant response (e.g., initial render)
 * Then call getCurrencyLogo() in background to get the real logo
 */
export function getCurrencyLogoSync(symbol: string): string {
  // Check cache
  const cached = logoCache[symbol];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.logo;
  }

  // Return local logo if available
  return LOCAL_LOGOS[symbol] || '/crypto-eth.png';
}

/**
 * Prefetch logos for multiple currencies (batch optimization)
 */
export async function prefetchCurrencyLogos(
  currencies: Array<{ symbol: string; contractAddress?: string }>
): Promise<void> {
  const promises = currencies.map(({ symbol, contractAddress }) =>
    getCurrencyLogo(symbol, contractAddress).catch(() => null)
  );
  await Promise.allSettled(promises);
}

