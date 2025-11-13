// ============================================================================
// 🔥 BLAZE WALLET - SAVINGS TRACKER
// ============================================================================
// Beautiful visualization of gas savings from Smart Scheduler
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { smartSchedulerService, type SavingsStats } from '@/lib/smart-scheduler-service';
import { useWalletStore } from '@/lib/wallet-store';
import { logger } from '@/lib/logger';

export default function SavingsTracker() {
  const { address: walletAddress } = useWalletStore();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('wallet_email') || walletAddress : '';

  const [stats, setStats] = useState<SavingsStats | null>(null);
  const [recentSavings, setRecentSavings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavings();
  }, [userId]);

  const loadSavings = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const data = await smartSchedulerService.getSavingsStats(userId);
      setStats(data.stats);
      setRecentSavings(data.recent_savings);
    } catch (error) {
      logger.error('Failed to load savings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] rounded-2xl p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats || stats.total_transactions === 0) {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/20">
        <div className="text-center">
          <div className="text-4xl mb-3">💰</div>
          <h3 className="text-white font-bold mb-2">Start Saving on Gas!</h3>
          <p className="text-gray-400 text-sm">
            Schedule your transactions to save money on gas fees
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden">
      {/* Header with Total Savings */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">💰</span>
            <h2 className="text-2xl font-bold text-white">Gas Savings</h2>
          </div>
          <div className="text-5xl font-bold text-white mb-2">
            ${stats.total_savings_usd.toFixed(2)}
          </div>
          <p className="text-white/90 text-sm">
            Total saved across {stats.total_transactions} transactions
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20"
          >
            <div className="text-gray-400 text-xs mb-1">Avg per Transaction</div>
            <div className="text-white text-2xl font-bold">
              ${stats.average_savings_per_tx_usd.toFixed(4)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 rounded-xl p-4 border border-orange-500/20"
          >
            <div className="text-gray-400 text-xs mb-1">Best Single Save</div>
            <div className="text-white text-2xl font-bold">
              ${stats.best_single_saving_usd.toFixed(4)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20"
          >
            <div className="text-gray-400 text-xs mb-1">Scheduled Txs</div>
            <div className="text-white text-2xl font-bold">
              {stats.scheduled_transactions}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-4 border border-yellow-500/20"
          >
            <div className="text-gray-400 text-xs mb-1">Total Txs</div>
            <div className="text-white text-2xl font-bold">
              {stats.total_transactions}
            </div>
          </motion.div>
        </div>

        {/* Savings by Chain */}
        {Object.keys(stats.savings_per_chain).length > 0 && (
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>Savings by Chain</span>
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.savings_per_chain)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([chain, savings], index) => {
                  const percentage = ((savings as number) / stats.total_savings_usd) * 100;
                  return (
                    <motion.div
                      key={chain}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="bg-white/5 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white capitalize font-medium">{chain}</span>
                        <span className="text-green-400 font-semibold">${(savings as number).toFixed(4)}</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.6 + index * 0.1, duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                        ></motion.div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Recent Savings */}
        {recentSavings.length > 0 && (
          <div>
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>🕒</span>
              <span>Recent Savings (Last 30 Days)</span>
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {recentSavings.slice(0, 10).map((saving, index) => (
                <motion.div
                  key={saving.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                  className="bg-white/5 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      saving.savings_usd > 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="text-white text-sm capitalize">{saving.chain}</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(saving.executed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className={`font-semibold text-sm ${
                    saving.savings_usd > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {saving.savings_usd > 0 ? '+' : ''}${saving.savings_usd.toFixed(4)}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-6 bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-xl p-4 border border-orange-500/20 text-center"
        >
          <div className="text-2xl mb-2">🎉</div>
          <p className="text-white font-semibold mb-1">You're a smart trader!</p>
          <p className="text-gray-400 text-sm">
            Keep scheduling transactions to maximize your savings
          </p>
        </motion.div>
      </div>
    </div>
  );
}

