'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, TrendingUp, Zap, Crown, Gift, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { StakingService, StakeInfo, StakingStats } from '@/lib/staking-service';
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

export default function StakingDashboard() {
  const { address, wallet } = useWalletStore();
  
  const [amount, setAmount] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<0 | 180 | 365>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [balance, setBalance] = useState('0');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const stakingPlans = [
    {
      lockPeriod: 0 as const,
      name: 'Flexible',
      apy: 8,
      lockDays: 0,
      icon: Zap,
      color: 'from-blue-500 to-cyan-500',
      description: 'Unstake anytime',
    },
    {
      lockPeriod: 180 as const,
      name: '6 Months',
      apy: 15,
      lockDays: 180,
      icon: TrendingUp,
      color: 'from-purple-500 to-pink-500',
      description: 'Higher rewards',
    },
    {
      lockPeriod: 365 as const,
      name: '1 Year',
      apy: 20,
      lockDays: 365,
      icon: Crown,
      color: 'from-orange-500 to-yellow-500',
      description: 'Maximum rewards',
    },
  ];

  // Load data
  useEffect(() => {
    loadStakingData();
  }, [address, wallet]);

  const loadStakingData = async () => {
    if (!address || !wallet) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Create connected wallet with provider
      let walletWithProvider = wallet;
      if (!wallet.provider) {
        const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
        walletWithProvider = wallet.connect(provider);
      }

      const stakingService = new StakingService(wallet);

      const [stake, stats, bal] = await Promise.all([
        stakingService.getStakeInfo(address),
        stakingService.getStakingStats(address),
        stakingService.getBalance(address),
      ]);

      setStakeInfo(stake);
      setStakingStats(stats);
      setBalance(bal);
      setError('');
    } catch (err: any) {
      logger.error('Error loading staking data:', err);
      // Don't show error for loading issues, just log them
      logger.log('Could not load staking data - wallet might not be connected');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProjectedRewards = () => {
    if (!amount || parseFloat(amount) === 0) return 0;
    const plan = stakingPlans.find(p => p.lockPeriod === selectedPlan);
    if (!plan) return 0;
    
    const amountNum = parseFloat(amount);
    return (amountNum * plan.apy) / 100;
  };

  const handleStake = async () => {
    if (!address || !wallet) {
      setError('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(balance)) {
      setError('Insufficient BLAZE balance');
      return;
    }

    try {
      setIsStaking(true);
      setError('');
      setSuccess('');

      // Create connected wallet
      let walletWithProvider = wallet;
      if (!wallet.provider) {
        const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
        walletWithProvider = wallet.connect(provider);
      }

      const stakingService = new StakingService(wallet);
      const txHash = await stakingService.stake(amount, selectedPlan);

      setSuccess(`Successfully staked ${amount} BLAZE!`);
      setAmount('');
      
      // Reload data
      await loadStakingData();
    } catch (err: any) {
      logger.error('Error staking:', err);
      
      // Simplify error messages for better UX
      let errorMessage = 'Failed to stake tokens';
      if (err.message.includes('user rejected') || err.message.includes('rejected')) {
        errorMessage = 'Transaction was cancelled';
      } else if (err.message.includes('insufficient')) {
        errorMessage = 'Insufficient balance';
      } else if (err.message.includes('allowance')) {
        errorMessage = 'Please approve tokens first';
      } else if (err.message.includes('network')) {
        errorMessage = 'Network error. Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!address || !wallet) {
      setError('Please connect your wallet');
      return;
    }

    if (!stakeInfo) {
      setError('No active stake found');
      return;
    }

    try {
      setIsUnstaking(true);
      setError('');
      setSuccess('');

      let walletWithProvider = wallet;
      if (!wallet.provider) {
        const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
        walletWithProvider = wallet.connect(provider);
      }

      const stakingService = new StakingService(wallet);
      const txHash = await stakingService.unstake();

      setSuccess(`Successfully unstaked! Tx: ${txHash.slice(0, 10)}...`);
      
      // Reload data
      await loadStakingData();
    } catch (err: any) {
      logger.error('Error unstaking:', err);
      setError(err.message || 'Failed to unstake tokens');
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!address || !wallet) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setIsClaiming(true);
      setError('');
      setSuccess('');

      let walletWithProvider = wallet;
      if (!wallet.provider) {
        const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
        walletWithProvider = wallet.connect(provider);
      }

      const stakingService = new StakingService(wallet);
      const txHash = await stakingService.claimRewards();

      setSuccess(`Successfully claimed rewards! Tx: ${txHash.slice(0, 10)}...`);
      
      // Reload data
      await loadStakingData();
    } catch (err: any) {
      logger.error('Error claiming rewards:', err);
      setError(err.message || 'Failed to claim rewards');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading staking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Lock className="w-6 h-6 text-orange-500" />
          Stake BLAZE
        </h2>
        <p className="text-gray-600">
          Lock your BLAZE tokens and earn up to 20% APY rewards
        </p>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
              <button 
                onClick={() => setError('')} 
                className="text-red-500 hover:text-red-700 text-lg font-bold"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-700 text-sm font-medium">{success}</p>
              </div>
              <button 
                onClick={() => setSuccess('')} 
                className="text-green-500 hover:text-green-700 text-lg font-bold"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-semibold">Your Staked</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">
            {stakingStats?.userStakedFormatted.toFixed(2) || '0'} BLAZE
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {stakeInfo ? `Lock: ${stakeInfo.lockPeriodName}` : 'No active stake'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold">Pending Rewards</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {stakingStats?.pendingRewardsFormatted.toFixed(4) || '0'} BLAZE
          </div>
          <div className="text-sm text-gray-600 mt-1">
            APY: {stakingStats?.stakingAPY || 0}%
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-semibold">Status</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {stakingStats?.isPremium ? 'Premium ✨' : 'Standard'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {stakingStats?.isPremium ? 'Premium benefits active' : 'Stake 1000+ for premium'}
          </div>
        </motion.div>
      </div>

      {/* Current Stake Info */}
      {stakeInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Current Stake</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Amount</div>
              <div className="text-lg font-semibold">{stakeInfo.amountFormatted.toFixed(2)} BLAZE</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Lock Period</div>
              <div className="text-lg font-semibold">{stakeInfo.lockPeriodName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">APY</div>
              <div className="text-lg font-semibold text-green-600">{stakeInfo.apy}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Unlock Date</div>
              <div className="text-lg font-semibold">
                {stakeInfo.isLocked ? stakeInfo.unlockDate.toLocaleDateString() : 'Anytime'}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleUnstake}
              disabled={!stakeInfo.canUnstake || isUnstaking}
              className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isUnstaking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Unstaking...
                </>
              ) : (
                <>Unstake All</>
              )}
            </button>
            
            <button
              onClick={handleClaimRewards}
              disabled={isClaiming || (stakingStats?.pendingRewardsFormatted || 0) === 0}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  Claim Rewards
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Staking Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold mb-4">
          {stakeInfo ? 'Stake More' : 'Start Staking'}
        </h3>

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="text-sm text-gray-700 mb-2 block font-medium">Amount to Stake</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-20 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                BLAZE
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Available: {parseFloat(balance).toFixed(2)} BLAZE
            </div>
          </div>

          {/* Staking Plans */}
          <div>
            <label className="text-sm text-gray-700 mb-2 block font-medium">Select Plan</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {stakingPlans.map((plan) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan === plan.lockPeriod;
                return (
                  <motion.button
                    key={plan.lockPeriod}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedPlan(plan.lockPeriod)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `bg-gradient-to-br ${plan.color} border-transparent text-white`
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-900'
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-2" />
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-2xl font-bold my-1">{plan.apy}% APY</div>
                    <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                      {plan.description}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Projected Rewards */}
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-green-50 border border-green-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">Projected yearly rewards:</span>
                <span className="text-lg font-semibold text-green-600">
                  +{calculateProjectedRewards().toFixed(2)} BLAZE
                </span>
              </div>
            </motion.div>
          )}

          {/* Stake Button */}
          <button
            onClick={handleStake}
            disabled={!amount || parseFloat(amount) <= 0 || isStaking}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isStaking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Staking...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Stake BLAZE
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-700">
            <Zap className="w-4 h-4" />
            How Staking Works
          </h4>
          <p className="text-sm text-blue-600">
            Lock your BLAZE tokens for a chosen period to earn rewards. Longer lock periods = higher APY. 
            Rewards are calculated and distributed automatically.
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-orange-700">
            <Crown className="w-4 h-4" />
            Premium Benefits
          </h4>
          <p className="text-sm text-orange-600">
            Hold 1000+ BLAZE (staked or unstaked) to unlock premium features: 50% NFT discount, 
            2x cashback, and exclusive governance voting power.
          </p>
        </div>
      </div>
    </div>
  );
}
