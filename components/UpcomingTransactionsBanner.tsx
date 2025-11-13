// ============================================================================
// 🔥 BLAZE WALLET - UPCOMING TRANSACTIONS BANNER
// ============================================================================
// Displays scheduled transactions in wallet tab
// Styled to perfectly match the existing dashboard design
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight, Clock, DollarSign } from 'lucide-react';
import { smartSchedulerService, type ScheduledTransaction } from '@/lib/smart-scheduler-service';
import { logger } from '@/lib/logger';

interface UpcomingTransactionsBannerProps {
  userId: string;
  chain: string;
  onViewAll: () => void;
}

export default function UpcomingTransactionsBanner({ 
  userId, 
  chain,
  onViewAll 
}: UpcomingTransactionsBannerProps) {
  const [transactions, setTransactions] = useState<ScheduledTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState<number>(0);

  useEffect(() => {
    loadTransactions();
  }, [userId, chain]);

  const loadTransactions = async () => {
    if (!userId) {
      logger.log('⚠️ [UpcomingBanner] No userId provided');
      return;
    }
    
    logger.log('🔍 [UpcomingBanner] Loading transactions for:', { userId, chain });
    
    try {
      const data = await smartSchedulerService.getScheduledTransactions(userId, chain, 'pending');
      logger.log('✅ [UpcomingBanner] Loaded transactions:', data);
      setTransactions(data);
      
      // Calculate total estimated savings
      const savings = data.reduce((sum, tx) => sum + (tx.estimated_savings_usd || 0), 0);
      setTotalSavings(savings);
      
      if (data.length === 0) {
        logger.log('ℹ️ [UpcomingBanner] No pending transactions found');
      }
    } catch (error) {
      logger.error('❌ [UpcomingBanner] Failed to load scheduled transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no transactions
  if (loading) {
    logger.log('⏳ [UpcomingBanner] Still loading...');
    return null;
  }
  
  if (transactions.length === 0) {
    logger.log('💤 [UpcomingBanner] No transactions to display');
    return null;
  }
  
  logger.log('🎯 [UpcomingBanner] Rendering banner with', transactions.length, 'transaction(s)');

  const nextTransaction = transactions[0];
  const timeUntilExecution = nextTransaction.scheduled_for 
    ? Math.max(0, Math.floor((new Date(nextTransaction.scheduled_for).getTime() - Date.now()) / (1000 * 60 * 60)))
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ delay: 0.2 }}
        onClick={onViewAll}
        className="glass-card cursor-pointer card-hover group relative overflow-hidden"
      >
        {/* Subtle animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">
                {transactions.length} transaction{transactions.length > 1 ? 's' : ''} scheduled
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </div>

          {/* Next Transaction Preview */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 font-medium truncate">
                  Next: {nextTransaction.amount} {nextTransaction.token_symbol || chain.toUpperCase()} → {' '}
                  <span className="font-mono text-xs">
                    {nextTransaction.to_address.slice(0, 6)}...{nextTransaction.to_address.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                  {timeUntilExecution !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeUntilExecution === 0 ? 'Executing soon' : `in ~${timeUntilExecution}h`}
                    </span>
                  )}
                  {totalSavings > 0 && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <DollarSign className="w-3 h-3" />
                      Save ${totalSavings.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Additional transactions indicator */}
            {transactions.length > 1 && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                +{transactions.length - 1} more scheduled
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

