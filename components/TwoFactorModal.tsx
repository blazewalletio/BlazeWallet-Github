'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Smartphone, Key, Check, AlertTriangle, Loader2, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  onSuccess: () => void;
}

type Step = 'info' | 'setup' | 'verify' | 'backup_codes' | 'disable';

export default function TwoFactorModal({ isOpen, onClose, isEnabled, onSuccess }: TwoFactorModalProps) {
  const [step, setStep] = useState<Step>(isEnabled ? 'disable' : 'info');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await fetch('/api/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          action: 'setup'
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to setup 2FA');
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('setup');
    } catch (err: any) {
      logger.error('2FA setup error:', err);
      setError(err.message || 'Failed to setup 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await fetch('/api/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          action: 'verify',
          token: verificationCode
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Store backup codes
      if (data.backupCodes) {
        setBackupCodes(data.backupCodes);
        setStep('backup_codes');
      } else {
        // Old flow without backup codes
        setStep('verify');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      logger.error('2FA verification error:', err);
      setError(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code to confirm');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await fetch('/api/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          action: 'disable',
          token: verificationCode
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Invalid verification code');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('2FA disable error:', err);
      setError(err.message || 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleClose = () => {
    setStep(isEnabled ? 'disable' : 'info');
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gray-50"
        onClick={(e) => {
          // Only close if clicking directly on the overlay (not on content)
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute inset-0 bg-gray-50 overflow-y-auto"
        >
          {/* Header - Sticky */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shadow-sm z-10">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Two-Factor Authentication</h2>
              <p className="text-xs text-gray-600">Extra layer of security</p>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-2xl mx-auto p-6">
            {/* INFO STEP */}
            {step === 'info' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">What is 2FA?</h3>
                      <p className="text-sm text-blue-800">
                        Two-Factor Authentication adds an extra layer of security by requiring a code from your phone in addition to your password.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">How it works:</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-orange-600">1</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Download an authenticator app (Google Authenticator, Authy, etc.)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-orange-600">2</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Scan the QR code we provide</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-orange-600">3</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Enter the 6-digit code to verify</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSetup}
                  disabled={isLoading}
                  className="w-full p-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-5 h-5" />
                      Enable 2FA
                    </>
                  )}
                </button>
              </div>
            )}

            {/* SETUP STEP */}
            {step === 'setup' && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-yellow-900 mb-1">Important!</h3>
                      <p className="text-sm text-yellow-800">
                        Save your secret key in a safe place. You'll need it to recover access if you lose your phone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">1. Scan QR Code</h3>
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 flex justify-center">
                    {qrCode ? (
                      <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">2. Or enter this key manually</h3>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-gray-100 rounded-lg font-mono text-sm text-gray-900 break-all">
                      {secret}
                    </code>
                    <button
                      onClick={handleCopySecret}
                      className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {copiedSecret ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">3. Enter verification code</h3>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                      setError('');
                    }}
                    placeholder="000000"
                    className="w-full p-4 text-center text-2xl font-mono bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('info')}
                    className="flex-1 p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={isLoading || verificationCode.length !== 6}
                    className="flex-1 p-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Key className="w-5 h-5" />
                        Verify & Enable
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* BACKUP CODES STEP */}
            {step === 'backup_codes' && (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-1">Save Your 8 Backup Codes</h3>
                      <p className="text-sm text-orange-800">
                        These 8 codes can be used to access your account if you lose your authenticator app. 
                        Each code can only be used once. Store them securely!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="bg-white px-3 py-2 rounded border border-gray-200 text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const codesText = backupCodes.join('\n');
                    navigator.clipboard.writeText(codesText);
                    setCopiedBackupCodes(true);
                    setTimeout(() => setCopiedBackupCodes(false), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl transition-colors"
                >
                  {copiedBackupCodes ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy All Codes
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-yellow-600 transition-all"
                >
                  I've Saved My Backup Codes
                </button>

                <p className="text-xs text-center text-gray-500">
                  ⚠️ You won't be able to see these codes again. Make sure to save them!
                </p>
              </div>
            )}

            {/* VERIFY SUCCESS STEP */}
            {step === 'verify' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">2FA Enabled!</h3>
                <p className="text-gray-600">
                  Your account is now protected with two-factor authentication
                </p>
              </div>
            )}

            {/* DISABLE STEP */}
            {step === 'disable' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 mb-1">Disable 2FA</h3>
                      <p className="text-sm text-red-800">
                        This will remove the extra layer of security from your account. Are you sure?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Enter verification code to confirm</h3>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                      setError('');
                    }}
                    placeholder="000000"
                    className="w-full p-4 text-center text-2xl font-mono bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisable}
                    disabled={isLoading || verificationCode.length !== 6}
                    className="flex-1 p-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Disabling...
                      </>
                    ) : (
                      'Disable 2FA'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

