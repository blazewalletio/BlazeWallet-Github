'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, TrendingUp, Zap, ExternalLink, AlertCircle, CheckCircle2, ArrowRightLeft, Coins } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { CashbackService, CashbackStats, CashbackTransaction } from '@/lib/cashback-service';
import { logger } from '@/lib/logger';

interface CashbackTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CashbackTracker({ isOpen, onClose }: CashbackTrackerProps) {
  const { wallet } = useWalletStore();
  const [stats, setStats] = useState<CashbackStats | null>(null);
  const [recentCashback, setRecentCashback] = useState<CashbackTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  
  const cashbackService = new CashbackService();

  // Block body scroll when modal is open
  useBlockBodyScroll(isOpen);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, wallet]);

  const loadData = async () => {
    if (!wallet) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const userAddress = await wallet.getAddress();
      
      const [statsData, transactionsData] = await Promise.all([
        cashbackService.getCashbackStats(userAddress),
        cashbackService.getRecentCashback(userAddress, 5),
      ]);
      
      setStats(statsData);
      setRecentCashback(transactionsData);
    } catch (err: any) {
      logger.error('Error loading cashback data:', err);
      setError(err.message || 'Failed to load cashback data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!wallet || !stats || stats.pendingFormatted === 0) return;

    try {
      setIsClaiming(true);
      setError(null);
      setSuccess(null);
      
      const userAddress = await wallet.getAddress();
      const txHash = await cashbackService.claimCashback(userAddress, wallet);
      
      setSuccess(`Successfully claimed ${stats.pendingFormatted.toFixed(4)} BLAZE! Transaction: ${txHash.slice(0, 10)}...`);
      
      // Reload data
      await loadData();
      
    } catch (err: any) {
      logger.error('Error claiming cashback:', err);
      setError(err.message || 'Failed to claim cashback');
    } finally {
      setIsClaiming(false);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading cashback data...</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6 pb-24">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Cashback Rewards</h2>
                <p className="text-sm text-gray-600">
                  Earn 2% cashback in BLAZE on every transaction
                </p>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card p-4 mb-6 border-l-4 border-red-500"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                  <button 
                    onClick={() => setError(null)} 
                    className="text-red-500 hover:text-red-700 text-xl font-bold leading-none"
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
                className="glass-card p-4 mb-6 border-l-4 border-green-500"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                  <button 
                    onClick={() => setSuccess(null)} 
                    className="text-green-500 hover:text-green-700 text-xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
              >
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Gift className="w-5 h-5" />
                  <span className="text-sm font-semibold">Total Earned</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalEarnedFormatted.toFixed(4)}</div>
                <div className="text-sm text-gray-500 mt-1">
                  BLAZE earned all time
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
              >
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm font-semibold">This Month</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.thisMonthFormatted.toFixed(4)}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {stats.totalEarnedFormatted > 0 ? `+${((stats.thisMonthFormatted / stats.totalEarnedFormatted) * 100).toFixed(0)}% of total` : '0% of total'}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
              >
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                  <Zap className="w-5 h-5" />
                  <span className="text-sm font-semibold">Pending</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.pendingFormatted.toFixed(4)}</div>
                <div className="text-sm text-gray-500 mt-1">
                  BLAZE claimable now
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
              >
                <div className="flex items-center gap-2 text-purple-600 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm font-semibold">Transactions</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.transactions}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Total rewarded
                </div>
              </motion.div>
            </div>
          )}

          {/* How it Works */}
          <div className="glass-card mb-6 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How Cashback Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center mb-3">
                  <ArrowRightLeft className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Make a Transaction</h4>
                <p className="text-sm text-gray-600">
                  Swap, send, or buy crypto in Blaze Wallet
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-3">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Earn 2% Cashback</h4>
                <p className="text-sm text-gray-600">
                  Automatically receive BLAZE tokens back
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-3">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Claim Rewards</h4>
                <p className="text-sm text-gray-600">
                  Withdraw or stake your earned BLAZE
                </p>
              </div>
            </div>
          </div>

          {/* Recent Cashback */}
          {recentCashback.length > 0 && (
            <div className="glass-card mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Cashback</h3>
              <div className="space-y-3">
                {recentCashback.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        item.status === 'confirmed' ? 'bg-green-100' :
                        item.status === 'pending' ? 'bg-orange-100' :
                        'bg-gray-100'
                      }`}>
                        <Gift className={`w-5 h-5 ${
                          item.status === 'confirmed' ? 'text-green-500' :
                          item.status === 'pending' ? 'text-orange-500' :
                          'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 capitalize">{item.transactionType} Cashback</div>
                        <div className="text-sm text-gray-500">{formatTimeAgo(item.timestamp)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        +{item.cashbackAmountFormatted.toFixed(4)} BLAZE
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {item.transactionHash.slice(0, 8)}...{item.transactionHash.slice(-6)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Cashback */}
          {!isLoading && recentCashback.length === 0 && (
            <div className="glass-card text-center py-12 mb-6">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Cashback Yet</h3>
              <p className="text-gray-500">Start making transactions to earn cashback rewards!</p>
            </div>
          )}

          {/* Claim Button */}
          {stats && stats.pendingFormatted > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
            >
              {isClaiming ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Claim {stats.pendingFormatted.toFixed(4)} BLAZE
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
