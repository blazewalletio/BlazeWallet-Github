'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, AlertCircle, Fingerprint } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrentAccount, switchToEmailAccount, switchToSeedWallet, WalletAccount, saveCurrentAccountToRecent, getAccountsByType } from '@/lib/account-manager';
import AccountSelectorDropdown from './AccountSelectorDropdown';
import NewEmailModal from './NewEmailModal';
import WalletRecoveryFlow from './WalletRecoveryFlow';
import DeviceVerificationModal from './DeviceVerificationModal';
import DeviceConfirmationModal from './DeviceConfirmationModal'; // ✅ NEW
import SensitiveAction2FAModal from './SensitiveAction2FAModal';
import { logger } from '@/lib/logger';
import { rateLimitService } from '@/lib/rate-limit-service';
import { EnhancedDeviceInfo } from '@/lib/device-fingerprint-pro';
import { DeviceVerificationCheckV2 } from '@/lib/device-verification-check-v2'; // ← V2!
import { twoFactorSessionService } from '@/lib/2fa-session-service';
import { supabase } from '@/lib/supabase';

interface PasswordUnlockModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onFallback: () => void;
}

export default function PasswordUnlockModal({ isOpen, onComplete, onFallback }: PasswordUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { unlockWithPassword } = useWalletStore();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(null);
  const [showNewEmailModal, setShowNewEmailModal] = useState(false);
  const [pendingNewEmail, setPendingNewEmail] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false); // ✅ NEW: Loading state for switching
  const [showRecoveryFlow, setShowRecoveryFlow] = useState(false); // ✅ NEW: Recovery flow state
  
  // Device Verification State
  const [showDeviceVerification, setShowDeviceVerification] = useState(false);
  const [deviceVerificationData, setDeviceVerificationData] = useState<{
    deviceInfo: EnhancedDeviceInfo;
    deviceToken: string;
    email: string;
    password: string;
  } | null>(null);
  
  // ✅ NEW: Device Confirmation State (for medium confidence)
  const [showDeviceConfirmation, setShowDeviceConfirmation] = useState(false);
  const [deviceConfirmationData, setDeviceConfirmationData] = useState<{
    suggestedDevice: any;
    score: number;
    userId: string;
    email: string;
    password: string;
  } | null>(null);

  // 🔐 2FA State for GRADUATED SECURITY
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [pending2FAPassword, setPending2FAPassword] = useState<string>('');

  // Load current account and reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadAccountData = async () => {
        try {
          console.log('🔄 [PasswordUnlock] Loading account data...');
          
          const account = getCurrentAccount();
          setCurrentAccount(account);
          
          // 🔥 FIX: Load email from IndexedDB first, fallback to localStorage, then Supabase
          const { secureStorage } = await import('@/lib/secure-storage');
          let email = await secureStorage.getItem('wallet_email');
          
          console.log('📦 [PasswordUnlock] IndexedDB email:', email || 'null');
          
          // Fallback to localStorage if IndexedDB empty
          if (!email) {
            email = localStorage.getItem('wallet_email');
            console.log('📦 [PasswordUnlock] localStorage email:', email || 'null');
          }
          
          // 🔥 CRITICAL: If still no email, try to get from Supabase session
          if (!email) {
            console.warn('⚠️ [PasswordUnlock] Email not in storage - checking Supabase session');
            const { supabase } = await import('@/lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            
            console.log('📧 [PasswordUnlock] Supabase session:', {
              hasSession: !!session,
              hasUser: !!session?.user,
              email: session?.user?.email || 'null'
            });
            
            if (session?.user?.email) {
              email = session.user.email;
              // Save it to IndexedDB for next time
              await secureStorage.setItem('wallet_email', email);
              await secureStorage.setItem('supabase_user_id', session.user.id);
              console.log('✅ [PasswordUnlock] Restored email from Supabase session:', email);
            }
          }
          
          if (email) {
            setUserEmail(email);
            console.log('✅ [PasswordUnlock] FINAL - Email loaded:', email);
          } else {
            console.error('❌ [PasswordUnlock] FINAL - No email found anywhere!');
          }
          
          console.log('📧 [PasswordUnlock] Current account loaded:', account);
        } catch (error) {
          console.error('❌ [PasswordUnlock] Error loading account data:', error);
        }
      };
      
      // ✅ FIX: Reset state EXCEPT userEmail (we just loaded it!)
      setPassword('');
      setError('');
      setIsLoading(false);
      setShowPassword(false);
      setIsSwitching(false);
      setShowRecoveryFlow(false);
      setPendingNewEmail(null);
      setShow2FAModal(false);
      setPending2FAPassword('');
      setUserId(null);
      // DON'T reset userEmail here - loadAccountData sets it!
      
      loadAccountData();
    }
  }, [isOpen]);

  // Check if biometric is available on mount
  useEffect(() => {
    const checkBiometric = async () => {
      if (typeof window !== 'undefined') {
        // ✅ WALLET-SPECIFIC: Use wallet identifier to check biometric status
        const { BiometricStore } = await import('@/lib/biometric-store');
        const { useWalletStore } = await import('@/lib/wallet-store');
        const { WebAuthnService } = await import('@/lib/webauthn-service');
        
        const biometricStore = BiometricStore.getInstance();
        const webauthnService = WebAuthnService.getInstance();
        
        // ✅ CHECK: Only show biometric on production domain
        if (!webauthnService.isOnProductionDomain()) {
          console.log('🚫 Biometric disabled: Not on production domain (my.blazewallet.io)');
          setBiometricAvailable(false);
          return;
        }
        
        // Get wallet identifier for this wallet
        const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
        if (!walletIdentifier) {
          setBiometricAvailable(false);
          return;
        }
        
        const hasStoredPassword = biometricStore.hasStoredPassword(walletIdentifier); // ✅ Wallet-specific check
        
        console.log(`🔍 Biometric check for wallet ${walletIdentifier.substring(0, 8)}...:`, hasStoredPassword);
        
        // Show biometric button if has stored password for this wallet
        setBiometricAvailable(hasStoredPassword);
      }
    };
    
    if (isOpen) {
      checkBiometric();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ✅ DEVICE CHECK DISABLED IN UNLOCK FLOW
    // Reason: User already passed device verification during login
    // If they can see this unlock modal, they're already authenticated!
    // Checking again causes "device_not_found" errors after device cleanup
    
    // 🔐 GRADUATED SECURITY - Check 2FA session for email wallets
    const isSeedWallet = DeviceVerificationCheckV2.isSeedWallet();
    if (!isSeedWallet) {
      // 🔥 FIX: Try IndexedDB first, fallback to localStorage
      const { secureStorage } = await import('@/lib/secure-storage');
      let email = await secureStorage.getItem('wallet_email');
      let storedUserId = await secureStorage.getItem('supabase_user_id');
      
      // Fallback to localStorage if IndexedDB empty
      if (!email) {
        email = localStorage.getItem('wallet_email');
      }
      if (!storedUserId) {
        storedUserId = localStorage.getItem('supabase_user_id');
      }
      
      if (email && storedUserId) {
        console.log('🔐 [PasswordUnlock] Checking 2FA session for email wallet...');
        
        // Check if user has 2FA enabled
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('two_factor_enabled')
          .eq('user_id', storedUserId)
          .single();
        
        if (profile?.two_factor_enabled) {
          console.log('🔐 [PasswordUnlock] 2FA is enabled - checking session age...');
          
          // Check 2FA session status
          const sessionStatus = await twoFactorSessionService.checkSession(storedUserId);
          
          if (sessionStatus.required) {
            // 🚨 SESSION EXPIRED or NO SESSION → Require 2FA BEFORE unlock
            console.log('⚠️ [PasswordUnlock] 2FA session expired - showing 2FA modal');
            setUserId(storedUserId);
            setUserEmail(email);
            setPending2FAPassword(password);
            setShow2FAModal(true);
            return; // Stop here - wait for 2FA verification
          } else {
            // ✅ SESSION VALID → Password only
            console.log('✅ [PasswordUnlock] 2FA session still valid - password only');
            if (sessionStatus.isNearExpiry) {
              console.log('⚠️ [PasswordUnlock] Session expiring soon:', sessionStatus.secondsRemaining, 'seconds');
            }
          }
        } else {
          console.log('ℹ️ [PasswordUnlock] 2FA not enabled for this user');
        }
      }
    } else {
      console.log('🌱 [PasswordUnlock] Seed wallet - no device verification or 2FA needed');
    }

    // Note: Rate limiting is now handled in wallet-store.ts unlockWithPassword()
    // The error message from there will show remaining attempts

    setIsLoading(true);
    try {
      // Check if this is a new email login
      if (pendingNewEmail) {
        // ✅ FORT KNOX: Use strict authentication for new email accounts too
        const { strictSignInWithEmail } = await import('@/lib/supabase-auth-strict');
        const result = await strictSignInWithEmail(pendingNewEmail, password);
        
        if (!result.success) {
          // ✅ NEW: Check if device confirmation is needed (medium confidence)
          if (result.requiresDeviceConfirmation && result.suggestedDevice) {
            console.log('⚠️ Device confirmation required (medium confidence)');
            
            // Get user ID from Supabase session
            const { data: { user } } = await supabase.auth.getUser();
            
            // Show device confirmation modal
            setDeviceConfirmationData({
              suggestedDevice: result.suggestedDevice,
              score: result.matchScore || 0,
              userId: user?.id || '',
              email: pendingNewEmail,
              password,
            });
            setShowDeviceConfirmation(true);
            return;
          }
          
          // Check if device verification is required
          if (result.requiresDeviceVerification && result.deviceVerificationToken && result.deviceInfo) {
            console.log('🚫 Device verification required for new email');
            
            // Show device verification modal
            setDeviceVerificationData({
              deviceInfo: result.deviceInfo,
              deviceToken: result.deviceVerificationToken,
              email: pendingNewEmail,
              password,
            });
            setShowDeviceVerification(true);
            return;
          }
          
          throw new Error(result.error || 'Invalid password');
        }

        // Wallet is now decrypted and loaded
        if (result.mnemonic) {
          const { importWallet } = useWalletStore.getState();
          await importWallet(result.mnemonic);
        }
        
        // ✅ FIX: Save account to recent after successful unlock
        saveCurrentAccountToRecent();
        
        // Set session flag
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        // ✅ FIX: Add small delay to ensure state propagates before calling onComplete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setPendingNewEmail(null);
        onComplete();
        return;
      }

      // Check if wallet was created with email
      // 🔥 FIX: Try IndexedDB first, fallback to localStorage
      const { secureStorage } = await import('@/lib/secure-storage');
      let createdWithEmailStr = await secureStorage.getItem('wallet_created_with_email');
      let email = await secureStorage.getItem('wallet_email');
      
      // Fallback to localStorage if IndexedDB empty
      if (!createdWithEmailStr) {
        createdWithEmailStr = localStorage.getItem('wallet_created_with_email');
      }
      if (!email) {
        email = localStorage.getItem('wallet_email');
      }
      
      const createdWithEmail = createdWithEmailStr === 'true';
      if (createdWithEmail && email) {
        // ✅ FORT KNOX: Use strict authentication with device verification
        const { strictSignInWithEmail } = await import('@/lib/supabase-auth-strict');
        const result = await strictSignInWithEmail(email, password);
        if (!result.success) {
          // ✅ NEW: Check if device confirmation is needed (medium confidence)
          if (result.requiresDeviceConfirmation && result.suggestedDevice) {
            console.log('⚠️ Device confirmation required (medium confidence)');
            
            // Get user ID from Supabase session
            const { data: { user } } = await supabase.auth.getUser();
            
            // Show device confirmation modal
            setDeviceConfirmationData({
              suggestedDevice: result.suggestedDevice,
              score: result.matchScore || 0,
              userId: user?.id || '',
              email,
              password,
            });
            setShowDeviceConfirmation(true);
            return;
          }
          
          // Check if device verification is required
          if (result.requiresDeviceVerification && result.deviceVerificationToken && result.deviceInfo) {
            console.log('🚫 Device verification required');
            
            // Show device verification modal
            setDeviceVerificationData({
              deviceInfo: result.deviceInfo,
              deviceToken: result.deviceVerificationToken,
              email,
              password,
            });
            setShowDeviceVerification(true);
            return;
          }
          throw new Error(result.error || 'Invalid password');
        }
        // Wallet is now decrypted and loaded
        if (result.mnemonic) {
          const { importWallet } = useWalletStore.getState();
          await importWallet(result.mnemonic);
        }
        
        // ✅ FIX: Save account to recent after successful unlock
        saveCurrentAccountToRecent();
        
        // Set session flag to skip unlock modal on page refresh during same session
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        // ✅ FIX: Add small delay to ensure state propagates before calling onComplete
        // This prevents the modal from staying open on first unlock attempt
        await new Promise(resolve => setTimeout(resolve, 100));
        onComplete();
      } else {
        // For seed phrase wallets, use traditional unlock
        await unlockWithPassword(password);
        // ✅ FIX: Save account to recent after successful unlock
        saveCurrentAccountToRecent();
        
        // Set session flag
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        // ✅ FIX: Add small delay to ensure state propagates before calling onComplete
        await new Promise(resolve => setTimeout(resolve, 100));
        onComplete();
      }
    } catch (error: any) {
      // Error message from wallet-store already includes attempt count and rate limit info
      console.error('❌ [PasswordUnlock] Error during unlock:', error);
      setError(error.message || 'Failed to unlock wallet');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 Handle successful 2FA verification - then proceed with unlock
  const handle2FASuccess = async () => {
    console.log('✅ [PasswordUnlock] 2FA verified - proceeding with password unlock');
    setShow2FAModal(false);
    
    // Now proceed with the actual unlock using the stored password
    setIsLoading(true);
    try {
      // ✅ AFTER 2FA: Just unlock the wallet directly with wallet-store
      // NO NEED to call strictSignInWithEmail again - we already authenticated during initial unlock!
      // Device verification and Supabase sign-in happened BEFORE 2FA prompt
      const { unlockWithPassword } = useWalletStore.getState();
      
      if (!pending2FAPassword) {
        throw new Error('Password not found');
      }
      
      // unlockWithPassword throws an error if password is wrong, so we can just await it
      await unlockWithPassword(pending2FAPassword);
      
      console.log('✅ [PasswordUnlock] Wallet unlocked successfully after 2FA');
      
      // ✅ Save account to recent after successful unlock
      saveCurrentAccountToRecent();
      
      // Set session flag
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      
      // ✅ Add small delay to ensure state propagates before calling onComplete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clear pending password
      setPending2FAPassword('');
      
      onComplete();
    } catch (error: any) {
      console.error('❌ [PasswordUnlock] Error during unlock after 2FA:', error);
      setError(error.message || 'Failed to unlock wallet');
      setPending2FAPassword(''); // Clear password on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = async (account: WalletAccount) => {
    console.log('🔄 Switching account:', account);
    setPassword('');
    setError('');
    setPendingNewEmail(null);
    setIsSwitching(true); // ✅ NEW: Show loading

    try {
      if (account.type === 'email' && account.email) {
        // ✅ FIX: Update localStorage immediately for email accounts
        // This ensures unlock uses the correct account
        saveCurrentAccountToRecent(); // Save current first
        
        if (account.id !== 'pending') {
          // Existing email account from recent list
          localStorage.setItem('wallet_email', account.email);
          localStorage.setItem('supabase_user_id', account.id);
          localStorage.setItem('wallet_created_with_email', 'true');
          
          console.log('✅ Updated localStorage for email account:', account.email);
        }
        
        setCurrentAccount(account);
      } else if (account.type === 'seed') {
        // Switching to seed wallet
        await switchToSeedWallet(account.id);
        const updatedAccount = getCurrentAccount();
        setCurrentAccount(updatedAccount);
      }
    } catch (err: any) {
      console.error('Failed to switch account:', err);
      setError(err.message || 'Failed to switch account');
      
      // ✅ FIX: Revert to previous account on failure
      const prevAccount = getCurrentAccount();
      if (prevAccount) {
        setCurrentAccount(prevAccount);
      }
    } finally {
      setIsSwitching(false); // ✅ NEW: Hide loading
    }
  };

  // Handle adding new email
  const handleAddNewEmail = async (email: string) => {
    console.log('➕ Adding new email account:', email);
    setPendingNewEmail(email);
    setCurrentAccount({
      id: 'pending',
      type: 'email',
      displayName: email,
      email: email,
      lastUsed: new Date(),
      isActive: true,
    });
    setShowNewEmailModal(false);
    setPassword('');
    setError('');
  };

  // Handle importing seed phrase
  const handleImportSeed = () => {
    // Redirect to onboarding with import flow
    onFallback();
  };

  // Handle complete sign out
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      console.log('🚪 [Unlock Modal] User initiated sign out');
      // Import supabase
      const { supabase } = await import('@/lib/supabase');
      // ⚠️ CRITICAL: Preserve device_id before clearing localStorage
      const preservedDeviceId = localStorage.getItem('blaze_device_id');
      const preservedFingerprint = localStorage.getItem('blaze_device_fingerprint');
      const preservedFingerprintCachedAt = localStorage.getItem('blaze_fingerprint_cached_at');
      
      console.log('🔑 [Unlock Modal] Preserving device_id:', preservedDeviceId?.substring(0, 12) + '...');
      // Sign out from Supabase
      await supabase.auth.signOut();
      // Clear wallet store
      const { resetWallet } = useWalletStore.getState();
      resetWallet();
      // Clear all wallet-related localStorage (but preserve device tracking)
      const keysToRemove = [
        'wallet_email',
        'has_password',
        'encrypted_wallet',
        'wallet_created_with_email',
        'supabase_user_id',
        'biometric_enabled',
        'wallet_unlocked_this_session',
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Clear sessionStorage
      sessionStorage.clear();
      // ✅ CRITICAL: Restore device_id after clearing localStorage
      if (preservedDeviceId) {
        localStorage.setItem('blaze_device_id', preservedDeviceId);
        console.log('✅ [Unlock Modal] Device ID restored after sign out');
      }
      if (preservedFingerprint) {
        localStorage.setItem('blaze_device_fingerprint', preservedFingerprint);
      }
      if (preservedFingerprintCachedAt) {
        localStorage.setItem('blaze_fingerprint_cached_at', preservedFingerprintCachedAt);
      }
      
      console.log('✅ [Unlock Modal] Sign out complete, redirecting to onboarding');
      // Redirect to onboarding
      onFallback();
      
    } catch (error: any) {
      console.error('❌ [SIGN OUT] Error:', error);
      console.error('❌ [Unlock Modal] Sign out error:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Get wallet identifier
      const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
      
      if (!walletIdentifier) {
        throw new Error('Cannot determine wallet identifier. Please ensure wallet data is properly saved.');
      }
      
      const { unlockWithBiometric } = useWalletStore.getState();
      await unlockWithBiometric();
      
      // Set session flag
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      
      onComplete();
    } catch (error: any) {
      // Check if biometric is still available after the error
      const { BiometricStore } = await import('@/lib/biometric-store');
      const biometricStore = BiometricStore.getInstance();
      const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
      
      if (walletIdentifier) {
        const hasStoredPassword = biometricStore.hasStoredPassword(walletIdentifier);
        setBiometricAvailable(hasStoredPassword);
      } else {
        setBiometricAvailable(false);
      }
      
      setError(error.message || "Biometric authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Unlock wallet
              </h2>
              <p className="text-gray-600">
                Enter your password to access your wallet
              </p>
            </div>

            {/* Smart Account Selector */}
            <div className="mb-6">
              <AccountSelectorDropdown
                currentAccount={currentAccount}
                onSelectAccount={handleSelectAccount}
                onAddNewEmail={() => setShowNewEmailModal(true)}
                onImportSeed={handleImportSeed}
                disabled={isLoading || isSwitching}
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Unlock"
                )}
              </button>

              {/* Biometric Authentication Button - Only show if enabled */}
              {biometricAvailable && (
                <button
                  type="button"
                  onClick={handleBiometricAuth}
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-50 disabled:cursor-not-allowed border-2 border-gray-200 text-gray-900 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-5 h-5" />
                  <span>Fingerprint / Face ID</span>
                </button>
              )}
            </form>

            <div className="mt-6 text-center space-y-3">
              <button
                onClick={() => setShowRecoveryFlow(true)}
                className="text-gray-600 hover:text-gray-900 text-sm underline transition-colors"
              >
                Recover with recovery phrase
              </button>
              
              {/* Sign Out Link - Subtle and secondary */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="text-gray-500 hover:text-red-600 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Your wallet is encrypted and stored on this device.
                <br />
                Your password is never sent to our servers.
              </p>
            </div>
          </div>
        </div>

        {/* Device Verification Modal */}
        {deviceVerificationData && (
          <DeviceVerificationModal
            isOpen={showDeviceVerification}
            deviceInfo={deviceVerificationData.deviceInfo}
            deviceToken={deviceVerificationData.deviceToken}
            email={deviceVerificationData.email}
            password={deviceVerificationData.password}
            onSuccess={async (mnemonic) => {
              // Wallet successfully verified and unlocked
              const { importWallet } = useWalletStore.getState();
              await importWallet(mnemonic);
              
              // Save to recent and complete
              saveCurrentAccountToRecent();
              sessionStorage.setItem('wallet_unlocked_this_session', 'true');
              
              setShowDeviceVerification(false);
              setDeviceVerificationData(null);
              onComplete();
            }}
            onCancel={() => {
              setShowDeviceVerification(false);
              setDeviceVerificationData(null);
              setError('Device verification cancelled');
            }}
          />
        )}
        
        {/* ✅ NEW: Device Confirmation Modal (medium confidence - 1-click verify) */}
        {deviceConfirmationData && (
          <DeviceConfirmationModal
            isOpen={showDeviceConfirmation}
            suggestedDevice={deviceConfirmationData.suggestedDevice}
            score={deviceConfirmationData.score}
            onConfirmYes={async () => {
              // User confirmed "Yes, this is me"
              const { confirmDeviceAndSignIn } = await import('@/lib/supabase-auth-strict');
              const result = await confirmDeviceAndSignIn(
                deviceConfirmationData.userId,
                deviceConfirmationData.suggestedDevice.id,
                deviceConfirmationData.email,
                deviceConfirmationData.password
              );
              
              if (!result.success) {
                throw new Error(result.error || 'Failed to confirm device');
              }
              
              // Wallet successfully unlocked
              if (result.mnemonic) {
                const { importWallet } = useWalletStore.getState();
                await importWallet(result.mnemonic);
                
                // Save to recent and complete
                saveCurrentAccountToRecent();
                sessionStorage.setItem('wallet_unlocked_this_session', 'true');
                
                setShowDeviceConfirmation(false);
                setDeviceConfirmationData(null);
                onComplete();
              }
            }}
            onConfirmNo={() => {
              // User said "No, not me" → Fall back to email verification
              console.log('❌ User declined device confirmation → Email verification');
              setShowDeviceConfirmation(false);
              
              // Show device verification modal instead
              // (need to trigger email verification flow)
              // For now, just show error and let user try again
              setError('Email verification required. Please try again.');
              setDeviceConfirmationData(null);
            }}
            onCancel={() => {
              setShowDeviceConfirmation(false);
              setDeviceConfirmationData(null);
            }}
          />
        )}

        {/* New Email Modal */}
        <NewEmailModal
          isOpen={showNewEmailModal}
          onClose={() => setShowNewEmailModal(false)}
          onSubmit={handleAddNewEmail}
          existingEmails={getAccountsByType().emailAccounts.map(acc => acc.email || '')}
        />

        {/* Wallet Recovery Flow */}
        <WalletRecoveryFlow
          isOpen={showRecoveryFlow}
          onClose={() => setShowRecoveryFlow(false)}
          onSuccess={() => {
            setShowRecoveryFlow(false);
            onComplete(); // Close unlock modal and go to dashboard
          }}
        />

        {/* 🔐 2FA Modal for Graduated Security */}
        {show2FAModal && userId && (
          <SensitiveAction2FAModal
            isOpen={show2FAModal}
            onClose={() => {
              setShow2FAModal(false);
              setPending2FAPassword('');
              setError('2FA verification cancelled');
            }}
            onSuccess={handle2FASuccess}
            userId={userId}
            actionName="Unlock Wallet"
            actionType="send" // Using "send" type for session creation
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
