'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { verifyPassword } from '@/lib/crypto-utils';
import { secureStorage } from '@/lib/secure-storage';
import { logger } from '@/lib/logger';

interface PasswordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export default function PasswordVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Verify Your Password',
  description = 'For security, please re-enter your password to continue.'
}: PasswordVerificationModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [allowPasswordInput, setAllowPasswordInput] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Hard reset on every open so the password field is always empty.
    setPassword('');
    setError('');
    setShowPassword(false);
    setAllowPasswordInput(false);
  }, [isOpen]);

  const handleVerify = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // Get stored password hash (try IndexedDB first, fallback to localStorage)
      const storedHash = await secureStorage.getItem('password_hash') || localStorage.getItem('password_hash');
      
      if (!storedHash) {
        setError('No password found. Please set up your wallet.');
        setIsVerifying(false);
        return;
      }

      // Verify password
      if (!verifyPassword(password, storedHash)) {
        setError('Incorrect password. Please try again.');
        setIsVerifying(false);
        return;
      }

      // Success!
      logger.log('✅ Password verified successfully');
      setPassword('');
      setError('');
      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Password verification error:', err);
      setError('Failed to verify password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setShowPassword(false);
    setAllowPasswordInput(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 text-white relative">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{title}</h2>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Security Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 mb-1">
                    Security check required
                  </p>
                  <p className="text-xs text-orange-700">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
                    placeholder="Enter your password"
                    className="w-full p-4 pr-12 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    autoFocus
                    disabled={isVerifying}
                    autoComplete="new-password"
                    name="verification-password"
                    readOnly={!allowPasswordInput}
                    onFocus={() => setAllowPasswordInput(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-3"
                >
                  <p className="text-sm text-red-700">{error}</p>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                disabled={isVerifying}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={isVerifying || !password}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Verify
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

