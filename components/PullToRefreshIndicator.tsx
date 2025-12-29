'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isPulling: boolean;
  isRefreshing: boolean;
  threshold: number;
  progress: number;
}

/**
 * Pull-to-refresh loading indicator
 * Appears above the portfolio card when user pulls down
 * Matches Blaze Wallet styling with glass-card and gradient accents
 */
export default function PullToRefreshIndicator({
  pullDistance,
  isPulling,
  isRefreshing,
  threshold,
  progress,
}: PullToRefreshIndicatorProps) {
  // Only show if pulling or refreshing
  const shouldShow = isPulling || isRefreshing;
  
  // Calculate icon scale based on pull distance (0.8 to 1.2)
  const iconScale = Math.min(0.8 + (progress * 0.4), 1.2);
  
  // Calculate opacity based on pull distance
  const opacity = Math.min(progress * 1.5, 1);
  
  // Height of the indicator (max 100px)
  const indicatorHeight = Math.min(pullDistance, 100);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: indicatorHeight,
            opacity: opacity,
          }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ 
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          className="w-full overflow-hidden"
          style={{
            minHeight: shouldShow ? '40px' : '0',
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Glass card background with gradient accent */}
            <div className="absolute inset-0 glass-card bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-b-2xl" />
            
            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-2">
              {/* Refresh icon */}
              <motion.div
                animate={{
                  scale: iconScale,
                  rotate: isRefreshing ? 360 : 0,
                }}
                transition={{
                  scale: { type: 'spring', stiffness: 300, damping: 20 },
                  rotate: isRefreshing 
                    ? { duration: 1, repeat: Infinity, ease: 'linear' }
                    : { duration: 0.3 },
                }}
                className="flex items-center justify-center"
              >
                <RefreshCw 
                  className={`w-6 h-6 text-orange-600 ${isRefreshing ? '' : ''}`}
                  style={{
                    filter: isRefreshing 
                      ? 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.5))'
                      : 'none',
                  }}
                />
              </motion.div>
              
              {/* "Release to refresh" text when threshold reached */}
              {progress >= 1 && !isRefreshing && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-gray-600 font-medium"
                >
                  Release to refresh
                </motion.p>
              )}
              
              {/* "Refreshing..." text during refresh */}
              {isRefreshing && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-orange-600 font-medium"
                >
                  Refreshing...
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

