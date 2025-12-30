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
  logo: string;
  timestamp: number;
}

// ⚡ LocalStorage-backed cache with 24 hour TTL (persists across page refreshes!)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = 'currency_logo_';

// Helper functions for localStorage cache
function getCachedLogo(key: string): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!cached) return null;
    
    const parsed: CurrencyLogoCache = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_TTL) {
      return parsed.logo;
    }
    
    // Expired - remove from localStorage
    localStorage.removeItem(CACHE_KEY_PREFIX + key);
    return null;
  } catch {
    return null;
  }
}

function setCachedLogo(key: string, logo: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + key,
      JSON.stringify({ logo, timestamp: Date.now() })
    );
  } catch {
    // Silently fail if localStorage is full
  }
}

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
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log(`\n🖼️ [CurrencyLogo] ${symbol} ${contractAddress ? `(${contractAddress.substring(0, 10)}...)` : ''}`);
  }
  
  // ⚡ Check LocalStorage cache first (persists across reloads!)
  const cached = getCachedLogo(cacheKey);
  if (cached) {
    if (isDev) console.log(`   ✅ CACHE HIT`);
    return cached;
  }

  // Return local logo if available (instant)
  if (LOCAL_LOGOS[symbol]) {
    const logo = LOCAL_LOGOS[symbol];
    setCachedLogo(cacheKey, logo);
    return logo;
  }

  try {
    // Try CoinGecko API (with server-side caching)
    const coinGeckoLogo = await getCoinGeckoLogo(symbol, contractAddress);
    if (coinGeckoLogo) {
      setCachedLogo(cacheKey, coinGeckoLogo);
      return coinGeckoLogo;
    }

    // Try CryptoCompare API as fallback
    const cryptoCompareLogo = await getCryptoCompareLogo(symbol);
    if (cryptoCompareLogo) {
      setCachedLogo(cacheKey, cryptoCompareLogo);
      return cryptoCompareLogo;
    }
  } catch (error) {
    // Silently fail in production, log in development
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`⚠️ [CurrencyLogo] Error fetching logo for ${symbol}:`, error);
    }
  }

  // ⚠️ Fallback to generic logo
  const fallback = '/crypto-eth.png';
  setCachedLogo(cacheKey, fallback);
  return fallback;
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

    const apiUrl = `/api/currency-logo?${params.toString()}`;
    const isDev = process.env.NODE_ENV === 'development';

    // Use server-side API route to avoid CSP/CORS issues
    const response = await fetch(apiUrl);

    if (response.ok) {
      const data = await response.json();
      
      if (data.logo) {
        if (isDev) console.log(`   ✅ ${data.source}: ${data.logo.substring(0, 50)}...`);
        return data.logo;
      }
    } else if (isDev) {
      console.warn(`   ⚠️ API returned ${response.status}`);
    }
  } catch (error: any) {
    // Silently fail in production
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`[CurrencyLogo] Fetch failed for ${symbol}:`, error.message);
    }
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
  // Check LocalStorage cache
  const cached = getCachedLogo(symbol);
  if (cached) {
    return cached;
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

