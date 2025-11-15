'use client';

import { useState, useEffect } from 'react';
import { X, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@/lib/logger';

interface EmailVerificationBannerProps {
  onOpenModal: () => void;
}

export default function EmailVerificationBanner({ onOpenModal }: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if user has email account
    const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
    const emailVerified = localStorage.getItem('email_verified') === 'true';
    const userEmail = localStorage.getItem('wallet_email') || '';
    const dismissed = sessionStorage.getItem('verification_banner_dismissed') === 'true';

    // Show banner if:
    // - Email account
    // - Not verified
    // - Not dismissed in this session
    if (createdWithEmail && !emailVerified && !dismissed && userEmail) {
      setEmail(userEmail);
      setIsVisible(true);
      logger.log('📧 Showing email verification banner');
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('verification_banner_dismissed', 'true');
    logger.log('📧 Verification banner dismissed');
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <div className="glass-card p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-2 border-orange-500/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm">
                  🔔 Verify your email to unlock advanced features
                </h3>
                <p className="text-xs text-gray-600 truncate">
                  {email} · Click to verify →
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onOpenModal}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
              >
                Verify
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

