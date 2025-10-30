'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { useEffect, useRef } from 'react';

interface ChainSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChainSelector({ isOpen, onClose }: ChainSelectorProps) {
  const { currentChain, switchChain } = useWalletStore();
  const selectedRef = useRef<HTMLButtonElement>(null);

  const handleSelectChain = (chainKey: string) => {
    // Haptic feedback on mobile
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    switchChain(chainKey);
    onClose();
  };

  // Auto-scroll to selected chain when modal opens
  useEffect(() => {
    if (isOpen && selectedRef.current) {
      setTimeout(() => {
        selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isOpen]);

  const chains = Object.entries(CHAINS);
  
  // L2 chains for badge display
  const l2Chains = ['polygon', 'arbitrum', 'base', 'optimism'];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
          
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-hidden"
          >
            <div className="glass-card rounded-t-3xl p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Select network</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="glass p-2 rounded-lg hover:bg-theme-bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Chain List - Hidden Scrollbar */}
              <div className="space-y-3 overflow-y-auto max-h-[60vh] scrollbar-hide">
                {chains.map(([key, chain]) => {
                  const isSelected = currentChain === key;
                  const isL2 = l2Chains.includes(key);
                  
                  return (
                    <motion.button
                      key={key}
                      ref={isSelected ? selectedRef : null}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectChain(key)}
                      className={`w-full p-4 rounded-xl flex items-center justify-between transition-all duration-300 ${
                        isSelected 
                          ? 'bg-gradient-to-br from-primary-500/20 to-primary-600/10 ring-2 ring-primary-500 shadow-xl shadow-primary-500/30' 
                          : 'glass hover:bg-theme-bg-secondary'
                      }`}
                    >
                      {/* Left: Logo + Info */}
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl font-bold overflow-hidden transition-all duration-300 ${
                            isSelected ? 'ring-2 ring-white/50 shadow-lg' : ''
                          }`}
                        >
                          {chain.logoUrl ? (
                            <img 
                              src={chain.logoUrl} 
                              alt={chain.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.textContent = chain.icon;
                              }}
                            />
                          ) : (
                            chain.icon
                          )}
                        </div>
                        <div className="text-left">
                          <div className={`font-semibold flex items-center gap-2 transition-colors ${
                            isSelected ? 'text-primary-300' : ''
                          }`}>
                            {chain.name}
                            {chain.isTestnet && (
                              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                                Testnet
                              </span>
                            )}
                            {isL2 && !chain.isTestnet && (
                              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                Fast
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-theme-text-secondary">{chain.nativeCurrency.symbol}</div>
                        </div>
                      </div>
                      
                      {/* Right: Check Icon (only when selected) */}
                      {isSelected && (
                        <motion.div 
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                          className="w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Bottom Tip */}
              <div className="mt-6 glass-card bg-theme-primary/10 border-theme-border/20">
                <p className="text-theme-primary text-sm">
                  💡 Use Polygon or Base for low-fee transactions
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
