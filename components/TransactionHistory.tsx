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
  Check
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { MultiChainService } from '@/lib/multi-chain-service';
import { CHAINS } from '@/lib/chains';
import { transactionCache } from '@/lib/transaction-cache';
import { apiQueue } from '@/lib/api-queue';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  isError: boolean;
  tokenSymbol?: string;
  tokenName?: string;
  type?: string;
  mint?: string;
  logoUrl?: string;
}

export default function TransactionHistory() {
  const { getCurrentAddress, currentChain } = useWalletStore();
  const displayAddress = getCurrentAddress();
  const chain = CHAINS[currentChain];
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState<string>('');

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
      console.log(`⚡ Loaded ${cachedData.length} transactions from cache (${isStale ? 'stale' : 'fresh'}) for ${currentChain}`);
      setTransactions(cachedData);
      setLoading(false); // ✅ Stop loading immediately
      
      // If data is fresh, we're done!
      if (!isStale) {
        return;
      }
      
      // ✅ If stale, continue to refresh in background (no loading state!)
      console.log('🔄 Refreshing stale transaction data in background...');
    } else {
      // No cached data - show loading state
      setLoading(true);
    }

    try {
      // Load from API with rate limiting
      const txs = await apiQueue.add(async () => {
        const blockchain = MultiChainService.getInstance(currentChain); // ✅ Use singleton
        return await blockchain.getTransactionHistory(displayAddress, 10);
      });

      // ✅ DEBUG: Log transaction details to see token metadata
      console.log('📋 [TransactionHistory] Raw transactions:', txs.map(tx => ({
        hash: tx.hash.substring(0, 8),
        tokenName: tx.tokenName,
        tokenSymbol: tx.tokenSymbol,
        logoUrl: tx.logoUrl,
        mint: tx.mint
      })));

      // ✅ Update with fresh data (smooth transition, no jarring reload)
      setTransactions(txs);
      
      // Cache for 30 minutes
      await transactionCache.set(cacheKey, txs, 30 * 60 * 1000);
      
      console.log(`✅ Successfully loaded ${txs.length} fresh transactions for ${currentChain}`);
    } catch (error) {
      console.error(`❌ Error loading transactions for ${currentChain}:`, error);
      
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

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Net nu';
    if (minutes < 60) return `${minutes}m geleden`;
    if (hours < 24) return `${hours}u geleden`;
    return `${days}d geleden`;
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
            const isSent = tx.from.toLowerCase() === displayAddress?.toLowerCase();
            const otherAddress = isSent ? tx.to : tx.from;
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
