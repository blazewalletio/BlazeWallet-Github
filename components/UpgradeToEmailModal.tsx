'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Shield, Mail, Lock, AlertTriangle, CheckCircle, 
  Cloud, Smartphone, Key, ArrowRight, Loader2, Eye, EyeOff
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface UpgradeToEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'intro' | 'form' | 'confirm' | 'processing' | 'success';

export default function UpgradeToEmailModal({ 
  isOpen, 
  onClose, 
  onSuccess
}: UpgradeToEmailModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); // To verify identity AND get mnemonic
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [extractedMnemonic, setExtractedMnemonic] = useState<string>(''); // Store mnemonic after decryption
  const [hasPassword, setHasPassword] = useState(false); // ✅ NEW: Track if wallet has password

  const handleClose = () => {
    if (step === 'processing') return; // Don't allow close during processing
    setStep('intro');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setError('');
    setAgreedToTerms(false);
    setHasPassword(false);
    onClose();
  };

  // ✅ Check if wallet has password on mount
  useEffect(() => {
    if (isOpen) {
      const passwordSet = typeof window !== 'undefined' 
        ? localStorage.getItem('has_password') === 'true'
        : false;
      setHasPassword(passwordSet);
      logger.log('📝 Wallet has password:', passwordSet);
    }
  }, [isOpen]);

  const handleNext = () => {
    setError('');
    
    if (step === 'intro') {
      setStep('form');
    } else if (step === 'form') {
      // Validate form
      if (!email || !password || !confirmPassword) {
        setError('Please fill in all fields');
        return;
      }

      // ✅ Only require current password if wallet has one
      if (hasPassword && !currentPassword) {
        setError('Please enter your current password');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!agreedToTerms) {
        setError('Please agree to the terms');
        return;
      }

      setStep('confirm');
    } else if (step === 'confirm') {
      handleUpgrade();
    }
  };

  const handleUpgrade = async () => {
    setError('');
    setStep('processing');

    try {
      logger.log('🔄 Starting wallet upgrade to email account...');

      let mnemonic: string;

      // ✅ If wallet has password: Decrypt to get mnemonic
      if (hasPassword) {
        logger.log('🔐 Wallet has password - decrypting...');
        
        const encryptedWalletString = typeof window !== 'undefined' 
          ? localStorage.getItem('encrypted_wallet')
          : null;

        if (!encryptedWalletString) {
          throw new Error('No wallet found to upgrade');
        }

        try {
          // Parse encrypted wallet (stored as JSON string)
          const encryptedWallet = JSON.parse(encryptedWalletString);
          
          // Decrypt using crypto-utils
          const { decryptWallet } = await import('@/lib/crypto-utils');
          mnemonic = decryptWallet(encryptedWallet, currentPassword);
          
          logger.log('✅ Wallet decrypted successfully');
          setExtractedMnemonic(mnemonic);
        } catch (err: any) {
          logger.error('❌ Failed to decrypt wallet:', err);
          setError('Current password is incorrect');
          setStep('form');
          return;
        }
      } 
      // ✅ If wallet has NO password: Get mnemonic from wallet store
      else {
        logger.log('📝 Wallet has no password - getting mnemonic from store...');
        
        const { useWalletStore } = await import('@/lib/wallet-store');
        const storeMnemonic = useWalletStore.getState().mnemonic;
        
        if (!storeMnemonic) {
          throw new Error('Cannot access wallet mnemonic. Please unlock your wallet first.');
        }
        
        mnemonic = storeMnemonic;
        logger.log('✅ Mnemonic retrieved from store');
      }

      // 2. Call upgrade function with extracted mnemonic
      const { upgradeToEmailAccount } = await import('@/lib/supabase-auth');
      
      const result = await upgradeToEmailAccount(
        email,
        password,
        mnemonic
      );

      if (!result.success) {
        throw new Error(result.error || 'Upgrade failed');
      }

      logger.log('✅ Wallet upgraded successfully!');
      setStep('success');

    } catch (error: any) {
      logger.error('❌ Upgrade failed:', error);
      setError(error.message || 'Failed to upgrade wallet. Please try again.');
      setStep('form');
    }
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess();
    // Reload page to reflect changes
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {step === 'success' ? 'Upgrade Complete!' : 'Upgrade to Email Account'}
              </h2>
            </div>
            {step !== 'processing' && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* STEP 1: INTRO */}
            {step === 'intro' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Why upgrade to an email account?
                  </h3>
                  <p className="text-sm text-gray-600">
                    Get additional features while keeping your existing wallet and addresses.
                  </p>
                </div>

                {/* Benefits */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                    <Cloud className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-green-900">Cloud Backup</div>
                      <div className="text-sm text-green-700">
                        Your encrypted wallet is securely stored in the cloud
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-blue-900">Multi-Device Access</div>
                      <div className="text-sm text-blue-700">
                        Login with email + password on any device
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <Key className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-purple-900">Advanced Security</div>
                      <div className="text-sm text-purple-700">
                        Enable 2FA, trusted devices, and more
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-semibold text-orange-900 mb-1">Important</div>
                      <ul className="space-y-1 text-orange-700">
                        <li>• Your seed phrase stays the same</li>
                        <li>• Your wallet addresses don't change</li>
                        <li>• You can still use your seed phrase as backup</li>
                        <li>• This upgrade is irreversible</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: FORM */}
            {step === 'form' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Current Password - Only show if wallet has password */}
                {hasPassword && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Current Wallet Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Verify your identity before upgrading</p>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="agree"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="agree" className="text-sm text-gray-700 cursor-pointer">
                    I understand that my seed phrase will be encrypted and stored in the cloud,
                    and I can still use my seed phrase as a backup method.
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('intro')}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: CONFIRM */}
            {step === 'confirm' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-orange-900 mb-2">
                        Final Confirmation
                      </div>
                      <div className="text-sm text-orange-700 space-y-1">
                        <p>You are about to upgrade your wallet to an email account.</p>
                        <p className="font-semibold">This action cannot be undone.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Email:</span>
                    <span className="text-sm text-gray-900 font-mono">{email}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Account Type:</span>
                    <span className="text-sm text-gray-900">Email Account</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('form')}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30"
                  >
                    Upgrade Now
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: PROCESSING */}
            {step === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
              >
                <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upgrading Your Wallet...
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we securely upgrade your account
                </p>
              </motion.div>
            )}

            {/* STEP 5: SUCCESS */}
            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center space-y-6"
              >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Upgrade Complete!
                  </h3>
                  <p className="text-gray-600">
                    Your wallet has been successfully upgraded to an email account.
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-left">
                  <div className="text-sm text-green-900 space-y-2">
                    <p className="font-semibold">✅ What's changed:</p>
                    <ul className="space-y-1 ml-4">
                      <li>• Cloud backup enabled</li>
                      <li>• You can now login with email + password</li>
                      <li>• Advanced security features unlocked</li>
                      <li>• Multi-device access enabled</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-left">
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-2">📧 Verification Email Sent</p>
                    <p>We've sent a verification email to <span className="font-mono font-semibold">{email}</span></p>
                    <p className="mt-1">Please check your inbox and verify your email.</p>
                  </div>
                </div>

                <button
                  onClick={handleSuccess}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30"
                >
                  Done
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

