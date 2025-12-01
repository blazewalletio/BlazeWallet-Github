'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { CreditCard, Banknote, ShieldCheck, Flame, ExternalLink, Loader2, X } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { CHAINS } from '@/lib/chains';
import { OnramperService } from '@/lib/onramper-service';
import { logger } from '@/lib/logger';

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BuyModal({ isOpen, onClose }: BuyModalProps) {
  const { address, currentChain, solanaAddress, bitcoinAddress } = useWalletStore();
  const chain = CHAINS[currentChain];
  const supportedAssets = OnramperService.getSupportedAssets(chain.id);
  
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

  // Load widget URL when modal opens
  useEffect(() => {
    if (isOpen && address) {
      // Load widget with default crypto for current chain
      const defaultCrypto = OnramperService.getDefaultCrypto(chain.id);
      loadWidget(defaultCrypto);
    } else {
      // Reset state when modal closes
      setWidgetUrl(null);
      setError(null);
      setSelectedAsset(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, address, currentChain]);

  const loadWidget = async (currencyCode?: string) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedAsset(currencyCode || null);

    try {
      logger.log('🔥 BUY MODAL: Starting Onramper integration...');
      logger.log('Wallet Address:', address);
      logger.log('Chain ID:', chain.id);
      logger.log('Currency Code:', currencyCode);
      
      // 🔒 SECURITY: Use server-side endpoint to hide API key
      const response = await fetch('/api/onramper/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          defaultCryptoCurrency: currencyCode || OnramperService.getDefaultCrypto(chain.id),
          defaultFiatCurrency: 'EUR',
          chainId: chain.id,
          solanaAddress: solanaAddress || undefined,
          bitcoinAddress: bitcoinAddress || undefined,
          theme: 'light',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize Onramper');
      }

      const { widgetUrl: url } = await response.json();
      setWidgetUrl(url);
      logger.log('✅ BUY MODAL SUCCESS: Onramper widget URL loaded');
    } catch (error) {
      logger.error('❌ BUY MODAL ERROR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      if (errorMessage.includes('not configured')) {
        toast.error('Onramper is not configured. Please add ONRAMPER_API_KEY to environment variables.');
      } else {
        toast.error(`Failed to load Onramper: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetSelect = (currencyCode: string) => {
    loadWidget(currencyCode);
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
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Buy crypto</h2>
                <p className="text-sm text-gray-600">
                  With iDEAL, credit card or bank transfer
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          {!address ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 mb-6">Please connect your wallet to buy crypto</p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
              >
                Go Back
              </button>
            </div>
          ) : error && !widgetUrl ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Error Loading Widget</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => loadWidget()}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : isLoading ? (
            <div className="glass-card p-12 text-center min-h-[600px] flex items-center justify-center">
              <div>
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading Onramper widget...</p>
              </div>
            </div>
          ) : widgetUrl ? (
            <div className="space-y-6">
              {/* Popular Assets Selector */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular crypto</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {supportedAssets.slice(0, 6).map((currencyCode) => {
                    const displayName = OnramperService.getDisplayName(currencyCode);
                    const isSelected = selectedAsset === currencyCode;
                    return (
                      <button
                        key={currencyCode}
                        onClick={() => handleAssetSelect(currencyCode)}
                        className={`p-4 rounded-xl text-left border-2 transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-orange-500 to-yellow-500 border-orange-500 text-white'
                            : 'bg-gray-50 border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white'
                          }`}>
                            {displayName.charAt(0)}
                          </div>
                          <div>
                            <p className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                              {displayName}
                            </p>
                            <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                              {isSelected ? 'Selected' : 'Buy now'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Methods Info */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment methods</h3>
                <div className="flex flex-wrap gap-3">
                  {OnramperService.getSupportedPaymentMethods().map((method) => (
                    <div
                      key={method}
                      className="px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 border border-gray-200"
                    >
                      {method === 'iDEAL' && <Banknote className="w-4 h-4 inline mr-2" />}
                      {method === 'Credit Card' && <CreditCard className="w-4 h-4 inline mr-2" />}
                      {method}
                    </div>
                  ))}
                </div>
              </div>

              {/* Onramper Widget iFrame */}
              <div className="glass-card p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">Buy Crypto with Onramper</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative" style={{ minHeight: '630px' }}>
                  <iframe
                    src={widgetUrl}
                    title="Onramper Widget"
                    className="w-full border-0"
                    style={{ height: '630px', minHeight: '630px' }}
                    allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center min-h-[600px] flex items-center justify-center">
              <div>
                <Flame className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <p className="text-gray-600">Click on a crypto to start buying</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}




