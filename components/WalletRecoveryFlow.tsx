'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, AlertTriangle, CheckCircle, Eye, EyeOff, 
  Lock, ArrowRight, ArrowLeft, Key, Loader2, X
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface WalletRecoveryFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'warning' | 'mnemonic' | 'password' | 'success';

export default function WalletRecoveryFlow({ isOpen, onClose, onSuccess }: WalletRecoveryFlowProps) {
  const [step, setStep] = useState<Step>('warning');
  const [mnemonic, setMnemonic] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mnemonicValid, setMnemonicValid] = useState<boolean | null>(null);

  // ✅ FIX: Scroll to top on step change
  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [step, isOpen]);

  const handleClose = () => {
    if (isProcessing) return; // Don't allow close during processing
    setStep('warning');
    setMnemonic('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setMnemonicValid(null);
    onClose();
  };

  const handleWarningContinue = () => {
    setStep('mnemonic');
  };

  const validateMnemonic = async (mnemonicInput: string) => {
    const cleanMnemonic = mnemonicInput.trim().toLowerCase();
    const words = cleanMnemonic.split(/\s+/);

    // Check word count
    if (words.length !== 12 && words.length !== 24) {
      setMnemonicValid(false);
      return false;
    }

    // Validate with BIP39
    try {
      const bip39 = await import('bip39');
      const isValid = bip39.validateMnemonic(cleanMnemonic);
      setMnemonicValid(isValid);
      return isValid;
    } catch (error) {
      logger.error('BIP39 validation error:', error);
      setMnemonicValid(false);
      return false;
    }
  };

  const handleMnemonicContinue = async () => {
    setError('');
    
    if (!mnemonic.trim()) {
      setError('Please enter your recovery phrase');
      return;
    }

    const isValid = await validateMnemonic(mnemonic);
    
    if (!isValid) {
      setError('Invalid recovery phrase. Please check your words and try again.');
      return;
    }

    setStep('password');
  };

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score, label: 'Medium', color: 'bg-yellow-500' };
    if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' };
    return { score, label: 'Very Strong', color: 'bg-green-600' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleRecoverWallet = async () => {
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsProcessing(true);

    try {
      logger.log('🔄 Starting wallet recovery...');

      // Import recovery function
      const { recoverWallet } = await import('@/lib/wallet-recovery');
      
      const result = await recoverWallet(mnemonic.trim().toLowerCase(), newPassword);

      if (!result.success) {
        throw new Error(result.error || 'Recovery failed');
      }

      logger.log('✅ Wallet recovered successfully!');
      setStep('success');

    } catch (error: any) {
      logger.error('❌ Recovery failed:', error);
      setError(error.message || 'Failed to recover wallet. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && !isProcessing && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Wallet Recovery</h2>
                <p className="text-xs text-gray-600">
                  Step {step === 'warning' ? '1' : step === 'mnemonic' ? '2' : step === 'password' ? '3' : '4'}/4
                </p>
              </div>
            </div>
            {!isProcessing && step !== 'success' && (
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
            {/* STEP 1: WARNING */}
            {step === 'warning' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-orange-900 mb-2">
                        Important: Password Reset
                      </div>
                      <div className="text-sm text-orange-800 space-y-1">
                        <p>You are about to reset your wallet password using your recovery phrase.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <div className="font-semibold mb-1">You will need:</div>
                      <p>Your 12-word recovery phrase</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <div className="font-semibold mb-1">What stays the same:</div>
                      <p>Your wallet addresses and balances</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <div className="font-semibold mb-1">What changes:</div>
                      <p>Your old password will be replaced with a new one</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleWarningContinue}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
              </motion.div>
            )}

            {/* STEP 2: MNEMONIC INPUT */}
            {step === 'mnemonic' && (
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

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Recovery Phrase
                  </label>
                  <textarea
                    value={mnemonic}
                    onChange={(e) => {
                      setMnemonic(e.target.value);
                      setMnemonicValid(null);
                      setError('');
                    }}
                    onBlur={() => mnemonic && validateMnemonic(mnemonic)}
                    placeholder="Enter your 12-word recovery phrase (separate with spaces)"
                    rows={4}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm ${
                      mnemonicValid === false ? 'border-red-300 bg-red-50' : 
                      mnemonicValid === true ? 'border-green-300 bg-green-50' : 
                      'border-gray-300'
                    }`}
                  />
                  {mnemonicValid === true && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Valid recovery phrase
                    </p>
                  )}
                  {mnemonicValid === false && (
                    <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Invalid recovery phrase
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Enter all 12 words separated by spaces, in the correct order
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">💡 Tip:</span> Your recovery phrase is case-insensitive and extra spaces are ignored.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('warning')}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={handleMnemonicContinue}
                    disabled={!mnemonic.trim() || mnemonicValid === false}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: NEW PASSWORD */}
            {step === 'password' && (
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

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Password strength:</span>
                        <span className={`text-xs font-semibold ${
                          passwordStrength.label === 'Weak' ? 'text-red-600' :
                          passwordStrength.label === 'Medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Minimum 8 characters</p>
                </div>

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
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Passwords do not match
                    </p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Passwords match
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('mnemonic')}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={handleRecoverWallet}
                    disabled={isProcessing || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Recovering...
                      </>
                    ) : (
                      <>
                        <Key className="w-5 h-5" />
                        Recover Wallet
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SUCCESS */}
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
                    Wallet Recovered!
                  </h3>
                  <p className="text-gray-600">
                    Your wallet has been successfully recovered with a new password.
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-left">
                  <div className="text-sm text-green-900 space-y-2">
                    <p className="font-semibold">✅ What happened:</p>
                    <ul className="space-y-1 ml-4">
                      <li>• Wallet recovered from recovery phrase</li>
                      <li>• New password set successfully</li>
                      <li>• All wallet addresses preserved</li>
                      <li>• Ready to use!</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={handleSuccess}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30"
                >
                  Go to Dashboard
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

