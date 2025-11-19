'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, AlertCircle, Fingerprint } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrentAccount, switchToEmailAccount, switchToSeedWallet, WalletAccount, saveCurrentAccountToRecent, getAccountsByType } from '@/lib/account-manager';
import AccountSelectorDropdown from './AccountSelectorDropdown';
import NewEmailModal from './NewEmailModal';
import { logger } from '@/lib/logger';
import { rateLimitService } from '@/lib/rate-limit-service';

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

  // Load current account
  useEffect(() => {
    if (isOpen) {
      const account = getCurrentAccount();
      setCurrentAccount(account);
      logger.log('📧 Current account loaded:', account);
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
          logger.log('🚫 Biometric disabled: Not on production domain (my.blazewallet.io)');
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
        
        logger.log(`🔍 Biometric check for wallet ${walletIdentifier.substring(0, 8)}...:`, hasStoredPassword);
        
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

    // Note: Rate limiting is now handled in wallet-store.ts unlockWithPassword()
    // The error message from there will show remaining attempts

    setIsLoading(true);
    try {
      // Check if this is a new email login
      if (pendingNewEmail) {
        // ✅ SECURITY: Check rate limiting first for email accounts
        const lockStatus = rateLimitService.isLocked(pendingNewEmail);
        if (lockStatus.isLocked) {
          const minutes = Math.ceil(lockStatus.unlockInSeconds! / 60);
          throw new Error(`Too many failed attempts. Please try again in ${minutes} minutes.`);
        }

        // For new email wallets, decrypt using Supabase auth method
        const { signInWithEmail } = await import('@/lib/supabase-auth');
        const result = await signInWithEmail(pendingNewEmail, password);
        
        if (!result.success) {
          // ✅ SECURITY: Record failed attempt
          const attemptResult = rateLimitService.recordFailedAttempt(pendingNewEmail);
          
          if (attemptResult.isLocked) {
            throw new Error(`Too many failed attempts. Account locked for 15 minutes.`);
          }
          
          throw new Error(result.error || `Invalid password. ${attemptResult.remainingAttempts} attempts remaining.`);
        }

        // ✅ SECURITY: Clear failed attempts on success
        rateLimitService.clearAttempts(pendingNewEmail);

        // Wallet is now decrypted and loaded
        if (result.mnemonic) {
          const { importWallet } = useWalletStore.getState();
          await importWallet(result.mnemonic);
        }
        
        // ✅ FIX: Save account to recent after successful unlock
        saveCurrentAccountToRecent();
        
        // Set session flag
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        setPendingNewEmail(null);
        onComplete();
        return;
      }

      // Check if wallet was created with email
      const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
      const email = localStorage.getItem('wallet_email');

      if (createdWithEmail && email) {
        // ✅ SECURITY: Check rate limiting first for email accounts
        const lockStatus = rateLimitService.isLocked(email);
        if (lockStatus.isLocked) {
          const minutes = Math.ceil(lockStatus.unlockInSeconds! / 60);
          throw new Error(`Too many failed attempts. Please try again in ${minutes} minutes.`);
        }

        // For email wallets, decrypt using Supabase auth method
        const { signInWithEmail } = await import('@/lib/supabase-auth');
        const result = await signInWithEmail(email, password);
        
        if (!result.success) {
          // ✅ SECURITY: Record failed attempt
          const attemptResult = rateLimitService.recordFailedAttempt(email);
          
          if (attemptResult.isLocked) {
            throw new Error(`Too many failed attempts. Account locked for 15 minutes.`);
          }
          
          throw new Error(result.error || `Invalid password. ${attemptResult.remainingAttempts} attempts remaining.`);
        }

        // ✅ SECURITY: Clear failed attempts on success
        rateLimitService.clearAttempts(email);

        // Wallet is now decrypted and loaded
        if (result.mnemonic) {
          const { importWallet } = useWalletStore.getState();
          await importWallet(result.mnemonic);
        }
        
        // ✅ FIX: Save account to recent after successful unlock
        saveCurrentAccountToRecent();
        
        // Set session flag to skip unlock modal on page refresh during same session
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        onComplete();
      } else {
        // For seed phrase wallets, use traditional unlock
        await unlockWithPassword(password);
        
        // ✅ FIX: Save account to recent after successful unlock
        saveCurrentAccountToRecent();
        
        // Set session flag
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        onComplete();
      }
    } catch (error: any) {
      // Error message from wallet-store already includes attempt count and rate limit info
      setError(error.message || 'Failed to unlock wallet');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle account switching
  const handleSelectAccount = async (account: WalletAccount) => {
    logger.log('🔄 Switching account:', account);
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
          
          logger.log('✅ Updated localStorage for email account:', account.email);
        }
        
        setCurrentAccount(account);
      } else if (account.type === 'seed') {
        // Switching to seed wallet
        await switchToSeedWallet(account.id);
        const updatedAccount = getCurrentAccount();
        setCurrentAccount(updatedAccount);
      }
    } catch (err: any) {
      logger.error('Failed to switch account:', err);
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
    logger.log('➕ Adding new email account:', email);
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

            <div className="mt-6 text-center">
              <button
                onClick={onFallback}
                className="text-gray-600 hover:text-gray-900 text-sm underline transition-colors"
              >
                Recover with recovery phrase
              </button>
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

        {/* New Email Modal */}
        <NewEmailModal
          isOpen={showNewEmailModal}
          onClose={() => setShowNewEmailModal(false)}
          onSubmit={handleAddNewEmail}
          existingEmails={getAccountsByType().emailAccounts.map(acc => acc.email || '')}
        />
      </motion.div>
    </AnimatePresence>
  );
}
