// ============================================================================
// 🔥 BLAZE WALLET - SCHEDULED TRANSACTIONS PANEL
// ============================================================================
// View and manage all scheduled transactions
// Styled as full-screen overlay matching SendModal and SmartScheduleModal
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Ban, 
  ClipboardList, 
  Inbox,
  DollarSign,
  Loader2
} from 'lucide-react';
import { smartSchedulerService, type ScheduledTransaction } from '@/lib/smart-scheduler-service';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrencyLogoSync } from '@/lib/currency-logo-service';

interface ScheduledTransactionsPanelProps {
  isOpen: boolean;
  chain?: string;
  onClose: () => void;
}

export default function ScheduledTransactionsPanel({ isOpen, chain, onClose }: ScheduledTransactionsPanelProps) {
  const { address: walletAddress } = useWalletStore();
  const userId = typeof window !== 'undefined' ? (localStorage.getItem('wallet_email') || walletAddress) : '';

  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen, filter, chain]);

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
    } finally {
      setCancellingId(null);
    }
  };

  const formatTimeRemaining = (scheduledFor: string | null) => {
    if (!scheduledFor) return 'Waiting for optimal gas';
    
    const now = Date.now();
    const scheduled = new Date(scheduledFor).getTime();
    const diff = scheduled - now;
    
    if (diff < 0) return 'Executing soon';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
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
            {/* Header */}
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Scheduled transactions</h2>
                  <p className="text-sm text-gray-600">
                    Manage your scheduled transactions
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="glass-card p-6 mb-4">
              <div className="grid grid-cols-3 gap-3">
                {(['pending', 'completed', 'all'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      filter === status
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-white border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex justify-center mb-2">
                      {status === 'pending' && <Clock className="w-6 h-6 text-orange-500" />}
                      {status === 'completed' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                      {status === 'all' && <ClipboardList className="w-6 h-6 text-blue-500" />}
                    </div>
                    <div className={`text-sm font-medium ${filter === status ? 'text-orange-600' : 'text-gray-900'}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-3 pb-6">
              {loading ? (
                <div className="glass-card p-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-medium">Loading transactions...</p>
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="glass-card p-12">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <Inbox className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No {filter !== 'all' ? filter : ''} transactions
                    </h3>
                    <p className="text-gray-600 text-sm max-w-sm">
                      Schedule a transaction to automatically execute at optimal gas prices and save money
                    </p>
                  </div>
                </div>
              ) : (
                transactions.map((tx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6"
                  >
                    <div className="flex items-start gap-4">
                      {/* Token Logo */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {tx.token_symbol ? (
                          <img
                            src={getCurrencyLogoSync(tx.token_symbol)}
                            alt={tx.token_symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="text-white font-bold text-lg">${(tx.token_symbol || '?').charAt(0).toUpperCase()}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="text-white font-bold text-lg">{tx.chain.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        {/* Header with Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="text-lg font-bold text-gray-900">
                              {tx.amount} {tx.token_symbol || tx.chain.toUpperCase()}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              To: {tx.to_address.slice(0, 10)}...{tx.to_address.slice(-6)}
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 ${
                            tx.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                            tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                            tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                            tx.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {tx.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                            {tx.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {tx.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                            {tx.status === 'cancelled' && <Ban className="w-3.5 h-3.5" />}
                            {!['pending', 'completed', 'failed', 'cancelled'].includes(tx.status) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span className="capitalize">{tx.status}</span>
                          </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs text-gray-600 mb-1">Chain</div>
                            <div className="text-sm font-semibold text-gray-900 capitalize">{tx.chain}</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs text-gray-600 mb-1">
                              {tx.status === 'pending' ? 'Executes' : 'Created'}
                            </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {tx.status === 'pending' && tx.scheduled_for
                                ? formatTimeRemaining(tx.scheduled_for)
                                : new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        {/* Savings Badge */}
                        {tx.actual_savings_usd && tx.actual_savings_usd > 0 && (
                          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 mb-3">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-green-600" />
                              <div>
                                <div className="text-sm font-semibold text-green-700">
                                  Saved ${tx.actual_savings_usd.toFixed(4)}
                                </div>
                                <div className="text-xs text-green-600">
                                  on gas fees
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Transaction Hash */}
                        {tx.transaction_hash && tx.transaction_hash !== 'SCHEDULED_TX' && (
                          <div className="bg-gray-50 rounded-xl p-3 mb-3">
                            <div className="text-xs text-gray-600 mb-1">Transaction hash</div>
                            <div className="text-xs font-mono text-gray-900 truncate">
                              {tx.transaction_hash}
                            </div>
                          </div>
                        )}

                        {/* Error Message */}
                        {tx.error_message && (
                          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 mb-3">
                            <div className="text-sm font-medium text-red-700">
                              {tx.error_message}
                            </div>
                          </div>
                        )}

                        {/* Cancel Button */}
                        {(tx.status === 'pending' || tx.status === 'ready') && (
                          <button
                            onClick={() => handleCancel(tx.id)}
                            disabled={cancellingId === tx.id}
                            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {cancellingId === tx.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Cancelling...</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-4 h-4" />
                                <span>Cancel transaction</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
