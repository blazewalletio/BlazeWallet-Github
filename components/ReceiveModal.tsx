'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Share2, ArrowDownLeft } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import QRCode from 'qrcode';
import { logger } from '@/lib/logger';
import { CHAINS } from '@/lib/chains';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiveModal({ isOpen, onClose }: ReceiveModalProps) {
  const { getCurrentAddress, currentChain } = useWalletStore();
  const displayAddress = getCurrentAddress(); // ✅ Get correct address for current chain
  const [copied, setCopied] = useState(false);
  const [qrDataURL, setQrDataURL] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Get current chain info
  const chain = CHAINS[currentChain as keyof typeof CHAINS];

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen && displayAddress) {
      generateQRCode();
    }
  }, [isOpen, displayAddress]);

  const generateQRCode = async () => {
    if (!displayAddress) return;
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(displayAddress, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrDataURL(qrCodeDataURL);
    } catch (error) {
      logger.error('Error generating QR code:', error);
    }
  };

  const copyAddress = async () => {
    if (!displayAddress) return;
    
    try {
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('Failed to copy wallet address:', error);
    }
  };

  const shareAddress = async () => {
    if (!displayAddress) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Wallet Address',
          text: displayAddress,
        });
      } catch (error) {
        logger.error('Error sharing:', error);
      }
    } else {
      copyAddress();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            ← Back
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ArrowDownLeft className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900">Receive crypto</h2>
                  <p className="text-sm text-gray-600">
                    Share your wallet address or QR code
                  </p>
                </div>
              </div>
              {/* Chain Badge */}
              {chain && (
                <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white rounded-xl border border-gray-200 shadow-sm self-start sm:self-auto">
                  {chain.logoUrl ? (
                    <img 
                      src={chain.logoUrl} 
                      alt={chain.name}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.chain-icon-fallback');
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={`text-lg sm:text-xl ${chain.logoUrl ? 'hidden' : ''} chain-icon-fallback`}>
                    {chain.icon}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-gray-900 whitespace-nowrap">
                    {chain.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            {/* QR Code Section */}
            <div className="glass-card p-8 text-center">
              <p className="text-gray-600 mb-6 text-lg">
                Scan this QR code to receive crypto
              </p>
              
              <div className="bg-white p-6 rounded-xl inline-block border border-gray-200 mb-6">
                {qrDataURL ? (
                  <img
                    src={qrDataURL}
                    alt="QR Code"
                    className="w-64 max-w-[70vw] aspect-square h-auto mx-auto object-contain"
                  />
                ) : (
                  <div className="w-64 max-w-[70vw] aspect-square h-auto mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-gray-400">Loading QR code...</div>
                  </div>
                )}
              </div>
            </div>

            {/* Address Section */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Your wallet address</h3>
                {/* Chain Badge (also shown here for better visibility) */}
                {chain && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                    {chain.logoUrl ? (
                      <img 
                        src={chain.logoUrl} 
                        alt={chain.name}
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.chain-icon-fallback-2');
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={`text-base ${chain.logoUrl ? 'hidden' : ''} chain-icon-fallback-2`}>
                      {chain.icon}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                      {chain.name}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200">
                <div className="font-mono text-sm break-all text-gray-900">
                  {displayAddress}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={copyAddress}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 min-w-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 flex-shrink-0" />
                      <span>Copy address</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={shareAddress}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 min-w-0"
                >
                  <Share2 className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">Share</span>
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="glass-card p-6 bg-orange-50 border border-orange-200">
              <div className="flex gap-4">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <p className="font-semibold text-gray-900 mb-2">Important</p>
                  <p>Only send crypto from the same network as your wallet. Sending from a different network may result in permanent loss of funds.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
