'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { POPULAR_TOKENS } from '@/lib/chains';
import { Token } from '@/lib/types';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenSelector({ isOpen, onClose }: TokenSelectorProps) {
  const { currentChain, addToken } = useWalletStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  const popularTokens = POPULAR_TOKENS[currentChain] || [];
  
  const filteredTokens = popularTokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToken = (token: Token) => {
    addToken(token);
    onClose();
  };

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
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden"
          >
            <div className="glass-card rounded-t-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Add token</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="glass p-2 rounded-lg hover:bg-theme-bg-secondary"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-text-secondary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoek token..."
                  className="input-field pl-12"
                />
              </div>

              {/* Popular Tokens */}
              <div className="space-y-3 overflow-y-auto max-h-[50vh] mb-6">
                <h3 className="text-sm font-semibold text-theme-text-secondary mb-3">Populaire tokens</h3>
                {filteredTokens.map((token) => (
                  <motion.button
                    key={token.address}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAddToken(token)}
                    className="w-full glass p-4 rounded-xl flex items-center justify-between hover:bg-theme-bg-secondary"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-lg">
                        {token.logo}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-sm text-theme-text-secondary">{token.name}</div>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-theme-text-secondary" />
                  </motion.button>
                ))}

                {filteredTokens.length === 0 && (
                  <div className="text-center py-8 text-theme-text-secondary">
                    <div className="text-3xl mb-2">🔍</div>
                    <p className="text-sm">No tokens found</p>
                  </div>
                )}
              </div>

              {/* Custom Token Address */}
              <div className="glass-card bg-theme-primary/10 border-theme-border/20">
                <p className="text-theme-primary text-xs mb-2">Custom token contract address:</p>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="0x..."
                  className="input-field text-sm font-mono"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
