'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail,
  Shield,
  Key,
  Bell,
  Globe,
  Eye,
  EyeOff,
  Smartphone,
  Lock,
  LogOut,
  ChevronRight,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  Edit3
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import SettingsModal from '../SettingsModal';
import { logger } from '@/lib/logger';

export default function AccountTab() {
  const { lockWallet } = useWalletStore();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  
  // Mock user data - in real app, this would come from auth/profile service
  const userEmail = typeof window !== 'undefined' 
    ? localStorage.getItem('userEmail') || 'user@blazewallet.io'
    : 'user@blazewallet.io';
  
  const isEmailVerified = true; // This would come from your auth service

  const accountSections = [
    {
      title: 'Profile',
      items: [
        { 
          icon: Mail, 
          label: 'Email', 
          description: userEmail,
          badge: isEmailVerified ? 'verified' : 'unverified',
          action: () => {} 
        },
        { 
          icon: Edit3, 
          label: 'Edit Profile', 
          description: 'Update your information', 
          action: () => {} 
        },
      ]
    },
    {
      title: 'Security',
      items: [
        { 
          icon: Key, 
          label: 'Change Password', 
          description: 'Update your password', 
          action: () => setShowSettingsModal(true) 
        },
        { 
          icon: Shield, 
          label: 'Export Wallet', 
          description: 'Backup your seed phrase', 
          action: () => setShowSettingsModal(true) 
        },
        { 
          icon: Lock, 
          label: 'Auto-Lock', 
          description: 'Lock after 5 minutes', 
          action: () => {} 
        },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { 
          icon: showBalance ? Eye : EyeOff, 
          label: 'Balance Visibility', 
          description: showBalance ? 'Balance shown' : 'Balance hidden', 
          action: () => setShowBalance(!showBalance) 
        },
        { 
          icon: Globe, 
          label: 'Language', 
          description: 'English', 
          action: () => {} 
        },
        { 
          icon: Bell, 
          label: 'Notifications', 
          description: 'Push notifications enabled', 
          action: () => {} 
        },
        { 
          icon: Smartphone, 
          label: 'Connected Devices', 
          description: '1 device connected', 
          action: () => {} 
        },
      ]
    },
    {
      title: 'Advanced',
      items: [
        { 
          icon: SettingsIcon, 
          label: 'Advanced Settings', 
          description: 'Developer options, network settings', 
          action: () => setShowSettingsModal(true) 
        },
        { 
          icon: Download, 
          label: 'Export Data', 
          description: 'Download your transaction history', 
          action: () => {} 
        },
        { 
          icon: Trash2, 
          label: 'Delete Account', 
          description: 'Permanently delete your account', 
          action: () => {},
          danger: true 
        },
      ]
    },
  ];

  return (
    <>
      {/* Header with Profile Card */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Account</h1>
                <p className="text-sm text-gray-500">Manage your profile & settings</p>
              </div>
            </div>
          </div>

          {/* Profile Summary Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 via-red-500 to-pink-600 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                {isEmailVerified && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    BLAZE User
                  </h3>
                  {isEmailVerified && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-medium text-green-700">Verified</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 truncate">{userEmail}</p>
                <p className="text-xs text-gray-500 mt-1">Member since Nov 2024</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {accountSections.map((section, sectionIndex) => (
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
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="text-left">
                        <div className={`font-medium flex items-center gap-2 ${
                          item.danger ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {item.label}
                          {item.badge === 'verified' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                          {item.badge === 'unverified' && (
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                          )}
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
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div className="font-medium text-gray-900 text-sm">Export Wallet</div>
              <div className="text-xs text-gray-500 mt-1">Backup seed phrase</div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                lockWallet();
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="glass-card p-4 text-center hover:bg-red-50 transition-colors"
            >
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <div className="font-medium text-red-600 text-sm">Lock Wallet</div>
              <div className="text-xs text-gray-500 mt-1">Secure your wallet</div>
            </motion.button>
          </div>
        </motion.div>

        {/* App Version */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-4"
        >
          <p className="text-xs text-gray-400">BLAZE Wallet v2.0.0</p>
          <p className="text-xs text-gray-400 mt-1">© 2024 BLAZE. All rights reserved.</p>
        </motion.div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal 
          isOpen={showSettingsModal} 
          onClose={() => setShowSettingsModal(false)} 
        />
      )}
    </>
  );
}

