'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Calendar, Shield, Settings, Copy, Check, 
  Crown, Wallet, ChevronRight, Edit2, Save, X, Key, Download,
  Lock, Eye, Globe, Bell, Smartphone, Sliders, FileDown, Trash2,
  LogOut, CheckCircle
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { getCurrentAccount } from '@/lib/account-manager';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface AccountPageProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export default function AccountPage({ isOpen, onClose, onOpenSettings }: AccountPageProps) {
  const { currentChain, lockWallet } = useWalletStore();
  const [account, setAccount] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [memberSince, setMemberSince] = useState('Nov 2024');
  
  useEffect(() => {
    const loadAccountData = async () => {
      if (isOpen) {
        const currentAccount = getCurrentAccount();
        setAccount(currentAccount);
        setDisplayName(currentAccount?.displayName || 'BLAZE User');
        
        // Load balance visibility preference
        const balanceVisibility = localStorage.getItem('showBalance');
        setShowBalance(balanceVisibility !== 'false');

        // Check if email is verified from Supabase and get created date
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Check if email_confirmed_at is set (means email is verified)
            setIsEmailVerified(!!user.email_confirmed_at);
            logger.log('Email verified status:', !!user.email_confirmed_at);
            
            // Get created date from Supabase
            if (user.created_at) {
              const createdDate = new Date(user.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short',
                day: 'numeric' 
              });
              setMemberSince(createdDate);
              logger.log('Member since:', createdDate);
            }
          }
        } catch (error) {
          logger.error('Failed to load user verification status:', error);
        }
      }
    };

    loadAccountData();
  }, [isOpen]);

  const handleSaveDisplayName = () => {
    // TODO: Save display name to account
    logger.log('Saving display name:', displayName);
    setIsEditing(false);
  };

  const handleToggleBalance = () => {
    const newValue = !showBalance;
    setShowBalance(newValue);
    localStorage.setItem('showBalance', String(newValue));
  };

  const handleLockWallet = () => {
    lockWallet();
    onClose();
    window.location.reload();
  };

  if (!isOpen || !account) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6 pb-32">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
                <p className="text-sm text-gray-600">
                  Manage your profile, security, and preferences
                </p>
              </div>
            </div>
          </div>

          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md relative">
                <User className="w-7 h-7 text-white" />
                {isEmailVerified && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="text-lg font-bold text-gray-900 bg-gray-50 border-2 border-orange-500 rounded-lg px-2 py-1 focus:outline-none flex-1"
                        placeholder="Your name"
                      />
                      <button
                        onClick={handleSaveDisplayName}
                        className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setDisplayName(account?.displayName || 'BLAZE User');
                        }}
                        className="p-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold text-gray-900 truncate">
                        {displayName}
                      </h2>
                      {isEmailVerified && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 mb-1 truncate">{account.email || 'user@blazewallet.io'}</p>
                <p className="text-xs text-gray-500">Member since {memberSince}</p>
              </div>

              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
          </motion.div>

          {/* PROFILE Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <div className="glass-card rounded-2xl overflow-hidden">
              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">Email</span>
                    {isEmailVerified ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-orange-600 text-xs">
                        Pending verification
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{account.email || 'user@blazewallet.io'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Edit Profile</div>
                  <p className="text-sm text-gray-600">Update your information</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </motion.div>

          {/* SECURITY Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="glass-card rounded-2xl overflow-hidden">
              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Change Password</div>
                  <p className="text-sm text-gray-600">Update your password</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button 
                onClick={() => {
                  onClose();
                  if (onOpenSettings) onOpenSettings();
                }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Export Wallet</div>
                  <p className="text-sm text-gray-600">Backup your seed phrase</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Auto-Lock</div>
                  <p className="text-sm text-gray-600">Lock after 5 minutes</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </motion.div>

          {/* PREFERENCES Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <div className="glass-card rounded-2xl overflow-hidden">
              <button 
                onClick={handleToggleBalance}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Balance Visibility</div>
                  <p className="text-sm text-gray-600">{showBalance ? 'Balance shown' : 'Balance hidden'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Language</div>
                  <p className="text-sm text-gray-600">English</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Notifications</div>
                  <p className="text-sm text-gray-600">Push notifications enabled</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Connected Devices</div>
                  <p className="text-sm text-gray-600">1 device connected</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </motion.div>

          {/* ADVANCED Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="glass-card rounded-2xl overflow-hidden">
              <button 
                onClick={() => {
                  onClose();
                  if (onOpenSettings) onOpenSettings();
                }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Advanced Settings</div>
                  <p className="text-sm text-gray-600">Developer options, network settings</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileDown className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Export Data</div>
                  <p className="text-sm text-gray-600">Download your transaction history</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button className="w-full flex items-center gap-4 p-4 hover:bg-red-50 transition-colors">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-red-600">Delete Account</div>
                  <p className="text-sm text-gray-600">Permanently delete your account</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 gap-4 mb-6"
          >
            <button 
              onClick={() => {
                onClose();
                if (onOpenSettings) onOpenSettings();
              }}
              className="glass-card rounded-2xl p-6 text-center hover:bg-blue-50 hover:border-blue-200 border border-gray-100 transition-all group"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div className="font-semibold text-gray-900 mb-1">Export Wallet</div>
              <div className="text-xs text-gray-600">Backup seed phrase</div>
            </button>

            <button 
              onClick={handleLockWallet}
              className="glass-card rounded-2xl p-6 text-center hover:bg-red-50 hover:border-red-200 border border-gray-100 transition-all group"
            >
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <div className="font-semibold text-red-600 mb-1">Lock Wallet</div>
              <div className="text-xs text-gray-600">Secure your wallet</div>
            </button>
          </motion.div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 space-y-1 mt-8">
            <div className="font-semibold">BLAZE Wallet v2.0.0</div>
            <div>© 2024 BLAZE. All rights reserved.</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

