'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertCircle, CheckCircle, Smartphone, Mail, Lock, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { EnhancedDeviceInfo } from '@/lib/device-fingerprint-pro';
import { logger } from '@/lib/logger';

interface DeviceVerificationModalProps {
  isOpen: boolean;
  deviceInfo: EnhancedDeviceInfo;
  deviceToken: string;
  email: string;
  password: string;
  onSuccess: (mnemonic: string) => void;
  onCancel: () => void;
}

export default function DeviceVerificationModal({
  isOpen,
  deviceInfo,
  deviceToken,
  email,
  password,
  onSuccess,
  onCancel,
}: DeviceVerificationModalProps) {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'code' | '2fa'>('code');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [timer, setTimer] = useState(60);
  
  // Refs for auto-focus
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const twoFactorInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (timer > 0 && isOpen) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setVerificationCode(['', '', '', '', '', '']);
      setTwoFactorCode(['', '', '', '', '', '']);
      setStep('code');
      setError('');
      setTimer(60);
      setResendSuccess(false);
      // Focus first input
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleCodeInput = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...verificationCode];
    newCode[index] = value.slice(-1); // Take last character only
    setVerificationCode(newCode);
    setError('');
    
    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handle2FAInput = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...twoFactorCode];
    newCode[index] = value.slice(-1);
    setTwoFactorCode(newCode);
    setError('');
    
    // Auto-focus next input
    if (value && index < 5) {
      twoFactorInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handle2FAKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      twoFactorInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Validate code with backend
      // Get CSRF token first (production-safe)
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const response = await fetch('/api/verify-device-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken, // CSRF protection
        },
        body: JSON.stringify({
          deviceToken,
          verificationCode: code,
          step: 'validate_code',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }
      
      logger.log('✅ Verification code accepted');
      
      // ✅ STORE DEVICE ID (returned from API after marking device as verified)
      if (data.deviceId) {
        const { DeviceIdManager } = await import('@/lib/device-id-manager');
        DeviceIdManager.setDeviceId(data.deviceId);
        logger.log('✅ Device ID stored in localStorage:', data.deviceId.substring(0, 12) + '...');
      }
      
      // ✅ STORE SESSION TOKEN
      if (data.sessionToken && typeof window !== 'undefined') {
        sessionStorage.setItem('blaze_session_token', data.sessionToken);
        logger.log('✅ Session token stored');
      }
      
      // Check if 2FA is required
      if (data.requires2FA) {
        logger.log('🔐 2FA is enabled, moving to 2FA step');
        setStep('2fa');
        setTimeout(() => twoFactorInputRefs.current[0]?.focus(), 100);
      } else {
        logger.log('✅ No 2FA required, signing in directly...');
        
        // ✅ DEVICE ALREADY VERIFIED BY API!
        // Just sign in with Supabase and decrypt wallet
        const { supabase } = await import('@/lib/supabase');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (authError || !authData.user) {
          throw new Error('Failed to sign in');
        }
        
        logger.log('✅ User signed in:', authData.user.id);
        
        // Decrypt wallet
        const csrfResponse = await fetch('/api/csrf-token');
        const { token: csrfToken } = await csrfResponse.json();
        
        const walletResponse = await fetch('/api/get-wallet', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ userId: authData.user.id }),
        });
        
        const walletData = await walletResponse.json();
        
        if (!walletData.success) {
          throw new Error(walletData.error || 'Failed to fetch wallet');
        }
        
        const { decryptMnemonic } = await import('@/lib/wallet-crypto');
        const decryptedMnemonic = await decryptMnemonic(
          walletData.encrypted_mnemonic,
          password
        );
        
        logger.log('✅ Wallet unlocked!');
        onSuccess(decryptedMnemonic);
      }
      
    } catch (error: any) {
      logger.error('❌ Code verification failed:', error);
      setError(error.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    const code2FA = twoFactorCode.join('');
    const code = verificationCode.join('');
    
    if (code2FA.length !== 6) {
      setError('Please enter the 6-digit 2FA code');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const { verifyDeviceAndSignIn } = await import('@/lib/supabase-auth-strict');
      
      const result = await verifyDeviceAndSignIn(
        deviceToken,
        code,
        code2FA,
        email,
        password
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }
      
      logger.log('✅ Device verified and wallet unlocked!');
      
      // Success!
      if (result.mnemonic) {
        onSuccess(result.mnemonic);
      } else {
        throw new Error('Failed to decrypt wallet');
      }
      
    } catch (error: any) {
      logger.error('❌ 2FA verification failed:', error);
      setError(error.message || 'Invalid 2FA code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    setError('');
    
    try {
      const response = await fetch('/api/device-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          resend: true,
          deviceToken,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resend code');
      }
      
      setResendSuccess(true);
      setTimer(60); // Reset timer
      setVerificationCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
      
      setTimeout(() => setResendSuccess(false), 3000);
      
    } catch (error: any) {
      logger.error('❌ Resend failed:', error);
      setError('Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent, isCode: boolean) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (isCode) {
      const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
      setVerificationCode(newCode);
      // Focus last filled input
      const lastIndex = Math.min(pastedData.length, 5);
      codeInputRefs.current[lastIndex]?.focus();
    } else {
      const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
      setTwoFactorCode(newCode);
      const lastIndex = Math.min(pastedData.length, 5);
      twoFactorInputRefs.current[lastIndex]?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 text-white">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl backdrop-blur">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                {step === 'code' ? 'Verify New Device' : '2FA Required'}
              </h2>
              <p className="text-white/90 text-center text-sm">
                {step === 'code' 
                  ? 'We sent a verification code to your email'
                  : 'Enter your 2FA code from your authenticator app'
                }
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Device Info Card */}
              {step === 'code' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {deviceInfo.deviceName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {deviceInfo.browser} {deviceInfo.browserVersion}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {deviceInfo.location.city}, {deviceInfo.location.country}
                      </p>
                      <p className="text-xs text-gray-600">
                        {deviceInfo.ipAddress}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Verification Code Input */}
              <AnimatePresence mode="wait">
                {step === 'code' && (
                  <motion.div
                    key="code-step"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                        Email Verification Code
                      </label>
                      <div 
                        className="flex gap-2 justify-center"
                        onPaste={(e) => handlePaste(e, true)}
                      >
                        {verificationCode.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => {
                              codeInputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleCodeInput(index, e.target.value)}
                            onKeyDown={(e) => handleCodeKeyDown(index, e)}
                            className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                          />
                        ))}
                      </div>
                    </div>

                    {/* Resend Code */}
                    <div className="text-center">
                      {timer > 0 ? (
                        <p className="text-sm text-gray-600">
                          Resend code in <span className="font-medium">{timer}s</span>
                        </p>
                      ) : (
                        <button
                          onClick={handleResendCode}
                          disabled={resendLoading}
                          className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-2 mx-auto disabled:opacity-50"
                        >
                          {resendLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : resendSuccess ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Code sent!
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Resend code
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Error */}
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

                    {/* Continue Button */}
                    <button
                      onClick={handleVerifyCode}
                      disabled={isLoading || verificationCode.join('').length !== 6}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-2xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}

                {/* 2FA Code Input */}
                {step === '2fa' && (
                  <motion.div
                    key="2fa-step"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                        Two-Factor Authentication Code
                      </label>
                      <div 
                        className="flex gap-2 justify-center"
                        onPaste={(e) => handlePaste(e, false)}
                      >
                        {twoFactorCode.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => {
                              twoFactorInputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handle2FAInput(index, e.target.value)}
                            onKeyDown={(e) => handle2FAKeyDown(index, e)}
                            className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900">
                        Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code
                      </p>
                    </div>

                    {/* Error */}
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

                    {/* Verify Button */}
                    <button
                      onClick={handleVerify2FA}
                      disabled={isLoading || twoFactorCode.join('').length !== 6}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-2xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Verify & Unlock
                        </>
                      )}
                    </button>

                    {/* Back Button */}
                    <button
                      onClick={() => {
                        setStep('code');
                        setError('');
                        setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
                      }}
                      disabled={isLoading}
                      className="w-full py-3 text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-all disabled:opacity-50"
                    >
                      Back
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cancel Button */}
              <button
                onClick={onCancel}
                disabled={isLoading}
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

