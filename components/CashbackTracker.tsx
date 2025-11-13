'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift, TrendingUp, Zap, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CashbackService, CashbackStats, CashbackTransaction } from '@/lib/cashback-service';
import { logger } from '@/lib/logger';

export default function CashbackTracker() {
  const { wallet } = useWalletStore();
  const [stats, setStats] = useState<CashbackStats | null>(null);
  const [recentCashback, setRecentCashback] = useState<CashbackTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  
  const cashbackService = new CashbackService();

  // Load data when wallet connects
  useEffect(() => {
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

    loadData();
  }, [wallet]);

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
      const [statsData, transactionsData] = await Promise.all([
        cashbackService.getCashbackStats(userAddress),
        cashbackService.getRecentCashback(userAddress, 5),
      ]);
      
      setStats(statsData);
      setRecentCashback(transactionsData);
      
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Gift className="w-6 h-6 text-orange-500" />
          Cashback Rewards
        </h2>
        <p className="text-gray-600">
          Earn 2% cashback in BLAZE on every transaction
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto" />
          <span className="ml-3 text-gray-600">Loading cashback data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-700 mb-1">Error</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-700 mb-1">Success</h3>
            <p className="text-sm text-green-600">{success}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Gift className="w-5 h-5" />
              <span className="text-sm font-semibold">Total Earned</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.totalEarnedFormatted.toFixed(4)} BLAZE</div>
            <div className="text-sm text-gray-600 mt-1">
              All time rewards
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-semibold">This Month</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.thisMonthFormatted.toFixed(4)} BLAZE</div>
            <div className="text-sm text-gray-600 mt-1">
              {stats.totalEarnedFormatted > 0 ? `+${((stats.thisMonthFormatted / stats.totalEarnedFormatted) * 100).toFixed(0)}% of total` : '0% of total'}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Zap className="w-5 h-5" />
              <span className="text-sm font-semibold">Pending</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{stats.pendingFormatted.toFixed(4)} BLAZE</div>
            <div className="text-sm text-gray-600 mt-1">
              Claimable now
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-semibold">Transactions</span>
            </div>
            <div className="text-3xl font-bold text-purple-400">{stats.transactions}</div>
            <div className="text-sm text-gray-600 mt-1">
              Total rewarded
            </div>
          </motion.div>
        </div>
      )}

      {/* How it Works */}
      <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-6">
        <h3 className="font-semibold mb-4">How Cashback Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">💸</span>
            </div>
            <h4 className="font-semibold mb-1">Make a Transaction</h4>
            <p className="text-gray-600">
              Swap, send, or buy crypto in Blaze Wallet
            </p>
          </div>
          <div>
            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">🎁</span>
            </div>
            <h4 className="font-semibold mb-1">Earn 2% Cashback</h4>
            <p className="text-gray-600">
              Automatically receive BLAZE tokens back
            </p>
          </div>
          <div>
            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">💰</span>
            </div>
            <h4 className="font-semibold mb-1">Claim Rewards</h4>
            <p className="text-gray-600">
              Withdraw or stake your earned BLAZE
            </p>
          </div>
        </div>
      </div>

      {/* Recent Cashback */}
      {recentCashback.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold mb-4">Recent Cashback</h3>
          <div className="space-y-3">
            {recentCashback.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                    <div className="font-semibold capitalize">{item.transactionType} Cashback</div>
                    <div className="text-sm text-gray-500">{formatTimeAgo(item.timestamp)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    +{item.cashbackAmountFormatted.toFixed(4)} BLAZE
                  </div>
                  <div className="text-xs text-gray-500">
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
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Cashback Yet</h3>
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
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  );
}
