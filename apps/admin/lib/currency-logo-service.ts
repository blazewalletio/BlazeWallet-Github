/**
 * 🎨 Currency Logo Service (UPDATED - CoinGecko Pro API)
 * 
 * Now uses our centralized CoinGecko Pro API with IndexedDB caching
 * for optimal performance and comprehensive coverage
 * 
 * Architecture:
 * - Uses TokenLogoCache (multi-layer: Memory → IndexedDB → Server)
 * - Server API proxy with CoinGecko Pro API
 * - Fallback to local logos for instant loading
 */

import { logger } from '@/lib/logger';
import { TokenLogoCache } from './token-logo-cache';

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

/**
 * Get currency logo dynamically using CoinGecko Pro API
 * @param symbol Token symbol (e.g., 'ETH', 'BTC', 'USDC')
 * @param contractAddress Contract address for ERC20/SPL tokens
 * @param chainKey Chain identifier (default: 'ethereum')
 * @returns Logo URL (local file, blob URL from cache, or placeholder)
 */
export async function getCurrencyLogo(
  symbol: string,
  contractAddress?: string,
  chainKey: string = 'ethereum'
): Promise<string> {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log(`\n🖼️ [CurrencyLogo] ${symbol} on ${chainKey} ${contractAddress ? `(${contractAddress.substring(0, 10)}...)` : ''}`);
  }

  // Return local logo if available (instant)
  if (LOCAL_LOGOS[symbol]) {
    if (isDev) console.log(`   ✅ Using local logo for ${symbol}`);
    return LOCAL_LOGOS[symbol];
  }

  // Use TokenLogoCache (multi-layer caching + CoinGecko Pro API)
  try {
    const address = contractAddress || '0x0000000000000000000000000000000000000000';
    
    const logoUrl = await TokenLogoCache.getTokenLogo(
      { symbol, address, chainKey },
      undefined // No logoURI - let API discover it
    );

    if (logoUrl) {
      if (isDev) console.log(`   ✅ Got logo from CoinGecko Pro API (cached)`);
      return logoUrl;
    }
  } catch (error) {
    if (isDev) {
      logger.warn(`⚠️ [CurrencyLogo] Error fetching logo for ${symbol}:`, error);
    }
  }

  // ⚠️ Fallback to generic placeholder
  if (isDev) console.log(`   ⚠️ Using placeholder for ${symbol}`);
  return '/crypto-placeholder.png';
}

/**
 * Synchronous version that returns local logo or placeholder
 * Use this when you need instant response (e.g., initial render)
 */
export function getCurrencyLogoSync(symbol: string): string {
  return LOCAL_LOGOS[symbol] || '/crypto-placeholder.png';
}

/**
 * Prefetch logos for multiple currencies (batch optimization)
 */
export async function prefetchCurrencyLogos(
  currencies: Array<{ symbol: string; contractAddress?: string; chainKey?: string }>
): Promise<void> {
  const promises = currencies.map(({ symbol, contractAddress, chainKey = 'ethereum' }) =>
    getCurrencyLogo(symbol, contractAddress, chainKey).catch(() => null)
  );
  await Promise.allSettled(promises);
}
