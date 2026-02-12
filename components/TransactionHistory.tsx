'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  ExternalLink, 
  Clock, 
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  FileText,
  Edit2,
  Save,
  X as XIcon
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { MultiChainService } from '@/lib/multi-chain-service';
import { CHAINS } from '@/lib/chains';
import { transactionCache } from '@/lib/transaction-cache';
import { apiQueue } from '@/lib/api-queue';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface Transaction {
  hash: string;
  from: string | string[] | { address?: string } | null | undefined;
  to: string | string[] | { address?: string } | null | undefined;
  value: string;
  timestamp: number;
  isError: boolean;
  tokenSymbol?: string;
  tokenName?: string;
  type?: string;
  mint?: string;
  logoUrl?: string;
  note?: string; // User's personal note
}

export default function TransactionHistory() {
  const { getCurrentAddress, currentChain } = useWalletStore();
  const displayAddress = getCurrentAddress();
  const chain = CHAINS[currentChain];
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState<string>('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [displayAddress, currentChain]);

  const loadTransactions = async () => {
    if (!displayAddress) return;
    
    const cacheKey = `${currentChain}:${displayAddress}`;
    
    // ✅ STALE-WHILE-REVALIDATE: Check cache first (including stale data)
    const { data: cachedData, isStale } = await transactionCache.getStale(cacheKey);
    
    if (cachedData && cachedData.length > 0) {
      // ✅ Show cached data INSTANTLY (even if stale)
      logger.log(`⚡ Loaded ${cachedData.length} transactions from cache (${isStale ? 'stale' : 'fresh'}) for ${currentChain}`);
      setTransactions(cachedData);
      setLoading(false); // ✅ Stop loading immediately
      
      // If data is fresh, we're done!
      if (!isStale) {
        return;
      }
      
      // ✅ If stale, continue to refresh in background (no loading state!)
      logger.log('🔄 Refreshing stale transaction data in background...');
    } else {
      // No cached data - show loading state
      setLoading(true);
    }

    try {
      // ✅ Load BOTH on-chain transactions AND scheduled transactions
      const [onChainTxs, scheduledTxs] = await Promise.all([
        // 1. On-chain transactions from blockchain explorers
        apiQueue.add(async () => {
          const blockchain = MultiChainService.getInstance(currentChain);
          return await blockchain.getTransactionHistory(displayAddress, 50);
        }),
        
        // 2. Executed scheduled transactions from Supabase
        apiQueue.add(async () => {
          try {
            const response = await fetch(
              `/api/smart-scheduler/history?address=${displayAddress}&chain=${currentChain}`
            );
            if (!response.ok) throw new Error('Failed to fetch scheduled transactions');
            const data = await response.json();
            return data.transactions || [];
          } catch (error) {
            logger.error('❌ Error loading scheduled transactions:', error);
            return [];
          }
        })
      ]);

      // ✅ Combine and deduplicate transactions by hash
      const txMap = new Map<string, Transaction>();
      
      // Add on-chain transactions first
      onChainTxs.forEach(tx => txMap.set(tx.hash.toLowerCase(), tx));
      
      // Add/merge scheduled transactions
      scheduledTxs.forEach((scheduledTx: any) => {
        if (scheduledTx.transaction_hash) {
          const hash = scheduledTx.transaction_hash.toLowerCase();
          
          // If not already in map from on-chain data, create transaction object
          if (!txMap.has(hash)) {
            txMap.set(hash, {
              hash: scheduledTx.transaction_hash,
              from: scheduledTx.from_address,
              to: scheduledTx.to_address,
              value: scheduledTx.amount,
              timestamp: new Date(scheduledTx.executed_at).getTime(),
              isError: scheduledTx.status === 'failed',
              tokenSymbol: scheduledTx.token_symbol || chain.nativeCurrency.symbol,
              tokenName: scheduledTx.token_symbol || chain.nativeCurrency.name,
              type: 'Smart Send',
              logoUrl: chain.logoUrl
            });
          }
        }
      });

      // Convert map to array and sort by timestamp (newest first)
      const allTransactions = Array.from(txMap.values()).sort((a, b) => b.timestamp - a.timestamp);

      // ✅ DEBUG: Log transaction details
      logger.log('📋 [TransactionHistory] Combined transactions:', {
        onChain: onChainTxs.length,
        scheduled: scheduledTxs.length,
        total: allTransactions.length
      });

      // ✅ Update with fresh data (smooth transition, no jarring reload)
      setTransactions(allTransactions);
      
      // Cache for 30 minutes
      await transactionCache.set(cacheKey, allTransactions, 30 * 60 * 1000);
      
      logger.log(`✅ Successfully loaded ${allTransactions.length} fresh transactions for ${currentChain}`);
    } catch (error) {
      logger.error(`❌ Error loading transactions for ${currentChain}:`, error);
      
      // ✅ If we have stale data, keep showing it despite error
      if (!cachedData || cachedData.length === 0) {
        setTransactions([]);
      }
    }
    setLoading(false);
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(''), 2000);
  };

  // Load notes for all transactions
  const loadNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: notes, error } = await supabase
        .from('transaction_notes')
        .select('tx_hash, note')
        .eq('user_id', user.id)
        .eq('chain_key', currentChain);

      if (error) throw error;

      if (notes && notes.length > 0) {
        // Map notes to transactions
        setTransactions(prevTxs => 
          prevTxs.map(tx => {
            const note = (notes as any[]).find((n: any) => n.tx_hash.toLowerCase() === tx.hash.toLowerCase());
            return note ? { ...tx, note: note.note } : tx;
          })
        );
      }
    } catch (error) {
      logger.error('Failed to load transaction notes:', error);
    }
  };

  // Load notes when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      loadNotes();
    }
  }, [transactions.length, currentChain]);

  const startEditingNote = (hash: string, currentNote?: string) => {
    setEditingNote(hash);
    setNoteText(currentNote || '');
  };

  const cancelEditingNote = () => {
    setEditingNote(null);
    setNoteText('');
  };

  const saveNote = async (hash: string) => {
    if (!noteText.trim() && !transactions.find(tx => tx.hash === hash)?.note) {
      // No note to save and no existing note
      cancelEditingNote();
      return;
    }

    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!noteText.trim()) {
        // Delete note if empty
        const { error } = await supabase
          .from('transaction_notes')
          .delete()
          .eq('user_id', user.id)
          .eq('chain_key', currentChain)
          .eq('tx_hash', hash);

        if (error) throw error;

        // Update local state
        setTransactions(prevTxs =>
          prevTxs.map(tx => tx.hash === hash ? { ...tx, note: undefined } : tx)
        );
      } else {
        // Upsert note
        const { error } = await (supabase as any)
          .from('transaction_notes')
          .upsert({
            user_id: user.id,
            chain_key: currentChain,
            tx_hash: hash,
            note: noteText.trim()
          }, {
            onConflict: 'user_id,chain_key,tx_hash'
          });

        if (error) throw error;

        // Update local state
        setTransactions(prevTxs =>
          prevTxs.map(tx => tx.hash === hash ? { ...tx, note: noteText.trim() } : tx)
        );
      }

      cancelEditingNote();
      logger.log('Transaction note saved:', hash);
    } catch (error) {
      logger.error('Failed to save transaction note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const toAddressList = (value: Transaction['from']): string[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        .map((entry) => entry.trim());
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }

    if (typeof value === 'object' && value.address && typeof value.address === 'string') {
      const trimmed = value.address.trim();
      return trimmed ? [trimmed] : [];
    }

    return [];
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-orange-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
        <p className="text-sm text-gray-500">
          Your transaction history will appear here once you make your first transaction
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {transactions.map((tx, index) => {
            const fromAddresses = toAddressList(tx.from);
            const toAddresses = toAddressList(tx.to);
            const normalizedCurrentAddress = (displayAddress || '').toLowerCase();
            const isSent = normalizedCurrentAddress
              ? fromAddresses.some((address) => address.toLowerCase() === normalizedCurrentAddress)
              : false;
            const otherAddress = isSent ? (toAddresses[0] || '') : (fromAddresses[0] || '');
            const value = parseFloat(tx.value);
            const symbol = tx.tokenSymbol || chain.nativeCurrency.symbol;
            
            // Determine logo URL: tx.logoUrl (SPL tokens) or chain.logoUrl (native)
            const logoUrl = tx.logoUrl || chain.logoUrl;

            return (
              <motion.div
                key={tx.hash}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
                className="relative overflow-hidden bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 group"
              >
                {/* 🔥 DIAGONAL FADE LOGO WATERMARK - Premium Effect */}
                {logoUrl && (
                  <div 
                    className="absolute -right-6 top-1/2 -translate-y-1/2 w-28 h-28 sm:w-32 sm:h-32 pointer-events-none"
                    style={{
                      opacity: tx.isError ? 0.05 : 0.15, // ✅ Increased visibility: 0.08 → 0.15
                      maskImage: 'linear-gradient(135deg, transparent 30%, black 70%)',
                      WebkitMaskImage: 'linear-gradient(135deg, transparent 30%, black 70%)',
                    }}
                  >
                    <img 
                      src={logoUrl} 
                      alt=""
                      className="w-full h-full object-contain select-none"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to chain logo if token logo fails
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-4 relative z-10">
                  {/* Icon with Blaze styling */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    tx.isError 
                      ? 'bg-red-100' 
                      : isSent 
                        ? 'bg-orange-100' 
                        : 'bg-green-100'
                  }`}>
                    {tx.isError ? (
                      <XCircle className="w-6 h-6 text-red-500" />
                    ) : isSent ? (
                      <ArrowUpRight className="w-6 h-6 text-orange-500" />
                    ) : (
                      <ArrowDownLeft className="w-6 h-6 text-green-500" />
                    )}
                  </div>

                  {/* Transaction Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {tx.isError 
                          ? 'Failed' 
                          : tx.tokenName 
                            ? tx.tokenName 
                            : tx.type || (isSent ? 'Sent' : 'Received')
                        }
                      </span>
                      {!tx.isError && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-mono truncate">
                        {formatAddress(otherAddress)}
                      </span>
                      <button
                        onClick={() => copyHash(tx.hash)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                        title="Copy transaction hash"
                      >
                        {copiedHash === tx.hash ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-1">
                      {formatTime(tx.timestamp)}
                    </div>

                    {/* Transaction Note */}
                    {editingNote === tx.hash ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add a note (e.g., 'Payment for services', 'Gift to friend')..."
                          className="w-full p-2 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                          rows={2}
                          autoFocus
                          maxLength={500}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveNote(tx.hash)}
                            disabled={savingNote}
                            className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            {savingNote ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditingNote}
                            disabled={savingNote}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XIcon className="w-3 h-3" />
                            Cancel
                          </button>
                          {tx.note && (
                            <span className="text-xs text-gray-400">
                              {noteText.length}/500
                            </span>
                          )}
                        </div>
                      </div>
                    ) : tx.note ? (
                      <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 flex-1">{tx.note}</p>
                          <button
                            onClick={() => startEditingNote(tx.hash, tx.note)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-orange-100 rounded"
                            title="Edit note"
                          >
                            <Edit2 className="w-3 h-3 text-orange-600" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingNote(tx.hash)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Add note
                      </button>
                    )}
                  </div>

                  {/* Amount & Link */}
                  <div className="text-right flex-shrink-0">
                    <div className={`font-bold text-base mb-1 ${
                      tx.isError 
                        ? 'text-gray-400' 
                        : isSent 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                    }`}>
                      {isSent ? '-' : '+'}{value.toFixed(6)} {symbol}
                    </div>
                    <a
                      href={`${chain.explorerUrl}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
    </div>
  );
}
