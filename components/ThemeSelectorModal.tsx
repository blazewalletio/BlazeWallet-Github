'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, Monitor, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: 'light' | 'dark' | 'auto';
  onSuccess: () => void;
}

type Theme = 'light' | 'dark' | 'auto';

export default function ThemeSelectorModal({ isOpen, onClose, currentTheme, onSuccess }: ThemeSelectorModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(currentTheme);
  const [isLoading, setIsLoading] = useState(false);

  const themes = [
    {
      value: 'light' as Theme,
      label: 'Light',
      description: 'Bright and clean interface',
      icon: Sun,
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      value: 'dark' as Theme,
      label: 'Dark',
      description: 'Easy on the eyes',
      icon: Moon,
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      value: 'auto' as Theme,
      label: 'Auto',
      description: 'Matches system settings',
      icon: Monitor,
      gradient: 'from-blue-500 to-cyan-500'
    }
  ];

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .update({ theme: selectedTheme })
        .eq('user_id', user.id);

      if (error) throw error;

      // Log activity
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'settings_change',
        p_description: `Theme changed to ${selectedTheme}`,
        p_metadata: JSON.stringify({ theme: selectedTheme })
      });

      logger.log('Theme updated:', selectedTheme);
      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Theme update error:', err);
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
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Sun className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Theme</h2>
                <p className="text-xs text-gray-600">Choose your preferred theme</p>
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
          <div className="p-6 space-y-3">
            {themes.map((theme) => {
              const Icon = theme.icon;
              const isSelected = selectedTheme === theme.value;

              return (
                <button
                  key={theme.value}
                  onClick={() => setSelectedTheme(theme.value)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{theme.label}</div>
                      <div className="text-sm text-gray-600">{theme.description}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-6 h-6 text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
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
              disabled={isLoading || selectedTheme === currentTheme}
              className="flex-1 p-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

