'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Key, Trash2, 
  Eye, EyeOff, Copy, Check, Bell, Settings, Fingerprint, CheckCircle, XCircle, Bug,
  AlertTriangle, Lock, Clock, Globe, TestTube2
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { supabase } from '@/lib/supabase';
import { CHAINS } from '@/lib/chains';
import BiometricSetupModal from './BiometricSetupModal';
import PasswordVerificationModal from './PasswordVerificationModal';
import { logger } from '@/lib/logger';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDebug?: () => void; // NEW: Callback to open debug panel
}

export default function SettingsModal({ isOpen, onClose, onOpenDebug }: SettingsModalProps) {
  const { mnemonic, resetWallet, address, getCurrentAddress } = useWalletStore();
  const displayAddress = getCurrentAddress(); // ✅ Get correct address for current chain
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState('');
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [showPasswordVerification, setShowPasswordVerification] = useState(false);
  
  // ✅ NEW: Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // ✅ NEW: Network & Testnet settings
  const [defaultNetwork, setDefaultNetwork] = useState('ethereum');
  const [enableTestnets, setEnableTestnets] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(5); // minutes
  
  // Supabase user ID (for syncing settings)
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Load all settings from Supabase (or localStorage fallback)
  useEffect(() => {
    if (isOpen) {
      loadAllSettings();
    }
  }, [isOpen]);

  const loadAllSettings = async () => {
    setIsLoadingSettings(true);
    
    try {
      // Try to get Supabase user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setSupabaseUserId(user.id);
        logger.log('✅ Loading settings from Supabase for user:', user.id);
        
        // Load from Supabase
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('notifications_enabled, default_network, enable_testnets, auto_lock_timeout')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          logger.error('Error loading settings from Supabase:', error);
          // Fallback to localStorage
          loadFromLocalStorage();
        } else if (profile) {
          // Apply Supabase settings
          setNotificationsEnabled(profile.notifications_enabled ?? true);
          setDefaultNetwork(profile.default_network || 'ethereum');
          setEnableTestnets(profile.enable_testnets ?? false);
          setAutoLockTimeout(profile.auto_lock_timeout ?? 5);
          
          logger.log('✅ Settings loaded from Supabase:', profile);
        } else {
          // No profile yet, use defaults
          loadFromLocalStorage();
        }
      } else {
        // No Supabase user (seed wallet), use localStorage
        logger.log('📱 No Supabase user, loading from localStorage');
        setSupabaseUserId(null);
        loadFromLocalStorage();
      }
    } catch (error) {
      logger.error('Error in loadAllSettings:', error);
      loadFromLocalStorage();
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadFromLocalStorage = () => {
    if (typeof window !== 'undefined') {
      setNotificationsEnabled(localStorage.getItem('notifications_enabled') !== 'false');
      setDefaultNetwork(localStorage.getItem('default_network') || 'ethereum');
      setEnableTestnets(localStorage.getItem('enable_testnets') === 'true');
      setAutoLockTimeout(parseInt(localStorage.getItem('auto_lock_timeout') || '5'));
    }
  };

  const saveToSupabase = async (updates: any) => {
    if (!supabaseUserId) {
      logger.log('⚠️ No Supabase user, skipping cloud sync');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', supabaseUserId);

      if (error) {
        logger.error('Error saving to Supabase:', error);
      } else {
        logger.log('✅ Settings synced to Supabase:', updates);
      }
    } catch (error) {
      logger.error('Error in saveToSupabase:', error);
    }
  };

  const handleToggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('notifications_enabled', String(newValue));
    }
    
    // Sync to Supabase
    await saveToSupabase({ notifications_enabled: newValue });
    
    logger.log(`✅ Notifications ${newValue ? 'enabled' : 'disabled'}`);
  };

  const handleChangeDefaultNetwork = async (network: string) => {
    setDefaultNetwork(network);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('default_network', network);
    }
    
    // Sync to Supabase
    await saveToSupabase({ default_network: network });
    
    logger.log(`✅ Default network changed to: ${network}`);
  };

  const handleToggleTestnets = async () => {
    const newValue = !enableTestnets;
    setEnableTestnets(newValue);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('enable_testnets', String(newValue));
    }
    
    // Sync to Supabase
    await saveToSupabase({ enable_testnets: newValue });
    
    logger.log(`✅ Testnets ${newValue ? 'enabled' : 'disabled'}`);
  };

  const handleChangeAutoLock = async (minutes: number) => {
    setAutoLockTimeout(minutes);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto_lock_timeout', String(minutes));
    }
    
    // Sync to Supabase
    await saveToSupabase({ auto_lock_timeout: minutes });
    
    logger.log(`✅ Auto-lock timeout changed to: ${minutes} minutes`);
  };

  // Check biometric status on mount - WALLET-SPECIFIC
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      // ✅ WALLET-SPECIFIC: Check biometric for THIS wallet only
      const checkBiometric = async () => {
        try {
          const { useWalletStore } = await import('@/lib/wallet-store');
          const { BiometricStore } = await import('@/lib/biometric-store');
          const { WebAuthnService } = await import('@/lib/webauthn-service');
          
          const webauthnService = WebAuthnService.getInstance();
          
          // ✅ CHECK: Only show biometric on production domain
          if (!webauthnService.isOnProductionDomain()) {
            logger.log('🚫 Biometric disabled: Not on production domain (my.blazewallet.io)');
            setBiometricEnabled(false);
            setIsMobile(false);
            return;
          }
          
          const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
          if (walletIdentifier) {
            const biometricStore = BiometricStore.getInstance();
            const enabled = biometricStore.hasStoredPassword(walletIdentifier);
            setBiometricEnabled(enabled);
            logger.log(`🔍 Biometric check for wallet ${walletIdentifier.substring(0, 8)}...: ${enabled}`);
          } else {
            setBiometricEnabled(false);
          }
        } catch (error) {
          logger.error('Error checking biometric status:', error);
          setBiometricEnabled(false);
        }
      };
      
      checkBiometric();
      
      const mobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    }
  }, [isOpen]);

  const copyMnemonic = () => {
    if (mnemonic) {
      navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnableBiometric = () => {
    setBiometricError('');
    setShowBiometricSetup(true);
  };
  
  const handleBiometricSetupSuccess = () => {
    setBiometricEnabled(true);
    setBiometricError('');
  };
  
  const handleDisableBiometric = async () => {
    if (!confirm('Are you sure you want to disable Face ID / Touch ID?')) {
      return;
    }
    
    try {
      // Import services
      const { WebAuthnService } = await import('@/lib/webauthn-service');
      const { BiometricStore } = await import('@/lib/biometric-store');
      const { useWalletStore } = await import('@/lib/wallet-store');
      
      const webauthnService = WebAuthnService.getInstance();
      const biometricStore = BiometricStore.getInstance();
      
      // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
      const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
      if (!walletIdentifier) {
        throw new Error('Cannot determine wallet identifier');
      }
      
      // ✅ WALLET-SPECIFIC: Remove credentials and password for THIS wallet only
      webauthnService.removeCredential(walletIdentifier);
      biometricStore.removePassword(walletIdentifier);
      
      setBiometricEnabled(false);
      logger.log(`✅ Biometric disabled for wallet: ${walletIdentifier.substring(0, 8)}...`);
      
    } catch (error: any) {
      setBiometricError(error.message || 'Failed to disable biometric authentication');
    }
  };

  const handleReset = () => {
    resetWallet();
    onClose();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-600">
                  Manage your wallet preferences
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            {/* Account Info */}
            <div className="glass-card p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                Account
              </h3>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-600 mb-2 font-medium">Wallet address</div>
                <div className="font-mono text-sm break-all text-gray-900">{displayAddress}</div>
              </div>
            </div>

            {/* Recovery Phrase */}
            <div className="glass-card p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-500" />
                Security
              </h3>
              
              <div className="space-y-4">
                {/* SECURITY WARNING when showing mnemonic */}
                {!showMnemonic && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                    <p className="text-red-900 text-sm font-semibold mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Security Warning
                    </p>
                    <p className="text-red-800 text-xs">
                      Your recovery phrase is EXTREMELY sensitive. Only reveal it in a secure, private location. 
                      Make sure no one can see your screen and no cameras/screenshots are active.
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold text-gray-900">Recovery phrase</div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowMnemonic(!showMnemonic)}
                    className="text-orange-600 hover:text-orange-700 text-sm flex items-center gap-1 font-semibold"
                  >
                    {showMnemonic ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Show (Be Careful!)
                      </>
                    )}
                  </motion.button>
                </div>

                {showMnemonic && mnemonic && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {/* CRITICAL WARNING while showing */}
                    <div className="bg-red-100 border-2 border-red-500 rounded-xl p-4 mb-4">
                      <div className="flex items-start gap-2">
                        <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-900 font-bold text-sm mb-1">SENSITIVE DATA VISIBLE!</p>
                          <ul className="text-red-800 text-xs space-y-0.5">
                            <li>• Make sure you are alone</li>
                            <li>• Check for cameras/screen recording</li>
                            <li>• Never share or screenshot this</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-5 rounded-xl mb-4 border border-gray-200">
                      <div className="grid grid-cols-3 gap-3 text-sm font-mono">
                        {mnemonic.split(' ').map((word, index) => (
                          <div key={index} className="bg-white p-3 rounded-lg text-center border border-gray-200">
                            <span className="text-gray-400 text-xs">{index + 1}.</span>
                            {' '}<span className="text-gray-900 font-semibold select-all">{word}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={copyMnemonic}
                      className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-900 flex items-center justify-center gap-2 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied! Clear clipboard after use
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy phrase (Use carefully)
                        </>
                      )}
                    </motion.button>

                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-yellow-800 text-sm font-medium">
                        ⚠️ Never share these words with anyone. They give full access to your wallet.
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* ✅ NEW: Biometric Authentication Section */}
                {isMobile && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-semibold text-gray-900">Face ID / Touch ID</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {biometricEnabled ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Enabled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                            <XCircle className="w-4 h-4" />
                            Disabled
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-3">
                      Use biometric authentication to unlock your wallet quickly and securely.
                    </p>
                    
                    {biometricError && (
                      <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                        {biometricError}
                      </div>
                    )}
                    
                    {biometricEnabled ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleEnableBiometric}
                          disabled={biometricLoading}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-900 py-3 rounded-xl font-semibold text-sm transition-colors disabled:cursor-not-allowed"
                        >
                          {biometricLoading ? 'Setting up...' : 'Re-setup'}
                        </button>
                        <button
                          onClick={handleDisableBiometric}
                          disabled={biometricLoading}
                          className="flex-1 bg-red-100 hover:bg-red-200 disabled:bg-red-50 text-red-700 py-3 rounded-xl font-semibold text-sm transition-colors disabled:cursor-not-allowed"
                        >
                          Disable
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleEnableBiometric}
                        disabled={biometricLoading}
                        className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Fingerprint className="w-4 h-4" />
                        {biometricLoading ? 'Setting up...' : 'Enable Face ID / Touch ID'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Preferences */}
            <div className="glass-card p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Preferences
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-orange-500" />
                    <div>
                      <div className="font-semibold text-sm text-gray-900">Notifications</div>
                      <div className="text-xs text-gray-600">Transaction updates</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={notificationsEnabled}
                      onChange={handleToggleNotifications}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {/* Auto-Lock Timeout */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">Auto-Lock Timeout</div>
                      <div className="text-xs text-gray-600">Lock wallet after inactivity</div>
                    </div>
                  </div>
                  <select
                    value={autoLockTimeout}
                    onChange={(e) => handleChangeAutoLock(parseInt(e.target.value))}
                    disabled={isLoadingSettings}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3cpath%20fill%3D%22%236B7280%22%20d%3D%22M10.293%203.293L6%207.586%201.707%203.293A1%201%200%2000.293%204.707l5%205a1%201%200%20001.414%200l5-5a1%201%200%2010-1.414-1.414z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[center_right_1rem] bg-no-repeat pr-10"
                  >
                    <option value={0}>Never</option>
                    <option value={1}>1 minute</option>
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>

                {/* Default Network */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Globe className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">Default Network</div>
                      <div className="text-xs text-gray-600">Chain shown when opening wallet</div>
                    </div>
                  </div>
                  <select
                    value={defaultNetwork}
                    onChange={(e) => handleChangeDefaultNetwork(e.target.value)}
                    disabled={isLoadingSettings}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3cpath%20fill%3D%22%236B7280%22%20d%3D%22M10.293%203.293L6%207.586%201.707%203.293A1%201%200%2000.293%204.707l5%205a1%201%200%20001.414%200l5-5a1%201%200%2010-1.414-1.414z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[center_right_1rem] bg-no-repeat pr-10"
                  >
                    {Object.entries(CHAINS)
                      .filter(([key]) => {
                        const chain = CHAINS[key as keyof typeof CHAINS];
                        // Show testnets only if enabled
                        if (chain.isTestnet) return enableTestnets;
                        return true;
                      })
                      .map(([key, chain]) => (
                        <option key={key} value={key}>
                          {chain.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Enable Testnets */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <TestTube2 className="w-5 h-5 text-purple-500" />
                    <div>
                      <div className="font-semibold text-sm text-gray-900">Enable Testnets</div>
                      <div className="text-xs text-gray-600">Show testnet chains in network list</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={enableTestnets}
                      onChange={handleToggleTestnets}
                      disabled={isLoadingSettings}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                  </label>
                </div>

                {/* Dark Mode REMOVED - wallet only has light mode */}
              </div>
            </div>

            {/* Developer Tools - Mobile Only */}
            <div className="glass-card p-6 lg:hidden">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Bug className="w-5 h-5 text-orange-500" />
                Developer tools
              </h3>
              
              <button
                onClick={() => {
                  if (onOpenDebug) {
                    onOpenDebug();
                  }
                }}
                className="w-full bg-gradient-to-r from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 border border-orange-200 text-gray-900 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Bug className="w-5 h-5 text-orange-500" />
                Open debug panel
              </button>
              
              <p className="text-xs text-gray-500 mt-3">
                View wallet info, check balances, and debug blockchain connections.
              </p>
            </div>

            {/* Danger Zone */}
            <div className="glass-card p-6 border border-red-200 bg-gradient-to-r from-red-50 to-rose-50">
              <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Danger zone
              </h3>
              
              {!showResetConfirm ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 py-3 rounded-xl font-semibold transition-colors"
                >
                  Reset wallet
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white p-5 rounded-xl border border-red-300"
                >
                  <p className="text-red-700 text-sm mb-4 font-medium leading-relaxed">
                    Are you sure? This action cannot be undone.
                    Make sure you have your recovery phrase!
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-semibold text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
                    >
                      Yes, reset
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* App Info */}
            <div className="text-center py-8">
              <div className="mb-3">
                <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  Blaze v2.0
                </span>
              </div>
              <div className="text-sm text-gray-600">Lightning fast crypto</div>
            </div>
          </div>
        </div>
        
        {/* Biometric Setup Modal */}
        <BiometricSetupModal
          isOpen={showBiometricSetup}
          onClose={() => setShowBiometricSetup(false)}
          onSuccess={handleBiometricSetupSuccess}
        />
      </motion.div>
    </AnimatePresence>
  );
}
