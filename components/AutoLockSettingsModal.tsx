'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Clock, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface AutoLockSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTimeout: number; // in minutes
  onSuccess: () => void;
}

export default function AutoLockSettingsModal({
  isOpen,
  onClose,
  currentTimeout,
  onSuccess
}: AutoLockSettingsModalProps) {
  const [selectedTimeout, setSelectedTimeout] = useState(currentTimeout);
  const [isLoading, setIsLoading] = useState(false);

  const timeoutOptions = [
    { value: 1, label: '1 minute', description: 'Maximum security' },
    { value: 5, label: '5 minutes', description: 'Recommended' },
    { value: 15, label: '15 minutes', description: 'Balanced' },
    { value: 30, label: '30 minutes', description: 'Relaxed' },
    { value: 60, label: '1 hour', description: 'Minimal' },
    { value: 0, label: 'Never', description: 'Disabled (not recommended)' }
  ];

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Store in user_profiles (we'll add this column if it doesn't exist)
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          auto_lock_timeout: selectedTimeout
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Also store in localStorage for immediate effect
      localStorage.setItem('autoLockTimeout', selectedTimeout.toString());

      // Log activity
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'settings_change',
        p_description: `Auto-lock timeout set to ${selectedTimeout === 0 ? 'Never' : `${selectedTimeout} minutes`}`,
        p_metadata: JSON.stringify({ timeout: selectedTimeout })
      });

      logger.log('Auto-lock settings updated');
      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Update error:', err);
      alert('Failed to update settings. Please try again.');
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
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Auto-Lock</h2>
                <p className="text-xs text-gray-600">Set wallet lock timeout</p>
              </div>
            </div>
            <button
              onClick={onClose} aria-label="Close modal"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-3">
            <div className="text-sm text-gray-600 mb-4">
              Your wallet will automatically lock after the selected period of inactivity.
            </div>

            {timeoutOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTimeout(option.value)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedTimeout === option.value
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedTimeout === option.value
                          ? 'bg-gradient-to-br from-orange-500 to-red-500'
                          : 'bg-gray-100'
                      }`}
                    >
                      {selectedTimeout === option.value ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Clock
                          className={`w-5 h-5 ${
                            option.value === 0 ? 'text-red-500' : 'text-gray-500'
                          }`}
                        />
                      )}
                    </div>
                    <div>
                      <div
                        className={`font-semibold ${
                          selectedTimeout === option.value ? 'text-orange-600' : 'text-gray-900'
                        }`}
                      >
                        {option.label}
                      </div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </div>
                  {selectedTimeout === option.value && (
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            ))}

            {selectedTimeout === 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <span className="font-semibold">Security Warning:</span> Disabling auto-lock
                  reduces your wallet's security. Anyone with access to your device can access your
                  funds.
                </div>
              </div>
            )}
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
              className="flex-1 p-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Apply Settings'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

