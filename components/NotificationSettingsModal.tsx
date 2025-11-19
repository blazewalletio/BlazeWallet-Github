'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: boolean;
  onSuccess: () => void;
}

export default function NotificationSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSuccess
}: NotificationSettingsModalProps) {
  const [settings, setSettings] = useState({
    all: currentSettings,
    transactions: true,
    security: true,
    priceAlerts: false,
    news: false,
    promotions: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: !prev[key] };
      // If turning off 'all', turn off everything
      if (key === 'all' && !prev.all) {
        return { ...newSettings, all: true };
      }
      if (key === 'all' && prev.all) {
        return {
          all: false,
          transactions: false,
          security: false,
          priceAlerts: false,
          news: false,
          promotions: false
        };
      }
      return newSettings;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .update({ notifications_enabled: settings.all })
        .eq('user_id', user.id);

      if (error) throw error;

      // Log activity
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'settings_change',
        p_description: `Notifications ${settings.all ? 'enabled' : 'disabled'}`,
        p_metadata: JSON.stringify(settings)
      });

      logger.log('Notification settings updated');
      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const notificationTypes = [
    {
      key: 'transactions' as const,
      label: 'Transactions',
      description: 'Incoming and outgoing payments',
      enabled: settings.transactions
    },
    {
      key: 'security' as const,
      label: 'Security Alerts',
      description: 'Login attempts, password changes',
      enabled: settings.security
    },
    {
      key: 'priceAlerts' as const,
      label: 'Price Alerts',
      description: 'Crypto price movements',
      enabled: settings.priceAlerts
    },
    {
      key: 'news' as const,
      label: 'News & Updates',
      description: 'New features and announcements',
      enabled: settings.news
    },
    {
      key: 'promotions' as const,
      label: 'Promotions',
      description: 'Special offers and rewards',
      enabled: settings.promotions
    }
  ];

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
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
                <p className="text-xs text-gray-600">Manage your notification preferences</p>
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
          <div className="p-6 space-y-4">
            {/* Master Toggle */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-orange-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">All Notifications</div>
                  <div className="text-sm text-gray-600">Enable or disable all notifications</div>
                </div>
                <button
                  onClick={() => handleToggle('all')}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    settings.all ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                      settings.all ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Individual Toggles */}
            <div className="space-y-3">
              {notificationTypes.map((type) => (
                <div
                  key={type.key}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    settings.all && type.enabled
                      ? 'border-orange-200 bg-purple-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-600">{type.description}</div>
                    </div>
                    <button
                      onClick={() => handleToggle(type.key)}
                      disabled={!settings.all}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        settings.all && type.enabled ? 'bg-orange-500' : 'bg-gray-300'
                      } ${!settings.all ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          settings.all && type.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
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
              className="flex-1 p-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

