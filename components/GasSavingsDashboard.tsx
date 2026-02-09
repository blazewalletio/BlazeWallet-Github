'use client';

/**
 * 🔥 BLAZE WALLET - GAS SAVINGS DASHBOARD
 * 
 * Beautiful savings tracker showing:
 * - Total savings all-time
 * - This month savings
 * - Savings per chain
 * - Best single saving
 * - Savings leaderboard position
 * - Recent savings history
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingDown, DollarSign, Trophy, Calendar,
  Clock, Zap, BarChart3, Award, Sparkles, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface SavingsStats {
  totalSavingsUSD: number;
  savingsThisMonthUSD: number;
  averageSavingsPerTxUSD: number;
  bestSingleSavingUSD: number;
  totalTransactions: number;
  scheduledTransactions: number;
  percentile: number;
  savingsPerChain: Record<string, number>;
}

interface RecentSaving {
  id: string;
  chain: string;
  savingsUSD: number;
  executedAt: string;
  transactionHash: string;
}

interface GasSavingsDashboardProps {
  userId: string;
}

export default function GasSavingsDashboard({ userId }: GasSavingsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SavingsStats | null>(null);
  const [recentSavings, setRecentSavings] = useState<RecentSaving[]>([]);

  useEffect(() => {
    loadSavingsData();
  }, [userId]);

  const loadSavingsData = async () => {
    setLoading(true);

    try {
      // Get user stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_savings_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }

      if (statsData) {
        const data = statsData as any;
        setStats({
          totalSavingsUSD: data.total_savings_usd || 0,
          savingsThisMonthUSD: data.savings_this_month_usd || 0,
          averageSavingsPerTxUSD: data.average_savings_per_tx_usd || 0,
          bestSingleSavingUSD: data.best_single_saving_usd || 0,
          totalTransactions: data.total_transactions || 0,
          scheduledTransactions: data.scheduled_transactions || 0,
          percentile: data.percentile || 0,
          savingsPerChain: data.savings_per_chain || {},
        });
      } else {
        // No data yet
        setStats({
          totalSavingsUSD: 0,
          savingsThisMonthUSD: 0,
          averageSavingsPerTxUSD: 0,
          bestSingleSavingUSD: 0,
          totalTransactions: 0,
          scheduledTransactions: 0,
          percentile: 0,
          savingsPerChain: {},
        });
      }

      // Get recent savings
      const { data: savingsData, error: savingsError } = await supabase
        .from('transaction_savings')
        .select('*')
        .eq('user_id', userId)
        .eq('was_scheduled', true)
        .order('executed_at', { ascending: false })
        .limit(10);

      if (savingsError) {
        throw savingsError;
      }

      setRecentSavings((savingsData as any)?.map((s: any) => ({
        id: s.id,
        chain: s.chain,
        savingsUSD: s.savings_usd,
        executedAt: s.executed_at,
        transactionHash: s.transaction_hash,
      })) || []);

    } catch (error: any) {
      logger.error('[Savings Dashboard] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPercentileText = (percentile: number) => {
    if (percentile >= 95) return 'Top 5% 🏆';
    if (percentile >= 90) return 'Top 10% 🌟';
    if (percentile >= 75) return 'Top 25% ⭐';
    if (percentile >= 50) return 'Top 50% ✨';
    return 'Keep going! 💪';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading your savings...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No savings data yet</p>
        <p className="text-sm text-gray-500 mt-2">Start using Smart Send to track your savings!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Savings */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-green-700 font-medium">Total Saved</p>
          </div>
          <p className="text-3xl font-bold text-green-900">
            ${stats.totalSavingsUSD.toFixed(2)}
          </p>
          <p className="text-sm text-green-600 mt-1">
            from {stats.scheduledTransactions} smart sends
          </p>
        </motion.div>

        {/* This Month */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-blue-700 font-medium">This Month</p>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            ${stats.savingsThisMonthUSD.toFixed(2)}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            saved on gas fees
          </p>
        </motion.div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Average per TX */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <p className="text-xs text-gray-600 font-medium">Avg per TX</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            ${stats.averageSavingsPerTxUSD.toFixed(2)}
          </p>
        </div>

        {/* Best Single Saving */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <p className="text-xs text-gray-600 font-medium">Best Save</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            ${stats.bestSingleSavingUSD.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Leaderboard Position */}
      {stats.percentile > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-purple-900">
                  {getPercentileText(stats.percentile)}
                </p>
                <p className="text-sm text-purple-700">
                  of all Blaze users
                </p>
              </div>
            </div>
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      )}

      {/* Savings per Chain */}
      {Object.keys(stats.savingsPerChain).length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">Savings by Chain</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(stats.savingsPerChain)
              .sort(([, a], [, b]) => b - a)
              .map(([chain, savings]) => (
                <div key={chain} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700 uppercase">
                        {chain.slice(0, 3)}
                      </span>
                    </div>
                    <span className="font-medium text-gray-700 capitalize">
                      {chain}
                    </span>
                  </div>
                  <span className="font-bold text-green-600">
                    ${savings.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Savings */}
      {recentSavings.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">Recent Savings</h3>
          </div>

          <div className="space-y-3">
            {recentSavings.map(saving => (
              <div key={saving.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 capitalize">
                    {saving.chain}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(saving.executedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    +${saving.savingsUSD.toFixed(2)}
                  </p>
                  <a
                    href={`https://etherscan.io/tx/${saving.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View TX
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.totalSavingsUSD === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Start Saving on Gas!</h3>
          <p className="text-gray-600 max-w-sm mx-auto mb-4">
            Use Smart Send to schedule transactions at optimal times and start tracking your savings.
          </p>
          <button
            onClick={loadSavingsData}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:shadow-lg transition-all inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

