'use client';

/**
 * 🔥 BLAZE WALLET - SMART SEND MODAL
 * 
 * Revolutionary gas-optimized transaction scheduling
 * - Compare now vs optimal timing
 * - Schedule for cheapest gas
 * - Real-time savings calculator
 * - Beautiful mobile-first design
 * - Works on all 18 chains
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Clock, Zap, DollarSign, TrendingDown, Calendar,
  ArrowRight, Check, AlertCircle, Sparkles, Info
} from 'lucide-react';

interface SmartSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: Date, estimatedSavings: number) => void;
  onSendNow: () => void;
  
  // Transaction details
  chain: string;
  amount: string;
  token: string;
  toAddress: string;
  fromAddress: string;
}

interface GasComparison {
  now: {
    gasPrice: number;
    gasCostUSD: number;
    level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  };
  optimal: {
    time: string; // "Tonight at 3 AM"
    timestamp: Date;
    gasPrice: number;
    gasCostUSD: number;
    level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  };
  savings: {
    usd: number;
    percentage: number;
    worthWaiting: boolean; // AI decision
  };
}

export default function SmartSendModal({
  isOpen,
  onClose,
  onSchedule,
  onSendNow,
  chain,
  amount,
  token,
  toAddress,
  fromAddress,
}: SmartSendModalProps) {
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<GasComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<'now' | 'optimal'>('optimal');

  useEffect(() => {
    if (isOpen) {
      loadGasComparison();
    }
  }, [isOpen, chain]);

  const loadGasComparison = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('⚡ [Smart Send] Fetching gas comparison...', { chain, amount, token });

      const response = await fetch('/api/smart-send/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          amount,
          token,
          transactionType: 'transfer',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load gas comparison');
      }

      setComparison(data.comparison);
      
      // Auto-select optimal if savings > $1
      if (data.comparison.savings.worthWaiting) {
        setSelectedOption('optimal');
      } else {
        setSelectedOption('now');
      }

    } catch (err: any) {
      console.error('❌ [Smart Send] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedOption === 'now') {
      onSendNow();
    } else if (comparison) {
      onSchedule(comparison.optimal.timestamp, comparison.savings.usd);
    }
  };

  const getGasLevelColor = (level: string) => {
    switch (level) {
      case 'very_low': return 'text-green-600 bg-green-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'very_high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getGasLevelText = (level: string) => {
    switch (level) {
      case 'very_low': return 'Very Low';
      case 'low': return 'Low';
      case 'medium': return 'Medium';
      case 'high': return 'High';
      case 'very_high': return 'Very High';
      default: return level;
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Smart Send</h2>
              <p className="text-sm text-gray-500">Save on gas fees</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transaction Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Sending</span>
              <span className="text-sm text-gray-600">{chain}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {amount} {token}
            </div>
            <div className="text-sm text-gray-500 mt-1 truncate">
              To: {toAddress.slice(0, 6)}...{toAddress.slice(-4)}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Analyzing gas prices...</p>
              <p className="text-sm text-gray-500 mt-1">Finding best time to save you money</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Unable to load gas data</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          ) : comparison ? (
            <>
              {/* Savings Alert */}
              {comparison.savings.worthWaiting && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-green-900">Save ${comparison.savings.usd.toFixed(2)}</p>
                      <p className="text-sm text-green-700">by waiting for optimal gas</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {/* Send Now */}
                <button
                  onClick={() => setSelectedOption('now')}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                    selectedOption === 'now'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedOption === 'now' ? 'bg-orange-500' : 'bg-gray-200'
                      }`}>
                        <Zap className={`w-5 h-5 ${selectedOption === 'now' ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Send Now</p>
                        <p className="text-sm text-gray-600">Instant transaction</p>
                      </div>
                    </div>
                    {selectedOption === 'now' && (
                      <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getGasLevelColor(comparison.now.level)}`}>
                      {getGasLevelText(comparison.now.level)} Gas
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      ${comparison.now.gasCostUSD.toFixed(2)}
                    </span>
                  </div>
                </button>

                {/* Schedule Optimal */}
                <button
                  onClick={() => setSelectedOption('optimal')}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                    selectedOption === 'optimal'
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {comparison.savings.worthWaiting && selectedOption !== 'optimal' && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                      RECOMMENDED
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedOption === 'optimal' ? 'bg-green-500' : 'bg-gray-200'
                      }`}>
                        <Clock className={`w-5 h-5 ${selectedOption === 'optimal' ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Schedule Smart</p>
                        <p className="text-sm text-gray-600">{comparison.optimal.time}</p>
                      </div>
                    </div>
                    {selectedOption === 'optimal' && (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getGasLevelColor(comparison.optimal.level)}`}>
                        {getGasLevelText(comparison.optimal.level)} Gas
                      </span>
                      {comparison.savings.usd > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                          Save ${comparison.savings.usd.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-bold text-green-700">
                      ${comparison.optimal.gasCostUSD.toFixed(2)}
                    </span>
                  </div>
                </button>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">How it works</p>
                  <p className="text-blue-700">
                    {selectedOption === 'optimal' 
                      ? 'Your transaction will be automatically sent when gas prices are lowest. You\'ll receive a notification when complete.'
                      : 'Your transaction will be sent immediately at current gas prices.'}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        {!loading && !error && comparison && (
          <div className="p-6 border-t border-gray-100 space-y-3">
            <button
              onClick={handleConfirm}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {selectedOption === 'now' ? (
                <>
                  <Zap className="w-5 h-5" />
                  Send Now
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Schedule Smart Send
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

