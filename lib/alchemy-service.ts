import { Alchemy, Network, AssetTransfersCategory, SortingOrder } from 'alchemy-sdk';
import { ethers } from 'ethers';
import { Token } from './types';
import { logger } from '@/lib/logger';
import { getHistoryLogosBatch } from '@/lib/history-logo-service';

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'V9A0m8eB58qyWJpajjs6Y';

// Map chain keys to Alchemy networks
const CHAIN_TO_NETWORK: Record<string, Network> = {
  ethereum: Network.ETH_MAINNET,
  polygon: Network.MATIC_MAINNET,
  arbitrum: Network.ARB_MAINNET,
  base: Network.BASE_MAINNET,
  sepolia: Network.ETH_SEPOLIA,
};

interface EnrichedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  logo: string; // Always a string (fallback to placeholder if not found)
}

/**
 * Alchemy Service for ERC20 token detection and enhanced transaction history
 * Provides automatic token discovery, metadata, and comprehensive transaction tracking
 * ✅ Singleton pattern: wordt maar 1x per chain geïnitialiseerd
 */
export class AlchemyService {
  private alchemy: Alchemy;
  private chainKey: string;
  private static initialized = new Set<string>(); // Track which chains are initialized

  constructor(chainKey: string = 'ethereum') {
    this.chainKey = chainKey;
    const network = CHAIN_TO_NETWORK[chainKey];
    
    if (!network) {
      throw new Error(`Alchemy not supported for chain: ${chainKey}`);
    }

    this.alchemy = new Alchemy({
      apiKey: ALCHEMY_API_KEY,
      network,
    });

    // Only log once per chain (prevent console spam)
    if (!AlchemyService.initialized.has(chainKey)) {
      logger.log(`🔮 [AlchemyService] Initialized for ${chainKey} (${network})`);
      AlchemyService.initialized.add(chainKey);
    }
  }

  /**
   * Get ALL ERC20 token balances for an address (auto-detect)
   * Returns enriched tokens with metadata (name, symbol, decimals, logo)
   */
  async getAllTokenBalances(address: string): Promise<EnrichedToken[]> {
    try {
      console.log(`\n🔮 [AlchemyService] Fetching all ERC20 tokens...`);
      console.log(`   Address: ${address}`);
      console.log(`   Chain: ${this.chainKey}`);
      logger.log(`\n🔮 [AlchemyService] Fetching all ERC20 tokens for ${address.substring(0, 8)}...`);
      
      // Get all token balances (includes zero balances initially)
      const balances = await this.alchemy.core.getTokenBalances(address);
      
      console.log(`📊 [AlchemyService] Alchemy returned ${balances.tokenBalances.length} total tokens`);
      logger.log(`📊 [AlchemyService] Found ${balances.tokenBalances.length} total tokens`);
      
      // Filter out zero balances
      const nonZeroBalances = balances.tokenBalances.filter(
        token => token.tokenBalance && token.tokenBalance !== '0x0' && token.tokenBalance !== '0x'
      );

      console.log(`✅ [AlchemyService] ${nonZeroBalances.length} tokens with non-zero balance`);
      logger.log(`✅ [AlchemyService] ${nonZeroBalances.length} tokens with non-zero balance`);

      if (nonZeroBalances.length === 0) {
        return [];
      }

      // ⚡ STEP 1: Fetch all metadata in parallel (fast)
      console.log(`\n📡 [AlchemyService] Fetching metadata for ${nonZeroBalances.length} tokens...`);
      const metadataResults = await Promise.all(
        nonZeroBalances.map(async (token, idx) => {
          try {
            if (process.env.NODE_ENV === 'development') {
              console.log(`   [${idx + 1}/${nonZeroBalances.length}] ${token.contractAddress.substring(0, 10)}...`);
            }
            const metadata = await this.alchemy.core.getTokenMetadata(token.contractAddress);
            
            // Parse balance using decimals
            const decimals = metadata.decimals || 18;
            const balance = this.formatTokenBalance(token.tokenBalance || '0x0', decimals);

            // Skip if balance is zero after formatting
            if (parseFloat(balance) === 0) {
              return null;
            }

            return {
              address: token.contractAddress,
              symbol: metadata.symbol || 'UNKNOWN',
              name: metadata.name || 'Unknown Token',
              decimals,
              balance,
              alchemyLogo: metadata.logo,
            };
          } catch (error) {
            logger.warn(`⚠️ [AlchemyService] Failed to get metadata for ${token.contractAddress}:`, error);
            return null;
          }
        })
      );

      // Filter out nulls
      const tokensWithMetadata = metadataResults.filter((t): t is NonNullable<typeof t> => t !== null);
      
      // ⚡ STEP 2: Fetch all missing logos in parallel (6x faster!)
      console.log(`\n🖼️ [AlchemyService] Fetching logos in parallel for ${tokensWithMetadata.length} tokens...`);
      const { getCurrencyLogo } = await import('./currency-logo-service');
      
      const enrichedTokens = await Promise.all(
        tokensWithMetadata.map(async (token) => {
          let logo: string = token.alchemyLogo || '/crypto-placeholder.png';
          
          // If Alchemy doesn't provide logo, fetch from CoinGecko Pro API (with caching)
          if (!token.alchemyLogo) {
            try {
              const fetchedLogo = await getCurrencyLogo(token.symbol, token.address, this.chainKey);
              if (fetchedLogo) {
                logo = fetchedLogo;
              }
            } catch (error) {
              // Silently fail, keep placeholder
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ Logo fetch failed for ${token.symbol}:`, error);
              }
            }
          }

          return {
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance: token.balance,
            logo,
          };
        })
      );

      // Filter out failed tokens and null values
      const validTokens = enrichedTokens.filter((token): token is EnrichedToken => token !== null);

      console.log(`\n✅ [AlchemyService] Successfully enriched ${validTokens.length} tokens`);
      
      // Only log full details in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📊 FINAL ALCHEMY TOKEN LIST:`);
        validTokens.forEach((token, idx) => {
          console.log(`   ${idx + 1}. ${token.symbol} - Balance: ${token.balance}`);
        });
      }

      logger.log(`✅ [AlchemyService] Successfully enriched ${validTokens.length} tokens`);
      
      return validTokens;
    } catch (error) {
      logger.error('❌ [AlchemyService] Error fetching token balances:', error);
      throw error;
    }
  }

  /**
   * Get complete transaction history including native and ERC20 transfers
   * Returns unified transaction format compatible with existing TransactionHistory component
   */
  async getFullTransactionHistory(address: string, limit: number = 20): Promise<any[]> {
    try {
      logger.log(`\n🔮 [AlchemyService] Fetching transaction history for ${address.substring(0, 8)}...`);
      
      // Get both incoming and outgoing transfers
      const [outgoing, incoming] = await Promise.all([
        this.alchemy.core.getAssetTransfers({
          fromAddress: address,
          category: [
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.ERC20,
            AssetTransfersCategory.ERC721,
            AssetTransfersCategory.ERC1155
          ],
          order: SortingOrder.DESCENDING,
          maxCount: Math.ceil(limit / 2),
          withMetadata: true,
        }),
        this.alchemy.core.getAssetTransfers({
          toAddress: address,
          category: [
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.ERC20,
            AssetTransfersCategory.ERC721,
            AssetTransfersCategory.ERC1155
          ],
          order: SortingOrder.DESCENDING,
          maxCount: Math.ceil(limit / 2),
          withMetadata: true,
        })
      ]);

      // Combine and deduplicate
      const allTransfers = [...outgoing.transfers, ...incoming.transfers];
      const uniqueTransfers = Array.from(
        new Map(allTransfers.map(tx => [tx.hash, tx])).values()
      );

      // Sort by block number (newest first)
      uniqueTransfers.sort((a, b) => {
        const blockA = parseInt(b.blockNum, 16);
        const blockB = parseInt(a.blockNum, 16);
        return blockA - blockB;
      });

      // Take only the requested limit
      const limitedTransfers = uniqueTransfers.slice(0, limit);

      logger.log(`✅ [AlchemyService] Found ${limitedTransfers.length} transactions`);

      // Resolve all history logos through strict CoinGecko Pro API batch endpoint.
      const logoRequests = limitedTransfers.map((tx, idx) => ({
        key: String(idx),
        isNative: tx.category === AssetTransfersCategory.EXTERNAL || tx.asset === 'ETH',
        address: tx.rawContract?.address ? String(tx.rawContract.address).toLowerCase() : undefined,
      }));

      const logoMap = await getHistoryLogosBatch(this.chainKey, logoRequests);

      const transactionsWithLogos = limitedTransfers.map((tx, idx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value?.toString() || '0',
        timestamp: tx.metadata.blockTimestamp
          ? new Date(tx.metadata.blockTimestamp).getTime()
          : Date.now(),
        tokenSymbol: tx.asset || 'ETH',
        tokenName: this.getTokenName(tx),
        type: tx.category,
        blockNumber: parseInt(tx.blockNum, 16).toString(),
        isError: false,
        logoUrl: logoMap[String(idx)] || undefined,
      }));

      return transactionsWithLogos;
    } catch (error) {
      logger.error('❌ [AlchemyService] Error fetching transaction history:', error);
      throw error;
    }
  }

  /**
   * Check if Alchemy is supported for the given chain
   */
  static isSupported(chainKey: string): boolean {
    return chainKey in CHAIN_TO_NETWORK;
  }

  /**
   * Get list of supported chains
   */
  static getSupportedChains(): string[] {
    return Object.keys(CHAIN_TO_NETWORK);
  }

  /**
   * Private: Format token balance from hex to human-readable string
   */
  private formatTokenBalance(hexBalance: string, decimals: number): string {
    try {
      // Remove '0x' prefix if present
      const cleanHex = hexBalance.startsWith('0x') ? hexBalance : `0x${hexBalance}`;
      
      // Convert to BigInt and format
      const balance = ethers.formatUnits(cleanHex, decimals);
      
      // Return with reasonable precision
      const num = parseFloat(balance);
      if (num === 0) return '0';
      if (num < 0.000001) return num.toExponential(2);
      if (num < 1) return num.toFixed(6);
      if (num < 1000) return num.toFixed(4);
      return num.toFixed(2);
    } catch (error) {
      logger.warn(`⚠️ [AlchemyService] Error formatting balance ${hexBalance}:`, error);
      return '0';
    }
  }

  /**
   * Private: Get token name from transfer
   */
  private getTokenName(tx: any): string {
    // Try rawContract name first
    if (tx.rawContract?.name) {
      return tx.rawContract.name;
    }
    
    // Fallback to asset symbol
    if (tx.asset) {
      return tx.asset;
    }
    
    // Default
    return tx.category === AssetTransfersCategory.EXTERNAL ? 'ETH' : 'Token';
  }
}

