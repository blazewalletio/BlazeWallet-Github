/**
 * 🦎 CoinGecko Token Metadata Service
 * 
 * Separate from price service - focuses on token metadata only
 * - Token name, symbol, logo
 * - Works for established tokens on exchanges
 * - Fallback for tokens not on DEXes
 * - Rate limit: 10-50 calls/minute (free tier)
 */

export interface CoinGeckoTokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  logoURI?: string;
  coingeckoId?: string;
}

class CoinGeckoTokenService {
  private cache = new Map<string, { data: CoinGeckoTokenMetadata | null; timestamp: number }>();
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours (metadata rarely changes)
  private pending = new Map<string, Promise<CoinGeckoTokenMetadata | null>>();

  /**
   * Get token metadata from CoinGecko
   */
  async getTokenMetadata(mint: string): Promise<CoinGeckoTokenMetadata | null> {
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

  private async fetchTokenMetadata(mint: string): Promise<CoinGeckoTokenMetadata | null> {
    try {
      console.log(`🦎 [CoinGecko] Fetching metadata for ${mint.substring(0, 8)}...`);
      
      // CoinGecko API endpoint for Solana tokens
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/solana/contract/${mint}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (response.status === 404) {
        console.log(`ℹ️ [CoinGecko] Token not found: ${mint.substring(0, 8)}...`);
        return null;
      }

      if (response.status === 429) {
        console.warn('⚠️ [CoinGecko] Rate limit hit, skipping...');
        return null;
      }

      if (!response.ok) {
        console.warn(`⚠️ [CoinGecko] API returned ${response.status} for ${mint.substring(0, 8)}...`);
        return null;
      }

      const data = await response.json();

      if (!data.id) {
        console.log(`ℹ️ [CoinGecko] No metadata for ${mint.substring(0, 8)}...`);
        return null;
      }

      const result: CoinGeckoTokenMetadata = {
        mint: mint,
        name: data.name || 'Unknown Token',
        symbol: (data.symbol || 'UNKNOWN').toUpperCase(),
        logoURI: data.image?.large || data.image?.small,
        coingeckoId: data.id,
      };

      console.log(`✅ [CoinGecko] Found ${result.symbol} (${result.name})`);
      
      return result;
    } catch (error: any) {
      // Don't log as error for 404s (expected for many tokens)
      if (error.status !== 404) {
        console.error(`❌ [CoinGecko] Failed to fetch ${mint.substring(0, 8)}...:`, error);
      }
      return null;
    }
  }

  /**
   * Clear cache for a specific token (for manual refresh)
   */
  clearCache(mint?: string) {
    if (mint) {
      this.cache.delete(mint);
      console.log(`🧹 [CoinGecko] Cleared cache for ${mint.substring(0, 8)}...`);
    } else {
      this.cache.clear();
      console.log('🧹 [CoinGecko] Cleared all cache');
    }
  }
}

// Singleton instance
export const coinGeckoTokenService = new CoinGeckoTokenService();

