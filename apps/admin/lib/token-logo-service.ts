/**
 * TokenLogoService - Duurzame oplossing voor token logo's
 * ✅ UPDATED: Uses server-side API proxy to bypass CORS!
 * 
 * Features:
 * - Server-side logo fetching (no CORS issues!)
 * - Logo caching voor snelheid
 * - Automatische fallback chain
 * - Chain-agnostic design
 */

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
   * ✅ PRIMARY: Server-side API proxy (no CORS!)
   * ✅ FALLBACK: Direct logoURI if provided
   */
  async getTokenLogo(token: TokenIdentifier, logoURI?: string): Promise<string | null> {
    const cacheKey = `${token.chainKey}:${token.address}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.url;
    }

    // ✅ PRIMARY: Use server-side API proxy (bypasses CORS!)
    try {
      const apiUrl = `/api/token-logo?address=${encodeURIComponent(token.address)}&chainKey=${encodeURIComponent(token.chainKey)}&symbol=${encodeURIComponent(token.symbol)}`;
      
      const response = await fetch(apiUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        // API proxy works! Use it as the logo URL
        this.cacheUrl(cacheKey, apiUrl);
        return apiUrl;
      }
    } catch (error) {
      console.warn('Server-side logo fetch failed:', error);
    }

    // ✅ FALLBACK 1: Try provided logoURI directly
    if (logoURI && !this.failedUrls.has(logoURI)) {
      const isValid = await this.validateImageUrl(logoURI);
      if (isValid) {
        this.cacheUrl(cacheKey, logoURI);
        return logoURI;
      }
      this.failedUrls.add(logoURI);
    }

    // No logo found
    return null;
  }

  /**
   * Validate if an image URL is accessible
   */
  private async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Cache a logo URL
   */
  private cacheUrl(key: string, url: string): void {
    this.cache.set(key, {
      url,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const TokenLogoService = new TokenLogoServiceClass();
