'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({
  isOpen,
  onClose
}: DeleteAccountModalProps) {
  const [step, setStep] = useState<'confirm' | 'password' | 'final'>('confirm');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordVerification = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not authenticated');

      // Verify password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });

      if (signInError) {
        setError('Incorrect password');
        setIsLoading(false);
        return;
      }

      setStep('final');
    } catch (err: any) {
      logger.error('Password verification error:', err);
      setError('Failed to verify password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Log final activity
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'account_deleted',
        p_description: 'Account deletion initiated',
        p_metadata: JSON.stringify({ timestamp: new Date().toISOString() })
      });

      // Delete user data from all tables (RLS will handle permissions)
      await Promise.all([
        supabase.from('user_profiles').delete().eq('user_id', user.id),
        supabase.from('user_activity_log').delete().eq('user_id', user.id),
        supabase.from('trusted_devices').delete().eq('user_id', user.id),
        supabase.from('user_security_scores').delete().eq('user_id', user.id),
        supabase.from('user_transaction_stats').delete().eq('user_id', user.id)
      ]);

      // Delete all local data
      localStorage.clear();
      sessionStorage.clear();

      // Sign out (this will also delete the auth user via database trigger if set up)
      await supabase.auth.signOut();

      // Show success message and redirect
      alert('Your account has been permanently deleted.');
      window.location.href = '/';
    } catch (err: any) {
      logger.error('Account deletion error:', err);
      setError('Failed to delete account. Please contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
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
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Delete Account</h2>
                <p className="text-xs text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Warning Banner */}
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <div className="font-bold mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  PERMANENT ACTION
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li>All your wallet data will be deleted</li>
                  <li>Transaction history will be lost</li>
                  <li>This action CANNOT be reversed</li>
                  <li>Make sure to backup your seed phrase</li>
                </ul>
              </div>
            </div>

            {/* Step 1: Initial Confirmation */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="text-gray-700">
                  Are you absolutely sure you want to delete your account? This will permanently
                  delete all your data including:
                </div>
                <ul className="list-disc list-inside space-y-2 text-gray-600 text-sm">
                  <li>Profile information and settings</li>
                  <li>Activity logs and security history</li>
                  <li>Trusted devices</li>
                  <li>Transaction statistics</li>
                </ul>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Important:</strong> Export your wallet and save your seed phrase before
                  deleting your account!
                </div>
              </div>
            )}

            {/* Step 2: Password Verification */}
            {step === 'password' && (
              <div className="space-y-4">
                <div className="text-gray-700">
                  Please enter your password to continue:
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerification()}
                />
                {error && (
                  <div className="text-sm text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Final Confirmation */}
            {step === 'final' && (
              <div className="space-y-4">
                <div className="text-gray-700 font-semibold">
                  This is your last chance. Type <span className="text-red-600">DELETE</span> to
                  permanently delete your account:
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
                />
                {error && (
                  <div className="text-sm text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            {step === 'confirm' && (
              <button
                onClick={() => setStep('password')}
                className="flex-1 p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all"
              >
                Continue
              </button>
            )}
            {step === 'password' && (
              <button
                onClick={handlePasswordVerification}
                disabled={isLoading || !password}
                className="flex-1 p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Verifying...' : 'Verify Password'}
              </button>
            )}
            {step === 'final' && (
              <button
                onClick={handleDeleteAccount}
                disabled={isLoading || confirmText !== 'DELETE'}
                className="flex-1 p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Deleting...' : 'Delete Account Forever'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

