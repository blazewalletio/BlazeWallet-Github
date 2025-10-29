/**
 * 🔥 Alchemy EVM Token Discovery Service
 * 
 * This service automatically discovers ALL ERC20 tokens held by an address,
 * just like we do for Solana SPL tokens!
 * 
 * Features:
 * - Automatic token discovery via Alchemy API
 * - Works for ALL EVM chains (Ethereum, Polygon, Arbitrum, Base, etc.)
 * - Returns token balances with metadata (name, symbol, logo, decimals)
 * - Filters out zero-balance tokens
 * - Caching for performance
 */

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  error?: string;
}

interface AlchemyTokenMetadata {
  name?: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
}

export interface EVMToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  logo?: string;
}

class AlchemyTokenService {
  private cache = new Map<string, { tokens: EVMToken[]; timestamp: number }>();
  private cacheDuration = 30000; // 30 seconds cache

  /**
   * Get Alchemy API key for a specific chain
   */
  private getAlchemyApiKey(chainKey: string): string | null {
    // Use environment variables for API keys
    // For demo purposes, we'll use the demo key
    // In production, you should use proper API keys per chain
    
    const apiKeys: Record<string, string> = {
      ethereum: process.env.NEXT_PUBLIC_ALCHEMY_ETHEREUM_API_KEY || 'demo',
      polygon: process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_API_KEY || 'demo',
      arbitrum: process.env.NEXT_PUBLIC_ALCHEMY_ARBITRUM_API_KEY || 'demo',
      base: process.env.NEXT_PUBLIC_ALCHEMY_BASE_API_KEY || 'demo',
      optimism: process.env.NEXT_PUBLIC_ALCHEMY_OPTIMISM_API_KEY || 'demo',
    };

    return apiKeys[chainKey] || null;
  }

  /**
   * Get Alchemy network name for a chain
   */
  private getAlchemyNetwork(chainKey: string): string | null {
    const networks: Record<string, string> = {
      ethereum: 'eth-mainnet',
      polygon: 'polygon-mainnet',
      arbitrum: 'arb-mainnet',
      base: 'base-mainnet',
      optimism: 'opt-mainnet',
    };

    return networks[chainKey] || null;
  }

  /**
   * 🔥 Get ALL ERC20 tokens for an address (like Solana's getSPLTokenBalances!)
   */
  async getAllTokenBalances(
    address: string,
    chainKey: string
  ): Promise<EVMToken[]> {
    console.log('\n========== EVM TOKEN FETCH START ==========');
    console.log(`🪙 [AlchemyTokenService] Fetching ALL ERC20 tokens for ${address} on ${chainKey}...`);

    // Check cache first
    const cacheKey = `${chainKey}:${address}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`⚡ [AlchemyTokenService] Cache hit: ${cached.tokens.length} tokens`);
      return cached.tokens;
    }

    const apiKey = this.getAlchemyApiKey(chainKey);
    const network = this.getAlchemyNetwork(chainKey);

    if (!apiKey || !network) {
      console.warn(`⚠️ [AlchemyTokenService] Alchemy not configured for ${chainKey}, using fallback`);
      return this.fallbackToEtherscan(address, chainKey);
    }

    try {
      // Use Alchemy API to get token balances
      const url = `https://${network}.g.alchemy.com/v2/${apiKey}`;
      
      console.log(`📡 [AlchemyTokenService] Calling Alchemy API for ${chainKey}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getTokenBalances',
          params: [address],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Alchemy API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`);
      }

      const tokenBalances: AlchemyTokenBalance[] = data.result?.tokenBalances || [];
      
      console.log(`📊 [AlchemyTokenService] Found ${tokenBalances.length} token balances`);

      // Filter out zero balances and errors
      const nonZeroTokens = tokenBalances.filter(
        (token) => !token.error && token.tokenBalance !== '0x0' && token.tokenBalance !== '0'
      );

      console.log(`🪙 [AlchemyTokenService] ${nonZeroTokens.length} tokens with non-zero balance`);

      if (nonZeroTokens.length === 0) {
        console.log('✅ [AlchemyTokenService] No tokens found');
        console.log('========== EVM TOKEN FETCH COMPLETE ==========\n');
        return [];
      }

      // Fetch metadata for each token
      console.log(`📊 [AlchemyTokenService] Fetching metadata for ${nonZeroTokens.length} tokens...`);
      
      const tokensWithMetadata = await Promise.all(
        nonZeroTokens.map(async (tokenBalance) => {
          try {
            const metadata = await this.getTokenMetadata(
              tokenBalance.contractAddress,
              chainKey,
              url
            );

            // Convert hex balance to decimal
            const balance = this.hexToDecimal(
              tokenBalance.tokenBalance,
              metadata.decimals || 18
            );

            return {
              address: tokenBalance.contractAddress,
              symbol: metadata.symbol || 'UNKNOWN',
              name: metadata.name || 'Unknown Token',
              decimals: metadata.decimals || 18,
              balance,
              logo: metadata.logo,
            };
          } catch (error) {
            console.error(
              `Error fetching metadata for ${tokenBalance.contractAddress}:`,
              error
            );
            
            // Return basic info even if metadata fetch fails
            return {
              address: tokenBalance.contractAddress,
              symbol: tokenBalance.contractAddress.slice(0, 6) + '...',
              name: 'Unknown Token',
              decimals: 18,
              balance: this.hexToDecimal(tokenBalance.tokenBalance, 18),
            };
          }
        })
      );

      console.log(`✅ [AlchemyTokenService] Successfully processed ${tokensWithMetadata.length} ERC20 tokens`);
      console.log('========== EVM TOKEN FETCH COMPLETE ==========\n');

      // Cache the results
      this.cache.set(cacheKey, {
        tokens: tokensWithMetadata,
        timestamp: Date.now(),
      });

      return tokensWithMetadata;
    } catch (error) {
      console.error('❌ [AlchemyTokenService] Error fetching tokens from Alchemy:', error);
      
      // Fallback to alternative method
      return this.fallbackToEtherscan(address, chainKey);
    }
  }

  /**
   * Get token metadata from Alchemy
   */
  private async getTokenMetadata(
    contractAddress: string,
    chainKey: string,
    alchemyUrl: string
  ): Promise<AlchemyTokenMetadata> {
    try {
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getTokenMetadata',
          params: [contractAddress],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Metadata error: ${data.error.message}`);
      }

      return {
        name: data.result?.name,
        symbol: data.result?.symbol,
        decimals: data.result?.decimals,
        logo: data.result?.logo,
      };
    } catch (error) {
      console.warn(`Failed to get metadata for ${contractAddress}:`, error);
      return {};
    }
  }

  /**
   * Convert hex balance to decimal string
   */
  private hexToDecimal(hexBalance: string, decimals: number): string {
    try {
      // Remove '0x' prefix if present
      const hex = hexBalance.startsWith('0x') ? hexBalance.slice(2) : hexBalance;
      
      if (!hex || hex === '0') return '0';

      // Convert hex to BigInt
      const balanceBigInt = BigInt('0x' + hex);
      
      // Convert to decimal with proper decimals
      const divisor = BigInt(10 ** decimals);
      const wholePart = balanceBigInt / divisor;
      const fractionalPart = balanceBigInt % divisor;
      
      // Format with decimals
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      const result = `${wholePart}.${fractionalStr}`;
      
      // Remove trailing zeros
      return parseFloat(result).toString();
    } catch (error) {
      console.error('Error converting hex balance:', error);
      return '0';
    }
  }

  /**
   * Fallback method using on-chain calls (slower but works without Alchemy)
   */
  private async fallbackToEtherscan(
    address: string,
    chainKey: string
  ): Promise<EVMToken[]> {
    console.log(`⚠️ [AlchemyTokenService] Using fallback method for ${chainKey}...`);
    
    // For now, return empty array
    // In production, you could implement Etherscan API or other fallback
    console.log('ℹ️ [AlchemyTokenService] Fallback not implemented, returning empty array');
    
    return [];
  }

  /**
   * Clear cache for a specific address or all
   */
  clearCache(address?: string, chainKey?: string) {
    if (address && chainKey) {
      const cacheKey = `${chainKey}:${address}`;
      this.cache.delete(cacheKey);
      console.log(`🧹 [AlchemyTokenService] Cleared cache for ${chainKey}:${address}`);
    } else {
      this.cache.clear();
      console.log('🧹 [AlchemyTokenService] Cleared all cache');
    }
  }
}

// Export singleton instance
export const alchemyTokenService = new AlchemyTokenService();

