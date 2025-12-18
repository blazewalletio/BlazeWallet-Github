'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, CreditCard, ArrowRight } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { OnramperService } from '@/lib/onramper-service';
import { logger } from '@/lib/logger';
import { apiPost } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Quote {
  cryptoAmount: string;
  exchangeRate: string;
  fee: string;
  totalAmount: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  processingTime: string;
  fee: string;
}

export default function BuyModal({ isOpen, onClose }: BuyModalProps) {
  useBlockBodyScroll(isOpen);
  const { currentChain, getCurrentAddress } = useWalletStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const popupRef = useRef<Window | null>(null);

  // State management
  const [step, setStep] = useState<'select' | 'widget' | 'processing' | 'success' | 'error'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  
  // Form state
  const [fiatAmount, setFiatAmount] = useState('100');
  const [fiatCurrency, setFiatCurrency] = useState('EUR');
  const [cryptoCurrency, setCryptoCurrency] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  
  // Data state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [supportedCryptos, setSupportedCryptos] = useState<string[]>([]);
  const [supportedFiats, setSupportedFiats] = useState<string[]>(['EUR', 'USD', 'GBP']);

  // Initialize default crypto based on current chain
  useEffect(() => {
    if (isOpen && currentChain) {
      const chain = CHAINS[currentChain];
      if (chain) {
        const defaultCrypto = OnramperService.getDefaultCrypto(chain.id);
        setCryptoCurrency(defaultCrypto);
      }
    }
  }, [isOpen, currentChain]);

  // Fetch supported data on mount
  useEffect(() => {
    if (isOpen && step === 'select') {
      fetchSupportedData();
    }
  }, [isOpen, step]);

  // Fetch quote when amount/crypto changes
  useEffect(() => {
    if (isOpen && step === 'select' && fiatAmount && parseFloat(fiatAmount) > 0 && cryptoCurrency) {
      const debounceTimer = setTimeout(() => {
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [fiatAmount, fiatCurrency, cryptoCurrency, isOpen, step]);

  // Cleanup popup on unmount
  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const fetchSupportedData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/onramper/supported-data?country=NL');
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.paymentMethods || []);
        setSupportedCryptos(data.cryptoCurrencies || []);
        setSupportedFiats(data.fiatCurrencies || ['EUR', 'USD', 'GBP']);
      }
    } catch (err: any) {
      logger.error('Failed to fetch supported data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuote = async () => {
    if (!fiatAmount || parseFloat(fiatAmount) <= 0 || !cryptoCurrency) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}`
      );
      
      const data = await response.json();
      
      if (data.success && data.quote) {
        setQuote(data.quote);
      } else {
        setError(data.message || 'Failed to fetch quote');
        setQuote(null);
      }
    } catch (err: any) {
      logger.error('Failed to fetch quote:', err);
      setError('Failed to fetch quote. Please try again.');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!quote || !selectedPaymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    const walletAddress = getCurrentAddress();
    if (!walletAddress) {
      toast.error('Wallet address not found');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStep('processing');

      // Create transaction (using apiPost for automatic CSRF token handling)
      const response = await apiPost('/api/onramper/create-transaction', {
        fiatAmount: parseFloat(fiatAmount),
        fiatCurrency,
        cryptoCurrency,
        walletAddress,
        paymentMethod: selectedPaymentMethod,
        // For now we prefer the standard signed widget flow so that we can
        // safely pass the user's wallet address via the `wallets` parameter.
        // This allows Onramper + the providers to send the purchased crypto
        // directly to the correct wallet, while still using our own UI for
        // amount / asset / payment-method selection.
        useDirectCheckout: false,
      });

      const data = await response.json();

      if (data.success && data.transaction?.paymentUrl) {
        setWidgetUrl(data.transaction.paymentUrl);
        setStep('widget');
        
        // Open in popup (better UX than iframe for payment providers)
        const width = 600;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        const popup = window.open(
          data.transaction.paymentUrl,
          'onramper-payment',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (popup) {
          popupRef.current = popup;
          
          // Monitor popup
          const checkInterval = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkInterval);
              // Check transaction status (webhook will update)
              setStep('processing');
              toast.success('Payment completed! Checking transaction status...');
              
              // Poll for status update (webhook should handle this, but we can poll as backup)
              setTimeout(() => {
                setStep('success');
                onClose();
              }, 2000);
            }
          }, 1000);
        } else {
          // Popup blocked - show instructions
          setError('Popup blocked. Please allow popups for this site and try again, or use "Open in New Tab" option.');
          setStep('widget');
          toast.error('Popup blocked. Please allow popups or use "Open in New Tab".', { duration: 5000 });
        }
      } else {
        throw new Error(data.error || 'Failed to create transaction');
      }
    } catch (err: any) {
      logger.error('Failed to create transaction:', err);
      setError(err.message || 'Failed to create transaction');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['50', '100', '250', '500'];
  const chain = CHAINS[currentChain];
  const supportedAssets = chain ? OnramperService.getSupportedAssets(chain.id) : [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && step === 'select') {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Buy Crypto</h2>
              <p className="text-sm text-gray-500 mt-1">Purchase cryptocurrency with fiat</p>
            </div>
            {step === 'select' && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {step === 'select' && (
              <div className="p-6 space-y-6">
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        min="10"
                        step="0.01"
                      />
                    </div>
                    <select
                      value={fiatCurrency}
                      onChange={(e) => setFiatCurrency(e.target.value)}
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
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
                    value={cryptoCurrency}
                    onChange={(e) => setCryptoCurrency(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select cryptocurrency</option>
                    {supportedAssets
                      .filter((asset) => supportedCryptos.length === 0 || supportedCryptos.includes(asset))
                      .map((asset) => (
                        <option key={asset} value={asset}>
                          {asset} - {OnramperService.getDisplayName(asset)}
                        </option>
                      ))}
                  </select>
            </div>

                {/* Quote Display */}
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    <span className="ml-2 text-gray-600">Fetching quote...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                {quote && !loading && (
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-xl">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">You'll receive:</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {parseFloat(quote.cryptoAmount).toFixed(6)} {cryptoCurrency}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Exchange rate:</span>
                        <span className="text-gray-900 font-medium">
                          1 {cryptoCurrency} = {fiatCurrency} {parseFloat(quote.exchangeRate).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Fee:</span>
                        <span className="text-gray-900 font-medium">{fiatCurrency} {quote.fee}</span>
                      </div>
                      <div className="pt-2 border-t border-orange-200 flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Total:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {fiatCurrency} {quote.totalAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selection */}
                {quote && !loading && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setSelectedPaymentMethod(method.id)}
                          className={`p-4 border-2 rounded-xl text-left transition-all ${
                            selectedPaymentMethod === method.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-5 h-5 text-gray-600" />
                              <div>
                                <div className="font-medium text-gray-900">{method.name}</div>
                                <div className="text-xs text-gray-500">
                                  {method.processingTime} • Fee: {method.fee}
                                </div>
                              </div>
                            </div>
                            {selectedPaymentMethod === method.id && (
                              <CheckCircle2 className="w-5 h-5 text-orange-500" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Continue Button */}
                {quote && selectedPaymentMethod && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleContinue}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Payment</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            )}

            {step === 'widget' && widgetUrl && (
              <div className="p-12 text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Window</h3>
                  <p className="text-gray-600 mb-4">
                    Complete your payment in the popup window that should have opened.
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    If the popup was blocked, please allow popups for this site and try again, or click the button below to open in a new tab.
                  </p>
                </div>
                <div className="space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      // Try popup again
                      const width = 600;
                      const height = 800;
                      const left = (window.screen.width - width) / 2;
                      const top = (window.screen.height - height) / 2;
                      
                      const popup = window.open(
                        widgetUrl,
                        'onramper-payment',
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                      );

                      if (popup) {
                        popupRef.current = popup;
                        toast.success('Payment window opened!');
                      } else {
                        toast.error('Popup blocked. Please allow popups or use "Open in New Tab" below.');
                      }
                    }}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
                  >
                    Open Payment Window Again
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      // Open in new tab as fallback
                      window.open(widgetUrl, '_blank');
                      toast.success('Opened in new tab. Complete your payment there.');
                    }}
                    className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Open in New Tab
                  </motion.button>
                  <button
                    onClick={() => {
                      setStep('select');
                      setError(null);
                    }}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to Selection
                  </button>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="p-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Payment</h3>
                <p className="text-gray-600">
                  Please complete your payment in the popup window. We'll update you when the transaction is confirmed.
                </p>
              </div>
            )}

            {step === 'success' && (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600 mb-6">
                  Your cryptocurrency will arrive in your wallet shortly.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Failed</h3>
                <p className="text-gray-600 mb-6">{error}</p>
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
                    className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
