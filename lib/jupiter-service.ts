/**
 * Jupiter Token List Service
 * 
 * Fetches Solana SPL token metadata including logos from Jupiter aggregator
 * Jupiter maintains a curated list of verified Solana tokens
 */

export interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
  extensions?: {
    coingeckoId?: string;
  };
}

export class JupiterService {
  private static tokenListCache: JupiterToken[] | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  // Solana native token address (wrapped SOL)
  private static NATIVE_SOL_ADDRESS = 'So11111111111111111111111111111111111111112';

  /**
   * Check if address is native SOL (wrapped)
   */
  static isNativeSOL(address: string): boolean {
    return address === this.NATIVE_SOL_ADDRESS || address.toLowerCase() === 'native' || address === 'sol';
  }

  /**
   * Get native SOL address (wrapped)
   */
  static getNativeSOLAddress(): string {
    return this.NATIVE_SOL_ADDRESS;
  }

  /**
   * Fetch all Solana tokens from Jupiter
   * Uses 'strict' list (verified tokens only)
   */
  static async getTokenList(): Promise<JupiterToken[]> {
    // Check cache
    const now = Date.now();
    if (this.tokenListCache && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
      return this.tokenListCache;
    }

    try {
      // Using official Solana Token List Registry (maintained by Solana Labs)
      const response = await fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json');
      
      if (!response.ok) {
        throw new Error(`Solana Token List API error: ${response.status}`);
      }

      const data = await response.json();
      const tokens: JupiterToken[] = data.tokens || [];
      
      // Update cache
      this.tokenListCache = tokens;
      this.cacheTimestamp = now;
      
      return tokens;
    } catch (error) {
      console.error('[JupiterService] Failed to fetch token list:', error);
      
      // Return cached data if available, even if expired
      if (this.tokenListCache) {
        return this.tokenListCache;
      }
      
      return [];
    }
  }

  /**
   * Get a specific token by address
   */
  static async getToken(address: string): Promise<JupiterToken | null> {
    const tokens = await this.getTokenList();
    return tokens.find(t => t.address === address) || null;
  }

  /**
   * Get token logo URL by address
   * Returns null if token not found or no logo available
   */
  static async getTokenLogo(address: string): Promise<string | null> {
    const token = await this.getToken(address);
    return token?.logoURI || null;
  }

  /**
   * Get logos for multiple tokens (batch)
   * Returns a map of address -> logoURI
   */
  static async getTokenLogos(addresses: string[]): Promise<Record<string, string>> {
    const tokens = await this.getTokenList();
    const logoMap: Record<string, string> = {};

    const tokensByAddress = new Map(tokens.map(t => [t.address, t]));

    addresses.forEach(address => {
      const token = tokensByAddress.get(address);
      if (token?.logoURI) {
        logoMap[address] = token.logoURI;
      }
    });

    return logoMap;
  }

  /**
   * Search tokens by symbol or name
   */
  static async searchTokens(query: string): Promise<JupiterToken[]> {
    const tokens = await this.getTokenList();
    const lowerQuery = query.toLowerCase();

    return tokens.filter(t => 
      t.symbol.toLowerCase().includes(lowerQuery) ||
      t.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get popular Solana tokens (by tags)
   */
  static async getPopularTokens(): Promise<JupiterToken[]> {
    const tokens = await this.getTokenList();
    
    // Filter for tokens with 'verified' or 'community' tags
    return tokens.filter(t => 
      t.tags?.includes('verified') || 
      t.tags?.includes('community') ||
      t.tags?.includes('lst') // Liquid staking tokens
    );
  }

  /**
   * Clear cache (useful for testing or force refresh)
   */
  static clearCache(): void {
    this.tokenListCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get swap quote from Jupiter API
   * 
   * @param inputMint - Input token mint address
   * @param outputMint - Output token mint address
   * @param amount - Amount in smallest unit (lamports)
   * @param slippageBps - Slippage in basis points (50 = 0.5%)
   * @param onlyDirectRoutes - Only use direct routes (faster but may have worse rates)
   */
  static async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50,
    onlyDirectRoutes: boolean = false
  ): Promise<any> {
    try {
      const url = new URL('https://quote-api.jup.ag/v6/quote');
      url.searchParams.append('inputMint', inputMint);
      url.searchParams.append('outputMint', outputMint);
      url.searchParams.append('amount', amount);
      url.searchParams.append('slippageBps', slippageBps.toString());
      if (onlyDirectRoutes) {
        url.searchParams.append('onlyDirectRoutes', 'true');
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[JupiterService] Failed to get quote:', error);
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter API
   * 
   * @param quoteResponse - Quote response from getQuote()
   * @param userPublicKey - User's Solana public key
   * @param wrapUnwrapSOL - Wrap/unwrap SOL automatically (default: true)
   * @param feeAccount - Fee account for referral fees (optional)
   * @param asLegacyTransaction - Return legacy transaction format (optional)
   * @param prioritizationFeeLamports - Priority fee in lamports (optional)
   */
  static async getSwapTransaction(
    quoteResponse: any,
    userPublicKey: string,
    wrapUnwrapSOL: boolean = true,
    feeAccount?: string,
    asLegacyTransaction?: boolean,
    prioritizationFeeLamports?: number
  ): Promise<any> {
    try {
      const body: any = {
        quoteResponse,
        userPublicKey,
        wrapUnwrapSOL,
      };

      if (feeAccount) {
        body.feeAccount = feeAccount;
      }

      if (asLegacyTransaction !== undefined) {
        body.asLegacyTransaction = asLegacyTransaction;
      }

      if (prioritizationFeeLamports !== undefined) {
        body.prioritizationFeeLamports = prioritizationFeeLamports;
      }

      const response = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[JupiterService] Failed to get swap transaction:', error);
      throw error;
    }
  }
}

// Export for convenience
export async function getSolanaTokenLogo(address: string): Promise<string | null> {
  return JupiterService.getTokenLogo(address);
}

export async function getSolanaTokenLogos(addresses: string[]): Promise<Record<string, string>> {
  return JupiterService.getTokenLogos(addresses);
}
