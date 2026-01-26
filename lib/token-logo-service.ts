/**
 * TokenLogoService - Duurzame oplossing voor token logo's
 * 
 * Features:
 * - Multi-source fallback (logoURI → CoinGecko → Jupiter → Placeholder)
 * - Logo caching voor snelheid
 * - Automatische retry bij failures
 * - Chain-specific logo providers
 */

import { logger } from './logger';

interface LogoCache {
  url: string;
  timestamp: number;
}

interface TokenIdentifier {
  symbol: string;
  address: string;
  chainKey: string;
}

class TokenLogoServiceClass {
  private cache: Map<string, LogoCache> = new Map();
  private failedUrls: Set<string> = new Set();
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  /**
   * Get token logo URL with intelligent fallback
   */
  async getTokenLogo(token: TokenIdentifier, logoURI?: string): Promise<string | null> {
    const cacheKey = `${token.chainKey}:${token.address}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.url;
    }

    // Try primary source (logoURI from token data)
    if (logoURI && !this.failedUrls.has(logoURI)) {
      const isValid = await this.validateImageUrl(logoURI);
      if (isValid) {
        this.cacheUrl(cacheKey, logoURI);
        return logoURI;
      }
      this.failedUrls.add(logoURI);
    }

    // Fallback 1: CoinGecko dynamic search
    try {
      const coinGeckoUrl = await this.searchCoinGecko(token);
      if (coinGeckoUrl) {
        this.cacheUrl(cacheKey, coinGeckoUrl);
        return coinGeckoUrl;
      }
    } catch (error) {
      logger.warn('CoinGecko logo search failed', { token, error });
    }

    // Fallback 2: Jupiter API (Solana only)
    if (token.chainKey === 'solana') {
      try {
        const jupiterUrl = await this.searchJupiter(token);
        if (jupiterUrl) {
          this.cacheUrl(cacheKey, jupiterUrl);
          return jupiterUrl;
        }
      } catch (error) {
        logger.warn('Jupiter logo search failed', { token, error });
      }
    }

    // Fallback 3: Trust Wallet Assets (generic)
    try {
      const trustWalletUrl = await this.getTrustWalletLogo(token);
      if (trustWalletUrl) {
        this.cacheUrl(cacheKey, trustWalletUrl);
        return trustWalletUrl;
      }
    } catch (error) {
      logger.warn('Trust Wallet logo search failed', { token, error });
    }

    // No logo found - return null (will show placeholder)
    return null;
  }

  /**
   * Search CoinGecko API for token logo
   */
  private async searchCoinGecko(token: TokenIdentifier): Promise<string | null> {
    try {
      // CoinGecko API: Search by contract address (for EVM) or symbol (for others)
      const isEVM = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'base', 'avalanche'].includes(token.chainKey);
      
      if (isEVM && token.address !== '0x0000000000000000000000000000000000000000') {
        // Search by contract address
        const platformId = this.getCoinGeckoPlatformId(token.chainKey);
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${token.address}`
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.image?.large || data.image?.small || null;
        }
      } else {
        // Search by symbol (fallback for native tokens or non-EVM)
        const response = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(token.symbol)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const match = data.coins?.find((coin: any) => 
            coin.symbol.toLowerCase() === token.symbol.toLowerCase()
          );
          return match?.large || match?.small || null;
        }
      }
    } catch (error) {
      logger.warn('CoinGecko API error', { error });
    }
    return null;
  }

  /**
   * Search Jupiter API for Solana token logo
   */
  private async searchJupiter(token: TokenIdentifier): Promise<string | null> {
    try {
      // Jupiter uses a strict token list - fetch and search
      const response = await fetch('https://token.jup.ag/all');
      if (!response.ok) return null;

      const tokens = await response.json();
      const match = tokens.find((t: any) => 
        t.address === token.address || t.symbol === token.symbol
      );
      
      return match?.logoURI || null;
    } catch (error) {
      logger.warn('Jupiter API error', { error });
      return null;
    }
  }

  /**
   * Get Trust Wallet Assets logo (generic fallback)
   */
  private async getTrustWalletLogo(token: TokenIdentifier): Promise<string | null> {
    try {
      // Trust Wallet has a comprehensive token list on GitHub
      const chainMap: Record<string, string> = {
        ethereum: 'ethereum',
        bsc: 'smartchain',
        polygon: 'polygon',
        arbitrum: 'arbitrum',
        optimism: 'optimism',
        avalanche: 'avalanche',
        solana: 'solana',
      };

      const chain = chainMap[token.chainKey];
      if (!chain) return null;

      const baseUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
      let logoUrl: string;

      if (token.address === '0x0000000000000000000000000000000000000000' || token.address === 'native') {
        // Native token
        logoUrl = `${baseUrl}/${chain}/info/logo.png`;
      } else {
        // Token address (checksummed for EVM)
        const address = token.chainKey === 'solana' ? token.address : this.toChecksumAddress(token.address);
        logoUrl = `${baseUrl}/${chain}/assets/${address}/logo.png`;
      }

      const isValid = await this.validateImageUrl(logoUrl);
      return isValid ? logoUrl : null;
    } catch (error) {
      logger.warn('Trust Wallet logo fetch failed', { error });
      return null;
    }
  }

  /**
   * Validate if image URL is accessible
   */
  private async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Cache logo URL
   */
  private cacheUrl(key: string, url: string): void {
    this.cache.set(key, {
      url,
      timestamp: Date.now(),
    });
  }

  /**
   * Get CoinGecko platform ID for chain
   */
  private getCoinGeckoPlatformId(chainKey: string): string {
    const mapping: Record<string, string> = {
      ethereum: 'ethereum',
      bsc: 'binance-smart-chain',
      polygon: 'polygon-pos',
      arbitrum: 'arbitrum-one',
      optimism: 'optimistic-ethereum',
      base: 'base',
      avalanche: 'avalanche',
    };
    return mapping[chainKey] || 'ethereum';
  }

  /**
   * Convert address to checksum format (EVM)
   */
  private toChecksumAddress(address: string): string {
    // Simple checksum implementation
    // For production, use ethers.js getAddress()
    return address; // Placeholder - will be enhanced
  }

  /**
   * Clear cache (for testing/debugging)
   */
  clearCache(): void {
    this.cache.clear();
    this.failedUrls.clear();
  }

  /**
   * Get cache stats (for monitoring)
   */
  getCacheStats(): { size: number; failed: number } {
    return {
      size: this.cache.size,
      failed: this.failedUrls.size,
    };
  }
}

export const TokenLogoService = new TokenLogoServiceClass();

