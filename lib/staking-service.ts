import { ethers } from 'ethers';
import { CONTRACTS, BlazeTokenABI } from './contracts-config';
import { logger } from '@/lib/logger';

export interface StakeInfo {
  amount: string;
  amountFormatted: number;
  timestamp: number;
  lockPeriod: number;
  lockPeriodName: string;
  rewardDebt: string;
  currentReward: string;
  currentRewardFormatted: number;
  apy: number;
  unlockDate: Date;
  isLocked: boolean;
  canUnstake: boolean;
}

export interface StakingStats {
  totalStaked: string;
  totalStakedFormatted: number;
  userStaked: string;
  userStakedFormatted: number;
  pendingRewards: string;
  pendingRewardsFormatted: number;
  isPremium: boolean;
  stakingAPY: number;
}

export class StakingService {
  private contract: ethers.Contract;
  private wallet: ethers.Signer;

  constructor(wallet: ethers.Signer) {
    this.wallet = wallet;
    this.contract = new ethers.Contract(
      CONTRACTS.blazeToken,
      BlazeTokenABI.abi,
      wallet
    );
  }

  /**
   * Get user's stake info
   */
  async getStakeInfo(address: string): Promise<StakeInfo | null> {
    try {
      const stake = await this.contract.getStakeInfo(address);
      
      const amount = stake.amount;
      const timestamp = Number(stake.timestamp);
      const lockPeriod = Number(stake.lockPeriod);
      const rewardDebt = stake.pendingReward || '0'; // Use pendingReward as rewardDebt

      // If no stake, return null
      if (amount === 0n) {
        return null;
      }

      // Calculate current rewards
      const currentReward = await this.contract.calculateReward(address);

      // Determine APY based on lock period
      let apy = 8; // Flexible
      let lockPeriodName = 'Flexible';
      
      if (lockPeriod === 180) {
        apy = 15;
        lockPeriodName = '6 months';
      } else if (lockPeriod === 365) {
        apy = 20;
        lockPeriodName = '1 year';
      }

      // Calculate unlock date
      const unlockTimestamp = timestamp + (lockPeriod * 24 * 60 * 60);
      const unlockDate = new Date(unlockTimestamp * 1000);
      const isLocked = lockPeriod > 0;
      const canUnstake = !isLocked || Date.now() >= unlockTimestamp * 1000;

      return {
        amount: amount.toString(),
        amountFormatted: Number(ethers.formatEther(amount)),
        timestamp,
        lockPeriod,
        lockPeriodName,
        rewardDebt: rewardDebt.toString(),
        currentReward: currentReward.toString(),
        currentRewardFormatted: Number(ethers.formatEther(currentReward)),
        apy,
        unlockDate,
        isLocked,
        canUnstake,
      };
    } catch (error) {
      logger.error('Error getting stake info:', error);
      throw error;
    }
  }

  /**
   * Get overall staking statistics
   */
  async getStakingStats(userAddress: string): Promise<StakingStats> {
    try {
      const [totalStaked, userStake, userBalance] = await Promise.all([
        this.contract.totalStaked(),
        this.contract.getStakeInfo(userAddress),
        this.contract.balanceOf(userAddress),
      ]);

      const userStakedAmount = userStake.amount;
      const pendingRewards = await this.contract.calculateReward(userAddress);

      // Check premium status (1000+ BLAZE)
      const premiumThreshold = ethers.parseEther('1000');
      const totalBalance = userBalance + userStakedAmount;
      const isPremium = totalBalance >= premiumThreshold;

      // Determine user's APY
      const lockPeriod = Number(userStake.lockPeriod);
      let stakingAPY = 8;
      if (lockPeriod === 180) stakingAPY = 15;
      else if (lockPeriod === 365) stakingAPY = 20;

      return {
        totalStaked: totalStaked.toString(),
        totalStakedFormatted: Number(ethers.formatEther(totalStaked)),
        userStaked: userStakedAmount.toString(),
        userStakedFormatted: Number(ethers.formatEther(userStakedAmount)),
        pendingRewards: pendingRewards.toString(),
        pendingRewardsFormatted: Number(ethers.formatEther(pendingRewards)),
        isPremium,
        stakingAPY,
      };
    } catch (error) {
      logger.error('Error getting staking stats:', error);
      throw error;
    }
  }

  /**
   * Stake tokens
   */
  async stake(amount: string, lockPeriod: number): Promise<string> {
    try {
      // Validate lock period
      if (![0, 180, 365].includes(lockPeriod)) {
        throw new Error('Invalid lock period. Must be 0, 180, or 365 days');
      }

      const amountWei = ethers.parseEther(amount);

      // First approve the contract to spend tokens
      logger.log('Approving tokens...');
      const approveTx = await this.contract.approve(
        CONTRACTS.blazeToken,
        amountWei
      );
      await approveTx.wait();
      logger.log('Tokens approved');

      // Then stake
      logger.log('Staking tokens...');
      const tx = await this.contract.stakeTokens(amountWei, lockPeriod);
      const receipt = await tx.wait();

      logger.log('Stake successful!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error staking:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      throw new Error(error.message || 'Failed to stake tokens');
    }
  }

  /**
   * Unstake tokens and claim rewards
   */
  async unstake(): Promise<string> {
    try {
      logger.log('Unstaking tokens...');
      const tx = await this.contract.unstakeTokens();
      const receipt = await tx.wait();

      logger.log('Unstake successful!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error unstaking:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      if (error.message.includes('Still locked')) {
        throw new Error('Tokens are still locked. Check unlock date.');
      }
      throw new Error(error.message || 'Failed to unstake tokens');
    }
  }

  /**
   * Claim rewards without unstaking
   */
  async claimRewards(): Promise<string> {
    try {
      logger.log('Claiming rewards...');
      const tx = await this.contract.claimRewards();
      const receipt = await tx.wait();

      logger.log('Rewards claimed!');
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error claiming rewards:', error);
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      throw new Error(error.message || 'Failed to claim rewards');
    }
  }

  /**
   * Calculate projected rewards for a given amount and period
   */
  calculateProjectedRewards(amount: number, lockPeriod: number, days: number = 365): number {
    let apy = 0.08; // 8% for flexible
    
    if (lockPeriod === 180) {
      apy = 0.15; // 15% for 6 months
    } else if (lockPeriod === 365) {
      apy = 0.20; // 20% for 1 year
    }

    const dailyRate = apy / 365;
    const reward = amount * dailyRate * days;

    return reward;
  }

  /**
   * Get user's BLAZE balance
   */
  async getBalance(address: string): Promise<string> {
    try {
      logger.log('🔍 Getting balance for address:', address);
      logger.log('🔍 Using contract address:', this.contract.target);
      
      const balance = await this.contract.balanceOf(address);
      const formattedBalance = ethers.formatEther(balance);
      
      logger.log('🔍 Raw balance:', balance.toString());
      logger.log('🔍 Formatted balance:', formattedBalance);
      
      return formattedBalance;
    } catch (error) {
      logger.error('❌ Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Check if user has approved enough tokens
   */
  async getAllowance(owner: string, spender: string): Promise<string> {
    try {
      const allowance = await this.contract.allowance(owner, spender);
      return ethers.formatEther(allowance);
    } catch (error) {
      logger.error('Error getting allowance:', error);
      throw error;
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return CONTRACTS.blazeToken;
  }
}

