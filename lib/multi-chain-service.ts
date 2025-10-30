import { ethers } from 'ethers';
import { BlockchainService } from './blockchain';
import { SolanaService } from './solana-service';
import { AlchemyService } from './alchemy-service';
import { CHAINS } from './chains';

/**
 * Unified Multi-Chain Service
 * Automatically routes to the correct blockchain service based on chain type
 * ✅ Singleton pattern met cache per chain (voorkomt excessive re-initialization)
 */
export class MultiChainService {
  private chainKey: string;
  private evmService: BlockchainService | null = null;
  private solanaService: SolanaService | null = null;
  private alchemyService: AlchemyService | null = null;

  private constructor(chainKey: string = 'ethereum') {
    this.chainKey = chainKey;
    
    if (this.isSolana()) {
      const chain = CHAINS[chainKey];
      this.solanaService = new SolanaService(chain.rpcUrl);
    } else {
      this.evmService = new BlockchainService(chainKey);
      
      // ✅ Initialize Alchemy if supported (silent logs)
      if (AlchemyService.isSupported(chainKey)) {
        try {
          this.alchemyService = new AlchemyService(chainKey);
          // Only log once during initialization
          if (!MultiChainService.instances.has(chainKey)) {
            console.log(`✅ [MultiChainService] Alchemy enabled for ${chainKey}`);
          }
        } catch (error) {
          console.warn(`⚠️ [MultiChainService] Alchemy initialization failed for ${chainKey}, using fallback`);
        }
      }
    }
  }

  // ✅ Singleton cache: één instance per chain
  private static instances = new Map<string, MultiChainService>();

  /**
   * Get or create MultiChainService instance for a specific chain
   * This prevents creating multiple instances for the same chain
   */
  static getInstance(chainKey: string = 'ethereum'): MultiChainService {
    if (!this.instances.has(chainKey)) {
      this.instances.set(chainKey, new MultiChainService(chainKey));
    }
    return this.instances.get(chainKey)!;
  }

  /**
   * Clear cache (for testing or chain updates)
   */
  static clearCache() {
    this.instances.clear();
    console.log('🧹 [MultiChainService] Cache cleared');
  }

  private isSolana(): boolean {
    return this.chainKey === 'solana';
  }

  getChain() {
    return CHAINS[this.chainKey];
  }

  async getBalance(address: string): Promise<string> {
    if (this.isSolana() && this.solanaService) {
      return await this.solanaService.getBalance(address);
    } else if (this.evmService) {
      return await this.evmService.getBalance(address);
    }
    throw new Error('Service not initialized');
  }

  async getGasPrice(): Promise<{ slow: string; standard: string; fast: string }> {
    if (this.isSolana() && this.solanaService) {
      // Solana has very low and stable fees
      const fee = await this.solanaService.getTransactionFee();
      return { slow: fee, standard: fee, fast: fee };
    } else if (this.evmService) {
      return await this.evmService.getGasPrice();
    }
    throw new Error('Service not initialized');
  }

  async sendTransaction(
    walletOrMnemonic: ethers.Wallet | ethers.HDNodeWallet | string,
    to: string,
    amount: string,
    gasPrice?: string
  ): Promise<ethers.TransactionResponse | string> {
    if (this.isSolana() && this.solanaService) {
      // For Solana, walletOrMnemonic must be a mnemonic string
      if (typeof walletOrMnemonic === 'string') {
        return await this.solanaService.sendTransaction(walletOrMnemonic, to, amount);
      }
      throw new Error('Solana requires mnemonic for transaction signing');
    } else if (this.evmService) {
      // For EVM, walletOrMnemonic must be a Wallet instance
      if (typeof walletOrMnemonic !== 'string') {
        return await this.evmService.sendTransaction(walletOrMnemonic, to, amount, gasPrice);
      }
      throw new Error('EVM requires wallet instance for transaction signing');
    }
    throw new Error('Service not initialized');
  }

  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    // ✅ NEW: Use Alchemy if available (includes ERC20 transfers!)
    if (this.alchemyService && !this.isSolana()) {
      try {
        console.log(`🔮 [MultiChainService] Using Alchemy for transaction history`);
        return await this.alchemyService.getFullTransactionHistory(address, limit);
      } catch (error) {
        console.warn(`⚠️ [MultiChainService] Alchemy failed, falling back to Etherscan API`);
      }
    }
    
    // Fallback to existing methods
    if (this.isSolana() && this.solanaService) {
      return await this.solanaService.getTransactionHistory(address, limit);
    } else if (this.evmService) {
      return await this.evmService.getTransactionHistory(address, limit);
    }
    return [];
  }

  isValidAddress(address: string): boolean {
    if (this.isSolana() && this.solanaService) {
      return this.solanaService.isValidAddress(address);
    } else if (this.evmService) {
      // EVM address validation
      return ethers.isAddress(address);
    }
    return false;
  }

  // Helper to get the correct address format message
  getAddressFormatHint(): string {
    if (this.isSolana()) {
      return 'Solana address (base58, e.g., DYw8jC...)';
    }
    return 'EVM address (0x...)';
  }

  /**
   * Get SPL token balances (Solana only)
   * Returns all SPL tokens with non-zero balance, enriched with metadata
   */
  async getSPLTokenBalances(address: string): Promise<any[]> {
    if (this.isSolana() && this.solanaService) {
      return await this.solanaService.getSPLTokenBalances(address);
    }
    // Return empty array for non-Solana chains
    return [];
  }

  /**
   * ✅ NEW: Get ALL ERC20 token balances (auto-detect via Alchemy)
   * Falls back to manual token list if Alchemy unavailable
   */
  async getERC20TokenBalances(address: string): Promise<any[]> {
    // Use Alchemy if available (auto-detects ALL tokens)
    if (this.alchemyService && !this.isSolana()) {
      try {
        console.log(`🔮 [MultiChainService] Using Alchemy for ERC20 token detection`);
        const tokens = await this.alchemyService.getAllTokenBalances(address);
        
        // Map to standard Token format
        return tokens.map(token => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance,
          logo: token.logo || '/crypto-placeholder.png',
        }));
      } catch (error) {
        console.warn(`⚠️ [MultiChainService] Alchemy failed for ERC20 tokens, using fallback`);
      }
    }
    
    // Fallback: return empty array (Dashboard will use POPULAR_TOKENS instead)
    return [];
  }

  /**
   * Check if Alchemy is available for current chain
   */
  hasAlchemy(): boolean {
    return this.alchemyService !== null;
  }
}

