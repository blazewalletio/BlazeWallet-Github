// ============================================================================
// 🔥 BLAZE WALLET - ONRAMP TRANSACTIONS PANEL
// ============================================================================
// View and manage all onramp transactions (BANXA, MoonPay, etc.)
// Shows transaction status, amounts, and provider information
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
  TrendingUp,
  CreditCard
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

interface OnrampTransactionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnrampTransactionsPanel({ isOpen, onClose }: OnrampTransactionsPanelProps) {
  const { address: walletAddress } = useWalletStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<OnrampTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed' | 'cancelled'>('all');

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

  useEffect(() => {
    if (isOpen && userId) {
      loadTransactions();
      // Set up real-time subscription
      const channel = supabase
        .channel('onramp_transactions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'onramp_transactions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            logger.log('Real-time update received:', payload);
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
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error loading onramp transactions:', error);
        setTransactions([]);
      } else {
        setTransactions(data || []);
      }
    } catch (error) {
      logger.error('Failed to load onramp transactions:', error);
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
        return 'bg-green-100 text-green-700';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
      default:
        return 'bg-orange-100 text-orange-700';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProviderUrl = (provider: string, transactionId: string) => {
    // Return provider dashboard URL if available
    const providerUrls: Record<string, string> = {
      banxa: `https://banxa.com/order/${transactionId}`,
      moonpay: `https://buy.moonpay.com/transaction_receipt?transactionId=${transactionId}`,
    };
    return providerUrls[provider.toLowerCase()] || null;
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.status.toLowerCase() === filter.toLowerCase();
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Purchase History</h2>
                <p className="text-sm text-gray-600">View all your crypto purchases</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
            {(['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-purple-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No transactions found</h3>
                <p className="text-gray-500">
                  {filter === 'all' 
                    ? 'You haven\'t made any purchases yet'
                    : `No ${filter} transactions found`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTransactions.map((tx) => {
                  const providerUrl = getProviderUrl(tx.provider, tx.onramp_transaction_id);
                  
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${getStatusColor(tx.status)}`}>
                              {getStatusIcon(tx.status)}
                              <span className="capitalize">{tx.status}</span>
                            </div>
                            <span className="text-sm font-semibold capitalize text-gray-700">
                              {tx.provider}
                            </span>
                            {tx.payment_method && (
                              <span className="text-xs text-gray-500">
                                via {tx.payment_method}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Amount</div>
                              <div className="text-sm font-semibold text-gray-900">
                                {tx.fiat_amount.toFixed(2)} {tx.fiat_currency}
                              </div>
                            </div>
                            {tx.crypto_amount && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">You received</div>
                                <div className="text-sm font-semibold text-green-600">
                                  {tx.crypto_amount.toFixed(6)} {tx.crypto_currency}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 text-xs text-gray-500">
                            {formatDate(tx.status_updated_at)}
                          </div>
                        </div>

                        {providerUrl && (
                          <a
                            href={providerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View on provider website"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-600" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

