import { ethers } from 'ethers';
import { BlockchainService } from './blockchain';
import { SolanaService } from './solana-service';
import { CHAINS } from './chains';

/**
 * Unified Multi-Chain Service
 * Automatically routes to the correct blockchain service based on chain type
 */
export class MultiChainService {
  private chainKey: string;
  private evmService: BlockchainService | null = null;
  private solanaService: SolanaService | null = null;

  constructor(chainKey: string = 'ethereum') {
    this.chainKey = chainKey;
    
    if (this.isSolana()) {
      const chain = CHAINS[chainKey];
      this.solanaService = new SolanaService(chain.rpcUrl);
    } else {
      this.evmService = new BlockchainService(chainKey);
    }
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
}

