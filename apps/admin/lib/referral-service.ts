import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

export interface ReferralData {
  userAddress: string;
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  totalEarned: string;
  totalEarnedFormatted: number;
  pendingRewards: string;
  pendingRewardsFormatted: number;
  lifetimeEarnings: string;
  lifetimeEarningsFormatted: number;
  referrerAddress?: string; // Who referred this user
  referralDate?: number; // When this user was referred
}

export interface ReferralTransaction {
  id: string;
  referrerAddress: string;
  referredAddress: string;
  transactionType: 'signup' | 'transaction_fee' | 'cashback_share';
  amount: string;
  amountFormatted: number;
  status: 'pending' | 'confirmed' | 'claimed';
  timestamp: number;
  transactionHash?: string;
  originalTransactionHash?: string; // For fee sharing transactions
  description: string;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: string;
  totalEarnedFormatted: number;
  pendingRewards: string;
  pendingRewardsFormatted: number;
  lifetimeEarnings: string;
  lifetimeEarningsFormatted: number;
  activeReferrals: number; // Referrals who are still active users
  averageEarningsPerReferral: number;
  topReferralEarnings: number;
}

export interface ReferralConfig {
  signupReward: string; // BLAZE tokens for each signup
  signupRewardFormatted: number;
  feeSharePercentage: number; // Percentage of referred user's fees
  minimumTransactionForFeeShare: string; // Minimum transaction amount to earn fee share
  maximumFeeSharePerTransaction: string; // Maximum fee share per transaction
}

export class ReferralService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/referral';
  }

  /**
   * Get referral data for a user
   */
  async getReferralData(userAddress: string): Promise<ReferralData> {
    try {
      const response = await fetch(`${this.baseUrl}/data?address=${userAddress}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch referral data: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching referral data:', error);
      throw error;
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userAddress: string): Promise<ReferralStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats?address=${userAddress}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch referral stats: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching referral stats:', error);
      throw error;
    }
  }

  /**
   * Get referral transactions for a user
   */
  async getReferralTransactions(userAddress: string, limit: number = 10): Promise<ReferralTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/transactions?address=${userAddress}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch referral transactions: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching referral transactions:', error);
      throw error;
    }
  }

  /**
   * Get referral configuration
   */
  async getReferralConfig(): Promise<ReferralConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch referral config: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching referral config:', error);
      throw error;
    }
  }

  /**
   * Claim pending referral rewards
   */
  async claimReferralRewards(userAddress: string, wallet: ethers.Signer): Promise<string> {
    try {
      // First, check if there are pending rewards
      const stats = await this.getReferralStats(userAddress);
      if (parseFloat(stats.pendingRewardsFormatted.toString()) === 0) {
        throw new Error('No pending referral rewards to claim');
      }

      // Create a transaction to claim referral rewards
      const response = await fetch(`${this.baseUrl}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          amount: stats.pendingRewards,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to claim referral rewards: ${response.statusText}`);
      }

      const result = await response.json();
      return result.transactionHash;
    } catch (error) {
      logger.error('Error claiming referral rewards:', error);
      throw error;
    }
  }

  /**
   * Generate a unique referral code for a user
   */
  generateReferralCode(userAddress: string): string {
    // Create a short, unique code based on address
    const addressHash = ethers.keccak256(ethers.toUtf8Bytes(userAddress));
    const codeSuffix = addressHash.slice(2, 8).toUpperCase();
    return `BLAZE-${codeSuffix}`;
  }

  /**
   * Create referral link
   */
  createReferralLink(referralCode: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://blazewallet.app';
    return `${baseUrl}/ref/${referralCode}`;
  }

  /**
   * Record a referral signup
   */
  async recordReferralSignup(
    referrerAddress: string,
    referredAddress: string,
    referralCode: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/record-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrerAddress,
          referredAddress,
          referralCode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to record referral signup: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error recording referral signup:', error);
      throw error;
    }
  }

  /**
   * Record a fee share transaction
   */
  async recordFeeShare(
    referrerAddress: string,
    referredAddress: string,
    originalTransactionHash: string,
    feeAmount: string,
    feeShareAmount: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/record-fee-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrerAddress,
          referredAddress,
          originalTransactionHash,
          feeAmount,
          feeShareAmount,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to record fee share: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error recording fee share:', error);
      throw error;
    }
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(referralCode: string): Promise<{
    isValid: boolean;
    referrerAddress?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/validate-code?code=${referralCode}`);
      if (!response.ok) {
        throw new Error(`Failed to validate referral code: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('Error validating referral code:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if user has a referral code
   */
  async hasReferralCode(userAddress: string): Promise<boolean> {
    try {
      const data = await this.getReferralData(userAddress);
      return !!data.referralCode;
    } catch (error) {
      logger.error('Error checking referral code:', error);
      return false;
    }
  }
}
