'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Gift, Copy, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { ReferralService, ReferralData, ReferralStats, ReferralTransaction } from '@/lib/referral-service';
import { logger } from '@/lib/logger';

interface ReferralDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralDashboard({ isOpen, onClose }: ReferralDashboardProps) {
  const { wallet } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<ReferralTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  
  const referralService = new ReferralService();

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
      
      const [data, statsData, transactionsData] = await Promise.all([
        referralService.getReferralData(userAddress),
        referralService.getReferralStats(userAddress),
        referralService.getReferralTransactions(userAddress, 5),
      ]);
      
      setReferralData(data);
      setStats(statsData);
      setRecentTransactions(transactionsData);
    } catch (err: any) {
      logger.error('Error loading referral data:', err);
      setError(err.message || 'Failed to load referral data');
    } finally {
      setIsLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!referralData) return;
    navigator.clipboard.writeText(referralData.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    if (!wallet || !stats || stats.pendingRewardsFormatted === 0) return;

    try {
      setIsClaiming(true);
      setError(null);
      setSuccess(null);
      
      const userAddress = await wallet.getAddress();
      const txHash = await referralService.claimReferralRewards(userAddress, wallet);
      
      setSuccess(`Successfully claimed ${stats.pendingRewardsFormatted.toFixed(4)} BLAZE! Transaction: ${txHash.slice(0, 10)}...`);
      
      // Reload data
      await loadData();
      
    } catch (err: any) {
      logger.error('Error claiming referral rewards:', err);
      setError(err.message || 'Failed to claim referral rewards');
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading referral data...</p>
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
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Referral Program</h2>
                <p className="text-sm text-gray-600">
                  Earn 50 BLAZE per referral + 10% of their transaction fees forever!
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

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
              >
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-semibold">Total Referrals</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalReferrals}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {stats.activeReferrals} active
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
              >
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Gift className="w-5 h-5" />
                  <span className="text-sm font-semibold">Total Earned</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.totalEarnedFormatted.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  BLAZE lifetime rewards
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
              >
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                  <Gift className="w-5 h-5" />
                  <span className="text-sm font-semibold">Pending</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.pendingRewardsFormatted.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  BLAZE claimable now
                </div>
              </motion.div>
            </div>
          )}

          {/* Referral Link */}
          {referralData && (
            <div className="glass-card mb-6 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Referral Link</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={referralData.referralLink}
                  readOnly
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={copyReferralLink}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/30"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy
                    </>
                  )}
                </motion.button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="text-gray-700">Earn 50 BLAZE instantly per sign-up</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="text-gray-700">Get 10% of their transaction fees</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="text-gray-700">Lifetime passive income</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-blue-600" />
                  </div>
                  <span className="text-gray-700">Unlimited referrals</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Referrals */}
          {recentTransactions.length > 0 && (
            <div className="glass-card mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Referral Activity</h3>
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        transaction.transactionType === 'signup' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                        transaction.transactionType === 'transaction_fee' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
                        'bg-gradient-to-br from-orange-500 to-yellow-500'
                      }`}>
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-mono text-sm text-gray-900">
                          {transaction.referredAddress.slice(0, 6)}...{transaction.referredAddress.slice(-4)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {transaction.transactionType === 'signup' ? 'Signup bonus' : 'Fee share'} • {formatTimeAgo(transaction.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        transaction.status === 'confirmed' ? 'text-green-600' :
                        transaction.status === 'pending' ? 'text-orange-500' :
                        'text-gray-500'
                      }`}>
                        +{transaction.amountFormatted.toFixed(2)} BLAZE
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {transaction.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Referrals */}
          {!isLoading && recentTransactions.length === 0 && (
            <div className="glass-card text-center py-12 mb-6">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Referrals Yet</h3>
              <p className="text-gray-500">Share your referral link to start earning rewards!</p>
            </div>
          )}

          {/* Claim Button */}
          {stats && stats.pendingRewardsFormatted > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
            >
              {isClaiming ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  Claim {stats.pendingRewardsFormatted.toFixed(2)} BLAZE
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
