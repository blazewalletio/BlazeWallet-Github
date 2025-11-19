'use client';

/**
 * 🔥 BLAZE WALLET - RECURRING SEND MODAL
 * 
 * Set up automatic recurring payments with optimal gas timing
 * - Daily, weekly, biweekly, monthly
 * - Automatic gas optimization
 * - Savings tracking
 * - Easy pause/resume
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Repeat, Calendar, Clock, DollarSign,
  Check, AlertCircle, Sparkles, TrendingDown
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RecurringSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Pre-filled from Send Modal
  chain: string;
  amount: string;
  token: string;
  toAddress: string;
  fromAddress: string;
  userId: string;
}

type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export default function RecurringSendModal({
  isOpen,
  onClose,
  chain,
  amount,
  token,
  toAddress,
  fromAddress,
  userId,
}: RecurringSendModalProps) {
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [useOptimalTiming, setUseOptimalTiming] = useState(true);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Calculate next execution
      const startDateTime = new Date(startDate);
      startDateTime.setHours(2, 0, 0, 0); // Default to 2 AM (optimal time)

      const { data, error: insertError } = await supabase
        .from('recurring_sends')
        .insert({
          user_id: userId,
          chain,
          from_address: fromAddress,
          to_address: toAddress,
          amount,
          token_symbol: token,
          frequency,
          start_date: startDate,
          end_date: endDate || null,
          next_execution: startDateTime.toISOString(),
          use_optimal_timing: useOptimalTiming,
          label: label || `${frequency} ${token} send`,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      logger.log('✅ Recurring send created:', data.id);
      setSuccess(true);

      // Close after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);

    } catch (err: any) {
      logger.error('❌ Failed to create recurring send:', err);
      setError(err.message || 'Failed to set up recurring send');
    } finally {
      setLoading(false);
    }
  };

  const getEstimatedMonthlySavings = () => {
    // Rough estimate: 30% savings on average
    const baseCost = 5; // Assume $5 per transaction without optimization
    const optimizedCost = baseCost * 0.7; // 30% savings
    const savings = baseCost - optimizedCost;

    const txPerMonth = 
      frequency === 'daily' ? 30 :
      frequency === 'weekly' ? 4 :
      frequency === 'biweekly' ? 2 : 1;

    return (savings * txPerMonth).toFixed(2);
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recurring Send</h2>
              <p className="text-sm text-gray-500">Set & forget</p>
            </div>
          </div>
          <button
            onClick={onClose} aria-label="Close modal"
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transaction Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Sending</div>
            <div className="text-xl font-bold text-gray-900">{amount} {token}</div>
            <div className="text-sm text-gray-500 mt-1 truncate">
              To: {toAddress.slice(0, 8)}...{toAddress.slice(-6)}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['daily', 'weekly', 'biweekly', 'monthly'] as Frequency[]).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    frequency === freq
                      ? 'border-orange-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <Repeat className={`w-5 h-5 mx-auto mb-2 ${
                      frequency === freq ? 'text-orange-600' : 'text-gray-400'
                    }`} />
                    <div className="font-semibold text-gray-900 capitalize">{freq}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-semibold text-gray-900 mb-2">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* End Date (Optional) */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-semibold text-gray-900 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite</p>
          </div>

          {/* Label */}
          <div>
            <label htmlFor="label" className="block text-sm font-semibold text-gray-900 mb-2">
              Label (Optional)
            </label>
            <input
              type="text"
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Weekly DCA to Savings"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Optimal Timing */}
          <button
            type="button"
            onClick={() => setUseOptimalTiming(!useOptimalTiming)}
            className={`w-full p-4 rounded-xl border-2 transition-all ${
              useOptimalTiming
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  useOptimalTiming ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  <Sparkles className={`w-5 h-5 ${
                    useOptimalTiming ? 'text-white' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Optimal Gas Timing</p>
                  <p className="text-sm text-gray-600">Auto-execute at cheapest gas</p>
                </div>
              </div>
              {useOptimalTiming && (
                <Check className="w-6 h-6 text-green-600" />
              )}
            </div>
          </button>

          {/* Estimated Savings */}
          {useOptimalTiming && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-900">
                    ~${getEstimatedMonthlySavings()}/month saved
                  </p>
                  <p className="text-sm text-green-700">with optimal timing</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Failed to set up recurring send</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-green-900">Recurring send created!</p>
                <p className="text-sm text-green-700">First send: {new Date(startDate).toLocaleDateString()}</p>
              </div>
            </motion.div>
          )}
        </form>

        {/* Footer */}
        {!success && (
          <div className="p-6 border-t border-gray-100 space-y-3">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Repeat className="w-5 h-5" />
                  Set Up Recurring Send
                </>
              )}
            </button>

            <button
              type="button"
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

