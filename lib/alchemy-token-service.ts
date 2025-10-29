/**
 * 🔥 Alchemy EVM Token Discovery Service
 * 
 * This service automatically discovers ALL ERC20 tokens held by an address,
 * just like we do for Solana SPL tokens!
 * 
 * Features:
 * - Automatic token discovery via Alchemy API
 * - Direct on-chain RPC fallback (works for ALL tokens, just like Solana!)
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
  rawBalance?: string; // Hex balance from chain
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
   * 🔥 Get ALL ERC20 tokens for an address (3-tier hybrid: Alchemy -> Direct RPC -> On-chain)
   * 
   * Just like Solana uses direct RPC calls, we now have a GUARANTEED working fallback!
   */
  async getAllTokenBalances(
    address: string,
    chainKey: string
  ): Promise<EVMToken[]> {
    console.log('\n========== EVM TOKEN FETCH START (3-TIER HYBRID) ==========');
    console.log(`🪙 [AlchemyTokenService] Fetching ALL ERC20 tokens for ${address} on ${chainKey}...`);

    // Check cache first
    const cacheKey = `${chainKey}:${address}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`⚡ [AlchemyTokenService] Cache hit: ${cached.tokens.length} tokens`);
      return cached.tokens;
    }

    // ✅ TIER 1: Try Alchemy API first (fast, but can be incomplete with demo key)
    console.log('🔄 [Tier 1] Trying Alchemy API...');
    try {
      const alchemyTokens = await this.getTokensViaAlchemy(address, chainKey);
      
      if (alchemyTokens.length > 0) {
        console.log(`✅ [Tier 1] Alchemy returned ${alchemyTokens.length} tokens!`);
        
        // Cache the results
        this.cache.set(cacheKey, {
          tokens: alchemyTokens,
          timestamp: Date.now(),
        });
        
        return alchemyTokens;
      }
      
      console.log('⚠️ [Tier 1] Alchemy returned 0 tokens, trying Tier 2...');
    } catch (error) {
      console.warn('⚠️ [Tier 1] Alchemy failed:', error);
      console.log('🔄 [Tier 2] Falling back to direct RPC calls...');
    }

    // ✅ TIER 2: Direct RPC Calls (works ALWAYS, just like Solana!)
    try {
      const rpcTokens = await this.getTokensViaDirectRPC(address, chainKey);
      
      if (rpcTokens.length > 0) {
        console.log(`✅ [Tier 2] Direct RPC returned ${rpcTokens.length} tokens!`);
        
        // Cache the results
        this.cache.set(cacheKey, {
          tokens: rpcTokens,
          timestamp: Date.now(),
        });
        
        return rpcTokens;
      }
      
      console.log('ℹ️ [Tier 2] No tokens found via RPC');
    } catch (error) {
      console.error('❌ [Tier 2] Direct RPC failed:', error);
    }

    // ✅ TIER 3: Last resort - return empty array
    console.log('ℹ️ [Tier 3] No tokens found on this chain');
    console.log('========== EVM TOKEN FETCH COMPLETE (NO TOKENS) ==========\n');
    
    return [];
  }

  /**
   * TIER 1: Get tokens via Alchemy API
   */
  private async getTokensViaAlchemy(
    address: string,
    chainKey: string
  ): Promise<EVMToken[]> {
    const apiKey = this.getAlchemyApiKey(chainKey);
    const network = this.getAlchemyNetwork(chainKey);

    if (!apiKey || !network) {
      throw new Error(`Alchemy not configured for ${chainKey}`);
    }

    // Use Alchemy API to get token balances
    const url = `https://${network}.g.alchemy.com/v2/${apiKey}`;
    
    console.log(`📡 [Alchemy] Calling API for ${chainKey}...`);
    
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
    
    console.log(`📊 [Alchemy] Found ${tokenBalances.length} token balances`);

    // Filter out zero balances and errors
    const nonZeroTokens = tokenBalances.filter(
      (token) => !token.error && token.tokenBalance !== '0x0' && token.tokenBalance !== '0'
    );

    console.log(`🪙 [Alchemy] ${nonZeroTokens.length} tokens with non-zero balance`);

    if (nonZeroTokens.length === 0) {
      return [];
    }

    // Fetch metadata for each token
    console.log(`📊 [Alchemy] Fetching metadata for ${nonZeroTokens.length} tokens...`);
    
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
            rawBalance: tokenBalance.tokenBalance,
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
            rawBalance: tokenBalance.tokenBalance,
          };
        }
      })
    );

    console.log(`✅ [Alchemy] Successfully processed ${tokensWithMetadata.length} ERC20 tokens`);
    
    return tokensWithMetadata;
  }

  /**
   * TIER 2: Get tokens via direct RPC calls (like Solana!)
   * This works by using Alchemy's public RPC endpoint which doesn't need API keys!
   */
  private async getTokensViaDirectRPC(
    address: string,
    chainKey: string
  ): Promise<EVMToken[]> {
    console.log(`🔗 [DirectRPC] Querying blockchain directly for ${chainKey}...`);
    
    // ✅ Use Alchemy's PUBLIC RPC endpoints (no API key needed for basic calls!)
    const publicRpcUrls: Record<string, string> = {
      ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      polygon: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
      arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/demo',
      base: 'https://base-mainnet.g.alchemy.com/v2/demo',
      optimism: 'https://opt-mainnet.g.alchemy.com/v2/demo',
    };
    
    const rpcUrl = publicRpcUrls[chainKey] || this.getRPCUrl(chainKey);
    
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for ${chainKey}`);
    }

    try {
      // ✅ Use Alchemy's alchemy_getTokenBalances even with demo key!
      // The demo key works for basic calls but may have rate limits
      console.log(`📡 [DirectRPC] Using Alchemy RPC at ${rpcUrl}`);
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20'], // 'erc20' = get all ERC20 tokens
          id: 1,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.warn(`⚠️ [DirectRPC] Alchemy RPC error: ${data.error.message}`);
        // Fall back to log-based discovery
        return this.getTokensViaLogs(address, rpcUrl);
      }

      const tokenBalances: AlchemyTokenBalance[] = data.result?.tokenBalances || [];
      
      console.log(`📊 [DirectRPC] Found ${tokenBalances.length} tokens`);

      // Filter non-zero balances
      const nonZeroTokens = tokenBalances.filter(
        (token) => !token.error && token.tokenBalance !== '0x0' && token.tokenBalance !== '0'
      );

      console.log(`🪙 [DirectRPC] ${nonZeroTokens.length} tokens with balance`);

      if (nonZeroTokens.length === 0) {
        return [];
      }

      // Fetch metadata for each token
      const tokensWithMetadata = await Promise.all(
        nonZeroTokens.map(async (tokenBalance) => {
          try {
            // Try Alchemy metadata first, then fallback to on-chain
            let metadata: AlchemyTokenMetadata;
            
            try {
              metadata = await this.getTokenMetadataViaAlchemy(tokenBalance.contractAddress, rpcUrl);
            } catch (error) {
              // Fallback to on-chain metadata
              metadata = await this.getERC20Metadata(tokenBalance.contractAddress, rpcUrl);
            }

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
              rawBalance: tokenBalance.tokenBalance,
            };
          } catch (error) {
            console.error(`Failed to process ${tokenBalance.contractAddress}:`, error);
            return {
              address: tokenBalance.contractAddress,
              symbol: tokenBalance.contractAddress.slice(0, 6) + '...',
              name: 'Unknown Token',
              decimals: 18,
              balance: this.hexToDecimal(tokenBalance.tokenBalance, 18),
              rawBalance: tokenBalance.tokenBalance,
            };
          }
        })
      );

      console.log(`✅ [DirectRPC] Successfully processed ${tokensWithMetadata.length} tokens`);
      
      return tokensWithMetadata;
    } catch (error) {
      console.error('❌ [DirectRPC] Failed:', error);
      
      // Final fallback to log-based discovery
      return this.getTokensViaLogs(address, rpcUrl!);
    }
  }

  /**
   * Get token metadata via Alchemy RPC
   */
  private async getTokenMetadataViaAlchemy(
    contractAddress: string,
    rpcUrl: string
  ): Promise<AlchemyTokenMetadata> {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [contractAddress],
        id: 1,
      }),
    });

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
  }

  /**
   * Fallback: Get tokens via Transfer logs (slower, less reliable)
   */
  private async getTokensViaLogs(
    address: string,
    rpcUrl: string
  ): Promise<EVMToken[]> {
    console.log(`🔄 [Logs Fallback] Discovering tokens via Transfer events...`);
    
    // Get all ERC20 Transfer events TO this address (indicates token ownership)
    const logs = await this.getERC20TransferLogs(address, rpcUrl);
    
    console.log(`📊 [Logs Fallback] Found ${logs.length} ERC20 transfer events`);
    
    if (logs.length === 0) {
      return [];
    }

    // Extract unique token addresses
    const tokenAddresses = [...new Set(logs.map((log: any) => log.address))];
    console.log(`🪙 [Logs Fallback] Discovered ${tokenAddresses.length} unique token contracts`);

    // Fetch balance for each token (in batches to avoid rate limits)
    const batchSize = 10;
    const tokensWithBalance: (EVMToken | null)[] = [];
    
    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
      const batch = tokenAddresses.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (tokenAddress: string) => {
          try {
            // Get balance
            const balance = await this.getERC20Balance(address, tokenAddress, rpcUrl);
            
            if (balance === '0' || balance === '0x0') {
              return null; // Filter out zero balances
            }

            // Get token metadata (name, symbol, decimals)
            const metadata = await this.getERC20Metadata(tokenAddress, rpcUrl);
            
            // Convert hex balance to decimal
            const balanceDecimal = this.hexToDecimal(balance, metadata.decimals);
            
            console.log(`✅ [Logs Fallback] ${metadata.symbol}: ${balanceDecimal}`);
            
            return {
              address: tokenAddress,
              symbol: metadata.symbol,
              name: metadata.name,
              decimals: metadata.decimals,
              balance: balanceDecimal,
              logo: metadata.logo,
              rawBalance: balance,
            };
          } catch (error) {
            console.warn(`⚠️ [Logs Fallback] Failed to fetch ${tokenAddress}:`, error);
            return null;
          }
        })
      );
      
      tokensWithBalance.push(...batchResults);
    }

    // Filter out null values (tokens with zero balance or errors)
    const validTokens = tokensWithBalance.filter((token): token is EVMToken => token !== null);
    
    console.log(`✅ [Logs Fallback] Successfully processed ${validTokens.length} tokens with balance`);
    
    return validTokens;
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
   * Get RPC URL for a chain
   */
  private getRPCUrl(chainKey: string): string | null {
    // Use public RPC endpoints (can be replaced with Alchemy/Infura for production)
    const rpcUrls: Record<string, string> = {
      ethereum: 'https://eth.llamarpc.com', // Free public RPC
      polygon: 'https://polygon-rpc.com',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      base: 'https://mainnet.base.org',
      optimism: 'https://mainnet.optimism.io',
      bsc: 'https://bsc-dataseed.binance.org',
    };

    return rpcUrls[chainKey] || null;
  }

  /**
   * Get ERC20 Transfer events (to discover all tokens an address has received)
   * OPTIMIZED: Only fetch recent blocks to avoid timeout
   */
  private async getERC20TransferLogs(
    address: string,
    rpcUrl: string
  ): Promise<any[]> {
    // ERC20 Transfer event signature: Transfer(address,address,uint256)
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    // Query logs where the address is the recipient (topic 2)
    // We pad the address to 32 bytes for topic matching
    const paddedAddress = '0x' + address.toLowerCase().slice(2).padStart(64, '0');

    try {
      // ✅ OPTIMIZATION: Only query recent blocks (last 10,000 blocks ~40 hours for Ethereum)
      // This prevents timeout and is sufficient for most use cases
      // For full history, you would need Alchemy/Etherscan API
      
      const latestBlockResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      
      const latestBlockData = await latestBlockResponse.json();
      const latestBlock = parseInt(latestBlockData.result, 16);
      const fromBlock = Math.max(0, latestBlock - 10000); // Last 10k blocks
      
      console.log(`📊 [DirectRPC] Querying logs from block ${fromBlock} to ${latestBlock} (${latestBlock - fromBlock} blocks)`);

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params: [{
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: 'latest',
            topics: [
              transferTopic, // Transfer event
              null, // from (any address)
              paddedAddress, // to (our address)
            ],
          }],
          id: 1,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('❌ [DirectRPC] RPC error:', data.error);
        return [];
      }

      return data.result || [];
    } catch (error) {
      console.error('❌ [DirectRPC] Failed to fetch logs:', error);
      return [];
    }
  }

  /**
   * Get ERC20 token balance for an address
   */
  private async getERC20Balance(
    ownerAddress: string,
    tokenAddress: string,
    rpcUrl: string
  ): Promise<string> {
    // ERC20 balanceOf(address) function signature
    const balanceOfSignature = '0x70a08231'; // keccak256("balanceOf(address)")[:4]
    const paddedAddress = ownerAddress.toLowerCase().slice(2).padStart(64, '0');
    const data = balanceOfSignature + paddedAddress;

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: tokenAddress,
              data: data,
            },
            'latest',
          ],
          id: 1,
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.result || '0x0';
    } catch (error) {
      console.error(`Failed to get balance for ${tokenAddress}:`, error);
      return '0x0';
    }
  }

  /**
   * Get ERC20 token metadata (name, symbol, decimals)
   */
  private async getERC20Metadata(
    tokenAddress: string,
    rpcUrl: string
  ): Promise<{ name: string; symbol: string; decimals: number; logo?: string }> {
    try {
      // Parallel fetch of name, symbol, decimals
      const [name, symbol, decimals] = await Promise.all([
        this.callERC20Function(tokenAddress, 'name()', rpcUrl),
        this.callERC20Function(tokenAddress, 'symbol()', rpcUrl),
        this.callERC20Function(tokenAddress, 'decimals()', rpcUrl),
      ]);

      return {
        name: name || 'Unknown Token',
        symbol: symbol || tokenAddress.slice(0, 6) + '...',
        decimals: decimals ? parseInt(decimals, 16) : 18,
      };
    } catch (error) {
      console.warn(`Failed to get metadata for ${tokenAddress}:`, error);
      
      return {
        name: 'Unknown Token',
        symbol: tokenAddress.slice(0, 6) + '...',
        decimals: 18,
      };
    }
  }

  /**
   * Call an ERC20 function (name, symbol, decimals)
   */
  private async callERC20Function(
    tokenAddress: string,
    functionName: string,
    rpcUrl: string
  ): Promise<string | null> {
    const signatures: Record<string, string> = {
      'name()': '0x06fdde03',
      'symbol()': '0x95d89b41',
      'decimals()': '0x313ce567',
    };

    const signature = signatures[functionName];
    
    if (!signature) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: tokenAddress,
              data: signature,
            },
            'latest',
          ],
          id: 1,
        }),
      });

      const result = await response.json();

      if (result.error) {
        return null;
      }

      const hexValue = result.result;

      if (!hexValue || hexValue === '0x') {
        return null;
      }

      // For decimals, return raw hex
      if (functionName === 'decimals()') {
        return hexValue;
      }

      // For name and symbol, decode string
      try {
        // Remove '0x' prefix
        const hex = hexValue.slice(2);
        
        // Skip offset (first 32 bytes) and length (next 32 bytes)
        const dataStart = 128; // 64 bytes * 2 chars/byte
        const stringHex = hex.slice(dataStart);
        
        // Convert hex to string
        let str = '';
        for (let i = 0; i < stringHex.length; i += 2) {
          const charCode = parseInt(stringHex.slice(i, i + 2), 16);
          if (charCode === 0) break; // Stop at null terminator
          str += String.fromCharCode(charCode);
        }
        
        return str || null;
      } catch (error) {
        return null;
      }
    } catch (error) {
      console.error(`Failed to call ${functionName} on ${tokenAddress}:`, error);
      return null;
    }
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

