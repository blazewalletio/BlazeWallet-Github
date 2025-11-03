'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Key, Clock, ChevronRight, Plus, FileText } from 'lucide-react';
import { getAllAccounts, switchToAccount, type WalletAccount } from '@/lib/account-manager';

interface AccountSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: () => void;
  onAddAccount: (type: 'email' | 'seed') => void;
  currentAccountId: string | null;
}

export default function AccountSwitchModal({
  isOpen,
  onClose,
  onSwitch,
  onAddAccount,
  currentAccountId,
}: AccountSwitchModalProps) {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);

  useEffect(() => {
    if (isOpen) {
      const allAccounts = getAllAccounts();
      setAccounts(allAccounts);
    }
  }, [isOpen]);

  const handleSwitchAccount = (account: WalletAccount) => {
    if (account.id === currentAccountId) {
      // Same account, just close
      onClose();
      return;
    }

    switchToAccount(account);
    onSwitch();
  };

  const formatLastUsed = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
      />
      
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-hidden"
      >
        <div className="glass-card rounded-t-3xl p-6 overflow-y-auto max-h-[80vh]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Switch account</h2>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="glass p-2 rounded-lg hover:bg-theme-bg-secondary"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Add New Account Buttons */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-semibold text-gray-600 mb-3">Add new account</p>
            
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onClose();
                onAddAccount('email');
              }}
              className="w-full glass p-4 rounded-xl flex items-center gap-4 hover:bg-theme-bg-secondary transition-colors border-2 border-blue-200 bg-blue-50"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              
              <div className="text-left flex-1">
                <div className="font-semibold text-gray-900">Login with email</div>
                <div className="text-sm text-gray-600">Use your email and password</div>
              </div>
              
              <Plus className="w-5 h-5 text-gray-400" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onClose();
                onAddAccount('seed');
              }}
              className="w-full glass p-4 rounded-xl flex items-center gap-4 hover:bg-theme-bg-secondary transition-colors border-2 border-orange-200 bg-orange-50"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              
              <div className="text-left flex-1">
                <div className="font-semibold text-gray-900">Import with recovery phrase</div>
                <div className="text-sm text-gray-600">Use your 12-word phrase</div>
              </div>
              
              <Plus className="w-5 h-5 text-gray-400" />
            </motion.button>
          </div>

          {/* Existing Accounts */}
          {accounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-600 mb-3">Recent accounts</p>
              
              {accounts.map((account) => {
                const isActive = account.id === currentAccountId;
                
                return (
                  <motion.button
                    key={account.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSwitchAccount(account)}
                    className={`w-full glass p-4 rounded-xl flex items-center justify-between hover:bg-theme-bg-secondary transition-colors ${
                      isActive ? 'ring-2 ring-orange-500 bg-orange-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        account.type === 'email'
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                          : 'bg-gradient-to-br from-orange-500 to-yellow-500'
                      }`}>
                        {account.type === 'email' ? (
                          <Mail className="w-6 h-6 text-white" />
                        ) : (
                          <Key className="w-6 h-6 text-white" />
                        )}
                      </div>
                      
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          {account.displayName}
                          {isActive && (
                            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatLastUsed(account.lastUsed)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Info Card */}
          <div className="mt-6 glass-card bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Secure account switching</p>
                <p className="text-xs text-gray-600">
                  Your wallet data remains encrypted. Enter your password after switching to unlock.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

