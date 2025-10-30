'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';

interface ChainSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChainSelector({ isOpen, onClose }: ChainSelectorProps) {
  const { currentChain, switchChain } = useWalletStore();

  const handleSelectChain = (chainKey: string) => {
    switchChain(chainKey);
    onClose();
  };

  const chains = Object.entries(CHAINS);

  // ✅ Helper: Check if chain is L2/cheap
  const isFastChain = (key: string) => {
    return ['polygon', 'arbitrum', 'base', 'optimism'].includes(key);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with stronger blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
          />
          
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden"
          >
            {/* Glass Card Container */}
            <div className="bg-gradient-to-b from-theme-bg-primary/95 to-theme-bg-secondary/95 backdrop-blur-xl rounded-t-[2rem] border-t-2 border-theme-border/30 shadow-2xl">
              {/* Header */}
              <div className="flex justify-between items-center px-6 pt-6 pb-4">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  Select network
                </h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Chains List - NO SCROLLBAR VISIBLE */}
              <div className="px-6 pb-6 overflow-y-auto max-h-[60vh] scrollbar-hide">
                <div className="space-y-3">
                  {chains.map(([key, chain], index) => {
                    const isSelected = currentChain === key;
                    const isFast = isFastChain(key);
                    
                    return (
                      <motion.button
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectChain(key)}
                        className={`
                          w-full p-4 rounded-2xl 
                          flex items-center justify-between
                          transition-all duration-300
                          ${isSelected 
                            ? 'bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 border-2 border-blue-500/50 shadow-lg shadow-blue-500/20' 
                            : 'bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:border-white/20'
                          }
                          backdrop-blur-sm
                        `}
                      >
                        {/* Left Side: Icon + Info */}
                        <div className="flex items-center gap-4">
                          {/* Chain Icon with Glow */}
                          <div
                            className={`
                              w-14 h-14 rounded-2xl 
                              flex items-center justify-center 
                              text-2xl font-bold overflow-hidden
                              transition-all duration-300
                              ${isSelected 
                                ? 'bg-white shadow-lg shadow-blue-500/30 scale-110' 
                                : 'bg-white/90'
                              }
                            `}
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
                          
                          {/* Chain Info */}
                          <div className="text-left">
                            <div className="font-bold text-lg flex items-center gap-2">
                              {chain.name}
                              {chain.isTestnet && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-semibold border border-amber-500/30">
                                  Testnet
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-white/50 font-medium">
                              {chain.nativeCurrency.symbol}
                            </div>
                          </div>
                        </div>
                        
                        {/* Right Side: Badge + Checkmark */}
                        <div className="flex items-center gap-3">
                          {/* Fast Badge for L2s */}
                          {isFast && !chain.isTestnet && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
                            >
                              <Zap className="w-3.5 h-3.5 text-green-400 fill-green-400" />
                              <span className="text-xs font-bold text-green-400">Fast</span>
                            </motion.div>
                          )}
                          
                          {/* Checkmark for Selected */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', damping: 15 }}
                              className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30"
                            >
                              <Check className="w-5 h-5 text-white stroke-[3]" />
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Tip Card */}
              <div className="px-6 pb-6">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 border border-blue-500/20 backdrop-blur-sm"
                >
                  <p className="text-sm text-blue-300 font-medium flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <span>Use Polygon or Base for low-cost transactions</span>
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
