'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, AlertCircle, Fingerprint, Mail, Key, RefreshCw } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrentAccount, saveAccountToRecent } from '@/lib/account-manager';
import AccountSwitchModal from './AccountSwitchModal';

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
  const [attempts, setAttempts] = useState(0);
  const { unlockWithPassword } = useWalletStore();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<ReturnType<typeof getCurrentAccount>>(null);
  const [showAccountSwitch, setShowAccountSwitch] = useState(false);

  // Check if biometric is available on mount
  useEffect(() => {
    const checkBiometric = async () => {
      if (typeof window !== 'undefined') {
        // ✅ Load current account
        const account = getCurrentAccount();
        setCurrentAccount(account);

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

    if (attempts >= 3) {
      setError("Too many failed attempts. Use your recovery phrase to start over.");
      return;
    }

    setIsLoading(true);
    try {
      // Check if wallet was created with email
      const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
      const email = localStorage.getItem('wallet_email');

      if (createdWithEmail && email) {
        // For email wallets, decrypt using Supabase auth method
        const { signInWithEmail } = await import('@/lib/supabase-auth');
        const result = await signInWithEmail(email, password);
        
        if (!result.success) {
          throw new Error(result.error || 'Invalid password');
        }

        // Wallet is now decrypted and loaded
        if (result.mnemonic) {
          const { importWallet } = useWalletStore.getState();
          await importWallet(result.mnemonic);
        }
        
        // ✅ Save to recent accounts
        if (currentAccount) {
          saveAccountToRecent(currentAccount);
        }
        
        // Set session flag to skip unlock modal on page refresh during same session
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        onComplete();
      } else {
        // For seed phrase wallets, use traditional unlock
        await unlockWithPassword(password);
        
        // ✅ Save to recent accounts
        if (currentAccount) {
          saveAccountToRecent(currentAccount);
        }
        
        // Set session flag
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        onComplete();
      }
    } catch (error: any) {
      setAttempts(prev => prev + 1);
      setError(`Invalid password. Attempt ${attempts + 1}/3`);
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
    <>
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
              {/* Account Badge */}
              {currentAccount && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
                  {currentAccount.type === 'email' ? (
                    <Mail className="w-4 h-4 text-orange-500" />
                  ) : (
                    <Key className="w-4 h-4 text-orange-500" />
                  )}
                  <span className="font-medium">{currentAccount.displayName}</span>
                </div>
              )}

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

              <div className="mt-6 flex flex-col gap-2 text-center">
                <button
                  onClick={() => setShowAccountSwitch(true)}
                  className="text-gray-600 hover:text-gray-900 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Switch account</span>
                </button>
                
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
        </motion.div>
      </AnimatePresence>

      {/* Account Switch Modal */}
      <AccountSwitchModal
        isOpen={showAccountSwitch}
        onClose={() => setShowAccountSwitch(false)}
        onSwitch={() => {
          setShowAccountSwitch(false);
          setPassword('');
          setError('');
          setAttempts(0);
          // Reload current account after switch
          const account = getCurrentAccount();
          setCurrentAccount(account);
        }}
        onAddAccount={async (type) => {
          setShowAccountSwitch(false);
          
          // Clear all wallet state to trigger fresh onboarding
          localStorage.removeItem('encrypted_wallet');
          localStorage.removeItem('wallet_created_with_email');
          localStorage.removeItem('wallet_email');
          localStorage.removeItem('supabase_user_id');
          localStorage.removeItem('has_password');
          sessionStorage.removeItem('wallet_unlocked_this_session');
          
          // Clear wallet store
          const { resetWallet } = useWalletStore.getState();
          resetWallet();
          
          // Force reload to trigger onboarding
          setTimeout(() => {
            window.location.href = type === 'email' ? '/' : '/?import=true';
          }, 100);
        }}
        currentAccountId={currentAccount?.id || null}
      />
    </>
  );
}
