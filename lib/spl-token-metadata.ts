/**
 * SPL Token Metadata Service
 * Hybrid approach: Hardcoded popular tokens + Jupiter API fallback
 */

export interface SPLTokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

/**
 * Top 10 Most Popular SPL Tokens (Hardcoded for reliability)
 * These will work even if Jupiter API is down
 */
export const POPULAR_SPL_TOKENS: Record<string, SPLTokenMetadata> = {
  // USDC - Most used stablecoin on Solana
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin',
  },
  // USDT - Tether
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    coingeckoId: 'tether',
  },
  // RAY - Raydium
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    coingeckoId: 'raydium',
  },
  // BONK - Bonk
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    coingeckoId: 'bonk',
  },
  // JUP - Jupiter
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png',
    coingeckoId: 'jupiter-exchange-solana',
  },
  // WIF - dogwifhat
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    logoURI: '/crypto-wif.png', // ✅ LOCAL FILE: No more IPFS issues!
    coingeckoId: 'dogwifcoin',
  },
  // JTO - Jito
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': {
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    symbol: 'JTO',
    name: 'Jito',
    decimals: 9,
    logoURI: 'https://metadata.jito.network/token/jto/image',
    coingeckoId: 'jito-governance-token',
  },
  // PYTH - Pyth Network
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    logoURI: 'https://pyth.network/token.svg',
    coingeckoId: 'pyth-network',
  },
  // ORCA - Orca
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': {
    mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    symbol: 'ORCA',
    name: 'Orca',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
    coingeckoId: 'orca',
  },
  // MNGO - Mango
  'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac': {
    mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
    symbol: 'MNGO',
    name: 'Mango',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/logo.png',
    coingeckoId: 'mango-markets',
  },
};

/**
 * Jupiter Token List Cache
 * We fetch this once and cache it for the session
 */
class JupiterTokenCache {
  private cache: Map<string, SPLTokenMetadata> | null = null;
  private cacheTime: number = 0;
  private cacheDuration = 3600000; // 1 hour cache

  async getTokenList(): Promise<Map<string, SPLTokenMetadata>> {
    // Return cached data if still valid
    if (this.cache && Date.now() - this.cacheTime < this.cacheDuration) {
      return this.cache;
    }

    try {
      console.log('🔍 [SPLTokenMetadata] Fetching Jupiter token list...');
      
      // ✅ FIX: Use server-side API proxy to avoid CORS/DNS issues
      // This fetches ALL tokens (~15,000) for comprehensive coverage
      const response = await fetch('/api/jupiter-tokens', {
        // Client-side fetch with cache
        cache: 'default',
      });
      
      if (!response.ok) {
        throw new Error(`Jupiter API proxy error: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle error response format
      if (data.error) {
        throw new Error(data.message || 'Jupiter API returned error');
      }
      
      // Handle both direct array and wrapped response
      const tokens: any[] = Array.isArray(data) ? data : (data.tokens || []);
      
      console.log(`🪐 [SPLTokenMetadata] Loaded ${tokens.length} tokens from Jupiter API`);
      
      // Convert to Map for fast lookup
      const tokenMap = new Map<string, SPLTokenMetadata>();
      
      tokens.forEach((token) => {
        if (token.address) {
          tokenMap.set(token.address, {
            mint: token.address,
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || 'Unknown Token',
            decimals: token.decimals || 9,
            logoURI: token.logoURI,
            coingeckoId: token.extensions?.coingeckoId,
          });
        }
      });

      this.cache = tokenMap;
      this.cacheTime = Date.now();
      
      console.log(`✅ [SPLTokenMetadata] Cached ${tokenMap.size} tokens from Jupiter`);
      
      return tokenMap;
    } catch (error) {
      console.error('❌ [SPLTokenMetadata] Failed to fetch Jupiter token list:', error);
      
      // Return empty map if fetch fails
      if (!this.cache) {
        this.cache = new Map();
      }
      
      return this.cache;
    }
  }

  clearCache() {
    this.cache = null;
    this.cacheTime = 0;
  }
}

const jupiterCache = new JupiterTokenCache();

/**
 * Get metadata for an SPL token
 * Uses hybrid approach: Hardcoded → Jupiter API → Fallback
 */
export async function getSPLTokenMetadata(mint: string): Promise<SPLTokenMetadata> {
  // Try 1: Check hardcoded popular tokens (instant)
  if (POPULAR_SPL_TOKENS[mint]) {
    console.log(`💎 [SPLTokenMetadata] Found ${mint} in popular tokens`);
    return POPULAR_SPL_TOKENS[mint];
  }

  // Try 2: Check Jupiter API cache
  try {
    const jupiterTokens = await jupiterCache.getTokenList();
    const jupiterToken = jupiterTokens.get(mint);
    
    if (jupiterToken) {
      console.log(`🪐 [SPLTokenMetadata] Found ${mint} in Jupiter API:`, {
        symbol: jupiterToken.symbol,
        name: jupiterToken.name,
        logoURI: jupiterToken.logoURI
      });
      return jupiterToken;
    } else {
      // ✅ Debug: Token NOT found in Jupiter API
      console.warn(`⚠️ [SPLTokenMetadata] Token ${mint} NOT FOUND in Jupiter API (${jupiterTokens.size} tokens loaded)`);
    }
  } catch (error) {
    console.warn(`⚠️ [SPLTokenMetadata] Jupiter API failed for ${mint}`, error);
  }

  // Fallback: Return basic metadata with mint address
  console.log(`⚠️ [SPLTokenMetadata] Unknown token ${mint}, using fallback`);
  return {
    mint,
    symbol: mint.slice(0, 4) + '...' + mint.slice(-4), // Shortened mint as symbol
    name: 'Unknown Token',
    decimals: 9, // Default Solana decimals
  };
}

/**
 * Get metadata for multiple SPL tokens (batch optimized)
 */
export async function getMultipleSPLTokenMetadata(
  mints: string[]
): Promise<Map<string, SPLTokenMetadata>> {
  const result = new Map<string, SPLTokenMetadata>();

  // Load Jupiter cache once for all tokens
  const jupiterTokens = await jupiterCache.getTokenList();

  for (const mint of mints) {
    // Try hardcoded first
    if (POPULAR_SPL_TOKENS[mint]) {
      result.set(mint, POPULAR_SPL_TOKENS[mint]);
      continue;
    }

    // Try Jupiter cache
    const jupiterToken = jupiterTokens.get(mint);
    if (jupiterToken) {
      result.set(mint, jupiterToken);
      continue;
    }

    // Fallback
    result.set(mint, {
      mint,
      symbol: mint.slice(0, 4) + '...' + mint.slice(-4),
      name: 'Unknown Token',
      decimals: 9,
    });
  }

  return result;
}

/**
 * Clear Jupiter cache (useful for manual refresh)
 */
export function clearSPLTokenCache() {
  jupiterCache.clearCache();
}

