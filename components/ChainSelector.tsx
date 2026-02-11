'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
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
  const modalRef = useRef<HTMLDivElement>(null);

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

  // ✅ FIX: Prevent body scroll when modal is open (iOS Safari fix)
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Prevent body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore body scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // ✅ FIX: Prevent scroll propagation on modal content
  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return;

    const preventScrollPropagation = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const scrollContainer = target.closest('.modal-scroll-container');
      
      if (scrollContainer) {
        const isAtTop = scrollContainer.scrollTop === 0;
        const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight;
        
        // Prevent pull-to-refresh at top
        if (isAtTop && e.touches[0].clientY > e.touches[0].clientY) {
          e.preventDefault();
        }
        
        // Prevent overscroll at bottom
        if (isAtBottom && e.touches[0].clientY < e.touches[0].clientY) {
          e.preventDefault();
        }
      }
    };

    modalElement.addEventListener('touchmove', preventScrollPropagation, { passive: false });
    
    return () => {
      modalElement.removeEventListener('touchmove', preventScrollPropagation);
    };
  }, [isOpen]);

  // ✅ Sort chains by market cap (largest first)
  // Market cap ranking based on CoinMarketCap Oct 2024
  const marketCapOrder: Record<string, number> = {
    'bitcoin': 1,        // #1 - $1.3T
    'ethereum': 2,       // #2 - $400B
    'solana': 3,         // #4 - $80B
    'bsc': 4,            // #5 (BNB) - $65B
    'avalanche': 5,      // #10 - $10B
    'polygon': 6,        // #13 - $6B
    'litecoin': 7,       // #20 - $6B
    'arbitrum': 8,       // #35 - $2B
    'optimism': 9,       // #37 - $2B
    'dogecoin': 10,      // #8 - $20B (meme, but popular)
    'base': 11,          // New L2 (popular)
    'bitcoincash': 12,   // #19 - $8B
    'fantom': 13,        // ~$500M
    'cronos': 14,        // ~$2B
    'zksync': 15,        // New L2
    'linea': 16,         // New L2
    'sepolia': 99,       // Testnet - always last
    'bscTestnet': 100,   // Testnet - always last
  };
  
  const chains = Object.entries(CHAINS).sort((a, b) => {
    const orderA = marketCapOrder[a[0]] || 999;
    const orderB = marketCapOrder[b[0]] || 999;
    return orderA - orderB;
  });
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            style={{ touchAction: 'none' }} // ✅ Prevent touch events
          />
          
          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            style={{ 
              maxHeight: '85vh', // ✅ Ensure header is always visible
              touchAction: 'none' // ✅ Prevent iOS Safari scroll issues
            }}
          >
            <div className="glass-card rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
              {/* Header - Fixed at top */}
              <div className="flex-shrink-0 flex justify-between items-center px-4 pt-4 pb-3 border-b border-theme-border/10">
                <h2 className="text-2xl font-bold">Select network</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="glass p-2 rounded-lg hover:bg-theme-bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Chain List - Scrollable with proper iOS handling */}
              <div 
                className="modal-scroll-container flex-1 overflow-y-auto scrollbar-hide"
                style={{ 
                  WebkitOverflowScrolling: 'touch', // ✅ Smooth scroll on iOS
                  overscrollBehavior: 'contain' // ✅ Prevent scroll chaining
                }}
              >
                <div className="px-2 py-2 space-y-2">
                  {chains.map(([key, chain]) => {
                    const isSelected = currentChain === key;
                    
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
                            className="w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
