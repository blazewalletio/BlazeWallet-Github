// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULE MODAL
// ============================================================================
// Full-screen overlay for scheduling transactions at optimal gas times
// Styled exactly like SendModal for perfect theme consistency
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronDown } from 'lucide-react';
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
        scheduleOptions.scheduled_for = optimalTiming?.optimal_time || new Date(Date.now() + 3 * 60 * 60 * 1000);
      } else if (mode === 'custom') {
        if (!customDate || !customTime) {
          throw new Error('Please select date and time');
        }
        const scheduledFor = new Date(`${customDate}T${customTime}`);
        if (scheduledFor <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        scheduleOptions.scheduled_for = scheduledFor;
      } else if (mode === 'threshold') {
        if (!gasThreshold) {
          throw new Error('Please enter gas price threshold');
        }
        scheduleOptions.optimal_gas_threshold = parseFloat(gasThreshold);
      }

      await smartSchedulerService.scheduleTransaction(scheduleOptions);

      setSuccess('Transaction scheduled successfully!');
      setTimeout(() => {
        onScheduled?.();
        handleClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to schedule transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode('optimal');
    setCustomTime('');
    setCustomDate('');
    setGasThreshold('');
    setMaxWaitHours(24);
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            <div className="pt-4 pb-2">
              <button
                onClick={handleClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Smart schedule</h2>
                  <p className="text-sm text-gray-600">
                    Save money by sending at optimal gas prices
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pb-6">
              {/* Current Gas Price Card */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Current gas price</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 text-xs font-medium">Live</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {smartSchedulerService.formatGasPrice(currentGasPrice, chain)}
                </div>
                <div className="text-sm text-gray-600">
                  ≈ ${estimatedCost.toFixed(4)} USD per transaction
                </div>
              </div>

              {/* Mode Selection */}
              <div className="glass-card p-6">
                <label className="text-sm font-medium text-gray-900 mb-3 block">
                  Schedule type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setMode('optimal')}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      mode === 'optimal'
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-white border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">🎯</div>
                    <div className={`text-sm font-medium ${mode === 'optimal' ? 'text-orange-600' : 'text-gray-900'}`}>
                      Optimal
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('custom')}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      mode === 'custom'
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-white border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">📅</div>
                    <div className={`text-sm font-medium ${mode === 'custom' ? 'text-orange-600' : 'text-gray-900'}`}>
                      Custom
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('threshold')}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      mode === 'threshold'
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-white border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">⚙️</div>
                    <div className={`text-sm font-medium ${mode === 'threshold' ? 'text-orange-600' : 'text-gray-900'}`}>
                      Threshold
                    </div>
                  </button>
                </div>
              </div>

              {/* Optimal Mode */}
              {mode === 'optimal' && optimalTiming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="text-2xl">🤖</div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">AI recommendation</h3>
                      <p className="text-sm text-gray-600">
                        Execute in ~3 hours for optimal savings
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs text-gray-600 mb-1">Predicted gas</div>
                      <div className="text-green-600 font-semibold">
                        {smartSchedulerService.formatGasPrice(optimalTiming.predicted_optimal_gas, chain)}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs text-gray-600 mb-1">Est. savings</div>
                      <div className="text-green-600 font-semibold">
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
                  className="glass-card p-6 space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">Date</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">Time</label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </motion.div>
              )}

              {/* Threshold Mode */}
              {mode === 'threshold' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-6"
                >
                  <label className="text-sm font-medium text-gray-900 mb-2 block">
                    Execute when gas price drops below:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={gasThreshold}
                      onChange={(e) => setGasThreshold(e.target.value)}
                      placeholder={currentGasPrice.toFixed(2)}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      {chain === 'solana' ? 'µlamports' : chain.includes('bitcoin') ? 'sat/vB' : 'gwei'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    We'll execute your transaction automatically when gas drops to this level
                  </p>
                </motion.div>
              )}

              {/* Max Wait Time */}
              <div className="glass-card p-6">
                <label className="text-sm font-medium text-gray-900 mb-3 block">
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
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>1h</span>
                  <span>72h</span>
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Transaction summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-medium text-gray-900">{amount} {tokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">To</span>
                    <span className="font-mono text-xs text-gray-900">
                      {toAddress.slice(0, 6)}...{toAddress.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Chain</span>
                    <span className="font-medium text-gray-900 capitalize">{chain}</span>
                  </div>
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border-2 border-red-200 rounded-xl p-4"
                >
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 border-2 border-green-200 rounded-xl p-4"
                >
                  <p className="text-green-700 text-sm font-medium">✅ {success}</p>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Scheduling...</span>
                    </div>
                  ) : (
                    'Schedule transaction'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
