/**
 * 🔐 SENSITIVE ACTION 2FA MODAL
 * For SESSION SHIELD - verify 2FA before sensitive actions
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, Loader2, AlertTriangle, ArrowLeft, Clock, Lock } from 'lucide-react';
import { logger } from '@/lib/logger';
import { twoFactorSessionService } from '@/lib/2fa-session-service';

interface SensitiveAction2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Called after successful 2FA verification
  userId: string;
  actionName: string; // e.g., "Send $500", "Swap tokens", "Export wallet"
  actionType: 'send' | 'swap' | 'wallet_export' | '2fa_disable' | 'password_change';
  amountUSD?: number; // For display purposes
}

export default function SensitiveAction2FAModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId,
  actionName,
  actionType,
  amountUSD
}: SensitiveAction2FAModalProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [isCompactHeight, setIsCompactHeight] = useState(false);
  const isCriticalAction = ['wallet_export', '2fa_disable', 'password_change'].includes(actionType);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const updateCompactMode = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      // Compact mode for small displays and keyboard-open situations.
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
      // Call API route for verification
      const response = await fetch('/api/2fa/verify-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: verificationCode,
          isBackupCode: useBackupCode,
          actionType,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }

      logger.log('✅ 2FA verification successful for action:', actionType);

      // Create/extend 2FA session (30 minutes)
      const sessionResult = await twoFactorSessionService.createSession(
        userId,
        undefined, // device fingerprint (optional)
        undefined, // ip address (optional)
        typeof window !== 'undefined' ? navigator.userAgent : undefined
      );

      if (sessionResult.success) {
        logger.log('✅ 2FA session created, valid for 30 minutes');
      }

      // Call success callback - allow action to proceed
      // Don't call handleClose() here - let the parent component handle closing
      // This prevents the "2FA cancelled" error from showing
      onSuccess();
    } catch (err: any) {
      logger.error('2FA action verification error:', err);
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

  // Get action-specific messaging
  const getActionMessage = () => {
    switch (actionType) {
      case 'send':
        return amountUSD 
          ? `Verify your identity to send ${amountUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
          : 'Verify your identity to send cryptocurrency';
      case 'swap':
        return 'Verify your identity to swap tokens';
      case 'wallet_export':
        return 'Verify your identity to export wallet data';
      case '2fa_disable':
        return 'Verify your identity to disable 2FA';
      case 'password_change':
        return 'Verify your identity to change your password';
      default:
        return 'Verify your identity to continue';
    }
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
              <div className={`${isCompactHeight ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl flex items-center justify-center shadow-lg ${
                isCriticalAction
                  ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/25'
                  : 'bg-gradient-to-br from-orange-500 to-yellow-500 shadow-orange-500/25'
              }`}>
                <Shield className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
              </div>
              <div className="min-w-0">
                <h2 className={`${isCompactHeight ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>Security verification</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{actionName}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={`${isCompactHeight ? 'p-4 sm:p-5 space-y-3.5' : 'p-5 sm:p-6 space-y-4'} bg-white/70 overflow-y-auto`}>
            {/* Info */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  isCriticalAction
                    ? 'bg-red-50 border-red-100'
                    : 'bg-orange-50 border-orange-100'
                }`}>
                  <Lock className={`w-4 h-4 ${isCriticalAction ? 'text-red-600' : 'text-orange-600'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">2FA required</h3>
                  <p className="text-sm text-gray-600">
                    {getActionMessage()}
                  </p>
                </div>
              </div>
            </div>

            {/* Session info for non-critical actions */}
            {!isCriticalAction && (
              <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
                <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-orange-900">
                  After verification, you won't need 2FA again for 30 minutes
                </p>
              </div>
            )}

            {/* Critical action warning */}
            {isCriticalAction && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-800">
                  <strong>Critical action:</strong> 2FA is always required for security
                </p>
              </div>
            )}

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
                      const value = e.target.value.toUpperCase();
                      setVerificationCode(value);
                    } else {
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
                className={`flex-1 text-white rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${
                  isCriticalAction
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-red-500/20'
                    : 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 shadow-orange-500/20'
                } ${isCompactHeight ? 'p-3.5' : 'p-4'}`}
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

