import { ethers } from 'ethers';
import { BlockchainService } from './blockchain';
import { SolanaService } from './solana-service';
import { AlchemyService } from './alchemy-service';
import { BitcoinService } from './bitcoin-service';
import { BitcoinForkService } from './bitcoin-fork-service';
import { CHAINS } from './chains';
import { logger } from '@/lib/logger';

/**
 * Unified Multi-Chain Service
 * Automatically routes to the correct blockchain service based on chain type
 * ✅ Singleton pattern met cache per chain (voorkomt excessive re-initialization)
 * ✅ NOW SUPPORTS: EVM, Solana, Bitcoin, Litecoin, Dogecoin, Bitcoin Cash
 */
export class MultiChainService {
  private chainKey: string;
  private evmService: BlockchainService | null = null;
  private solanaService: SolanaService | null = null;
  private bitcoinService: BitcoinService | null = null;
  private bitcoinForkService: BitcoinForkService | null = null;
  private alchemyService: AlchemyService | null = null;

  private constructor(chainKey: string = 'ethereum') {
    this.chainKey = chainKey;
    
    if (this.isSolana()) {
      const chain = CHAINS[chainKey];
      this.solanaService = new SolanaService(chain.rpcUrl);
    } else if (this.isBitcoin()) {
      this.bitcoinService = new BitcoinService('mainnet');
    } else if (this.isBitcoinFork()) {
      // Litecoin, Dogecoin, Bitcoin Cash
      const forkType = chainKey as 'litecoin' | 'dogecoin' | 'bitcoincash';
      this.bitcoinForkService = new BitcoinForkService(forkType);
    } else {
      // EVM chains
      this.evmService = new BlockchainService(chainKey);
      
      // ✅ Initialize Alchemy if supported (silent logs)
      if (AlchemyService.isSupported(chainKey)) {
        try {
          this.alchemyService = new AlchemyService(chainKey);
          // Only log once during initialization
          if (!MultiChainService.instances.has(chainKey)) {
            logger.log(`✅ [MultiChainService] Alchemy enabled for ${chainKey}`);
          }
        } catch (error) {
          logger.warn(`⚠️ [MultiChainService] Alchemy initialization failed for ${chainKey}, using fallback`);
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
    logger.log('🧹 [MultiChainService] Cache cleared');
  }

  private isSolana(): boolean {
    return this.chainKey === 'solana';
  }

  private isBitcoin(): boolean {
    return this.chainKey === 'bitcoin';
  }

  private isBitcoinFork(): boolean {
    return this.chainKey === 'litecoin' || this.chainKey === 'dogecoin' || this.chainKey === 'bitcoincash';
  }

  getChain() {
    return CHAINS[this.chainKey];
  }

  async getBalance(address: string): Promise<string> {
    if (this.isSolana() && this.solanaService) {
      return await this.solanaService.getBalance(address);
    } else if (this.isBitcoin() && this.bitcoinService) {
      const { confirmed } = await this.bitcoinService.getBalance(address);
      return ethers.formatUnits(confirmed, 8); // Bitcoin has 8 decimals
    } else if (this.isBitcoinFork() && this.bitcoinForkService) {
      const { confirmed } = await this.bitcoinForkService.getBalance(address);
      return ethers.formatUnits(confirmed, 8); // All use 8 decimals
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
    } else if (this.isBitcoin() && this.bitcoinService) {
      // Get Bitcoin fee estimates (sat/vB)
      const feeEstimate = await this.bitcoinService.estimateFees();
      return {
        slow: `${feeEstimate.slow} sat/vB`,
        standard: `${feeEstimate.standard} sat/vB`,
        fast: `${feeEstimate.fast} sat/vB`,
      };
    } else if (this.isBitcoinFork() && this.bitcoinForkService) {
      // Get Bitcoin-fork fee estimates
      const feeEstimate = await this.bitcoinForkService.estimateFees();
      return {
        slow: `${feeEstimate.slow} sat/vB`,
        standard: `${feeEstimate.standard} sat/vB`,
        fast: `${feeEstimate.fast} sat/vB`,
      };
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
    } else if (this.isBitcoin() && this.bitcoinService) {
      // For Bitcoin, walletOrMnemonic must be a mnemonic string
      if (typeof walletOrMnemonic === 'string') {
        // Derive Bitcoin address from mnemonic
        const { address: fromAddress } = this.bitcoinService.deriveBitcoinAddress(walletOrMnemonic, 'native-segwit');
        
        // Convert amount to satoshis
        const amountSats = Math.floor(parseFloat(amount) * 100000000);
        
        // gasPrice for Bitcoin is actually sat/vB fee rate
        const feeRate = gasPrice ? parseInt(gasPrice) : 10; // Default 10 sat/vB
        
        const result = await this.bitcoinService.createTransaction(
          walletOrMnemonic,
          fromAddress,
          to,
          amountSats,
          feeRate
        );
        return result.txid; // Return transaction ID as string
      }
      throw new Error('Bitcoin requires mnemonic for transaction signing');
    } else if (this.isBitcoinFork() && this.bitcoinForkService) {
      // For Bitcoin forks (LTC, DOGE, BCH)
      if (typeof walletOrMnemonic === 'string') {
        // Derive address from mnemonic
        const { address: fromAddress } = this.bitcoinForkService.deriveAddress(walletOrMnemonic, 'legacy');
        
        // Convert amount to smallest unit (satoshis/litoshi/dogoshi)
        const amountSmallest = Math.floor(parseFloat(amount) * 100000000);
        
        // gasPrice is sat/vB fee rate
        const feeRate = gasPrice ? parseInt(gasPrice) : 10;
        
        const result = await this.bitcoinForkService.createTransaction(
          fromAddress,
          to,
          amountSmallest,
          feeRate,
          walletOrMnemonic
        );
        
        // Broadcast transaction
        return await this.bitcoinForkService.broadcastTransaction(result.txHex);
      }
      throw new Error('Bitcoin forks require mnemonic for transaction signing');
    } else if (this.evmService) {
      // For EVM, walletOrMnemonic must be a Wallet instance
      if (typeof walletOrMnemonic !== 'string') {
        return await this.evmService.sendTransaction(walletOrMnemonic, to, amount, gasPrice);
      }
      throw new Error('EVM requires wallet instance for transaction signing');
    }
    throw new Error('Service not initialized');
  }

  async sendTokenTransaction(
    walletOrMnemonic: ethers.Wallet | ethers.HDNodeWallet | string,
    tokenAddress: string,
    to: string,
    amount: string,
    decimals: number,
    gasPrice?: string
  ): Promise<ethers.TransactionResponse | string> {
    if (this.isSolana() && this.solanaService) {
      // ✅ SPL token transfers now implemented!
      if (typeof walletOrMnemonic === 'string') {
        return await this.solanaService.sendSPLToken(walletOrMnemonic, tokenAddress, to, amount);
      }
      throw new Error('Solana requires mnemonic for transaction signing');
    } else if (this.evmService) {
      // For ERC20 tokens
      if (typeof walletOrMnemonic !== 'string') {
        const { TokenService } = await import('./token-service');
        const chainConfig = CHAINS[this.chainKey];
        const tokenService = new TokenService(chainConfig.rpcUrl);
        return await tokenService.sendToken(walletOrMnemonic, tokenAddress, to, amount, decimals);
      }
      throw new Error('EVM requires wallet instance for transaction signing');
    }
    throw new Error('Service not initialized');
  }

  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    // ✅ NEW: Use Alchemy if available (includes ERC20 transfers!)
    if (this.alchemyService && !this.isSolana() && !this.isBitcoin() && !this.isBitcoinFork()) {
      try {
        logger.log(`🔮 [MultiChainService] Using Alchemy for transaction history`);
        return await this.alchemyService.getFullTransactionHistory(address, limit);
      } catch (error) {
        logger.warn(`⚠️ [MultiChainService] Alchemy failed, falling back to Etherscan API`);
      }
    }
    
    // Fallback to existing methods
    if (this.isSolana() && this.solanaService) {
      return await this.solanaService.getTransactionHistory(address, limit);
    } else if (this.isBitcoin() && this.bitcoinService) {
      return await this.bitcoinService.getTransactionHistory(address, limit);
    } else if (this.isBitcoinFork() && this.bitcoinForkService) {
      return await this.bitcoinForkService.getTransactionHistory(address, limit);
    } else if (this.evmService) {
      return await this.evmService.getTransactionHistory(address, limit);
    }
    return [];
  }

  isValidAddress(address: string): boolean {
    if (this.isSolana() && this.solanaService) {
      return this.solanaService.isValidAddress(address);
    } else if (this.isBitcoin()) {
      return BitcoinService.isValidAddress(address); // Static method
    } else if (this.isBitcoinFork()) {
      const forkType = this.chainKey as 'litecoin' | 'dogecoin' | 'bitcoincash';
      return BitcoinForkService.isValidAddress(address, forkType);
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
    } else if (this.isBitcoin()) {
      return 'Bitcoin address (bc1..., 1..., or 3...)';
    } else if (this.chainKey === 'litecoin') {
      return 'Litecoin address (L/M... or ltc1...)';
    } else if (this.chainKey === 'dogecoin') {
      return 'Dogecoin address (D...)';
    } else if (this.chainKey === 'bitcoincash') {
      return 'Bitcoin Cash address (q/p... or 1/3...)';
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
    // Bitcoin and Bitcoin forks have no tokens
    if (this.isBitcoin() || this.isBitcoinFork()) {
      return [];
    }

    // Use Alchemy if available (auto-detects ALL tokens)
    if (this.alchemyService && !this.isSolana()) {
      try {
        logger.log(`🔮 [MultiChainService] Using Alchemy for ERC20 token detection`);
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
        logger.warn(`⚠️ [MultiChainService] Alchemy failed for ERC20 tokens, using fallback`);
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

