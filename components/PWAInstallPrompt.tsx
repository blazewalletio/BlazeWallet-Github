'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Zap, Lock, Smartphone, HardDrive } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function PWAInstallPrompt() {
  const { showPrompt, install, dismissLater, dismissPermanently, canInstall } = usePWAInstall();
  const [timeLeft, setTimeLeft] = useState(8);
  const [shouldPulse, setShouldPulse] = useState(false);

  // Countdown timer and pulse animation
  useEffect(() => {
    if (!showPrompt) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 2) {
          setShouldPulse(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showPrompt]);

  if (!canInstall || !showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={dismissLater}
          />

          {/* Bottom Sheet - Slides up from bottom */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ 
              y: 0,
              scale: shouldPulse ? [1, 1.01, 1] : 1 
            }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring',
              damping: 30,
              stiffness: 300,
              scale: shouldPulse ? { duration: 0.3, repeat: 2 } : undefined
            }}
            className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
          >
            <div className="mx-auto max-w-lg">
              <div className="relative bg-white rounded-t-3xl shadow-soft-xl overflow-hidden">
                {/* Gradient Header */}
                <div className="relative h-20 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 overflow-hidden">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  
                  {/* Close Button */}
                  <button
                    onClick={dismissPermanently}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors group z-10"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>

                  {/* Logo */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/30 rounded-2xl blur-xl" />
                      <div className="relative w-14 h-14 rounded-2xl bg-white p-2 shadow-lg">
                        <Image 
                          src="/blaze-logo.png" 
                          alt="Blaze" 
                          width={40} 
                          height={40}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 pt-6 pb-8">
                  {/* Title */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      Installeer BLAZE Wallet
                    </h3>
                    <p className="text-sm text-gray-600">
                      Voor de snelste en beste ervaring
                    </p>
                  </div>

                  {/* Features Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-3 shadow-soft">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        Snellere toegang
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-3 shadow-soft">
                        <Lock className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        Biometric security
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-3 shadow-soft">
                        <Smartphone className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        Offline support
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-3 shadow-soft">
                        <HardDrive className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        Sync je apparaten
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={install}
                      className="w-full px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold text-base shadow-soft-lg hover:shadow-soft-xl hover:brightness-110 transition-all flex items-center justify-center gap-3"
                    >
                      <Download className="w-5 h-5" />
                      Installeer Nu
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={dismissLater}
                      className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all"
                    >
                      Later
                    </motion.button>
                  </div>

                  {/* Auto-dismiss indicator */}
                  {timeLeft > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-1.5">
                      <div className="flex gap-1.5">
                        {[...Array(8)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0 }}
                            animate={{ scale: i < timeLeft ? 1 : 0.6 }}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              i < timeLeft 
                                ? 'bg-primary-500' 
                                : 'bg-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom safe area for iOS */}
                <div className="h-safe bg-white" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
