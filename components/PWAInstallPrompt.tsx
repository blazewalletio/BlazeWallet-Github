'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Zap, Lock, Smartphone, HardDrive } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useEffect, useState } from 'react';

export default function PWAInstallPrompt() {
  const { showPrompt, install, dismissLater, dismissPermanently, canInstall } = usePWAInstall();
  const [timeLeft, setTimeLeft] = useState(8);

  // Countdown timer
  useEffect(() => {
    if (!showPrompt) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [showPrompt]);

  if (!canInstall || !showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ 
            type: 'spring',
            damping: 25,
            stiffness: 300
          }}
          className="fixed bottom-6 right-6 z-50 w-[320px] max-w-[calc(100vw-48px)]"
        >
          {/* Card - matching dashboard style */}
          <div className="relative bg-white rounded-2xl shadow-soft-xl border border-gray-100 overflow-hidden">
            {/* Subtle gradient top accent */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600" />

            {/* Close button */}
            <button
              onClick={dismissPermanently}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            <div className="p-4">
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Installeer BLAZE
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Voor snellere toegang
                </p>
              </div>

              {/* Compact features list */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <span className="text-xs text-gray-600">Instant toegang</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <span className="text-xs text-gray-600">Biometric unlock</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  <span className="text-xs text-gray-600">Werkt offline</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={install}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium text-sm shadow-soft hover:shadow-soft-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Installeer
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={dismissLater}
                  className="px-3 py-2 bg-gray-50 text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
                >
                  Later
                </motion.button>
              </div>

              {/* Countdown dots */}
              {timeLeft > 0 && (
                <div className="mt-3 flex justify-center gap-1">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-1 rounded-full transition-all ${
                        i < timeLeft ? 'bg-primary-400' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
