/**
 * 🦎 CoinGecko Token Metadata Service
 * 
 * Separate from price service - focuses on token metadata only
 * - Token name, symbol, logo
 * - Works for established tokens on exchanges
 * - Fallback for tokens not on DEXes
 * - Rate limit: 10-50 calls/minute (free tier)
 */

import { logger } from '@/lib/logger';

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
      logger.log(`🦎 [CoinGecko] Fetching metadata for ${mint.substring(0, 8)}...`);
      
      // CoinGecko API endpoint for Solana tokens
      const apiKey = process.env.COINGECKO_API_KEY?.trim();
      const apiKeyParam = apiKey ? `?x_cg_demo_api_key=${apiKey}` : '';
      const url = `https://api.coingecko.com/api/v3/coins/solana/contract/${mint}${apiKeyParam}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 404) {
        logger.log(`ℹ️ [CoinGecko] Token not found: ${mint.substring(0, 8)}...`);
        return null;
      }

      if (response.status === 401) {
        logger.warn('⚠️ [CoinGecko] 401 Unauthorized - API key may be invalid or missing. Using free tier.');
        return null;
      }

      if (response.status === 429) {
        logger.warn('⚠️ [CoinGecko] Rate limit hit, skipping...');
        return null;
      }

      if (!response.ok) {
        logger.warn(`⚠️ [CoinGecko] API returned ${response.status} for ${mint.substring(0, 8)}...`);
        return null;
      }

      const data = await response.json();

      if (!data.id) {
        logger.log(`ℹ️ [CoinGecko] No metadata for ${mint.substring(0, 8)}...`);
        return null;
      }

      const result: CoinGeckoTokenMetadata = {
        mint: mint,
        name: data.name || 'Unknown Token',
        symbol: (data.symbol || 'UNKNOWN').toUpperCase(),
        logoURI: data.image?.large || data.image?.small,
        coingeckoId: data.id,
      };

      logger.log(`✅ [CoinGecko] Found ${result.symbol} (${result.name})`);
      
      return result;
    } catch (error: any) {
      // Don't log as error for 404s (expected for many tokens)
      if (error.status !== 404) {
        logger.error(`❌ [CoinGecko] Failed to fetch ${mint.substring(0, 8)}...:`, error);
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
      logger.log(`🧹 [CoinGecko] Cleared cache for ${mint.substring(0, 8)}...`);
    } else {
      this.cache.clear();
      logger.log('🧹 [CoinGecko] Cleared all cache');
    }
  }
}

// Singleton instance
export const coinGeckoTokenService = new CoinGeckoTokenService();

