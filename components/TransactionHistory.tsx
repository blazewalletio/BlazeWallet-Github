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
  type?: string;
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
    
    setLoading(true);
    try {
      // Check cache first
      const cacheKey = `${currentChain}:${displayAddress}`;
      const cached = await transactionCache.get(cacheKey);
      
      if (cached) {
        console.log(`✅ Loaded ${cached.length} transactions from cache for ${currentChain}`);
        setTransactions(cached);
        setLoading(false);
        return;
      }

      // Load from API with rate limiting
      const txs = await apiQueue.add(async () => {
        const blockchain = new MultiChainService(currentChain);
        return await blockchain.getTransactionHistory(displayAddress, 10);
      });

      setTransactions(txs);
      
      // Cache for 30 minutes
      await transactionCache.set(cacheKey, txs, 30 * 60 * 1000);
      
      console.log(`✅ Successfully loaded ${txs.length} transactions for ${currentChain}`);
    } catch (error) {
      console.error(`❌ Error loading transactions for ${currentChain}:`, error);
      // Still set empty array so UI shows "no transactions" instead of loading state
      setTransactions([]);
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
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent transactions</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-theme-bg-secondary/50 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent transactions</h3>
        <div className="text-center py-8 text-theme-text-secondary">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No transactions yet</p>
          <p className="text-sm mt-1">Your transactions will appear here once you make them</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-4">Recent transactions</h3>
      <div className="space-y-2">
        <AnimatePresence>
          {transactions.map((tx, index) => {
            const isSent = tx.from.toLowerCase() === displayAddress?.toLowerCase();
            const otherAddress = isSent ? tx.to : tx.from;
            const value = parseFloat(tx.value);
            const symbol = tx.tokenSymbol || chain.nativeCurrency.symbol;

            return (
              <motion.div
                key={tx.hash}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass p-4 rounded-xl hover:bg-theme-bg-card/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.isError 
                      ? 'bg-theme-primary/20' 
                      : isSent 
                        ? 'bg-theme-primary/20' 
                        : 'bg-theme-primary/20'
                  }`}>
                    {tx.isError ? (
                      <XCircle className="w-5 h-5 text-theme-primary" />
                    ) : isSent ? (
                      <ArrowUpRight className="w-5 h-5 text-theme-primary" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 text-theme-primary" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        {tx.isError ? 'Failed' : tx.type || (isSent ? 'Sent' : 'Received')}
                      </span>
                      {!tx.isError && (
                        <CheckCircle2 className="w-4 h-4 text-theme-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
                      <span className="font-mono truncate">
                        {formatAddress(otherAddress)}
                      </span>
                      <button
                        onClick={() => copyHash(tx.hash)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy transaction hash"
                      >
                        {copiedHash === tx.hash ? (
                          <Check className="w-3 h-3 text-theme-primary" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-theme-text-muted mt-1">
                      {formatTime(tx.timestamp)}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className={`font-semibold ${
                      tx.isError 
                        ? 'text-theme-text-muted' 
                        : isSent 
                          ? 'text-theme-primary' 
                          : 'text-theme-primary'
                    }`}>
                      {isSent ? '-' : '+'}{value.toFixed(6)} {symbol}
                    </div>
                    <a
                      href={`${chain.explorerUrl}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-theme-primary hover:text-theme-primary flex items-center gap-1 justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
    </div>
  );
}
