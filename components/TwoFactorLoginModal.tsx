'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, Loader2, AlertTriangle, ArrowLeft, Clock, Lock } from 'lucide-react';
import { logger } from '@/lib/logger';
import { twoFactorSessionService } from '@/lib/2fa-session-service';

interface TwoFactorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  email: string;
}

export default function TwoFactorLoginModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId,
  email 
}: TwoFactorLoginModalProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [isCompactHeight, setIsCompactHeight] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const updateCompactMode = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      setIsCompactHeight(viewportHeight < 760);
    };

    updateCompactMode();
    window.addEventListener('resize', updateCompactMode);
    window.visualViewport?.addEventListener('resize', updateCompactMode);

    return () => {
      window.removeEventListener('resize', updateCompactMode);
      window.visualViewport?.removeEventListener('resize', updateCompactMode);
    };
  }, [isOpen]);

  const handleVerify = async () => {
    if (!useBackupCode && verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    if (useBackupCode && verificationCode.length < 8) {
      setError('Please enter a valid backup code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call API route for verification (server-side only)
      const response = await fetch('/api/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: verificationCode,
          isBackupCode: useBackupCode,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }

      logger.log('✅ 2FA verification successful during login');
      
      // 🔐 SESSION SHIELD: Create 30-minute session after login
      const sessionResult = await twoFactorSessionService.createSession(
        userId,
        undefined, // device fingerprint (optional)
        undefined, // ip address (optional)
        typeof window !== 'undefined' ? navigator.userAgent : undefined
      );

      if (sessionResult.success) {
        logger.log('✅ 2FA session created, valid for 30 minutes');
      } else {
        logger.warn('⚠️ Failed to create 2FA session, but login successful');
      }
      
      onSuccess();
    } catch (err: any) {
      logger.error('2FA login verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setVerificationCode('');
    setError('');
    setUseBackupCode(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex justify-center ${
          isCompactHeight ? 'items-start p-2 sm:p-3' : 'items-center p-3 sm:p-4'
        }`}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`glass-card w-full max-w-[560px] border border-white/60 shadow-2xl overflow-hidden flex flex-col ${
            isCompactHeight ? 'rounded-2xl mt-2' : 'rounded-3xl'
          }`}
          style={{ maxHeight: isCompactHeight ? '96vh' : '92vh' }}
        >
          {/* Header */}
          <div className={`border-b border-gray-100/80 bg-white/75 backdrop-blur-sm flex-shrink-0 ${
            isCompactHeight ? 'px-4 sm:px-5 pt-4 pb-3' : 'px-5 sm:px-6 pt-5 sm:pt-6 pb-4'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`${isCompactHeight ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-orange-500 to-yellow-500 shadow-orange-500/25`}>
                <Shield className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
              </div>
              <div className="min-w-0">
                <h2 className={`${isCompactHeight ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>Security verification</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={`${isCompactHeight ? 'p-4 sm:p-5 space-y-3.5' : 'p-5 sm:p-6 space-y-4'} bg-white/70 overflow-y-auto`}>
            {/* Info */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 bg-orange-50 border-orange-100">
                  <Lock className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">2FA required</h3>
                  <p className="text-sm text-gray-600">
                    {useBackupCode 
                      ? 'Enter one of your backup codes to continue'
                      : 'Verify your identity with your authenticator code to continue'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-orange-900">
                After verification, you will not need 2FA again for 30 minutes
              </p>
            </div>

            {/* Input */}
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-gray-900 mb-2 block">
                  {useBackupCode ? 'Backup Code' : 'Verification Code'}
                </span>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => {
                    if (useBackupCode) {
                      // Backup code: allow alphanumeric and dashes
                      const value = e.target.value.toUpperCase();
                      setVerificationCode(value);
                    } else {
                      // TOTP: only numbers, max 6 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                    }
                    setError('');
                  }}
                  placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
                  className={`w-full text-center font-mono bg-white border-2 border-gray-200 rounded-2xl focus:outline-none shadow-sm ${
                    isCompactHeight ? 'p-3.5 text-2xl' : 'p-4 text-3xl'
                  }`}
                  style={{
                    letterSpacing: useBackupCode ? '0.12em' : '0.38em',
                  }}
                  maxLength={useBackupCode ? 20 : 6}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && verificationCode.length >= (useBackupCode ? 8 : 6)) {
                      handleVerify();
                    }
                  }}
                />
              </label>
              <p className="text-xs text-gray-500 text-center">
                {useBackupCode 
                  ? 'Each backup code can only be used once'
                  : 'Enter the 6-digit code from your authenticator app'
                }
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Toggle backup code */}
            <div className="text-center">
              <button
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setVerificationCode('');
                  setError('');
                }}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-2 mx-auto transition-colors"
              >
                {useBackupCode ? (
                  <>
                    <ArrowLeft className="w-4 h-4" />
                    Use authenticator app instead
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Use backup code instead
                  </>
                )}
              </button>
            </div>

            {/* Actions */}
            <div className={`grid grid-cols-2 gap-3 ${isCompactHeight ? 'pt-1' : 'pt-2'}`}>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className={`flex-1 bg-gray-100/90 hover:bg-gray-200 text-gray-700 rounded-2xl font-semibold transition-all disabled:opacity-50 ${
                  isCompactHeight ? 'p-3.5' : 'p-4'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={isLoading || verificationCode.length < (useBackupCode ? 8 : 6)}
                className={`flex-1 text-white rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 shadow-orange-500/20 ${
                  isCompactHeight ? 'p-3.5' : 'p-4'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    Verify & Continue
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

