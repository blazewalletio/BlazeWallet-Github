'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, ArrowRight, Flame } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { RampService } from '@/lib/ramp-service';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';
import { RampInstantSDK } from '@ramp-network/ramp-instant-sdk';

interface BuyModal2Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function BuyModal2({ isOpen, onClose }: BuyModal2Props) {
  useBlockBodyScroll(isOpen);
  const { currentChain, getCurrentAddress } = useWalletStore();

  // State management
  const [step, setStep] = useState<'select' | 'widget' | 'processing' | 'success' | 'error'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  
  // Form state
  const [fiatAmount, setFiatAmount] = useState('100');
  const [fiatCurrency, setFiatCurrency] = useState('EUR');
  const [cryptoAsset, setCryptoAsset] = useState<string>('');
  
  // Ramp SDK instance
  const rampInstanceRef = useRef<RampInstantSDK | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Supported fiat currencies
  const supportedFiats = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'NOK', 'SEK', 'DKK'];

  // Initialize default crypto based on current chain
  useEffect(() => {
    if (isOpen && currentChain) {
      const chain = CHAINS[currentChain];
      if (chain) {
        const defaultAsset = RampService.getDefaultAsset(chain.id);
        setCryptoAsset(defaultAsset);
      }
    }
  }, [isOpen, currentChain]);

  // Initialize Ramp SDK when widget should be shown
  useEffect(() => {
    // Only initialize when we're in widget step and widget should be shown
    if (step !== 'widget' || !showWidget || !containerRef.current || rampInstanceRef.current) {
      return;
    }

    let isMounted = true;

    const initializeRamp = async () => {
      const walletAddress = getCurrentAddress();
      if (!walletAddress) {
        if (isMounted) {
          toast.error('Wallet address not found');
          setStep('select');
        }
        return;
      }

      const chain = CHAINS[currentChain];
      if (!chain) {
        if (isMounted) {
          toast.error('Chain not found');
          setStep('select');
        }
        return;
      }

      // Fetch Ramp API key from API route
      let hostApiKey = '';
      try {
        const configResponse = await fetch('/api/ramp/config');
        if (!configResponse.ok) {
          throw new Error(`HTTP ${configResponse.status}`);
        }
        const configData = await configResponse.json();
        if (configData.success && configData.config?.hostApiKey) {
          hostApiKey = configData.config.hostApiKey;
        } else {
          // API key not configured - show user-friendly message
          if (isMounted) {
            logger.warn('Ramp API key not found in config response');
            toast.error('Ramp Network is not configured. Please contact support.');
            setStep('select');
          }
          return;
        }
      } catch (err: any) {
        logger.error('Failed to fetch Ramp config:', err);
        // Fallback to env var (for development)
        hostApiKey = process.env.NEXT_PUBLIC_RAMP_API_KEY || '';
        
        if (!hostApiKey) {
          if (isMounted) {
            toast.error('Ramp Network is not configured. Please contact support.');
            setStep('select');
          }
          return;
        }
      }

      if (!isMounted || !containerRef.current) return;

      try {
        // Determine variant based on screen size
        const isMobile = window.innerWidth < 768;
        const variant = isMobile ? 'embedded-mobile' : 'embedded-desktop';

        // Create Ramp SDK instance
        const rampInstance = new RampInstantSDK({
          hostAppName: 'Blaze Wallet',
          hostLogoUrl: 'https://my.blazewallet.io/logo.png',
          hostApiKey: hostApiKey,
          variant: variant,
          containerNode: containerRef.current,
          userAddress: walletAddress,
          swapAsset: cryptoAsset || RampService.getDefaultAsset(chain.id),
          swapAmount: fiatAmount ? (parseFloat(fiatAmount) * 100).toString() : undefined,
          enabledFlows: ['ONRAMP'],
        });

        // Set up event listeners
        rampInstance.on('*', (event: any) => {
          if (!isMounted) return;
          
          logger.log('Ramp event:', event);
          
          // Handle purchase created
          if (event.type === 'PURCHASE_CREATED') {
            logger.log('Purchase created:', event);
            setStep('processing');
          }

          // Handle purchase success
          if (event.type === 'PURCHASE_SUCCESSFUL') {
            logger.log('Purchase successful:', event);
            setStep('success');
            setShowWidget(false);
            toast.success('Payment completed! Your crypto will arrive shortly.');
          }

          // Handle purchase failed
          if (event.type === 'PURCHASE_FAILED') {
            logger.error('Purchase failed:', event);
            setError(event.payload?.message || 'Payment failed');
            setStep('error');
            setShowWidget(false);
          }

          // Handle widget close
          if (event.type === 'WIDGET_CLOSE') {
            logger.log('Widget closed');
            setShowWidget(false);
            setStep('select');
          }
        });

        // Show the widget
        rampInstance.show();
        rampInstanceRef.current = rampInstance;

        logger.log('✅ Ramp SDK initialized and shown');
      } catch (err: any) {
        if (!isMounted) return;
        
        logger.error('Failed to initialize Ramp SDK:', err);
        toast.error('Failed to initialize payment widget. Please try again.');
        setError(err.message || 'Failed to initialize widget');
        setStep('error');
        setShowWidget(false);
      }
    };

    initializeRamp();

    // Cleanup function
    return () => {
      isMounted = false;
      if (rampInstanceRef.current && !showWidget) {
        try {
          rampInstanceRef.current = null;
        } catch (err) {
          logger.error('Error cleaning up Ramp SDK:', err);
        }
      }
    };
  }, [step, showWidget, currentChain, cryptoAsset, fiatAmount]); // Removed fiatCurrency and getCurrentAddress from dependencies

  const handleContinue = async () => {
    const walletAddress = getCurrentAddress();
    if (!walletAddress) {
      toast.error('Wallet address not found');
      return;
    }

    if (!fiatAmount || parseFloat(fiatAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!cryptoAsset) {
      toast.error('Please select a cryptocurrency');
      return;
    }

    // Show the embedded widget
    setShowWidget(true);
    setStep('widget');
  };

  const quickAmounts = ['50', '100', '250', '500'];
  const chain = CHAINS[currentChain];
  const supportedAssets = chain ? RampService.getSupportedAssets(chain.id) : [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            {/* Header */}
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Buy crypto (Ramp)</h2>
                  <p className="text-sm text-gray-600">
                    Purchase crypto with credit card, bank transfer or Apple Pay via Ramp Network
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            {step === 'select' && (
              <div className="glass-card p-6 space-y-6">
                {/* Amount Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Spend
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={fiatAmount}
                        onChange={(e) => setFiatAmount(e.target.value)}
                        placeholder="0.00"
                        className="input-field font-mono text-sm"
                        min="10"
                        step="0.01"
                      />
                    </div>
                    <select
                      value={fiatCurrency}
                      onChange={(e) => setFiatCurrency(e.target.value)}
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {supportedFiats.map((fiat) => (
                        <option key={fiat} value={fiat}>{fiat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setFiatAmount(amount)}
                        className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {fiatCurrency} {amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crypto Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cryptocurrency
                  </label>
                  <select
                    value={cryptoAsset}
                    onChange={(e) => setCryptoAsset(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select cryptocurrency</option>
                    {supportedAssets.map((asset) => {
                      const [symbol, chain] = asset.split('_');
                      return (
                        <option key={asset} value={asset}>
                          {symbol} ({chain})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 text-blue-500 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-900 font-medium mb-1">Powered by Ramp Network</p>
                      <p className="text-xs text-blue-700">
                        Low fees (1.99% - 3.9%), instant delivery, and support for 150+ countries. 
                        Your crypto will be sent directly to your wallet address.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Continue Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinue}
                  disabled={loading || !fiatAmount || !cryptoAsset || parseFloat(fiatAmount) <= 0}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue with Ramp</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* Ramp Network Embedded Widget */}
            {step === 'widget' && showWidget && (
              <div className="glass-card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Complete Payment</h3>
                    <p className="text-sm text-gray-600">Complete your purchase securely with Ramp Network</p>
                  </div>
                  <button
                    onClick={() => {
                      if (rampInstanceRef.current) {
                        try {
                          // Ramp SDK doesn't have unmount, just clear the reference
                          rampInstanceRef.current = null;
                        } catch (err) {
                          logger.error('Error cleaning up Ramp SDK:', err);
                        }
                      }
                      setShowWidget(false);
                      setStep('select');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {/* 
                  Ramp Network Embedded Widget Container
                  - Fully embedded within our UI (no popups!)
                  - Apple Pay/Google Pay works perfectly
                  - 100% within Blaze UI/UX
                  - Embedded variant keeps everything in our modal
                */}
                <div 
                  ref={containerRef}
                  className="w-full min-h-[600px]"
                  id="ramp-widget-container"
                />
              </div>
            )}

            {step === 'processing' && (
              <div className="glass-card p-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Payment</h3>
                <p className="text-gray-600">
                  Please complete your payment. We'll update you when the transaction is confirmed.
                </p>
              </div>
            )}

            {step === 'success' && (
              <div className="glass-card p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600 mb-6">
                  Your cryptocurrency will arrive in your wallet shortly.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="glass-card p-12 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Failed</h3>
                <p className="text-gray-600 mb-6">{error || 'An error occurred during payment'}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setStep('select');
                      setError(null);
                    }}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

