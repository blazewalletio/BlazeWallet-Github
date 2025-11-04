// ============================================================================
// 🔥 BLAZE WALLET - SCHEDULED TRANSACTIONS PANEL
// ============================================================================
// View and manage all scheduled transactions
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartSchedulerService, type ScheduledTransaction } from '@/lib/smart-scheduler-service';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrencyLogoSync } from '@/lib/currency-logo-service';

interface ScheduledTransactionsPanelProps {
  chain?: string;
  onClose?: () => void;
}

export default function ScheduledTransactionsPanel({ chain, onClose }: ScheduledTransactionsPanelProps) {
  const { address: walletAddress } = useWalletStore();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('wallet_email') || walletAddress : '';

  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [filter, chain]);

  const loadTransactions = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const data = await smartSchedulerService.getScheduledTransactions(userId, chain, filter);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load scheduled transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (transactionId: string) => {
    if (!userId) return;
    
    setCancellingId(transactionId);
    try {
      await smartSchedulerService.cancelTransaction(transactionId, userId);
      await loadTransactions();
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      alert('Failed to cancel transaction');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'ready':
        return 'text-blue-400 bg-blue-500/10';
      case 'executing':
        return 'text-purple-400 bg-purple-500/10';
      case 'completed':
        return 'text-green-400 bg-green-500/10';
      case 'failed':
        return 'text-red-400 bg-red-500/10';
      case 'cancelled':
        return 'text-gray-400 bg-gray-500/10';
      case 'expired':
        return 'text-orange-400 bg-orange-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'ready':
        return '🎯';
      case 'executing':
        return '⚡';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '🚫';
      case 'expired':
        return '⏰';
      default:
        return '📋';
    }
  };

  return (
    <div className="bg-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">📅 Scheduled Transactions</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-white/90 text-sm">Manage your scheduled transactions</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-[#16172a] p-4 border-b border-white/5">
        <div className="flex gap-2">
          {(['pending', 'completed', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex-1 py-2 px-4 rounded-xl transition-all font-medium text-sm ${
                filter === status
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400">No scheduled transactions</p>
            <p className="text-gray-500 text-sm mt-1">
              Schedule a transaction to save on gas fees
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all border border-white/5"
              >
                <div className="flex items-start gap-3">
                  {/* Token Logo */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {tx.token_symbol ? (
                      <img
                        src={getCurrencyLogoSync(tx.token_symbol)}
                        alt={tx.token_symbol}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = (tx.token_symbol || '?').charAt(0).toUpperCase();
                        }}
                      />
                    ) : (
                      <span className="text-white font-bold">{tx.chain.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-white font-semibold">
                          {tx.amount} {tx.token_symbol || tx.chain.toUpperCase()}
                        </div>
                        <div className="text-gray-400 text-xs truncate">
                          To: {tx.to_address.slice(0, 10)}...{tx.to_address.slice(-6)}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {getStatusIcon(tx.status)} {tx.status}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-black/20 rounded-lg p-2">
                        <div className="text-gray-500 text-xs">Chain</div>
                        <div className="text-white text-xs font-medium capitalize">{tx.chain}</div>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2">
                        <div className="text-gray-500 text-xs">Created</div>
                        <div className="text-white text-xs font-medium">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Savings Info */}
                    {tx.actual_savings_usd && tx.actual_savings_usd > 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 text-sm">💰</span>
                          <span className="text-green-400 text-sm font-medium">
                            Saved ${tx.actual_savings_usd.toFixed(4)} on gas!
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Transaction Hash */}
                    {tx.transaction_hash && tx.transaction_hash !== 'SCHEDULED_TX' && (
                      <div className="text-xs text-gray-500 mb-2">
                        TX: {tx.transaction_hash.slice(0, 10)}...{tx.transaction_hash.slice(-6)}
                      </div>
                    )}

                    {/* Actions */}
                    {(tx.status === 'pending' || tx.status === 'ready') && (
                      <button
                        onClick={() => handleCancel(tx.id)}
                        disabled={cancellingId === tx.id}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium py-2 rounded-lg transition-all disabled:opacity-50"
                      >
                        {cancellingId === tx.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                            <span>Cancelling...</span>
                          </div>
                        ) : (
                          '🚫 Cancel Transaction'
                        )}
                      </button>
                    )}

                    {/* Error Message */}
                    {tx.error_message && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-2">
                        <div className="text-red-400 text-xs">{tx.error_message}</div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

