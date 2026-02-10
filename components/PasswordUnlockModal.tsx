'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, AlertCircle, Fingerprint } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrentAccount, switchToEmailAccount, switchToSeedWallet, WalletAccount, saveCurrentAccountToRecent, getAccountsByType } from '@/lib/account-manager';
import EmailAccountSelector from './EmailAccountSelector'; // ✅ NEW: IndexedDB-first selector
import NewEmailModal from './NewEmailModal';
import WalletRecoveryFlow from './WalletRecoveryFlow';
import DeviceVerificationCodeModal from './DeviceVerificationCodeModal';
import SensitiveAction2FAModal from './SensitiveAction2FAModal';
import { logger } from '@/lib/logger';
import { rateLimitService } from '@/lib/rate-limit-service';
import { EnhancedDeviceInfo } from '@/lib/device-fingerprint-pro';
import { DeviceVerificationCheckV2 } from '@/lib/device-verification-check-v2';
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
  
  
  
  // ✅ NEW: Email Verification Code State
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [verificationCodeData, setVerificationCodeData] = useState<{
    email: string;
    userId: string;
    deviceInfo: any;
    password: string;
  } | null>(null);

  // 🔐 2FA State for GRADUATED SECURITY
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [pending2FAPassword, setPending2FAPassword] = useState<string>('');

  // ✅ Mobile keyboard scroll fix: Ref for password input
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Load current account and reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadAccountData = async () => {
        try {
          const account = getCurrentAccount();
          setCurrentAccount(account);
          
          // 🔥 FIX: Load email from IndexedDB first, fallback to localStorage, then Supabase
          const { secureStorage } = await import('@/lib/secure-storage');
          let email = await secureStorage.getItem('wallet_email');
          
          // Fallback to localStorage if IndexedDB empty
          if (!email) {
            email = localStorage.getItem('wallet_email');
          }
          
          // 🔥 CRITICAL: If still no email, try to get from Supabase session
          if (!email) {
            const { supabase } = await import('@/lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user?.email) {
              email = session.user.email;
              // Save it to IndexedDB for next time
              await secureStorage.setItem('wallet_email', email);
              await secureStorage.setItem('supabase_user_id', session.user.id);
            }
          }
          
          if (email) {
            setUserEmail(email);
          } else {
            console.error('❌ [PasswordUnlock] FINAL - No email found anywhere!');
          }
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
        // Check if user has 2FA enabled
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('two_factor_enabled')
          .eq('user_id', storedUserId)
          .single();
        
        if (profile?.two_factor_enabled) {
          // Check 2FA session status
          const sessionStatus = await twoFactorSessionService.checkSession(storedUserId);
          
          if (sessionStatus.required) {
            // 🚨 SESSION EXPIRED or NO SESSION → Require 2FA BEFORE unlock
            setUserId(storedUserId);
            setUserEmail(email);
            setPending2FAPassword(password);
            setShow2FAModal(true);
            return; // Stop here - wait for 2FA verification
          }
        }
      }
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
          // Check if device verification is required
          if (result.requiresDeviceVerification && result.deviceInfo) {
            // Generate device info if not complete
            let deviceInfo = result.deviceInfo;
            if (!deviceInfo.fingerprint) {
              const { generateEnhancedFingerprint } = await import('@/lib/device-fingerprint-pro');
              deviceInfo = await generateEnhancedFingerprint();
            }
            
            // Use userId from result (saved before sign out) or try to get from session
            let userIdToUse = result.userId;
            if (!userIdToUse) {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                userIdToUse = user?.id;
              } catch (userError) {
                logger.warn('Could not get userId from session:', userError);
              }
            }
            
            if (!userIdToUse) {
              logger.error('❌ [PasswordUnlock] No userId available for device verification');
              throw new Error('Unable to verify device: user ID not available. Please try again.');
            }
            
            // Show device verification code modal
            setVerificationCodeData({
              email: pendingNewEmail,
              userId: userIdToUse,
              deviceInfo,
              password,
            });
            setShowVerificationCode(true);
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
          // Check if device verification is required
          if (result.requiresDeviceVerification && result.deviceInfo) {
            // Generate device info if not complete
            let deviceInfo = result.deviceInfo;
            if (!deviceInfo.fingerprint) {
              const { generateEnhancedFingerprint } = await import('@/lib/device-fingerprint-pro');
              deviceInfo = await generateEnhancedFingerprint();
            }
            
            // Use userId from result (saved before sign out) or try to get from session
            let userIdToUse = result.userId;
            if (!userIdToUse) {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                userIdToUse = user?.id;
              } catch (userError) {
                logger.warn('Could not get userId from session:', userError);
              }
            }
            
            if (!userIdToUse) {
              logger.error('❌ [PasswordUnlock] No userId available for device verification');
              throw new Error('Unable to verify device: user ID not available. Please try again.');
            }
            
            // Show device verification code modal
            setVerificationCodeData({
              email,
              userId: userIdToUse,
              deviceInfo,
              password,
            });
            setShowVerificationCode(true);
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
    // Close modal first to prevent onClose from setting error
    setShow2FAModal(false);
    setError(''); // Clear any previous errors
    
    // Now proceed with the actual unlock using the stored password
    setIsLoading(true);
    try {
      if (!pending2FAPassword) {
        throw new Error('Password not found');
      }

      // ✅ FIX: Check if this is an email wallet or seed phrase wallet
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
        // ✅ EMAIL WALLET: Use strictSignInWithEmail (2FA was already verified)
        const { strictSignInWithEmail } = await import('@/lib/supabase-auth-strict');
        const result = await strictSignInWithEmail(email, pending2FAPassword);
        
        if (!result.success) {
          throw new Error(result.error || 'Invalid password');
        }
        
        // Wallet is now decrypted and loaded
        if (result.mnemonic) {
          const { importWallet } = useWalletStore.getState();
          await importWallet(result.mnemonic);
        }
      } else {
        // ✅ SEED PHRASE WALLET: Use unlockWithPassword
        const { unlockWithPassword } = useWalletStore.getState();
        await unlockWithPassword(pending2FAPassword);
      }
      
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
      
      // Check if error is about device verification
      if (error.message && (error.message.includes('Device verification') || error.message.includes('Failed to update device'))) {
        // Try to show device verification modal
        try {
          // Get email again (might not be in scope)
          const { secureStorage } = await import('@/lib/secure-storage');
          let emailForVerification = await secureStorage.getItem('wallet_email');
          if (!emailForVerification) {
            emailForVerification = localStorage.getItem('wallet_email') || '';
          }
          
          const { generateEnhancedFingerprint } = await import('@/lib/device-fingerprint-pro');
          const deviceInfo = await generateEnhancedFingerprint();
          
          // Try to get userId from multiple sources
          let userIdToUse: string | undefined;
          
          // First try from Supabase session
          try {
            const { data: { user } } = await supabase.auth.getUser();
            userIdToUse = user?.id;
          } catch (userError) {
            logger.warn('Could not get userId from session:', userError);
          }
          
          // Fallback to state or secureStorage
          if (!userIdToUse) {
            userIdToUse = userId || undefined;
            if (!userIdToUse) {
              const { secureStorage } = await import('@/lib/secure-storage');
              userIdToUse = await secureStorage.getItem('supabase_user_id') || undefined;
            }
          }
          
          if (!userIdToUse) {
            logger.error('❌ [PasswordUnlock] No userId available for device verification in catch block');
            throw new Error('Unable to verify device: user ID not available. Please try logging in again.');
          }
          
          const emailToUse = pendingNewEmail || emailForVerification || '';
          setVerificationCodeData({
            email: emailToUse,
            userId: userIdToUse,
            deviceInfo,
            password: pending2FAPassword,
          });
          setShowVerificationCode(true);
          setError(''); // Clear error since we're showing verification modal
          return;
        } catch (fingerprintError) {
          logger.error('Failed to generate fingerprint for verification:', fingerprintError);
        }
      }
      
      setError(error.message || 'Failed to unlock wallet');
      setPending2FAPassword(''); // Clear password on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = async (account: WalletAccount) => {
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
      setError(''); // Clear any previous errors
      
      logger.log('🚪 [Sign Out] Starting sign out process...');
      
      // Import supabase
      const { supabase } = await import('@/lib/supabase');
      
      // ⚠️ CRITICAL: Preserve device_id before clearing storage
      const preservedDeviceId = localStorage.getItem('blaze_device_id');
      const preservedFingerprint = localStorage.getItem('blaze_device_fingerprint');
      const preservedFingerprintCachedAt = localStorage.getItem('blaze_fingerprint_cached_at');
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      logger.log('✅ [Sign Out] Signed out from Supabase');
      
      // Clear wallet store
      const { resetWallet } = useWalletStore.getState();
      resetWallet();
      logger.log('✅ [Sign Out] Wallet store reset');
      
      // ✅ CRITICAL: Clear IndexedDB (secure storage) - this is where encrypted_wallet is stored!
      const { secureStorage } = await import('@/lib/secure-storage');
      await secureStorage.clear();
      logger.log('✅ [Sign Out] IndexedDB cleared');
      
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
      logger.log('✅ [Sign Out] localStorage and sessionStorage cleared');
      
      // ✅ CRITICAL: Restore device_id after clearing localStorage
      if (preservedDeviceId) {
        localStorage.setItem('blaze_device_id', preservedDeviceId);
      }
      if (preservedFingerprint) {
        localStorage.setItem('blaze_device_fingerprint', preservedFingerprint);
      }
      if (preservedFingerprintCachedAt) {
        localStorage.setItem('blaze_fingerprint_cached_at', preservedFingerprintCachedAt);
      }
      
      logger.log('✅ [Sign Out] Sign out complete, calling onFallback...');
      
      // Call onFallback to handle redirect/reload
      onFallback();
      
    } catch (error: any) {
      logger.error('❌ [SIGN OUT] Error:', error);
      setError('Failed to sign out. Please try again.');
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
        className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto flex items-start justify-center p-4 pt-safe"
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

            {/* ✅ NEW: IndexedDB-first Email Account Selector */}
            <div className="mb-6">
              <EmailAccountSelector
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
                    ref={passwordInputRef}
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

        {/* Email Verification Code Modal */}
        {verificationCodeData && (
          <DeviceVerificationCodeModal
            isOpen={showVerificationCode}
            email={verificationCodeData.email}
            userId={verificationCodeData.userId}
            deviceInfo={verificationCodeData.deviceInfo}
            onVerify={async (code: string) => {
              // Verify code - ensure all required fields are present
              if (!verificationCodeData.deviceInfo || !verificationCodeData.deviceInfo.fingerprint) {
                logger.error('❌ [PasswordUnlock] Missing deviceInfo.fingerprint');
                throw new Error('Device information is incomplete. Please try again.');
              }

              const requestBody = {
                userId: verificationCodeData.userId,
                email: verificationCodeData.email,
                code,
                deviceInfo: {
                  fingerprint: verificationCodeData.deviceInfo.fingerprint,
                  deviceName: verificationCodeData.deviceInfo.deviceName || verificationCodeData.deviceInfo.name,
                  ipAddress: verificationCodeData.deviceInfo.ipAddress,
                  userAgent: verificationCodeData.deviceInfo.userAgent,
                  browser: verificationCodeData.deviceInfo.browser,
                  os: verificationCodeData.deviceInfo.os,
                },
              };

              logger.log('🔍 [PasswordUnlock] Verifying code with:', {
                userId: requestBody.userId?.substring(0, 8) + '...',
                email: requestBody.email,
                codeLength: code.length,
                hasFingerprint: !!requestBody.deviceInfo.fingerprint,
              });

              const response = await fetch('/api/verify-device-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              });

              const data = await response.json();

              if (!data.success) {
                logger.error('❌ [PasswordUnlock] Code verification failed:', data.error);
                throw new Error(data.error || 'Invalid verification code');
              }

              // Device verified - now sign in
              const { strictSignInWithEmail } = await import('@/lib/supabase-auth-strict');
              const result = await strictSignInWithEmail(
                verificationCodeData.email,
                verificationCodeData.password
              );

              if (!result.success) {
                throw new Error(result.error || 'Failed to sign in');
              }

              // Wallet successfully unlocked
              if (result.mnemonic) {
                const { importWallet } = useWalletStore.getState();
                await importWallet(result.mnemonic);

                // Save to recent and complete
                saveCurrentAccountToRecent();
                sessionStorage.setItem('wallet_unlocked_this_session', 'true');

                setShowVerificationCode(false);
                setVerificationCodeData(null);
                onComplete();
              }
            }}
            onResend={async () => {
              // Resend code
              const response = await fetch('/api/device-verification-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: verificationCodeData.userId,
                  email: verificationCodeData.email,
                  deviceInfo: verificationCodeData.deviceInfo,
                }),
              });

              const data = await response.json();

              if (!data.success) {
                throw new Error(data.error || 'Failed to resend code');
              }
            }}
            onCancel={() => {
              setShowVerificationCode(false);
              setVerificationCodeData(null);
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
