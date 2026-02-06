'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface DeviceVerificationCodeModalProps {
  isOpen: boolean;
  email: string;
  userId: string;
  deviceInfo: any;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
  onResend: () => Promise<void>;
}

export default function DeviceVerificationCodeModal({
  isOpen,
  email,
  userId,
  deviceInfo,
  onVerify,
  onCancel,
  onResend,
}: DeviceVerificationCodeModalProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Send code on mount
  useEffect(() => {
    if (isOpen && !codeSent) {
      sendCode();
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt]);

  const sendCode = async () => {
    try {
      setError('');
      const response = await fetch('/api/device-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
          deviceInfo
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setCodeSent(true);
      setExpiresAt(new Date(data.expiresAt));
      logger.log('✅ Verification code sent');
    } catch (err: any) {
      logger.error('Failed to send code:', err);
      setError(err.message || 'Failed to send verification code');
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    setCode(['', '', '', '', '', '']);
    
    try {
      await onResend();
      await sendCode();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only numbers
    
    const newCode = [...code];
    newCode[index] = value.slice(0, 1);
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    
    setCode(newCode);
    
    if (pasted.length === 6) {
      handleVerify(pasted);
    } else {
      const nextEmptyIndex = newCode.findIndex(digit => !digit);
      if (nextEmptyIndex !== -1) {
        const nextInput = document.getElementById(`code-${nextEmptyIndex}`);
        nextInput?.focus();
      }
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const codeString = codeToVerify || code.join('');
    
    if (codeString.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      await onVerify(codeString);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
      setCode(['', '', '', '', '', '']);
      document.getElementById('code-0')?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 text-white">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl backdrop-blur">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                Enter Verification Code
              </h2>
              <p className="text-white/90 text-center text-sm">
                We sent a 6-digit code to {email}
              </p>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              {success ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Device verified successfully!</p>
                </div>
              ) : (
                <>
                  {/* Code Input */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 text-center">
                      Enter the 6-digit code
                    </label>
                    
                    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          id={`code-${index}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                          disabled={isVerifying}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>

                    {timeRemaining !== null && timeRemaining > 0 && (
                      <p className="text-center text-sm text-gray-600">
                        Code expires in {formatTime(timeRemaining)}
                      </p>
                    )}

                    {timeRemaining === 0 && (
                      <p className="text-center text-sm text-red-600">
                        Code expired. Please request a new one.
                      </p>
                    )}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"
                    >
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">{error}</p>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="space-y-3">
                    <button
                      onClick={() => handleVerify()}
                      disabled={isVerifying || code.join('').length !== 6}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-2xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Verify Device
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleResend}
                      disabled={isResending || (timeRemaining !== null && timeRemaining > 0)}
                      className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Resend Code
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
              
              {/* Cancel Button */}
              <button
                onClick={onCancel}
                disabled={isVerifying || isResending}
                className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

