/**
 * Portfolio Change Calculator
 * 
 * Calculates weighted average portfolio change based on:
 * - Native token value and change
 * - All token values and their individual changes
 * 
 * Formula: Σ(asset_value / total_value × asset_change%)
 */

import { logger } from './logger';

export interface TokenWithChange {
  balanceUSD?: string | number;
  change24h?: number;
}

/**
 * Calculate weighted average portfolio change
 * 
 * @param tokens - Array of tokens with balanceUSD and change24h
 * @param nativeBalance - Native token balance (in native units)
 * @param nativePrice - Native token price in USD
 * @param nativeChange - Native token 24h change percentage
 * @returns Weighted portfolio change percentage
 */
export function calculateWeightedPortfolioChange(
  tokens: TokenWithChange[],
  nativeBalance: number,
  nativePrice: number,
  nativeChange: number
): number {
  const nativeValue = nativeBalance * nativePrice;
  
  // Calculate total token value
  const tokensTotalValue = tokens.reduce(
    (sum, token) => sum + parseFloat(String(token.balanceUSD || '0')),
    0
  );
  
  const totalPortfolioValue = nativeValue + tokensTotalValue;
  
  // Avoid division by zero
  if (totalPortfolioValue === 0) {
    return 0;
  }
  
  // Calculate weighted change: Σ(asset_value / total_value × asset_change%)
  let weightedChange = 0;
  
  // Native token contribution
  const nativeWeight = nativeValue / totalPortfolioValue;
  weightedChange += nativeWeight * nativeChange;
  
  // Each token's contribution
  tokens.forEach(token => {
    const tokenValue = parseFloat(String(token.balanceUSD || '0'));
    const tokenWeight = tokenValue / totalPortfolioValue;
    const tokenChange = token.change24h || 0;
    weightedChange += tokenWeight * tokenChange;
  });
  
  if (process.env.NODE_ENV === 'development') {
    logger.log(`📊 Weighted portfolio change: ${weightedChange.toFixed(2)}% (native: ${(nativeWeight * 100).toFixed(1)}%, tokens: ${((1 - nativeWeight) * 100).toFixed(1)}%)`);
  }
  
  return weightedChange;
}

