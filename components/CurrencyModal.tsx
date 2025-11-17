'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface CurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCurrency: string;
  onSuccess: () => void;
}

export default function CurrencyModal({
  isOpen,
  onClose,
  currentCurrency,
  onSuccess
}: CurrencyModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
  const [isLoading, setIsLoading] = useState(false);

  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
    { code: 'ETH', name: 'Ethereum', symbol: 'Ξ' }
  ];

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update currency in Supabase
      const { error } = await supabase
        .from('user_profiles')
        .update({ preferred_currency: selectedCurrency })
        .eq('user_id', user.id);

      if (error) throw error;

      // Also store in localStorage for immediate effect
      localStorage.setItem('preferredCurrency', selectedCurrency);

      // Log activity
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'settings_change',
        p_description: `Currency changed to ${selectedCurrency}`,
        p_metadata: JSON.stringify({ currency: selectedCurrency })
      });

      logger.log('Currency updated to:', selectedCurrency);
      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Currency update error:', err);
      alert('Failed to update currency. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card rounded-2xl max-w-md w-full"
        >
          {/* Header */}
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Currency</h2>
                <p className="text-xs text-gray-600">Choose your preferred currency</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-2">
              {currencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => setSelectedCurrency(currency.code)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    selectedCurrency === currency.code
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{currency.symbol}</span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-semibold text-sm ${
                          selectedCurrency === currency.code ? 'text-green-600' : 'text-gray-900'
                        }`}
                      >
                        {currency.code}
                      </div>
                      <div className="text-xs text-gray-600 truncate">{currency.name}</div>
                    </div>
                    {selectedCurrency === currency.code && (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <strong>Note:</strong> This affects how prices are displayed throughout the app.
              Exchange rates are updated in real-time.
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 p-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Currency'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

