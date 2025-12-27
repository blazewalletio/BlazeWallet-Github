/**
 * 🔥 Portfolio History Reconstruction
 * 
 * Reconstructs portfolio balance history using:
 * - Current token holdings
 * - Historical token prices (CoinGecko/DexScreener)
 * 
 * Works exactly like Bitvavo: shows portfolio value over time
 * based on what you currently hold, not what you held in the past.
 */

import { Token } from '@/lib/types';
import { getTokenPriceHistory, PriceDataPoint } from '@/lib/token-price-history';
import { logger } from '@/lib/logger';
import { BalanceSnapshot } from '@/lib/portfolio-history';
import { CHAINS } from '@/lib/chains';

/**
 * Get CoinGecko ID for native token based on chain
 * ✅ IMPROVED: Chain-specific native token detection
 */
function getNativeTokenCoinGeckoId(chain: string, nativeSymbol: string): string {
  const chainLower = chain.toLowerCase();
  
  // Chain-specific mappings (prioritize chain over symbol)
  const chainToCoinGeckoId: Record<string, string> = {
    'ethereum': 'ethereum',
    'solana': 'solana',
    'polygon': 'polygon',
    'bsc': 'binancecoin',
    'binance-smart-chain': 'binancecoin',
    'arbitrum': 'arbitrum',
    'base': 'base',
    'optimism': 'optimism',
    'avalanche': 'avalanche-2',
    'fantom': 'fantom',
    'cronos': 'crypto-com-chain',
    'bitcoin': 'bitcoin',
    'litecoin': 'litecoin',
    'dogecoin': 'dogecoin',
    'bitcoincash': 'bitcoin-cash',
  };
  
  // Try chain-based lookup first
  if (chainToCoinGeckoId[chainLower]) {
    return chainToCoinGeckoId[chainLower];
  }
  
  // Fallback to symbol-based lookup
  const symbolToCoinGeckoId: Record<string, string> = {
    'ETH': 'ethereum',
    'SOL': 'solana',
    'MATIC': 'polygon',
    'BNB': 'binancecoin',
    'ARB': 'arbitrum',
    'BASE': 'base',
    'OP': 'optimism',
    'AVAX': 'avalanche-2',
    'FTM': 'fantom',
    'CRO': 'crypto-com-chain',
    'BTC': 'bitcoin',
    'LTC': 'litecoin',
    'DOGE': 'dogecoin',
    'BCH': 'bitcoin-cash',
  };
  
  return symbolToCoinGeckoId[nativeSymbol.toUpperCase()] || nativeSymbol.toLowerCase();
}

/**
 * Convert timeframe to days
 * ✅ IMPROVED: LIVE uses only last 10 minutes (not 12 hours)
 */
function timeframeToDays(timeframe: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'): number {
  switch (timeframe) {
    case 'LIVE': return 0.007; // ~10 minutes (for price history fetch, but we'll only use last few points)
    case '1D': return 1;
    case '7D': return 7;
    case '30D': return 30;
    case '1J': return 365;
    case 'ALLES': return 365 * 5; // 5 years max
    default: return 7;
  }
}

/**
 * Get tolerance for findClosestPrice based on timeframe
 * ✅ IMPROVED: Timeframe-specific tolerances for better accuracy
 */
function getPriceTolerance(timeframe: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'): number {
  switch (timeframe) {
    case 'LIVE': return 1 * 60 * 1000; // 1 minute
    case '1D': return 5 * 60 * 1000; // 5 minutes
    case '7D': return 60 * 60 * 1000; // 1 hour
    case '30D': return 60 * 60 * 1000; // 1 hour
    case '1J': return 24 * 60 * 60 * 1000; // 24 hours
    case 'ALLES': return 24 * 60 * 60 * 1000; // 24 hours
    default: return 60 * 60 * 1000; // 1 hour
  }
}

/**
 * Find closest price point to a given timestamp
 * ✅ IMPROVED: Uses timeframe-specific tolerance for better accuracy
 */
function findClosestPrice(
  prices: PriceDataPoint[],
  targetTimestamp: number,
  tolerance: number
): PriceDataPoint | null {
  if (prices.length === 0) return null;
  
  // Binary search for closest timestamp
  let left = 0;
  let right = prices.length - 1;
  let closest = prices[0];
  let minDiff = Math.abs(prices[0].timestamp - targetTimestamp);
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const diff = Math.abs(prices[mid].timestamp - targetTimestamp);
    
    if (diff < minDiff) {
      minDiff = diff;
      closest = prices[mid];
    }
    
    if (prices[mid].timestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // Only return if within tolerance (timeframe-specific)
  if (minDiff < tolerance) {
    return closest;
  }
  
  return null;
}

/**
 * Reconstruct portfolio history from current holdings + historical prices
 * 
 * This works exactly like Bitvavo:
 * - Uses current token balances
 * - Applies historical prices to calculate portfolio value over time
 * - Shows what your current holdings would have been worth in the past
 */
export async function reconstructPortfolioHistory(
  tokens: Token[],
  nativeBalance: string,
  nativeSymbol: string,
  chain: string,
  timeframe: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES',
  firstTransactionTimestamp?: number
): Promise<BalanceSnapshot[]> {
  try {
    logger.log(`📊 [Portfolio Reconstruction] Starting for ${tokens.length} tokens, timeframe: ${timeframe}`);
    
    const days = timeframeToDays(timeframe);
    const now = Date.now();
    const startTime = firstTransactionTimestamp 
      ? Math.max(firstTransactionTimestamp, now - days * 24 * 60 * 60 * 1000)
      : now - days * 24 * 60 * 60 * 1000;
    
    // 1. Fetch historical prices for native token and all tokens (parallel)
    logger.log(`📊 [Portfolio Reconstruction] Fetching price histories for chain: ${chain}, native: ${nativeSymbol}...`);
    
    // ✅ IMPROVED: Use CoinGecko ID for native token (better detection)
    // For native tokens, we want to use CoinGecko directly (not contract address)
    const nativeCoinGeckoId = getNativeTokenCoinGeckoId(chain, nativeSymbol);
    logger.log(`📊 [Portfolio Reconstruction] Native token CoinGecko ID: ${nativeCoinGeckoId}`);
    
    const pricePromises = [
      // Native token (always first) - use symbol with chain for better detection
      getTokenPriceHistory(nativeSymbol, days, undefined, chain),
      // All tokens
      ...tokens.map(token => 
        getTokenPriceHistory(token.symbol, days, token.address, chain)
      )
    ];
    
    const priceHistories = await Promise.all(pricePromises);
    const nativeHistory = priceHistories[0];
    
    if (!nativeHistory.success || nativeHistory.prices.length === 0) {
      logger.warn(`⚠️ [Portfolio Reconstruction] No native price history available`);
      return [];
    }
    
    logger.log(`✅ [Portfolio Reconstruction] Got ${nativeHistory.prices.length} native price points`);
    
    // 2. Reconstruct portfolio value for each timestamp
    const portfolioPoints: BalanceSnapshot[] = [];
    const nativeBalanceNum = parseFloat(nativeBalance || '0');
    
    // ✅ IMPROVED: Use CoinGecko's exact data - no interpolation needed
    // CoinGecko already provides optimal granularity:
    // - 1D: ~288 points (5-minute intervals)
    // - 7D/30D: hourly intervals
    // - 1J/ALLES: daily intervals
    let pricePointsToUse = nativeHistory.prices;
    
    // ✅ For LIVE timeframe: only use last 10 minutes of data
    if (timeframe === 'LIVE') {
      const tenMinutesAgo = now - 10 * 60 * 1000;
      pricePointsToUse = pricePointsToUse.filter(p => p.timestamp >= tenMinutesAgo);
      logger.log(`📊 [Portfolio Reconstruction] LIVE mode: using last ${pricePointsToUse.length} points (last 10 minutes)`);
    }
    
    for (const nativePoint of pricePointsToUse) {
      // Skip if before start time
      if (nativePoint.timestamp < startTime) continue;
      
      // Start with native token value
      let totalValue = nativeBalanceNum * nativePoint.price;
      
      // Add token values
      const tolerance = getPriceTolerance(timeframe);
      tokens.forEach((token, index) => {
        const tokenHistory = priceHistories[index + 1];
        if (tokenHistory.success && tokenHistory.prices.length > 0) {
          const closestPrice = findClosestPrice(tokenHistory.prices, nativePoint.timestamp, tolerance);
          if (closestPrice) {
            const tokenBalance = parseFloat(token.balance || '0');
            totalValue += tokenBalance * closestPrice.price;
          }
        }
      });
      
      portfolioPoints.push({
        timestamp: nativePoint.timestamp,
        balance: totalValue,
        address: '', // Not needed for chart
        chain: chain
      });
    }
    
    // Add current balance as final point if needed
    if (portfolioPoints.length > 0) {
      const lastPoint = portfolioPoints[portfolioPoints.length - 1];
      const lastNativePrice = nativeHistory.prices[nativeHistory.prices.length - 1];
      
      // Calculate current total
      let currentTotal = nativeBalanceNum * lastNativePrice.price;
      tokens.forEach((token, index) => {
        const tokenHistory = priceHistories[index + 1];
        if (tokenHistory.success && tokenHistory.prices.length > 0) {
          const lastTokenPrice = tokenHistory.prices[tokenHistory.prices.length - 1];
          currentTotal += parseFloat(token.balance || '0') * lastTokenPrice.price;
        }
      });
      
      // Only add if significantly different or if last point is old
      if (Math.abs(currentTotal - lastPoint.balance) > 0.01 || (now - lastPoint.timestamp) > 60000) {
        portfolioPoints.push({
          timestamp: now,
          balance: currentTotal,
          address: '',
          chain: chain
        });
      }
    } else {
      // No data - add current point
      const lastNativePrice = nativeHistory.prices[nativeHistory.prices.length - 1];
      let currentTotal = nativeBalanceNum * lastNativePrice.price;
      tokens.forEach((token, index) => {
        const tokenHistory = priceHistories[index + 1];
        if (tokenHistory.success && tokenHistory.prices.length > 0) {
          const lastTokenPrice = tokenHistory.prices[tokenHistory.prices.length - 1];
          currentTotal += parseFloat(token.balance || '0') * lastTokenPrice.price;
        }
      });
      
      portfolioPoints.push({
        timestamp: now,
        balance: currentTotal,
        address: '',
        chain: chain
      });
    }
    
    logger.log(`✅ [Portfolio Reconstruction] Generated ${portfolioPoints.length} portfolio points`);
    
    // Ensure we have at least 2 points for a line (if only 1 point, duplicate it with slight time offset)
    if (portfolioPoints.length === 1) {
      const singlePoint = portfolioPoints[0];
      portfolioPoints.unshift({
        timestamp: singlePoint.timestamp - 3600000, // 1 hour before
        balance: singlePoint.balance,
        address: '',
        chain: chain
      });
      logger.log(`📊 [Portfolio Reconstruction] Added duplicate point for line rendering`);
    }
    
    return portfolioPoints;
    
  } catch (error) {
    logger.error('❌ [Portfolio Reconstruction] Failed:', error);
    return [];
  }
}

