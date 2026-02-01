'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Calendar, Shield, Settings, Copy, Check, 
  Crown, Wallet, ChevronRight, Edit2, Save, X, Key, Download,
  Lock, Eye, Globe, Bell, Smartphone, Sliders, FileDown, Trash2,
  LogOut, CheckCircle, AlertCircle, Activity, TrendingUp, Zap,
  Upload, Camera, Monitor, AlertTriangle, Award, Target, BarChart3,
  EyeOff, RefreshCw, Clock, MapPin, Chrome, Apple, Loader2,
  MoreVertical, ExternalLink
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { getCurrentAccount } from '@/lib/account-manager';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import TwoFactorModal from './TwoFactorModal';
import ChangePasswordModal from './ChangePasswordModal';
import CurrencyModal from './CurrencyModal';
import NotificationSettingsModal from './NotificationSettingsModal';
import AutoLockSettingsModal from './AutoLockSettingsModal';
import DeleteAccountModal from './DeleteAccountModal';
import ChangeEmailModal from './ChangeEmailModal';
import UpgradeToEmailModal from './UpgradeToEmailModal';

interface AccountPageProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

interface UserProfile {
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  preferred_currency: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  balance_visible: boolean;
  notifications_enabled: boolean;
  two_factor_enabled: boolean;
  two_factor_method: string | null;
}

interface SecurityScore {
  score: number;
  email_verified: boolean;
  two_factor_enabled: boolean;
  strong_password: boolean;
  recovery_phrase_backed_up: boolean;
  trusted_device_added: boolean;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  description: string;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

interface TrustedDevice {
  id: string;
  device_name: string;
  browser: string;
  os: string;
  last_used_at: string;
  is_current: boolean;
  verified_at: string | null;
}

interface TransactionStats {
  total_transactions: number;
  total_sent: string;
  total_received: string;
  total_gas_spent: string;
  favorite_token: string | null;
  last_transaction_at?: string | null;
  updated_at?: string;
}

export default function AccountPage({ isOpen, onClose, onOpenSettings }: AccountPageProps) {
  const { currentChain, lockWallet, address } = useWalletStore(); // ✅ Get address from wallet store
  const [account, setAccount] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  
  // User data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [memberSince, setMemberSince] = useState('Nov 2024');
  const [userEmail, setUserEmail] = useState('');
  
  // Security
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  
  // Stats
  const [transactionStats, setTransactionStats] = useState<TransactionStats | null>(null);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Modal states
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const loadAccountData = async () => {
      if (isOpen) {
        logger.log('🔄 AccountPage opened - loading data...');
        setIsLoading(true);
        
        try {
          const currentAccount = getCurrentAccount();
          logger.log('📝 Current account:', currentAccount);
          
          // ✅ CRITICAL: If no account found, create a minimal one from wallet state
          if (!currentAccount) {
            logger.log('⚠️ getCurrentAccount returned null - checking wallet state...');
            
            // ✅ NEW: Check wallet store FIRST (for wallets unlocked in memory)
            if (address) {
              logger.log('✅ Wallet found in store (memory) - creating account from store');
              setAccount({
                id: `temp-wallet-${address.substring(0, 8)}`,
                type: 'seed',
                displayName: `Wallet ${address.substring(0, 8)}...${address.substring(address.length - 6)}`,
                lastUsed: new Date(),
                isActive: true
              });
            } else {
              // Fallback: Check localStorage
              const encryptedWallet = typeof window !== 'undefined' 
                ? localStorage.getItem('encrypted_wallet')
                : null;
              
              if (!encryptedWallet) {
                logger.error('❌ No wallet found in store or localStorage - cannot show account page');
                setIsLoading(false);
                return;
              }
              
              // Create minimal account from localStorage
              logger.log('✅ Creating minimal account from localStorage');
              setAccount({
                id: 'temp-seed-wallet',
                type: 'seed',
                displayName: 'Seed Wallet',
                lastUsed: new Date(),
                isActive: true
              });
            }
          } else {
            setAccount(currentAccount);
          }
          
          // Try to get Supabase user (email wallets only)
          // ✅ Wrap in try-catch because getUser() throws exception for seed wallets
          let user = null;
          try {
            const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
            if (!userError && supabaseUser) {
              user = supabaseUser;
              logger.log('✅ Supabase user found (email wallet):', user.email);
            }
          } catch (authError: any) {
            // ✅ AuthSessionMissingError is expected for seed wallets - not an error!
            logger.log('📝 No Supabase session (seed wallet) - this is normal');
          }
          
          // ✅ Load data if we have a Supabase user (email wallets)
          if (user) {
            // Email wallet - load Supabase data
            setUserEmail(user.email || '');
            
            // ✅ Check our custom verification status table (not auth.users)
            const { data: verificationStatus } = await supabase
              .from('user_email_verification_status')
              .select('is_verified')
              .eq('user_id', user.id)
              .single();
            
            setIsEmailVerified(verificationStatus?.is_verified || false);
            
            // Get created date
            if (user.created_at) {
              const createdDate = new Date(user.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short',
                day: 'numeric' 
              });
              setMemberSince(createdDate);
            }
            
            // Load user profile
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', user.id)
              .single();
            
            if (profile) {
              setUserProfile(profile);
              setDisplayName(profile.display_name || 'BLAZE User');
            } else {
              // Create profile if it doesn't exist
              const { data: newProfile } = await supabase
                .from('user_profiles')
                .insert({
                  user_id: user.id,
                  display_name: 'BLAZE User'
                })
                .select()
                .single();
              
              if (newProfile) {
                setUserProfile(newProfile);
                setDisplayName(newProfile.display_name);
              }
            }
            
            // Load security score
            const { data: scoreData } = await supabase.rpc('calculate_security_score', {
              p_user_id: user.id
            });
            
            const { data: secScore } = await supabase
              .from('user_security_scores')
              .select('*')
              .eq('user_id', user.id)
              .single();
            
            if (secScore) {
              setSecurityScore(secScore);
            }
            
            // Load activity log (last 10)
            const { data: activities } = await supabase
              .from('user_activity_log')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10);
            
            if (activities) {
              setActivityLog(activities);
            }
            
            // Load trusted devices
            const { data: devices } = await supabase
              .from('trusted_devices')
              .select('*')
              .eq('user_id', user.id)
              .order('last_used_at', { ascending: false });
            
            if (devices) {
              setTrustedDevices(devices);
            }
            
            // Load transaction stats - use new API endpoint
            try {
              const statsResponse = await fetch(`/api/transactions/track?userId=${user.id}`);
              const statsData = await statsResponse.json();
              
              if (statsData.success && statsData.stats) {
                setTransactionStats(statsData.stats);
              } else {
                // Fallback to direct database query
                const { data: stats } = await supabase
                  .from('user_transaction_stats')
                  .select('*')
                  .eq('user_id', user.id)
                  .single();
                
                if (stats) {
                  setTransactionStats(stats);
                }
              }
            } catch (statsError) {
              logger.error('Failed to load transaction stats:', statsError);
              // Set default empty stats
              setTransactionStats({
                total_transactions: 0,
                total_sent: '0',
                total_received: '0',
                total_gas_spent: '0',
                favorite_token: null,
                last_transaction_at: null,
                updated_at: new Date().toISOString()
              });
            }
          } else {
            // ✅ Seed wallet - set defaults (no Supabase data)
            logger.log('📝 Seed wallet detected - using defaults');
            logger.log('📝 Account display name:', currentAccount?.displayName);
            setUserEmail(''); // No email
            setIsEmailVerified(false);
            setMemberSince('N/A');
            setDisplayName(currentAccount?.displayName || 'Seed Wallet User');
            // Security score, activity, devices, stats remain empty (default state)
          }
          
          logger.log('✅ AccountPage data loaded successfully');
        } catch (error) {
          logger.error('❌ Failed to load account data:', error);
          // ✅ Don't fail completely - show what we have
        } finally {
          setIsLoading(false);
          logger.log('✅ AccountPage loading complete');
        }
      }
    };

    loadAccountData();
  }, [isOpen]);

  const handleSaveDisplayName = async () => {
    if (!account) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName })
        .eq('user_id', user.id);
      
      if (!error) {
        setUserProfile(prev => prev ? { ...prev, display_name: displayName } : null);
        logger.log('Display name updated:', displayName);
      }
    } catch (error) {
      logger.error('Failed to update display name:', error);
    }
    
    setIsEditing(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('File must be an image');
      return;
    }
    
    setIsUploadingAvatar(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);
      
      // Update profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);
      
      if (!updateError) {
        setUserProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
        logger.log('Avatar uploaded successfully');
      }
    } catch (error) {
      logger.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCopyAddress = () => {
    // Get address from wallet store (WalletAccount doesn't have address property)
    const { getCurrentAddress } = useWalletStore.getState();
    const addressToCopy = address || getCurrentAddress();
    
    if (!addressToCopy) {
      logger.error('No address found to copy');
      alert('No address available to copy');
      return;
    }
    
    navigator.clipboard.writeText(addressToCopy).then(() => {
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
      logger.log('Address copied to clipboard:', addressToCopy);
    }).catch((error) => {
      logger.error('Failed to copy address:', error);
      alert('Failed to copy address. Please try again.');
    });
  };

  const handleToggleBalance = async () => {
    if (!userProfile) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const newValue = !userProfile.balance_visible;
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ balance_visible: newValue })
        .eq('user_id', user.id);
      
      if (!error) {
        setUserProfile({ ...userProfile, balance_visible: newValue });
        // ✅ REMOVED localStorage - all preferences are now in Supabase for cross-device sync
        
        // Log activity
        await supabase.rpc('log_user_activity', {
          p_user_id: user.id,
          p_activity_type: 'settings_change',
          p_description: `Balance visibility ${newValue ? 'enabled' : 'disabled'}`,
          p_metadata: JSON.stringify({ balance_visible: newValue })
        });
      }
    } catch (error) {
      logger.error('Failed to toggle balance visibility:', error);
    }
  };

  const handleLockWallet = () => {
    lockWallet();
    onClose();
    window.location.reload();
  };
  
  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this device?')) return;
    
    try {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId);
      
      if (error) throw error;
      
      // Update local state
      setTrustedDevices(prev => prev.filter(d => d.id !== deviceId));
      
      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('log_user_activity', {
          p_user_id: user.id,
          p_activity_type: 'security_alert',
          p_description: 'Trusted device removed',
          p_metadata: JSON.stringify({ device_id: deviceId })
        });
      }
      
      logger.log('Device removed:', deviceId);
    } catch (error) {
      logger.error('Failed to remove device:', error);
      alert('Failed to remove device. Please try again.');
    }
  };
  
  const handleExportCSV = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Download CSV file
      const response = await fetch(`/api/export-csv?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `blaze-wallet-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      logger.log('CSV exported successfully');
    } catch (error) {
      logger.error('Failed to export CSV:', error);
      alert('Failed to export transaction history. Please try again.');
    }
  };
  
  const handleExportAddresses = () => {
    try {
      const account = getCurrentAccount();
      if (!account) return;
      
      const { address, solanaAddress, bitcoinAddress, litecoinAddress, dogecoinAddress, bitcoincashAddress } = useWalletStore.getState();
      
      // Generate addresses for all 18 chains
      const addresses: Record<string, string> = {};
      Object.entries(CHAINS).forEach(([chainKey, chain]) => {
        if (chainKey === 'solana') {
          addresses['Solana'] = solanaAddress || 'N/A';
        } else if (chainKey === 'bitcoin') {
          addresses['Bitcoin'] = bitcoinAddress || 'N/A';
        } else if (chainKey === 'litecoin') {
          addresses['Litecoin'] = litecoinAddress || 'N/A';
        } else if (chainKey === 'dogecoin') {
          addresses['Dogecoin'] = dogecoinAddress || 'N/A';
        } else if (chainKey === 'bitcoincash') {
          addresses['Bitcoin Cash'] = bitcoincashAddress || 'N/A';
        } else {
          // All EVM chains use the same address
          addresses[chain.name] = address || 'N/A';
        }
      });
      
      // Create formatted text
      let text = '🔥 BLAZE WALLET - ALL CHAIN ADDRESSES\n';
      text += '='.repeat(50) + '\n\n';
      text += `Account: ${account.email || 'Seed Wallet'}\n`;
      text += `Export Date: ${new Date().toLocaleString()}\n\n`;
      text += '='.repeat(50) + '\n\n';
      
      Object.entries(addresses).forEach(([chainName, address]) => {
        text += `${chainName}:\n${address}\n\n`;
      });
      
      text += '='.repeat(50) + '\n';
      text += '⚠️ KEEP THIS SAFE - NEVER SHARE WITH ANYONE\n';
      text += '💡 Use these addresses to receive crypto on each chain\n';
      
      // Copy to clipboard
      navigator.clipboard.writeText(text);
      
      alert('✅ All addresses copied to clipboard!');
      
      logger.log('All addresses exported to clipboard');
    } catch (error) {
      logger.error('Failed to export addresses:', error);
      alert('Failed to export addresses. Please try again.');
    }
  };
  
  const handleReloadData = async () => {
    // Reload all data after modal changes
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profile) {
      setUserProfile(profile);
    }
    
    // Recalculate security score
    await supabase.rpc('calculate_security_score', {
      p_user_id: user.id
    });
    
    const { data: secScore } = await supabase
      .from('user_security_scores')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (secScore) {
      setSecurityScore(secScore);
    }
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSecurityScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login': return Monitor;
      case 'transaction': return TrendingUp;
      case 'security_alert': return AlertTriangle;
      case 'settings_change': return Settings;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'login': return 'from-blue-500 to-cyan-500';
      case 'transaction': return 'from-green-500 to-emerald-500';
      case 'security_alert': return 'from-red-500 to-orange-500';
      case 'settings_change': return 'from-purple-500 to-indigo-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case 'login': return 'from-blue-50 to-cyan-50';
      case 'transaction': return 'from-green-50 to-emerald-50';
      case 'security_alert': return 'from-red-50 to-orange-50';
      case 'settings_change': return 'from-purple-50 to-indigo-50';
      default: return 'from-gray-50 to-gray-50';
    }
  };

  // ✅ Show loading state even if account not loaded yet
  if (!isOpen) return null;

  // ✅ Show loading during data fetch OR if account not loaded yet
  if (isLoading || !account) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="animate-spin h-12 w-12 text-orange-500 mx-auto mb-4" />
              <p className="text-gray-600">Loading account data...</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

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
            className="mb-6 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-all hover:gap-3"
          >
            <span className="text-lg">←</span>
            <span>Back</span>
          </button>

          {/* Header - Modern & Compact */}
          <div className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-1">Account Settings</h2>
                <p className="text-sm text-gray-600">
                  Manage your wallet preferences
                </p>
              </div>
            </div>
          </div>

          {/* Account Section - HYBRID PRO */}
          <div className="glass-card p-6 border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Account
            </h3>
            
            {/* User Info */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                {/* Avatar with Upload Button */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center overflow-hidden">
                    {userProfile?.avatar_url ? (
                      <img 
                        src={userProfile.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  
                  {/* Upload Button */}
                  {account?.type === 'email' && (
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 hover:bg-orange-600 rounded-lg flex items-center justify-center cursor-pointer shadow-md transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={isUploadingAvatar}
                      />
                      {isUploadingAvatar ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : (
                        <Camera className="w-3 h-3 text-white" />
                      )}
                    </label>
                  )}
                </div>
                
                {/* Name & Email */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="text-base font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 flex-1 min-w-0"
                        placeholder="Your name"
                      />
                      <button
                        onClick={handleSaveDisplayName}
                        className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex-shrink-0"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setDisplayName(userProfile?.display_name || 'BLAZE User');
                        }}
                        className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors flex-shrink-0"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-gray-900 truncate">
                        {displayName}
                      </h4>
                      {isEmailVerified && (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors ml-auto"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-600 truncate">
                    {userEmail || (account?.type === 'seed' ? 'Seed Wallet' : 'No Email')}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Wallet Address */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-600 font-medium mb-1">Wallet address</div>
                  <code className="text-sm font-mono text-gray-900 block truncate">
                    {address || useWalletStore.getState().getCurrentAddress()}
                  </code>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="p-2 hover:bg-white rounded-lg transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copiedAddress ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Section - HYBRID PRO Grid */}
          <div className="glass-card p-6 border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              Statistics
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Transactions */}
              <div>
                <div className="text-xs text-gray-600 mb-1">Transactions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {transactionStats?.total_transactions || 0}
                </div>
              </div>
              
              {/* Volume */}
              <div>
                <div className="text-xs text-gray-600 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-900">
                  {transactionStats ? (
                    `$${(parseFloat(transactionStats.total_sent) + parseFloat(transactionStats.total_received)).toFixed(2)}`
                  ) : '$0.00'}
                </div>
              </div>
              
              {/* Security Score */}
              <div>
                <div className="text-xs text-gray-600 mb-1">Security</div>
                <div className={`text-2xl font-bold ${getSecurityScoreColor(securityScore?.score || 0)}`}>
                  {securityScore?.score || 0}/100
                </div>
              </div>
            </div>
          </div>

          {/* Security Section - HYBRID PRO Grid Layout */}
          <div className="glass-card p-6 border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-500" />
                Security
              </h3>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getSecurityScoreColor(securityScore?.score || 0)}`}>
                  {securityScore?.score || 0}
                </div>
                <div className="text-xs text-gray-600">/100 pts</div>
              </div>
            </div>
            
            {/* Security Score Grid - 4 items horizontal */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Email Verified */}
              <div className={`p-3 rounded-lg border-2 ${
                securityScore?.email_verified 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-center mb-2">
                  {securityScore?.email_verified ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Mail className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-center font-medium text-gray-900 mb-1">
                  Email Verified
                </div>
                <div className="text-xs text-center font-bold text-gray-600">
                  +25 pts
                </div>
              </div>
              
              {/* 2FA Enabled */}
              <div className={`p-3 rounded-lg border-2 ${
                securityScore?.two_factor_enabled 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-center mb-2">
                  {securityScore?.two_factor_enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Shield className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-center font-medium text-gray-900 mb-1">
                  2FA Enabled
                </div>
                <div className="text-xs text-center font-bold text-gray-600">
                  +30 pts
                </div>
              </div>
              
              {/* Recovery Phrase */}
              <div className={`p-3 rounded-lg border-2 ${
                securityScore?.recovery_phrase_backed_up 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-center mb-2">
                  {securityScore?.recovery_phrase_backed_up ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Key className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-center font-medium text-gray-900 mb-1">
                  Recovery Phrase
                </div>
                <div className="text-xs text-center font-bold text-gray-600">
                  +25 pts
                </div>
              </div>
              
              {/* Trusted Device */}
              <div className={`p-3 rounded-lg border-2 ${
                securityScore?.trusted_device_added 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-center mb-2">
                  {securityScore?.trusted_device_added ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="text-xs text-center font-medium text-gray-900 mb-1">
                  Trusted Device
                </div>
                <div className="text-xs text-center font-bold text-gray-600">
                  +20 pts
                </div>
              </div>
            </div>
            
            {/* 2FA Button */}
            {account?.type === 'email' && (
              <button
                onClick={() => setShow2FAModal(true)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-900">Two-Factor Authentication</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">
                    {userProfile?.two_factor_enabled ? 'Enabled' : 'Not enabled'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            )}
          </div>

          {/* Recent Activity - HYBRID PRO Clean Collapsible */}
          <div className="glass-card border border-gray-200 mb-6 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-500" />
                    Recent Activity
                  </h3>
                  <p className="text-xs text-gray-600">
                    {activityLog.length > 0 ? `Last ${activityLog.length} actions` : 'No activity yet'}
                  </p>
                </div>
                <button
                  onClick={() => setShowActivityLog(!showActivityLog)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm text-gray-700 transition-colors flex items-center gap-2"
                >
                  {showActivityLog ? 'Hide' : 'Show'}
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showActivityLog ? 'rotate-90' : ''}`} />
                </button>
              </div>
            </div>

            {/* Activity List - Expandable */}
            <AnimatePresence>
              {showActivityLog && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 space-y-2">
                    {activityLog.length === 0 ? (
                      <div className="text-center py-8">
                        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900 mb-1">No recent activity</p>
                        <p className="text-xs text-gray-500">
                          Activity will appear here
                        </p>
                      </div>
                    ) : (
                      activityLog.map((activity) => {
                        const Icon = getActivityIcon(activity.activity_type);
                        
                        return (
                          <div
                            key={activity.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  {activity.description}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  {activity.ip_address && (
                                    <span className="font-mono">{activity.ip_address}</span>
                                  )}
                                  <span>{formatActivityTime(activity.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trusted Devices - HYBRID PRO Clean Collapsible */}
          <div className="glass-card border border-gray-200 mb-6 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-orange-500" />
                    Trusted Devices
                  </h3>
                  <p className="text-xs text-gray-600">
                    {trustedDevices.length} {trustedDevices.length === 1 ? 'device' : 'devices'} verified
                  </p>
                </div>
                <button
                  onClick={() => setShowDevices(!showDevices)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm text-gray-700 transition-colors flex items-center gap-2"
                >
                  {showDevices ? 'Hide' : 'Show'}
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showDevices ? 'rotate-90' : ''}`} />
                </button>
              </div>
            </div>

            {/* Devices List - Expandable */}
            <AnimatePresence>
              {showDevices && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 space-y-2">
                    {trustedDevices.length === 0 ? (
                      <div className="text-center py-8">
                        <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900 mb-1">No trusted devices yet</p>
                        <p className="text-xs text-gray-500">
                          Verified devices will appear here
                        </p>
                      </div>
                    ) : (
                      trustedDevices.map((device) => (
                        <div
                          key={device.id}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg ${device.is_current ? 'bg-orange-100' : 'bg-gray-100'} flex-shrink-0`}>
                                {device.is_current ? (
                                  <Monitor className="w-4 h-4 text-orange-500" />
                                ) : device.os.toLowerCase().includes('ios') || device.os.toLowerCase().includes('iphone') ? (
                                  <Apple className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <Monitor className="w-4 h-4 text-gray-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {device.device_name}
                                  </p>
                                  {device.is_current && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">
                                  {device.browser} · {device.os}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Last used {formatActivityTime(device.last_used_at)}
                                </p>
                              </div>
                            </div>
                            
                            {!device.is_current && (
                              <button
                                onClick={() => handleRemoveDevice(device.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                title="Remove device"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Actions - HYBRID PRO Button Grid */}
          <div className="glass-card p-6 border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Quick Actions
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Export CSV */}
              <button
                onClick={handleExportCSV}
                className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <Download className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                <div className="text-xs font-medium text-gray-900">Export CSV</div>
              </button>
              
              {/* Export Addresses */}
              <button
                onClick={handleExportAddresses}
                className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <FileDown className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                <div className="text-xs font-medium text-gray-900">Export Addresses</div>
              </button>
              
              {/* Lock Wallet */}
              <button
                onClick={handleLockWallet}
                className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <Lock className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                <div className="text-xs font-medium text-gray-900">Lock Wallet</div>
              </button>
            </div>
          </div>


          {/* Footer */}
          <div className="text-center text-xs text-gray-500 space-y-1 mt-8">
            <div className="font-semibold">BLAZE Wallet v2.0.0</div>
            <div>© 2024 BLAZE. All rights reserved.</div>
          </div>
        </div>
      </motion.div>
      
      {/* Modals */}
      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        isEnabled={userProfile?.two_factor_enabled || false}
        onSuccess={handleReloadData}
      />
      
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSuccess={handleReloadData}
      />
      
      <CurrencyModal
        isOpen={showCurrency}
        onClose={() => setShowCurrency(false)}
        currentCurrency={userProfile?.preferred_currency || 'USD'}
        onSuccess={handleReloadData}
      />
      
      <NotificationSettingsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        currentSettings={userProfile?.notifications_enabled || false}
        onSuccess={handleReloadData}
      />
      
      <AutoLockSettingsModal
        isOpen={showAutoLock}
        onClose={() => setShowAutoLock(false)}
        currentTimeout={5}
        onSuccess={handleReloadData}
      />
      
      <DeleteAccountModal
        isOpen={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
      />
      
      <ChangeEmailModal
        isOpen={showChangeEmail}
        onClose={() => setShowChangeEmail(false)}
        currentEmail={userEmail}
        onSuccess={handleReloadData}
      />
      
      <UpgradeToEmailModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={handleReloadData}
      />
    </AnimatePresence>
  );
}

