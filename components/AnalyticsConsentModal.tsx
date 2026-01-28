'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Shield, X, Check } from 'lucide-react';
import { enableAnalytics, disableAnalytics, isAnalyticsEnabled } from '@/lib/analytics-tracker';
import { logger } from '@/lib/logger';

export default function AnalyticsConsentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    // Check if user has already responded
    const responded = localStorage.getItem('analytics_consent_responded');
    const enabled = localStorage.getItem('analytics_enabled');

    if (responded === 'true') {
      setHasResponded(true);
      return;
    }

    // If no response yet, show modal after 3 seconds
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  function handleAccept() {
    enableAnalytics();
    localStorage.setItem('analytics_consent_responded', 'true');
    setHasResponded(true);
    setIsOpen(false);
    logger.log('[Analytics] User opted in');
  }

  function handleDecline() {
    disableAnalytics();
    localStorage.setItem('analytics_consent_responded', 'true');
    setHasResponded(true);
    setIsOpen(false);
    logger.log('[Analytics] User opted out');
  }

  if (hasResponded) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={handleDecline}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 bottom-4 md:left-auto md:right-4 md:bottom-4 md:w-[480px] bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl shadow-2xl border border-purple-500/30 z-[9999] overflow-hidden"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-purple-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Help BLAZE Verbeteren</h2>
                    <p className="text-sm text-purple-200 mt-1">Privacy-first analytics</p>
                  </div>
                </div>
                <button
                  onClick={handleDecline}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4 mb-6">
                <p className="text-gray-200">
                  We willen graag begrijpen hoe je BLAZE gebruikt om de app te verbeteren. 
                  We verzamelen <span className="font-semibold text-white">alleen anonieme gebruiksdata</span> en 
                  <span className="font-semibold text-white"> NOOIT</span> je wallet addresses of exacte bedragen.
                </p>

                {/* What we collect */}
                <div className="bg-black/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Wat we verzamelen:
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Aantal transacties (niet de details)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Welke functies je gebruikt (swap, send, etc.)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Algemene waarde in USD (voor analytics)</span>
                    </li>
                  </ul>
                </div>

                {/* What we DON'T collect */}
                <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    Wat we NOOIT verzamelen:
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span><span className="font-semibold">Geen</span> wallet addresses</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span><span className="font-semibold">Geen</span> exacte bedragen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span><span className="font-semibold">Geen</span> persoonlijke gegevens</span>
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-gray-400">
                  Je kunt analytics altijd uitschakelen via Settings → Privacy.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleDecline}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors"
                >
                  Nee, geen analytics
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-semibold transition-all shadow-lg"
                >
                  Ja, help BLAZE
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

