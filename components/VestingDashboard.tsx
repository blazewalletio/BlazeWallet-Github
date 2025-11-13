'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, TrendingUp, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import { logger } from '@/lib/logger';

export default function VestingDashboard() {
  // Mock vesting data - would be fetched via contract calls
  const [vestingInfo, setVestingInfo] = useState({
    totalAmount: 120_000_000, // 120M tokens
    releasedAmount: 0,
    releasableAmount: 0,
    remainingTime: 180 * 24 * 60 * 60 * 1000, // 180 days in ms
    vestingDuration: 180 * 24 * 60 * 60 * 1000,
  });

  const progress = ((vestingInfo.vestingDuration - vestingInfo.remainingTime) / vestingInfo.vestingDuration) * 100;
  const lockedAmount = vestingInfo.totalAmount - vestingInfo.releasedAmount;
  const currentValue = vestingInfo.totalAmount * 0.01; // At $0.01 per token

  const formatTimeRemaining = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''} ${days % 30} days`;
    }
    return `${days} days ${hours} hours`;
  };

  const handleClaimVesting = async () => {
    // TODO: Implement actual contract call
    logger.log('Claiming vested tokens...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Lock className="w-6 h-6 text-orange-500" />
          Founder Vesting
        </h2>
        <p className="text-gray-600">
          Your tokens are vesting over 6 months with linear unlock
        </p>
      </div>

      {/* Main Vesting Card */}
      <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Total Vested</div>
            <div className="text-3xl font-bold">
              <AnimatedNumber value={vestingInfo.totalAmount} decimals={0} suffix=" BLAZE" />
            </div>
            <div className="text-sm text-gray-600 mt-1">
              ≈ ${currentValue.toLocaleString()} at current price
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">Currently Locked</div>
            <div className="text-3xl font-bold text-orange-500">
              <AnimatedNumber value={lockedAmount} decimals={0} suffix=" BLAZE" />
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {((lockedAmount / vestingInfo.totalAmount) * 100).toFixed(1)}% of total
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Vesting Progress</span>
            <span className="font-semibold">{progress.toFixed(1)}%</span>
          </div>
          <div className="relative h-3 bg-white border border-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-yellow-500"
            />
          </div>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-500" />
            <div>
              <div className="font-semibold">Time Until Full Unlock</div>
              <div className="text-sm text-gray-600">{formatTimeRemaining(vestingInfo.remainingTime)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-500">
              {Math.ceil(vestingInfo.remainingTime / (24 * 60 * 60 * 1000))}
            </div>
            <div className="text-xs text-gray-600">days left</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-semibold">Released</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {vestingInfo.releasedAmount.toLocaleString()} BLAZE
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {((vestingInfo.releasedAmount / vestingInfo.totalAmount) * 100).toFixed(2)}% unlocked
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold">Claimable Now</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {vestingInfo.releasableAmount.toLocaleString()} BLAZE
          </div>
          <div className="text-sm text-gray-600 mt-1">
            ≈ ${(vestingInfo.releasableAmount * 0.01).toLocaleString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-semibold">Still Locked</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {lockedAmount.toLocaleString()} BLAZE
          </div>
          <div className="text-sm text-gray-600 mt-1">
            ≈ ${(lockedAmount * 0.01).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Claim Button */}
      {vestingInfo.releasableAmount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClaimVesting}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2"
        >
          Claim {vestingInfo.releasableAmount.toLocaleString()} BLAZE
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      )}

      {/* Vesting Schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Vesting Schedule</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between pb-3 border-b border-gray-200">
            <span className="text-gray-600">Type</span>
            <span className="font-semibold">Linear Vesting</span>
          </div>
          <div className="flex justify-between pb-3 border-b border-gray-200">
            <span className="text-gray-600">Duration</span>
            <span className="font-semibold">6 Months (180 days)</span>
          </div>
          <div className="flex justify-between pb-3 border-b border-gray-200">
            <span className="text-gray-600">Daily Unlock</span>
            <span className="font-semibold">
              {(vestingInfo.totalAmount / 180).toLocaleString()} BLAZE
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Full Unlock Date</span>
            <span className="font-semibold">
              {new Date(Date.now() + vestingInfo.remainingTime).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">Smart Vesting Strategy</p>
            <p className="text-blue-600">
              Tokens unlock linearly every day. You can claim them anytime, or wait and claim in bulk. 
              This shows long-term commitment to the project and community trust.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
