'use client';

import { useState, useEffect } from 'react';
import { Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { debugLogger } from '@/lib/debug-logger';

/**
 * Debug Indicator
 * Shows a small floating icon that indicates debug logging is active
 * User can see their session ID for manual log queries
 */
export default function DebugIndicator() {
  const [showPanel, setShowPanel] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    // Get session ID
    setSessionId(debugLogger.getSessionId());

    // Pulse animation on mount (indicates logging is active)
    setIsPulsing(true);
    const timer = setTimeout(() => setIsPulsing(false), 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Floating debug icon */}
      <motion.button
        onClick={() => setShowPanel(true)}
        className={`fixed bottom-20 right-4 z-[9999] bg-gradient-to-br from-blue-500 to-purple-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all ${
          isPulsing ? 'animate-pulse' : ''
        }`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Activity size={20} />
      </motion.button>

      {/* Debug info panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                    <Activity size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Debug Logging Active</h3>
                    <p className="text-gray-400 text-sm">Remote debugging enabled</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Session ID */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <p className="text-gray-400 text-xs mb-2">Session ID:</p>
                <code className="text-blue-400 text-xs font-mono break-all">{sessionId}</code>
              </div>

              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0 animate-pulse" />
                  <p className="text-gray-300 text-sm">
                    All debug logs are being sent to Supabase
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0 animate-pulse" />
                  <p className="text-gray-300 text-sm">
                    Device verification steps are being tracked
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0 animate-pulse" />
                  <p className="text-gray-300 text-sm">
                    localStorage operations are being monitored
                  </p>
                </div>
              </div>

              {/* Logs visible info */}
              <div className="mt-6 pt-4 border-t border-gray-800">
                <p className="text-gray-400 text-xs text-center">
                  Logs are visible in Supabase <code className="text-blue-400">debug_logs</code> table
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

