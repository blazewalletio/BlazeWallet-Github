'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Calendar, Shield, Settings, Copy, Check, 
  Crown, Wallet, ChevronRight, Edit2, Save, X
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { BlockchainService } from '@/lib/blockchain';
import { CHAINS } from '@/lib/chains';
import { getCurrentAccount } from '@/lib/account-manager';
import { logger } from '@/lib/logger';

interface ProfilePageProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export default function ProfilePage({ isOpen, onClose, onOpenSettings }: ProfilePageProps) {
  const { currentChain, getCurrentAddress } = useWalletStore();
  const [account, setAccount] = useState<any>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      const currentAccount = getCurrentAccount();
      setAccount(currentAccount);
      setDisplayName(currentAccount?.displayName || '');
    }
  }, [isOpen]);

  const handleCopyAddress = (address: string, chainKey: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(chainKey);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSaveDisplayName = () => {
    // TODO: Save display name to account
    logger.log('Saving display name:', displayName);
    setIsEditing(false);
  };

  if (!isOpen || !account) return null;

  // Format member since date
  const memberSince = account.createdAt 
    ? new Date(account.createdAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'Unknown';

  // Get all wallet addresses per chain
  const walletAddresses = Object.entries(CHAINS).map(([key, chain]) => {
    let address = '';
    
    // Determine address based on chain key
    if (key === 'solana') {
      address = account.solanaAddress || '';
    } else if (key === 'bitcoin') {
      address = account.bitcoinAddress || '';
    } else if (key === 'litecoin') {
      address = account.litecoinAddress || '';
    } else if (key === 'dogecoin') {
      address = account.dogecoinAddress || '';
    } else if (key === 'bitcoincash') {
      address = account.bitcoincashAddress || '';
    } else {
      // All other chains are EVM-based and use the same address
      address = account.evmAddress || '';
    }
    
    return {
      chainKey: key,
      chainName: chain.name,
      chainIcon: chain.logoUrl,
      address,
      isActive: key === currentChain
    };
  }).filter(item => item.address);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6 pb-24">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="text-2xl font-bold text-gray-900 bg-white border-2 border-orange-500 rounded-lg px-3 py-1 focus:outline-none"
                        placeholder="Your name"
                      />
                      <button
                        onClick={handleSaveDisplayName}
                        className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setDisplayName(account?.displayName || '');
                        }}
                        className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {account.displayName || 'Anonymous User'}
                      </h2>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Account & Wallet Information
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Account Information Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-6 border border-gray-200"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Account Information</h3>
              
              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium">Email Address</div>
                    <div className="text-sm font-semibold text-gray-900">{account.email || 'Not set'}</div>
                  </div>
                </div>

                {/* Member Since */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium">Member Since</div>
                    <div className="text-sm font-semibold text-gray-900">{memberSince}</div>
                  </div>
                </div>

                {/* Premium Status */}
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-700 font-medium">Account Type</div>
                    <div className="text-sm font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                      {account.isPremium ? 'Premium Member' : 'Free Account'}
                    </div>
                  </div>
                  {!account.isPremium && (
                    <button className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm">
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Wallet Addresses Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-6 border border-gray-200"
            >
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-bold text-gray-900">Your Wallet Addresses</h3>
              </div>
              
              <div className="space-y-3">
                {walletAddresses.map((item) => (
                  <div
                    key={item.chainKey}
                    className={`p-4 rounded-xl border transition-all ${
                      item.isActive 
                        ? 'bg-orange-50 border-orange-300' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {item.chainIcon ? (
                        <img 
                          src={item.chainIcon} 
                          alt={item.chainName}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-gray-300 rounded-full" />
                      )}
                      <span className="font-semibold text-gray-900">{item.chainName}</span>
                      {item.isActive && (
                        <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200">
                        {BlockchainService.formatAddress(item.address, 12)}
                      </code>
                      <button
                        onClick={() => handleCopyAddress(item.address, item.chainKey)}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                      >
                        {copiedAddress === item.chainKey ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Actions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-6 border border-gray-200"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenSettings) onOpenSettings();
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Settings className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900">Wallet Settings</div>
                    <div className="text-xs text-gray-600">Security, backup & more</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl transition-all border border-blue-200"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900">Security & Privacy</div>
                    <div className="text-xs text-gray-600">Manage your security settings</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

