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
  seed_phrase_backed_up: boolean;
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
                address: address,
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
            
            // Load transaction stats
            const { data: stats } = await supabase
              .from('user_transaction_stats')
              .select('*')
              .eq('user_id', user.id)
              .single();
            
            if (stats) {
              setTransactionStats(stats);
            } else {
              // Create stats if they don't exist
              await supabase
                .from('user_transaction_stats')
                .insert({ user_id: user.id });
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
    // Try multiple sources for the address
    const addressToCopy = account?.address || address || getCurrentAccount()?.address;
    
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

          {/* User Info Card with Avatar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg relative overflow-hidden">
                  {userProfile?.avatar_url ? (
                    <img 
                      src={userProfile.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                  {isEmailVerified && (
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Upload Button */}
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors border-2 border-white">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                  {isUploadingAvatar ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </label>
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
                          setDisplayName(userProfile?.display_name || 'BLAZE User');
                        }}
                        className="p-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-gray-900 truncate">
                        {displayName}
                      </h2>
                      {isEmailVerified && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 mb-1 truncate">
                  {userEmail || (account?.type === 'seed' ? 'Seed Wallet (No Email)' : 'No Email')}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Member since {memberSince}</span>
                </div>
                
                {/* Wallet Address with Actions */}
                <div className="mt-2 flex items-center gap-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-600">
                    {(account?.address || address || getCurrentAccount()?.address)?.slice(0, 8)}...{(account?.address || address || getCurrentAccount()?.address)?.slice(-6)}
                  </code>
                  
                  {/* Copy Button - Fixed to always work */}
                  <button
                    onClick={handleCopyAddress}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy address to clipboard"
                  >
                    {copiedAddress ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </button>
                  
                  {/* Three Vertical Dots Menu (More Options) */}
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {showProfileMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowProfileMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
                          >
                            <button
                              onClick={() => {
                                const fullAddress = account?.address || address || getCurrentAccount()?.address;
                                if (fullAddress) {
                                  navigator.clipboard.writeText(fullAddress).then(() => {
                                    setCopiedAddress(true);
                                    setTimeout(() => setCopiedAddress(false), 2000);
                                    setShowProfileMenu(false);
                                    logger.log('Full address copied:', fullAddress);
                                  }).catch((error) => {
                                    logger.error('Failed to copy full address:', error);
                                    alert('Failed to copy address. Please try again.');
                                  });
                                } else {
                                  alert('No address available to copy');
                                }
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Copy className="w-4 h-4" />
                              Copy Full Address
                            </button>
                            
                            {(account?.address || address || getCurrentAccount()?.address) && (
                              <a
                                href={`${CHAINS[currentChain]?.explorerUrl}/address/${account?.address || address || getCurrentAccount()?.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShowProfileMenu(false)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <ExternalLink className="w-4 h-4" />
                                View on Explorer
                              </a>
                            )}
                            
                            <button
                              onClick={() => {
                                handleExportAddresses();
                                setShowProfileMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              Export All Addresses
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* QUICK STATS - NEW! */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-semibold">Transactions</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {transactionStats?.total_transactions || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Lifetime activity
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-semibold">Total Volume</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {transactionStats ? (
                  `$${(parseFloat(transactionStats.total_sent) + parseFloat(transactionStats.total_received)).toFixed(2)}`
                ) : '$0.00'}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Sent + Received
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Target className="w-5 h-5" />
                <span className="text-sm font-semibold">Security Score</span>
              </div>
              <div className={`text-3xl font-bold ${getSecurityScoreColor(securityScore?.score || 0)}`}>
                {securityScore?.score || 0}/100
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {securityScore && securityScore.score >= 80 ? 'Excellent' : securityScore && securityScore.score >= 60 ? 'Good' : 'Needs Work'}
              </div>
            </motion.div>
          </div>

          {/* SECURITY SCORE & CHECKLIST - NEW! */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 bg-gradient-to-r ${getSecurityScoreGradient(securityScore?.score || 0)} rounded-xl flex items-center justify-center`}>
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Security Status</h3>
                  <p className="text-sm text-gray-600">Protect your account</p>
                </div>
              </div>
              <div className={`text-3xl font-bold ${getSecurityScoreColor(securityScore?.score || 0)}`}>
                {securityScore?.score || 0}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${securityScore?.score || 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${getSecurityScoreGradient(securityScore?.score || 0)}`}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {securityScore?.email_verified ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">Email Verified</span>
                </div>
                <span className="text-xs text-gray-500">+20 pts</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {securityScore?.two_factor_enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">2FA Enabled</span>
                </div>
                <span className="text-xs text-gray-500">+25 pts</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {securityScore?.trusted_device_added ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">Trusted Device Added</span>
                </div>
                <span className="text-xs text-gray-500">+20 pts</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Active User</span>
                </div>
                <span className="text-xs text-gray-500">+15 pts</span>
              </div>
            </div>
          </motion.div>

          {/* RECENT ACTIVITY - NEW! */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card rounded-2xl overflow-hidden mb-6"
          >
            <button
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                  <p className="text-sm text-gray-600">Last {activityLog.length} actions</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showActivityLog ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {showActivityLog && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-gray-100"
                >
                  <div className="p-6 space-y-3">
                    {activityLog.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No recent activity</p>
                      </div>
                    ) : (
                      activityLog.map((activity) => {
                        const Icon = getActivityIcon(activity.activity_type);
                        return (
                          <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                              <Icon className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                {activity.ip_address && (
                                  <>
                                    <span>{activity.ip_address}</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>{formatActivityTime(activity.created_at)}</span>
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
          </motion.div>

          {/* TRUSTED DEVICES - NEW! */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl overflow-hidden mb-6"
          >
            <button
              onClick={() => setShowDevices(!showDevices)}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-gray-900">Trusted Devices</h3>
                  <p className="text-sm text-gray-600">{trustedDevices.length} device{trustedDevices.length !== 1 ? 's' : ''} connected</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showDevices ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {showDevices && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-gray-100"
                >
                  <div className="p-6 space-y-3">
                    {trustedDevices.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No trusted devices yet</p>
                        <p className="text-xs mt-1">New devices must be verified via email</p>
                      </div>
                    ) : (
                      trustedDevices.map((device) => (
                        <div key={device.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                            {device.os?.toLowerCase().includes('mac') || device.os?.toLowerCase().includes('ios') ? (
                              <Apple className="w-5 h-5 text-gray-600" />
                            ) : (
                              <Monitor className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{device.device_name}</p>
                              {device.is_current && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                  Current
                                </span>
                              )}
                              {!device.verified_at && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>{device.browser}</span>
                              <span>•</span>
                              <span>{device.os}</span>
                              <span>•</span>
                              <span>Last used {formatActivityTime(device.last_used_at)}</span>
                            </div>
                          </div>
                          {!device.is_current && (
                            <button 
                              onClick={() => handleRemoveDevice(device.id)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* UPGRADE BANNER - Show for seed wallets without email */}
          {account?.type === 'seed' && !userEmail && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="mb-6"
            >
              <div className="glass-card rounded-2xl p-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Upgrade to Email Account
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      Get cloud backup, multi-device access, and advanced security features while keeping your existing wallet.
                    </p>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SECURITY Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-3 px-1">Security</h3>
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Upgrade Button for Seed Wallets (Alternative placement in menu) */}
              {account?.type === 'seed' && !userEmail && (
                <button 
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all border-b border-gray-100 bg-gradient-to-r from-orange-50/30 to-red-50/30"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Upgrade to Email Account</span>
                      <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Cloud backup & advanced features</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              )}
              
              {/* Email section - Only show for email wallets */}
              {userEmail && (
                <button 
                  onClick={() => setShowChangeEmail(true)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
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
                    <p className="text-sm text-gray-600 truncate">{userEmail}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              )}

              <button 
                onClick={() => setShow2FAModal(true)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">Two-Factor Authentication</span>
                    {userProfile?.two_factor_enabled ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                        Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-full">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {userProfile?.two_factor_enabled ? 'Extra layer of security active' : 'Add an extra layer of security'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>

              <button 
                onClick={() => setShowChangePassword(true)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Change Password</div>
                  <p className="text-sm text-gray-600">Update your password</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            </div>
          </motion.div>

          {/* PREFERENCES Section - REMOVED, now in Settings */}
          {/* ADVANCED Section - REMOVED, now in Settings */}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-4 mb-6"
          >
            <button 
              onClick={handleExportAddresses}
              className="glass-card rounded-2xl p-6 text-center hover:bg-purple-50 hover:border-purple-200 border border-gray-100 transition-all group"
            >
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6 text-purple-600" />
              </div>
              <div className="font-semibold text-gray-900 mb-1 text-sm">Export Addresses</div>
              <div className="text-xs text-gray-600">All 18 chains</div>
            </button>
            
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
              <div className="font-semibold text-gray-900 mb-1 text-sm">Export Wallet</div>
              <div className="text-xs text-gray-600">Backup seed phrase</div>
            </button>

            <button 
              onClick={handleLockWallet}
              className="glass-card rounded-2xl p-6 text-center hover:bg-red-50 hover:border-red-200 border border-gray-100 transition-all group"
            >
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <div className="font-semibold text-red-600 mb-1 text-sm">Lock Wallet</div>
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

