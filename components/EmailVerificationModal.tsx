'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { logger } from '@/lib/logger';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailVerificationModal({ isOpen, onClose }: EmailVerificationModalProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');

  // Get email and userId from localStorage
  useState(() => {
    if (typeof window !== 'undefined') {
      setEmail(localStorage.getItem('wallet_email') || '');
      setUserId(localStorage.getItem('supabase_user_id') || '');
    }
  });

  const handleResendEmail = async () => {
    try {
      setIsResending(true);
      setResendMessage('');

      logger.log('📧 Resending verification email to:', email);

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to resend email');
      }

      setResendMessage('✅ Verification email sent! Check your inbox.');
      logger.log('✅ Verification email resent');

    } catch (error: any) {
      logger.error('❌ Resend error:', error);
      setResendMessage('❌ Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-card p-6 bg-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Verify Your Email</h2>
              </div>
              <button
                onClick={onClose} aria-label="Close modal"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Email sent message */}
              <div className="glass-card p-4 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20">
                <p className="text-gray-700 text-sm mb-2">
                  We've sent a verification link to:
                </p>
                <p className="font-semibold text-gray-900 mb-4">{email}</p>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Click the link in your email</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Return here to continue</span>
                  </div>
                </div>
              </div>

              {/* Resend button */}
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Resend verification email
                  </>
                )}
              </button>

              {/* Resend message */}
              {resendMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`glass-card p-3 text-sm ${
                    resendMessage.includes('✅')
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {resendMessage}
                </motion.div>
              )}

              {/* Help text */}
              <div className="glass-card p-4 bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-900 font-semibold mb-2">
                  Didn't receive it?
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Check your spam folder</li>
                  <li>Make sure {email} is correct</li>
                  <li>Wait a few minutes and click resend</li>
                </ul>
              </div>

              {/* Skip button */}
              <button
                onClick={onClose}
                className="w-full py-3 text-gray-600 hover:text-gray-900 text-sm font-semibold transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

