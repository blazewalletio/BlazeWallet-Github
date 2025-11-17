'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onSuccess: () => void;
}

export default function ChangeEmailModal({
  isOpen,
  onClose,
  currentEmail,
  onSuccess
}: ChangeEmailModalProps) {
  const [step, setStep] = useState<'password' | 'newEmail' | 'verification'>('password');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handlePasswordVerification = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Verify password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: password
      });

      if (signInError) {
        setError('Incorrect password');
        setIsLoading(false);
        return;
      }

      setStep('newEmail');
    } catch (err: any) {
      logger.error('Password verification error:', err);
      setError('Failed to verify password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail) {
      setError('Please enter a new email address');
      return;
    }

    if (!validateEmail(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError('New email must be different from current email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update email in Supabase Auth (this will send a verification email)
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (updateError) throw updateError;

      // Log activity
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'email_change',
        p_description: `Email change requested to ${newEmail}`,
        p_metadata: JSON.stringify({ 
          old_email: currentEmail,
          new_email: newEmail,
          timestamp: new Date().toISOString()
        })
      });

      setVerificationSent(true);
      setStep('verification');
    } catch (err: any) {
      logger.error('Email change error:', err);
      if (err.message.includes('already registered')) {
        setError('This email is already in use');
      } else {
        setError('Failed to change email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setNewEmail('');
    setError('');
    setStep('password');
    setVerificationSent(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
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
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Change Email</h2>
                <p className="text-xs text-gray-600">
                  {step === 'password' && 'Verify your identity'}
                  {step === 'newEmail' && 'Enter new email address'}
                  {step === 'verification' && 'Verification email sent'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Password Verification */}
            {step === 'password' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    For security reasons, please verify your password before changing your email
                    address.
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    disabled
                    className="w-full p-3 border-2 border-gray-200 bg-gray-50 rounded-xl text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerification()}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: New Email */}
            {step === 'newEmail' && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm text-green-700">Password verified successfully!</div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    disabled
                    className="w-full p-3 border-2 border-gray-200 bg-gray-50 rounded-xl text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailChange()}
                  />
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Note:</strong> You will need to verify your new email address before the
                  change takes effect.
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Verification Sent */}
            {step === 'verification' && (
              <div className="space-y-4 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Verification Email Sent!
                  </h3>
                  <p className="text-gray-600">
                    We've sent a verification email to:
                  </p>
                  <p className="font-semibold text-blue-600 mt-1">{newEmail}</p>
                </div>

                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-left">
                  <div className="text-sm text-blue-700 space-y-2">
                    <p className="font-semibold">Next steps:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Check your inbox at {newEmail}</li>
                      <li>Click the verification link in the email</li>
                      <li>Your email will be updated automatically</li>
                    </ol>
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Important:</strong> Your current email ({currentEmail}) will remain active
                  until you verify the new one.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 flex gap-3">
            {step === 'verification' ? (
              <button
                onClick={() => {
                  handleClose();
                  onSuccess();
                }}
                className="w-full p-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={handleClose}
                  className="flex-1 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                {step === 'password' && (
                  <button
                    onClick={handlePasswordVerification}
                    disabled={isLoading || !password}
                    className="flex-1 p-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Password'
                    )}
                  </button>
                )}
                {step === 'newEmail' && (
                  <button
                    onClick={handleEmailChange}
                    disabled={isLoading || !newEmail}
                    className="flex-1 p-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Change Email'
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

