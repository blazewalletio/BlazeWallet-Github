import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

export interface CashbackTransaction {
  id: string;
  userAddress: string;
  transactionHash: string;
  transactionType: 'swap' | 'send' | 'buy' | 'stake' | 'unstake';
  amount: string; // Amount in wei
  amountFormatted: number;
  cashbackAmount: string; // Cashback in wei
  cashbackAmountFormatted: number;
  cashbackPercentage: number;
  status: 'pending' | 'confirmed' | 'claimed';
  timestamp: number;
  blockNumber: number;
  tokenAddress?: string;
  tokenSymbol?: string;
  fromToken?: string;
  toToken?: string;
}

export interface CashbackStats {
  totalEarned: string;
  totalEarnedFormatted: number;
  thisMonth: string;
  thisMonthFormatted: number;
  pending: string;
  pendingFormatted: number;
  transactions: number;
  averageCashback: number;
  topTransactionType: string;
}

export interface CashbackConfig {
  swapPercentage: number; // e.g., 2 for 2%
  sendPercentage: number;
  buyPercentage: number;
  stakePercentage: number;
  unstakePercentage: number;
  minimumTransaction: string; // Minimum transaction amount to earn cashback
  maximumCashback: string; // Maximum cashback per transaction
}

export class CashbackService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/cashback';
  }

  /**
   * Get cashback statistics for a user
   */
  async getCashbackStats(userAddress: string): Promise<CashbackStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats?address=${userAddress}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cashback stats: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching cashback stats:', error);
      throw error;
    }
  }

  /**
   * Get recent cashback transactions for a user
   */
  async getRecentCashback(userAddress: string, limit: number = 10): Promise<CashbackTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/transactions?address=${userAddress}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cashback transactions: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching cashback transactions:', error);
      throw error;
    }
  }

  /**
   * Get cashback configuration
   */
  async getCashbackConfig(): Promise<CashbackConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cashback config: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching cashback config:', error);
      throw error;
    }
  }

  /**
   * Claim pending cashback rewards
   */
  async claimCashback(userAddress: string, wallet: ethers.Signer): Promise<string> {
    try {
      // First, check if there are pending rewards
      const stats = await this.getCashbackStats(userAddress);
      if (parseFloat(stats.pendingFormatted.toString()) === 0) {
        throw new Error('No pending cashback to claim');
      }

      // Create a transaction to claim cashback
      // This would typically involve calling a smart contract
      // For now, we'll simulate the process
      const response = await fetch(`${this.baseUrl}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          amount: stats.pending,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to claim cashback: ${response.statusText}`);
      }

      const result = await response.json();
      return result.transactionHash;
    } catch (error) {
      logger.error('Error claiming cashback:', error);
      throw error;
    }
  }

  /**
   * Calculate cashback for a transaction
   */
  calculateCashback(
    amount: string,
    transactionType: 'swap' | 'send' | 'buy' | 'stake' | 'unstake',
    config: CashbackConfig
  ): {
    cashbackAmount: string;
    cashbackAmountFormatted: number;
    percentage: number;
  } {
    const amountWei = BigInt(amount);
    const minimumWei = BigInt(config.minimumTransaction);
    const maximumWei = BigInt(config.maximumCashback);

    // Check if transaction meets minimum threshold
    if (amountWei < minimumWei) {
      return {
        cashbackAmount: '0',
        cashbackAmountFormatted: 0,
        percentage: 0,
      };
    }

    let percentage = 0;
    switch (transactionType) {
      case 'swap':
        percentage = config.swapPercentage;
        break;
      case 'send':
        percentage = config.sendPercentage;
        break;
      case 'buy':
        percentage = config.buyPercentage;
        break;
      case 'stake':
        percentage = config.stakePercentage;
        break;
      case 'unstake':
        percentage = config.unstakePercentage;
        break;
    }

    const cashbackAmount = (amountWei * BigInt(percentage)) / BigInt(100);
    const finalCashback = cashbackAmount > maximumWei ? maximumWei : cashbackAmount;

    return {
      cashbackAmount: finalCashback.toString(),
      cashbackAmountFormatted: Number(ethers.formatEther(finalCashback)),
      percentage,
    };
  }

  /**
   * Record a cashback transaction
   */
  async recordCashbackTransaction(
    userAddress: string,
    transactionHash: string,
    transactionType: 'swap' | 'send' | 'buy' | 'stake' | 'unstake',
    amount: string,
    tokenAddress?: string,
    tokenSymbol?: string,
    fromToken?: string,
    toToken?: string
  ): Promise<void> {
    try {
      const config = await this.getCashbackConfig();
      const cashback = this.calculateCashback(amount, transactionType, config);

      if (cashback.cashbackAmountFormatted === 0) {
        return; // No cashback earned
      }

      const response = await fetch(`${this.baseUrl}/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          transactionHash,
          transactionType,
          amount,
          cashbackAmount: cashback.cashbackAmount,
          cashbackPercentage: cashback.percentage,
          tokenAddress,
          tokenSymbol,
          fromToken,
          toToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to record cashback transaction: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error recording cashback transaction:', error);
      throw error;
    }
  }
}
