/**
 * 🔥 DexScreener API Service
 * 
 * DexScreener aggregates data from ALL Solana DEXes (Raydium, Orca, etc.)
 * - Real-time token metadata
 * - Works for Token-2022 and legacy SPL tokens
 * - Includes price, liquidity, volume data
 * - No API key needed for basic usage
 * - Rate limit: ~300 req/min (we cache aggressively)
 */

import { logger } from '@/lib/logger';

export interface DexScreenerToken {
  name: string;
  symbol: string;
  mint: string;
  logoURI?: string;
  priceUsd?: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
}

class DexScreenerService {
  private cache = new Map<string, { data: DexScreenerToken | null; timestamp: number }>();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes (prices change fast!)
  private pending = new Map<string, Promise<DexScreenerToken | null>>();

  /**
   * Get token metadata from DexScreener
   * Returns null if token not found or error occurs
   */
  async getTokenMetadata(mint: string): Promise<DexScreenerToken | null> {
    // Check cache first
    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    // Prevent duplicate requests
    if (this.pending.has(mint)) {
      return this.pending.get(mint)!;
    }

    const promise = this.fetchTokenMetadata(mint);
    this.pending.set(mint, promise);

    try {
      const result = await promise;
      this.cache.set(mint, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      this.pending.delete(mint);
    }
  }

  private async fetchTokenMetadata(mint: string): Promise<DexScreenerToken | null> {
    try {
      console.log(`\n🔍 [DexScreener] Fetching metadata...`);
      console.log(`   Address: ${mint}`);
      logger.log(`🔍 [DexScreener] Fetching metadata for ${mint.substring(0, 8)}...`);
      
      const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
      console.log(`   URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log(`   Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.error(`   ❌ API error: ${response.status}`);
        logger.warn(`⚠️ [DexScreener] API returned ${response.status} for ${mint.substring(0, 8)}...`);
        return null;
      }

      const data = await response.json();
      console.log(`   ✅ Response received`);
      console.log(`   Pairs found: ${data.pairs?.length || 0}`);

      // DexScreener returns pairs, we need to extract the base token
      if (!data.pairs || data.pairs.length === 0) {
        console.log(`   ❌ No trading pairs found`);
        logger.log(`ℹ️ [DexScreener] No trading pairs found for ${mint.substring(0, 8)}...`);
        return null;
      }

      // ✅ FIX: First filter pairs where the requested token is the BASE token
      // This prevents selecting pairs where our token is the quote token (e.g., LDO/PENDLE pair)
      const mintLower = mint.toLowerCase();
      const validPairs = data.pairs.filter((pair: any) => {
        const baseAddress = pair.baseToken?.address?.toLowerCase();
        return baseAddress === mintLower;
      });

      console.log(`   Total pairs: ${data.pairs.length}`);
      console.log(`   Pairs with ${mint.substring(0, 10)}... as base: ${validPairs.length}`);

      if (validPairs.length === 0) {
        console.log(`   ⚠️ No pairs found where token is base token, trying all pairs...`);
        // Fallback: if no pairs have our token as base, use all pairs (might be quote token)
        const fallbackPair = data.pairs.reduce((best: any, current: any) => {
          const bestLiq = best.liquidity?.usd || 0;
          const currentLiq = current.liquidity?.usd || 0;
          return currentLiq > bestLiq ? current : best;
        }, data.pairs[0]);
        
        // Check if quote token matches
        const quoteAddress = fallbackPair.quoteToken?.address?.toLowerCase();
        if (quoteAddress === mintLower) {
          console.log(`   ✅ Found as quote token, using reverse price`);
          // If it's the quote token, we need to invert the price
          const priceUsd = parseFloat(fallbackPair.priceUsd || '0');
          const invertedPrice = priceUsd > 0 ? 1 / priceUsd : 0;
          
          return {
            mint: mint,
            name: fallbackPair.quoteToken?.name || 'Unknown Token',
            symbol: fallbackPair.quoteToken?.symbol || 'UNKNOWN',
            logoURI: fallbackPair.info?.imageUrl || fallbackPair.quoteToken?.imageUrl,
            priceUsd: invertedPrice,
            liquidity: fallbackPair.liquidity?.usd,
            volume24h: fallbackPair.volume?.h24,
            priceChange24h: fallbackPair.priceChange?.h24 ? -fallbackPair.priceChange.h24 : 0, // Invert change
          };
        }
        
        console.log(`   ❌ Token not found as base or quote token`);
        return null;
      }

      // Get the pair with highest liquidity from valid pairs (where our token is base)
      const bestPair = validPairs.reduce((best: any, current: any) => {
        const bestLiq = best.liquidity?.usd || 0;
        const currentLiq = current.liquidity?.usd || 0;
        return currentLiq > bestLiq ? current : best;
      }, validPairs[0]);

      console.log(`   Best pair liquidity: $${bestPair.liquidity?.usd || 0}`);
      console.log(`   Best pair price: $${bestPair.priceUsd || 'N/A'}`);

      const token = bestPair.baseToken;
      console.log(`   Base token address: ${token.address}`);
      console.log(`   Base token symbol: ${token.symbol}`);
      console.log(`   Image URL: ${bestPair.info?.imageUrl || bestPair.baseToken?.imageUrl || 'N/A'}`);

      const priceUsd = parseFloat(bestPair.priceUsd || '0');
      const result: DexScreenerToken = {
        mint: token.address,
        name: token.name || 'Unknown Token',
        symbol: token.symbol || 'UNKNOWN',
        logoURI: bestPair.info?.imageUrl || bestPair.baseToken?.imageUrl, // Try both locations
        priceUsd: priceUsd,
        liquidity: bestPair.liquidity?.usd,
        volume24h: bestPair.volume?.h24,
        priceChange24h: bestPair.priceChange?.h24,
      };

      console.log(`   ✅ Result: ${result.symbol} = $${priceUsd.toFixed(8)}`);
      if (result.logoURI) {
        console.log(`   ✅ Logo: ${result.logoURI}`);
      } else {
        console.log(`   ❌ No logo found`);
      }
      
      logger.log(`✅ [DexScreener] Found ${result.symbol} (${result.name})`);
      
      return result;
    } catch (error) {
      console.error(`   ❌ Error:`, error);
      logger.error(`❌ [DexScreener] Failed to fetch ${mint.substring(0, 8)}...:`, error);
      return null;
    }
  }

  /**
   * Batch fetch multiple tokens (with rate limiting)
   */
  async getMultipleTokens(mints: string[]): Promise<Map<string, DexScreenerToken | null>> {
    const results = new Map<string, DexScreenerToken | null>();
    
    // DexScreener doesn't support batch requests, so we do them sequentially
    // with a small delay to avoid rate limits
    for (const mint of mints) {
      const metadata = await this.getTokenMetadata(mint);
      results.set(mint, metadata);
      
      // Small delay between requests (300 req/min = 200ms between requests)
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    return results;
  }

  /**
   * Clear cache for a specific token (for manual refresh)
   */
  clearCache(mint?: string) {
    if (mint) {
      this.cache.delete(mint);
      logger.log(`🧹 [DexScreener] Cleared cache for ${mint.substring(0, 8)}...`);
    } else {
      this.cache.clear();
      logger.log('🧹 [DexScreener] Cleared all cache');
    }
  }
}

// Singleton instance
export const dexScreenerService = new DexScreenerService();

