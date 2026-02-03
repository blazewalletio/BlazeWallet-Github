/**
 * 🔐 2FA SESSION STATUS COMPONENT
 * Shows current 2FA session status and expiry warning
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, RefreshCw } from 'lucide-react';
import { twoFactorSessionService } from '@/lib/2fa-session-service';
import { logger } from '@/lib/logger';

interface SessionStatusBadgeProps {
  userId: string | null;
  className?: string;
}

export default function SessionStatusBadge({ userId, className = '' }: SessionStatusBadgeProps) {
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const checkSession = async () => {
      const status = await twoFactorSessionService.checkSession(userId);
      setSessionStatus(status);

      // Show warning if session expires in less than 5 minutes
      if (!status.required && status.isNearExpiry) {
        setShowExpiryWarning(true);
      } else {
        setShowExpiryWarning(false);
      }
    };

    // Check immediately
    checkSession();

    // Check every 30 seconds
    const interval = setInterval(checkSession, 30000);

    return () => clearInterval(interval);
  }, [userId]);

  const handleExtendSession = async () => {
    if (!userId) return;

    const result = await twoFactorSessionService.extendSession(userId);
    if (result.success) {
      logger.log('✅ Session extended');
      // Refresh status
      const status = await twoFactorSessionService.checkSession(userId);
      setSessionStatus(status);
      setShowExpiryWarning(false);
    }
  };

  // Don't show if no userId or no active session
  if (!userId || !sessionStatus || sessionStatus.required) {
    return null;
  }

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Session Badge */}
      <div className={`flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg ${className}`}>
        <Shield className="w-4 h-4 text-green-600" />
        <span className="text-xs font-medium text-green-800">
          Secure session active
        </span>
        {sessionStatus.secondsRemaining && (
          <span className="text-xs text-green-600">
            ({formatTimeRemaining(sessionStatus.secondsRemaining)})
          </span>
        )}
      </div>

      {/* Expiry Warning */}
      <AnimatePresence>
        {showExpiryWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 max-w-sm"
          >
            <div className="glass-card p-4 border border-orange-200 bg-orange-50 shadow-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900 mb-1">
                    Session Expiring Soon
                  </h4>
                  <p className="text-sm text-orange-800 mb-3">
                    {twoFactorSessionService.getExpiryWarningMessage(
                      sessionStatus.secondsRemaining || 0
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExtendSession}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Extend Session
                    </button>
                    <button
                      onClick={() => setShowExpiryWarning(false)}
                      className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

