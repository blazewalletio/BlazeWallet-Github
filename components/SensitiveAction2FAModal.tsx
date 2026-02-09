/**
 * 🔐 SENSITIVE ACTION 2FA MODAL
 * For SESSION SHIELD - verify 2FA before sensitive actions
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, Loader2, AlertTriangle, ArrowLeft, Clock } from 'lucide-react';
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

  const getActionColor = () => {
    switch (actionType) {
      case 'wallet_export':
      case '2fa_disable':
      case 'password_change':
        return 'from-red-500 to-orange-500'; // Critical actions = red
      case 'send':
      case 'swap':
        return amountUSD && amountUSD > 1000
          ? 'from-yellow-500 to-orange-500' // Large amounts = orange
          : 'from-green-500 to-emerald-500'; // Normal = green
      default:
        return 'from-blue-500 to-cyan-500';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card rounded-2xl max-w-md w-full"
        >
          {/* Header */}
          <div className={`bg-gradient-to-r ${getActionColor()} bg-opacity-10 border-b border-gray-100 px-6 py-4`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${getActionColor()} rounded-xl flex items-center justify-center shadow-lg`}>
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Security Verification</h2>
                <p className="text-xs text-gray-600">{actionName}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">2FA Required</h3>
                  <p className="text-sm text-blue-800">
                    {getActionMessage()}
                  </p>
                </div>
              </div>
            </div>

            {/* Session info for non-critical actions */}
            {!['wallet_export', '2fa_disable', 'password_change'].includes(actionType) && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                <Clock className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-green-800">
                  After verification, you won't need 2FA again for 30 minutes
                </p>
              </div>
            )}

            {/* Critical action warning */}
            {['wallet_export', '2fa_disable', 'password_change'].includes(actionType) && (
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
                  className="w-full p-4 text-center text-2xl font-mono bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none tracking-widest"
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
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mx-auto"
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
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={isLoading || verificationCode.length < (useBackupCode ? 8 : 6)}
                className={`flex-1 p-4 bg-gradient-to-r ${getActionColor()} hover:opacity-90 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
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

