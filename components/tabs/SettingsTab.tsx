'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Lock, 
  Bell, 
  Globe, 
  Shield, 
  LogOut, 
  User,
  ChevronRight,
  Eye,
  EyeOff,
  Key,
  Smartphone,
  DollarSign
} from 'lucide-react';
import SettingsModal from '../SettingsModal';
import CurrencyModal from '../CurrencyModal';
import { useCurrency } from '@/contexts/CurrencyContext';
import { logger } from '@/lib/logger';

export default function SettingsTab() {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [showCurrency, setShowCurrency] = useState(false);
  const { selectedCurrency, symbol } = useCurrency();

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Profile', description: 'Manage your account', action: () => setShowSettingsModal(true) },
        { icon: Key, label: 'Security', description: 'Password, biometrics, recovery', action: () => setShowSettingsModal(true) },
        { icon: Eye, label: 'Privacy', description: 'Balance visibility & data', action: () => {}},
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: DollarSign, label: 'Currency', description: `${symbol} ${selectedCurrency}`, action: () => setShowCurrency(true) },
        { icon: Globe, label: 'Language', description: 'English', action: () => {} },
        { icon: Bell, label: 'Notifications', description: 'Push notifications enabled', action: () => {} },
        { icon: Eye, label: 'Appearance', description: 'Light mode', action: () => {} },
      ]
    },
    {
      title: 'Wallet',
      items: [
        { icon: Lock, label: 'Lock Wallet', description: 'Secure your wallet', action: () => {} },
        { icon: Smartphone, label: 'Connected Devices', description: '1 device connected', action: () => {} },
        { icon: Shield, label: 'Export Wallet', description: 'Backup your wallet', action: () => setShowSettingsModal(true) },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: User, label: 'Help & Support', description: 'Get help', action: () => {} },
        { icon: Globe, label: 'About', description: 'Version 2.0.0', action: () => {} },
        { icon: LogOut, label: 'Sign Out', description: 'Lock wallet and return to login', action: () => {
          // Lock wallet and reload
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, danger: true },
      ]
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-gray-600 to-gray-800 flex items-center justify-center">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">Manage your wallet</p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettingsModal(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <span className="text-sm font-medium">Advanced</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide px-1">
              {section.title}
            </h3>
            
            <div className="glass-card space-y-1">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.label}
                    whileTap={{ scale: 0.98 }}
                    onClick={item.action}
                    className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                      itemIndex !== section.items.length - 1 ? 'border-b border-gray-100' : ''
                    } ${item.danger ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        item.danger 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.label === 'Privacy' && showBalance ? (
                          <EyeOff className="w-5 h-5" />
                        ) : item.label === 'Privacy' ? (
                          <Eye className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      
                      <div className="text-left">
                        <div className={`font-medium ${item.danger ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.label}
                        </div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                      </div>
                    </div>
                    
                    {!item.danger && (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide px-1">
            Quick Actions
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettingsModal(true)}
              className="glass-card p-4 text-center hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div className="font-medium text-gray-900 text-sm">Export Keys</div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // Lock wallet and reload
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="glass-card p-4 text-center hover:bg-red-50 transition-colors"
            >
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
              <div className="font-medium text-red-600 text-sm">Lock Wallet</div>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal 
          isOpen={showSettingsModal} 
          onClose={() => setShowSettingsModal(false)} 
        />
      )}

      {/* Currency Modal */}
      {showCurrency && (
        <CurrencyModal
          isOpen={showCurrency}
          onClose={() => setShowCurrency(false)}
          currentCurrency={selectedCurrency}
          onSuccess={() => {
            setShowCurrency(false);
            logger.log('✅ Currency updated successfully');
          }}
        />
      )}
    </>
  );
}
