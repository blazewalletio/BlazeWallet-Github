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
      console.log(`🔍 [DexScreener] Fetching metadata for ${mint.substring(0, 8)}...`);
      
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`⚠️ [DexScreener] API returned ${response.status} for ${mint.substring(0, 8)}...`);
        return null;
      }

      const data = await response.json();

      // DexScreener returns pairs, we need to extract the base token
      if (!data.pairs || data.pairs.length === 0) {
        console.log(`ℹ️ [DexScreener] No trading pairs found for ${mint.substring(0, 8)}...`);
        return null;
      }

      // Get the pair with highest liquidity (most reliable data)
      const bestPair = data.pairs.reduce((best: any, current: any) => {
        const bestLiq = best.liquidity?.usd || 0;
        const currentLiq = current.liquidity?.usd || 0;
        return currentLiq > bestLiq ? current : best;
      }, data.pairs[0]);

      const token = bestPair.baseToken;
      
      // Verify it's the correct token (sometimes DexScreener returns quote token)
      if (token.address.toLowerCase() !== mint.toLowerCase()) {
        console.warn(`⚠️ [DexScreener] Token address mismatch for ${mint.substring(0, 8)}...`);
        return null;
      }

      const result: DexScreenerToken = {
        mint: token.address,
        name: token.name || 'Unknown Token',
        symbol: token.symbol || 'UNKNOWN',
        logoURI: bestPair.info?.imageUrl, // DexScreener has token images!
        priceUsd: parseFloat(bestPair.priceUsd || '0'),
        liquidity: bestPair.liquidity?.usd,
        volume24h: bestPair.volume?.h24,
        priceChange24h: bestPair.priceChange?.h24,
      };

      console.log(`✅ [DexScreener] Found ${result.symbol} (${result.name})`);
      
      return result;
    } catch (error) {
      console.error(`❌ [DexScreener] Failed to fetch ${mint.substring(0, 8)}...:`, error);
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
      console.log(`🧹 [DexScreener] Cleared cache for ${mint.substring(0, 8)}...`);
    } else {
      this.cache.clear();
      console.log('🧹 [DexScreener] Cleared all cache');
    }
  }
}

// Singleton instance
export const dexScreenerService = new DexScreenerService();

