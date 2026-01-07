// ============================================================================
// 🔥 BLAZE WALLET - PURCHASE HISTORY SIDEBAR
// ============================================================================
// Lightweight sidebar for viewing onramp purchase history
// Slides in from right, mobile-optimized, real-time updates
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  RefreshCw,
  ExternalLink,
  CreditCard,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useWalletStore } from '@/lib/wallet-store';

interface OnrampTransaction {
  id: string;
  onramp_transaction_id: string;
  provider: string;
  fiat_amount: number;
  fiat_currency: string;
  crypto_amount: number | null;
  crypto_currency: string;
  payment_method: string | null;
  status: string;
  status_updated_at: string;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

interface PurchaseHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PurchaseHistorySidebar({ isOpen, onClose }: PurchaseHistorySidebarProps) {
  const { address: walletAddress } = useWalletStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<OnrampTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  // Get user ID from Supabase auth
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        } else {
          // Fallback to wallet address if no auth user
          setUserId(walletAddress || null);
        }
      } catch (error) {
        logger.error('Error getting user ID:', error);
        setUserId(walletAddress || null);
      }
    };
    getUserId();
  }, [walletAddress]);

  // Load transactions with real-time updates
  useEffect(() => {
    if (isOpen && userId) {
      loadTransactions();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('purchase_history_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'onramp_transactions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            logger.log('📱 Real-time purchase update:', payload);
            loadTransactions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, userId, filter]);

  const loadTransactions = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('onramp_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20); // Only show recent 20 for performance

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('❌ Error loading transactions:', error);
        setTransactions([]);
      } else {
        setTransactions(data || []);
        logger.log(`✅ Loaded ${data?.length || 0} transactions`);
      }
    } catch (error) {
      logger.error('❌ Failed to load transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending':
      default:
        return <Clock className="w-4 h-4 text-orange-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'processing':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending':
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getProviderUrl = (provider: string, transactionId: string) => {
    const providerUrls: Record<string, string> = {
      banxa: `https://banxa.com/order/${transactionId}`,
      moonpay: `https://buy.moonpay.com/transaction_receipt?transactionId=${transactionId}`,
      onramper: `https://buy.onramper.com/`,
    };
    return providerUrls[provider.toLowerCase()] || null;
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.status.toLowerCase() === filter.toLowerCase();
  });

  const stats = {
    total: transactions.length,
    completed: transactions.filter(tx => tx.status.toLowerCase() === 'completed').length,
    pending: transactions.filter(tx => ['pending', 'processing'].includes(tx.status.toLowerCase())).length,
    failed: transactions.filter(tx => ['failed', 'cancelled'].includes(tx.status.toLowerCase())).length,
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Sidebar - responsive width */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-full sm:w-[480px] md:w-[520px] bg-white shadow-2xl flex flex-col"
        >
          {/* Header - Fixed */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-yellow-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Purchase History</h2>
                  <p className="text-xs text-gray-600">Your crypto purchases</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2 hover:bg-white/60 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/60 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'All', value: stats.total, filter: 'all', color: 'bg-gray-100 text-gray-700' },
                { label: 'Done', value: stats.completed, filter: 'completed', color: 'bg-green-100 text-green-700' },
                { label: 'Pending', value: stats.pending, filter: 'pending', color: 'bg-orange-100 text-orange-700' },
                { label: 'Failed', value: stats.failed, filter: 'failed', color: 'bg-red-100 text-red-700' },
              ].map((stat) => (
                <button
                  key={stat.filter}
                  onClick={() => setFilter(stat.filter as any)}
                  className={`p-2 rounded-lg text-center transition-all ${
                    filter === stat.filter
                      ? 'ring-2 ring-orange-500 ring-offset-1 scale-105'
                      : 'hover:scale-105'
                  } ${stat.color}`}
                >
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-xs font-medium">{stat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <CreditCard className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No purchases yet</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {filter === 'all' 
                    ? 'Start buying crypto to see your purchase history here'
                    : `No ${filter} transactions found`}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredTransactions.map((tx) => {
                  const isExpanded = expandedTx === tx.id;
                  const providerUrl = getProviderUrl(tx.provider, tx.onramp_transaction_id);
                  
                  return (
                    <motion.div
                      key={tx.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all overflow-hidden"
                    >
                      {/* Compact Card */}
                      <button
                        onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                        className="w-full p-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Status Badge */}
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border mb-2 ${getStatusColor(tx.status)}`}>
                              {getStatusIcon(tx.status)}
                              <span className="capitalize">{tx.status}</span>
                            </div>
                            
                            {/* Amount Info */}
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-lg font-bold text-gray-900">
                                {tx.fiat_amount.toFixed(2)} {tx.fiat_currency}
                              </span>
                              <span className="text-xs text-gray-500">→</span>
                              <span className="text-sm font-semibold text-orange-600">
                                {tx.crypto_amount ? tx.crypto_amount.toFixed(6) : '---'} {tx.crypto_currency}
                              </span>
                            </div>
                            
                            {/* Provider & Time */}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="capitalize font-medium">{tx.provider}</span>
                              <span>•</span>
                              <span>{formatDate(tx.status_updated_at)}</span>
                            </div>
                          </div>
                          
                          {/* Expand Icon */}
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-gray-100"
                          >
                            <div className="p-3 space-y-2 bg-gray-50">
                              {/* Payment Method */}
                              {tx.payment_method && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Payment Method</span>
                                  <span className="font-medium text-gray-900 capitalize">{tx.payment_method}</span>
                                </div>
                              )}
                              
                              {/* Wallet Address */}
                              {tx.wallet_address && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Wallet</span>
                                  <span className="font-mono text-xs text-gray-900">
                                    {tx.wallet_address.substring(0, 6)}...{tx.wallet_address.substring(tx.wallet_address.length - 4)}
                                  </span>
                                </div>
                              )}
                              
                              {/* Transaction ID */}
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Transaction ID</span>
                                <span className="font-mono text-xs text-gray-900">
                                  {tx.onramp_transaction_id.substring(0, 8)}...
                                </span>
                              </div>
                              
                              {/* Created Date */}
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Created</span>
                                <span className="text-gray-900">
                                  {new Date(tx.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>

                              {/* View on Provider */}
                              {providerUrl && (
                                <a
                                  href={providerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  View on {tx.provider}
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - Fixed (optional) */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span>Updates automatically in real-time</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

