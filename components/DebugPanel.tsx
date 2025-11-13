'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X, Copy, Check, ExternalLink } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { BlockchainService } from '@/lib/blockchain';
import { logger } from '@/lib/logger';

export default function DebugPanel({ externalOpen = false, onExternalClose }: { externalOpen?: boolean; onExternalClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualBalance, setManualBalance] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const { address, balance, currentChain } = useWalletStore();

  // Sync with external open state (from Settings)
  useEffect(() => {
    if (externalOpen) {
      setIsOpen(true);
    }
  }, [externalOpen]);

  const handleClose = () => {
    setIsOpen(false);
    if (onExternalClose) {
      onExternalClose();
    }
  };

  // Detect if running as PWA
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsPWA(isStandalone);
    }
  }, []);

  const chain = CHAINS[currentChain];
  const blockchain = new BlockchainService(currentChain as any);

  const checkBalanceManually = async () => {
    if (!address) return;
    setIsChecking(true);
    try {
      const bal = await blockchain.getBalance(address);
      setManualBalance(bal);
    } catch (error: any) {
      setManualBalance(`Error: ${error.message}`);
    }
    setIsChecking(false);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const explorerUrl = address ? `${chain.explorerUrl}/address/${address}` : '';

  if (!isOpen) {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`hidden lg:block fixed ${isPWA ? 'bottom-32' : 'bottom-24'} left-4 z-50 glass-card p-3 rounded-full shadow-lg hover:bg-white/10`}
        title="Debug Panel"
      >
        <Bug className="w-5 h-5 text-primary-400" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className={`fixed ${isPWA ? 'bottom-32' : 'bottom-24'} left-4 z-50 glass-card p-4 rounded-2xl shadow-2xl w-[90vw] max-w-md max-h-[80vh] overflow-y-auto`}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary-400" />
            <h3 className="font-bold">Debug Info</h3>
          </div>
          <button
            onClick={handleClose}
            className="glass p-2 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {/* Current Network */}
          <div className="glass p-3 rounded-lg">
            <div className="text-slate-400 text-xs mb-1">Network</div>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm overflow-hidden"
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
              <div>
                <div className="font-semibold">{chain.name}</div>
                <div className="text-xs text-slate-400">Chain ID: {chain.id}</div>
              </div>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="glass p-3 rounded-lg">
            <div className="text-slate-400 text-xs mb-1">Your address</div>
            <div className="font-mono text-xs break-all mb-2">{address}</div>
            <div className="flex gap-2">
              <button
                onClick={copyAddress}
                className="flex-1 btn-secondary py-1 text-xs flex items-center justify-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-secondary py-1 text-xs flex items-center justify-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Explorer
              </a>
            </div>
          </div>

          {/* Current Balance */}
          <div className="glass p-3 rounded-lg">
            <div className="text-slate-400 text-xs mb-1">Balance in app</div>
            <div className="text-xl font-bold">
              {balance} {chain.nativeCurrency.symbol}
            </div>
          </div>

          {/* Manual Check */}
          <div className="glass p-3 rounded-lg">
            <div className="text-slate-400 text-xs mb-2">Manual blockchain check</div>
            <button
              onClick={checkBalanceManually}
              disabled={isChecking}
              className="w-full btn-primary py-2 text-xs mb-2 disabled:opacity-50"
            >
              {isChecking ? 'Checking...' : 'Check Balance Now'}
            </button>
            {manualBalance && (
              <div className="text-xs">
                <div className="text-slate-400">Result:</div>
                <div className="font-mono font-bold text-primary-400">
                  {manualBalance} {!manualBalance.includes('Error') && chain.nativeCurrency.symbol}
                </div>
              </div>
            )}
          </div>

          {/* RPC Endpoint */}
          <div className="glass p-3 rounded-lg">
            <div className="text-slate-400 text-xs mb-1">RPC Endpoint</div>
            <div className="font-mono text-xs break-all text-slate-300">
              {chain.rpcUrl}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="glass-card bg-blue-500/10 border-blue-500/20 p-3">
            <div className="font-semibold text-blue-700 text-xs mb-2">💡 Troubleshooting</div>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Balance 0? Check if you're on the right network</li>
              <li>• Click "Check Balance Now" to force refresh</li>
              <li>• Click "Explorer" to see on blockchain</li>
              <li>• Transaction taking long? Wait 15-30 seconds</li>
            </ul>
          </div>

          {/* Quick Network Switch */}
          <div className="glass p-3 rounded-lg">
            <div className="text-slate-400 text-xs mb-2">Sent to wrong network?</div>
            <div className="text-xs text-slate-300 mb-2">
              Click your address above to switch networks
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
