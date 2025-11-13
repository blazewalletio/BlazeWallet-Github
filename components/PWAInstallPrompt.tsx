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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={dismissLater}
          />

          {/* Prompt Card */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: shouldPulse ? [1, 1.02, 1] : 1 
            }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 300,
              scale: shouldPulse ? { duration: 0.3, repeat: 2 } : undefined
            }}
            className="fixed bottom-6 right-6 z-50 w-[340px] max-w-[calc(100vw-48px)]"
          >
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-soft-xl overflow-hidden">
              {/* Gradient Top Border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600" />

              {/* Close Button */}
              <button
                onClick={dismissPermanently}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </button>

              {/* Content */}
              <div className="p-4 pt-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  {/* Blaze Logo with Gradient Border */}
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl blur-sm opacity-20" />
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-0.5">
                      <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                        <Image 
                          src="/blaze-logo.png" 
                          alt="Blaze" 
                          width={24} 
                          height={24}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 mb-0.5">
                      Installeer BLAZE Wallet
                    </h3>
                    <p className="text-xs text-gray-600">
                      Voor de beste ervaring
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-xs text-gray-700 font-medium">
                      Snellere toegang
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-xs text-gray-700 font-medium">
                      Biometric security
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-xs text-gray-700 font-medium">
                      Offline functionaliteit
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                      <HardDrive className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-xs text-gray-700 font-medium">
                      Desktop synchronisatie
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={install}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold text-sm shadow-soft hover:shadow-soft-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Installeer Nu
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={dismissLater}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm border border-gray-200 hover:bg-gray-200 transition-all"
                  >
                    Later
                  </motion.button>
                </div>

                {/* Auto-dismiss indicator */}
                {timeLeft > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <div className="flex gap-1">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-1 rounded-full transition-all duration-300 ${
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
