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
  AlertCircle,
  Check,
  Copy
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
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed' | 'cancelled'>('all');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

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
      // Trigger a lightweight reconcile pass to prevent stale pending states.
      void reconcileTransactions().then(() => loadTransactions());
      
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
        .limit(50);

      if (filter !== 'all') {
        if (filter === 'pending') {
          query = query.in('status', ['pending', 'processing']);
        } else if (filter === 'failed') {
          query = query.in('status', ['failed', 'refunded']);
        } else {
          query = query.eq('status', filter);
        }
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

  const reconcileTransactions = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;

      await fetch('/api/onramper/reconcile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      logger.warn('⚠️ Failed to reconcile onramp transactions from history panel:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reconcileTransactions();
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
    const status = tx.status.toLowerCase();
    if (filter === 'pending') return ['pending', 'processing'].includes(status);
    if (filter === 'failed') return ['failed', 'refunded'].includes(status);
    return status === filter.toLowerCase();
  });

  const stats = {
    total: transactions.length,
    completed: transactions.filter(tx => tx.status.toLowerCase() === 'completed').length,
    pending: transactions.filter(tx => ['pending', 'processing'].includes(tx.status.toLowerCase())).length,
    failed: transactions.filter(tx => ['failed', 'refunded'].includes(tx.status.toLowerCase())).length,
    cancelled: transactions.filter(tx => tx.status.toLowerCase() === 'cancelled').length,
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
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
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
                >
                  ← Back
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <ShoppingBag className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Purchase history</h2>
                      <p className="text-sm text-gray-600">Track all buy orders and status updates</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Refresh status"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-6 pb-6">
                <div className="glass-card p-4 sm:p-6 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: 'All', value: stats.total, key: 'all' as const, color: 'bg-gray-100 text-gray-700 border-gray-200' },
                      { label: 'Done', value: stats.completed, key: 'completed' as const, color: 'bg-green-100 text-green-700 border-green-200' },
                      { label: 'Pending', value: stats.pending, key: 'pending' as const, color: 'bg-orange-100 text-orange-700 border-orange-200' },
                      { label: 'Failed', value: stats.failed, key: 'failed' as const, color: 'bg-red-100 text-red-700 border-red-200' },
                      { label: 'Cancelled', value: stats.cancelled, key: 'cancelled' as const, color: 'bg-rose-100 text-rose-700 border-rose-200' },
                    ].map((stat) => (
                      <button
                        key={stat.key}
                        onClick={() => setFilter(stat.key)}
                        className={`p-2.5 rounded-xl text-center border transition-all ${
                          filter === stat.key
                            ? 'ring-2 ring-orange-500 ring-offset-1 scale-[1.02]'
                            : 'hover:scale-[1.01]'
                        } ${stat.color}`}
                      >
                        <div className="text-lg font-bold">{stat.value}</div>
                        <div className="text-xs font-semibold">{stat.label}</div>
                      </button>
                    ))}
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-14">
                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <CreditCard className="w-10 h-10 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">No purchases yet</h3>
                      <p className="text-sm text-gray-500 max-w-md">
                        {filter === 'all'
                          ? 'Start buying crypto to see your purchase history here.'
                          : `No ${filter} orders found in this view.`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTransactions.map((tx) => {
                        const isExpanded = expandedTx === tx.id;
                        const providerUrl = getProviderUrl(tx.provider, tx.onramp_transaction_id);

                        return (
                          <motion.div
                            key={tx.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                              className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border mb-2 ${getStatusColor(tx.status)}`}>
                                    {getStatusIcon(tx.status)}
                                    <span className="capitalize">{tx.status}</span>
                                  </div>
                                  <div className="text-lg font-bold text-gray-900">
                                    {tx.fiat_amount.toFixed(2)} {tx.fiat_currency}
                                  </div>
                                  <div className="text-sm text-orange-600 font-semibold">
                                    {tx.crypto_amount ? tx.crypto_amount.toFixed(6) : '--'} {tx.crypto_currency}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    <span className="capitalize font-medium">{tx.provider}</span> • {formatDate(tx.status_updated_at)}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                )}
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-gray-100 bg-gray-50"
                                >
                                  <div className="p-4 space-y-3">
                                    {tx.payment_method && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Payment method</span>
                                        <span className="font-medium text-gray-900 capitalize">{tx.payment_method}</span>
                                      </div>
                                    )}
                                    {tx.wallet_address && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Wallet</span>
                                        <span className="font-mono text-xs text-gray-900">
                                          {tx.wallet_address.substring(0, 6)}...{tx.wallet_address.substring(tx.wallet_address.length - 4)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-gray-600">Transaction ID</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(tx.onramp_transaction_id);
                                          setCopiedTxId(tx.id);
                                          setTimeout(() => setCopiedTxId(null), 1200);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-xs font-mono"
                                      >
                                        {copiedTxId === tx.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                                        {tx.onramp_transaction_id.substring(0, 10)}...
                                      </button>
                                    </div>
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
                                    {providerUrl && (
                                      <a
                                        href={providerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full mt-1 px-4 py-2.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
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

                <div className="glass-card p-3 flex items-center gap-2 text-xs text-gray-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Status updates are synced from providers via webhooks and reconciliation.</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

