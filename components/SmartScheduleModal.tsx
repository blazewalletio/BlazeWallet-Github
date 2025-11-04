// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULE MODAL
// ============================================================================
// Beautiful, intuitive modal for scheduling transactions at optimal gas times
// Features:
// - Real-time gas price display
// - Optimal timing suggestions with AI
// - Estimated savings calculator
// - Mobile-first, Blaze theme
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartSchedulerService, type ScheduleOptions } from '@/lib/smart-scheduler-service';
import { gasPriceService } from '@/lib/gas-price-service';
import { useWalletStore } from '@/lib/wallet-store';

interface SmartScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  onScheduled?: () => void;
}

type ScheduleMode = 'optimal' | 'custom' | 'threshold';

export default function SmartScheduleModal({
  isOpen,
  onClose,
  chain,
  fromAddress,
  toAddress,
  amount,
  tokenAddress,
  tokenSymbol = 'native',
  onScheduled,
}: SmartScheduleModalProps) {
  const { address: walletAddress } = useWalletStore();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('wallet_email') || walletAddress : '';

  const [mode, setMode] = useState<ScheduleMode>('optimal');
  const [loading, setLoading] = useState(false);
  const [currentGasPrice, setCurrentGasPrice] = useState<number>(0);
  const [optimalTiming, setOptimalTiming] = useState<any>(null);
  const [customTime, setCustomTime] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');
  const [gasThreshold, setGasThreshold] = useState<string>('');
  const [maxWaitHours, setMaxWaitHours] = useState<number>(24);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [estimatedSavings, setEstimatedSavings] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Load current gas price and optimal timing
  useEffect(() => {
    if (isOpen) {
      loadGasData();
    }
  }, [isOpen, chain]);

  const loadGasData = async () => {
    try {
      const gasData = await gasPriceService.getGasPrice(chain);
      if (gasData) {
        setCurrentGasPrice(gasData.standard);
        setEstimatedCost(await smartSchedulerService.estimateTransactionCost(chain, gasData.standard));
      }

      const timing = await smartSchedulerService.calculateOptimalTiming(chain);
      setOptimalTiming(timing);
      setEstimatedSavings(estimatedCost * (timing.estimated_savings_percent / 100));
    } catch (err) {
      console.error('Failed to load gas data:', err);
    }
  };

  const handleSchedule = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!userId) {
        throw new Error('Please connect your wallet first');
      }

      let scheduleOptions: ScheduleOptions = {
        user_id: userId,
        chain,
        from_address: fromAddress,
        to_address: toAddress,
        amount,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        schedule_type: mode === 'custom' ? 'specific_time' : mode === 'threshold' ? 'gas_threshold' : 'optimal',
        max_wait_hours: maxWaitHours,
        priority: 'standard',
      };

      if (mode === 'optimal') {
        // Use AI-recommended optimal time
        scheduleOptions.scheduled_for = optimalTiming?.optimal_time || new Date(Date.now() + 3 * 60 * 60 * 1000);
      } else if (mode === 'custom') {
        // Use custom date/time
        if (!customDate || !customTime) {
          throw new Error('Please select date and time');
        }
        const scheduledFor = new Date(`${customDate}T${customTime}`);
        if (scheduledFor <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        scheduleOptions.scheduled_for = scheduledFor;
      } else if (mode === 'threshold') {
        // Use gas threshold
        if (!gasThreshold) {
          throw new Error('Please enter gas price threshold');
        }
        scheduleOptions.optimal_gas_threshold = parseFloat(gasThreshold);
      }

      await smartSchedulerService.scheduleTransaction(scheduleOptions);

      setSuccess('Transaction scheduled successfully!');
      setTimeout(() => {
        onScheduled?.();
        onClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to schedule transaction');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1a1a2e] w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white">⚡ Smart Schedule</h2>
                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-white/90 text-sm">Save money by sending at optimal gas prices</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] sm:max-h-[600px] overflow-y-auto">
            {/* Current Gas Price Card */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 mb-6 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Current Gas Price</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-xs">Live</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {smartSchedulerService.formatGasPrice(currentGasPrice, chain)}
              </div>
              <div className="text-sm text-gray-400">
                ≈ ${estimatedCost.toFixed(4)} USD per transaction
              </div>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="text-gray-300 text-sm font-medium mb-3 block">Schedule Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setMode('optimal')}
                  className={`p-3 rounded-xl transition-all ${
                    mode === 'optimal'
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="text-xl mb-1">🎯</div>
                  <div className="text-xs font-medium">Optimal</div>
                </button>
                <button
                  onClick={() => setMode('custom')}
                  className={`p-3 rounded-xl transition-all ${
                    mode === 'custom'
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="text-xl mb-1">📅</div>
                  <div className="text-xs font-medium">Custom</div>
                </button>
                <button
                  onClick={() => setMode('threshold')}
                  className={`p-3 rounded-xl transition-all ${
                    mode === 'threshold'
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="text-xl mb-1">⚙️</div>
                  <div className="text-xs font-medium">Threshold</div>
                </button>
              </div>
            </div>

            {/* Optimal Mode */}
            {mode === 'optimal' && optimalTiming && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 mb-6 border border-green-500/20"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">🤖</div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">AI Recommendation</h3>
                    <p className="text-gray-400 text-sm">
                      Execute in ~3 hours for optimal savings
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Predicted Gas</div>
                    <div className="text-green-400 font-semibold">
                      {smartSchedulerService.formatGasPrice(optimalTiming.predicted_optimal_gas, chain)}
                    </div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Est. Savings</div>
                    <div className="text-green-400 font-semibold">
                      ~{optimalTiming.estimated_savings_percent}%
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Custom Time Mode */}
            {mode === 'custom' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 space-y-4"
              >
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Date</label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Time</label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </motion.div>
            )}

            {/* Threshold Mode */}
            {mode === 'threshold' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <label className="text-gray-300 text-sm font-medium mb-2 block">
                  Execute when gas price drops below:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={gasThreshold}
                    onChange={(e) => setGasThreshold(e.target.value)}
                    placeholder={currentGasPrice.toFixed(2)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    {chain === 'solana' ? 'µlamports' : chain.includes('bitcoin') ? 'sat/vB' : 'gwei'}
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  We'll execute your transaction automatically when gas drops to this level
                </p>
              </motion.div>
            )}

            {/* Max Wait Time */}
            <div className="mb-6">
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Maximum wait time: {maxWaitHours} hours
              </label>
              <input
                type="range"
                min="1"
                max="72"
                value={maxWaitHours}
                onChange={(e) => setMaxWaitHours(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1h</span>
                <span>72h</span>
              </div>
            </div>

            {/* Transaction Summary */}
            <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-medium">{amount} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">To</span>
                <span className="text-white font-mono text-xs">
                  {toAddress.slice(0, 6)}...{toAddress.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Chain</span>
                <span className="text-white capitalize">{chain}</span>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4"
              >
                <p className="text-red-400 text-sm">{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4"
              >
                <p className="text-green-400 text-sm">✅ {success}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Scheduling...</span>
                  </div>
                ) : (
                  '⚡ Schedule Transaction'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

