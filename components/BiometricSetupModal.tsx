'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BiometricSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BiometricSetupModal({ isOpen, onClose, onSuccess }: BiometricSetupModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'password' | 'biometric' | 'success'>('password');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Check if wallet was created with email
      const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
      const email = localStorage.getItem('wallet_email');

      if (createdWithEmail && email) {
        // Validate password with Supabase
        const { signInWithEmail } = await import('@/lib/supabase-auth');
        const result = await signInWithEmail(email, password);
        
        if (!result.success) {
          throw new Error('Invalid password');
        }
      } else {
        // Validate password with local encryption
        const { useWalletStore } = await import('@/lib/wallet-store');
        const { unlockWithPassword } = useWalletStore.getState();
        
        // Try to unlock with password to validate it
        const encryptedWalletData = localStorage.getItem('encrypted_wallet');
        if (!encryptedWalletData) {
          throw new Error('No encrypted wallet found');
        }
        
        const storedHash = localStorage.getItem('password_hash');
        if (!storedHash) {
          throw new Error('No password hash found');
        }
        
        // Verify password hash
        const { verifyPassword } = await import('@/lib/crypto-utils');
        if (!verifyPassword(password, storedHash)) {
          throw new Error('Invalid password');
        }
      }

      // Password is valid, move to biometric registration
      setStep('biometric');
      
      // Automatically start biometric registration
      await handleBiometricRegistration();
      
    } catch (error: any) {
      setError(error.message || 'Invalid password');
      setIsLoading(false);
    }
  };

  const handleBiometricRegistration = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Import services
      const { WebAuthnService } = await import('@/lib/webauthn-service');
      const { BiometricStore } = await import('@/lib/biometric-store');
      const { useWalletStore } = await import('@/lib/wallet-store');
      
      const webauthnService = WebAuthnService.getInstance();
      const biometricStore = BiometricStore.getInstance();
      
      // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
      const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
      if (!walletIdentifier) {
        throw new Error('Cannot determine wallet identifier for biometric setup');
      }
      
      // ✅ WALLET-SPECIFIC: Detect wallet type
      const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
      const walletType: 'email' | 'seed' = createdWithEmail ? 'email' : 'seed';
      
      // Create display name (first 8 chars for EVM, email for email wallets)
      const displayName = walletType === 'email' 
        ? (localStorage.getItem('wallet_email') || 'BLAZE User')
        : `Wallet ${walletIdentifier.substring(0, 8)}...`;
      
      console.log(`🔐 Setting up biometric for ${walletType} wallet:`, displayName);
      
      // ✅ WALLET-SPECIFIC: Register WebAuthn credential with wallet identifier
      const result = await webauthnService.register(walletIdentifier, displayName, walletType);
      
      if (!result.success || !result.credential) {
        throw new Error(result.error || 'Biometric registration was cancelled or not allowed');
      }
      
      // ✅ WALLET-SPECIFIC: Store credential indexed by wallet identifier
      webauthnService.storeCredential(result.credential, walletIdentifier);
      
      // ✅ WALLET-SPECIFIC: Store password for THIS wallet only
      const stored = await biometricStore.storePassword(password, walletIdentifier);
      
      if (!stored) {
        throw new Error('Failed to store password for biometric access');
      }
      
      console.log(`✅ Biometric enabled for wallet: ${walletIdentifier.substring(0, 8)}...`);
      
      // Success!
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        
        // Reset state
        setPassword('');
        setStep('password');
        setError('');
      }, 1500);
      
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      setError(error.message || 'Failed to enable biometric authentication');
      setStep('password'); // Go back to password step
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setPassword('');
      setStep('password');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
        >
          {step === 'password' && (
            <>
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Fingerprint className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Enable Face ID / Touch ID
                </h2>
                <p className="text-gray-600 text-sm">
                  Enter your wallet password to continue
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Wallet password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      placeholder="Enter password"
                      required
                      autoFocus
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-900 font-semibold py-3 px-6 rounded-xl transition-colors disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !password}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Continue"
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 'biometric' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Fingerprint className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Scan your biometric
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                Use Face ID or Touch ID to complete setup
              </p>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-900 font-semibold py-3 px-6 rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBiometricRegistration}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Setting up...' : 'Try again'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                All set!
              </h2>
              <p className="text-gray-600 text-sm">
                Face ID / Touch ID has been enabled successfully
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

