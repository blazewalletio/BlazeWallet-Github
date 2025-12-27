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

/**
 * Convert timeframe to days
 */
function timeframeToDays(timeframe: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'): number {
  switch (timeframe) {
    case 'LIVE': return 2 / 24; // ✅ FIXED: 2 hours (not 12 hours) for true live view
    case '1D': return 1;
    case '7D': return 7;
    case '30D': return 30;
    case '1J': return 365;
    case 'ALLES': return 365 * 5; // 5 years max
    default: return 7;
  }
}

/**
 * Find closest price point to a given timestamp
 */
function findClosestPrice(
  prices: PriceDataPoint[],
  targetTimestamp: number
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
  
  // Only return if within 24 hours
  if (minDiff < 24 * 60 * 60 * 1000) {
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
    logger.log(`📊 [Portfolio Reconstruction] Fetching price histories...`);
    
    const pricePromises = [
      // Native token (always first)
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
    
    // ✅ REMOVED: No interpolation - use only real API data
    // Interpolation generates fake data that doesn't match reality
    // If we have few points, that's OK - we'll use what we have
    const pricePointsToUse = nativeHistory.prices;
    
    if (pricePointsToUse.length < 2) {
      logger.warn(`⚠️ [Portfolio Reconstruction] Only ${pricePointsToUse.length} price points available - may result in limited chart data`);
    }
    
    for (const nativePoint of pricePointsToUse) {
      // Skip if before start time
      if (nativePoint.timestamp < startTime) continue;
      
      // Start with native token value
      let totalValue = nativeBalanceNum * nativePoint.price;
      
      // Add token values
      tokens.forEach((token, index) => {
        const tokenHistory = priceHistories[index + 1];
        if (tokenHistory.success && tokenHistory.prices.length > 0) {
          const closestPrice = findClosestPrice(tokenHistory.prices, nativePoint.timestamp);
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

