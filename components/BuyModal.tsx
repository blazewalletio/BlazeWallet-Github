'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, ArrowRight, Flame } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { MoonPayService } from '@/lib/moonpay-service';
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
  networkFee: string;
  totalAmount: string;
  baseCurrency: string;
  quoteCurrency: string;
}

export default function BuyModal({ isOpen, onClose }: BuyModalProps) {
  useBlockBodyScroll(isOpen);
  const { currentChain, getCurrentAddress } = useWalletStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State management
  const [step, setStep] = useState<'select' | 'widget' | 'processing' | 'success' | 'error'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  
  // Form state
  const [fiatAmount, setFiatAmount] = useState('100');
  const [fiatCurrency, setFiatCurrency] = useState('EUR');
  const [cryptoCurrency, setCryptoCurrency] = useState<string>('');
  
  // Data state
  const [quote, setQuote] = useState<Quote | null>(null);
  const supportedFiats = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'NOK', 'SEK', 'DKK'];

  // Initialize default crypto based on current chain
  useEffect(() => {
    if (isOpen && currentChain) {
      const chain = CHAINS[currentChain];
      if (chain) {
        const defaultCrypto = MoonPayService.getDefaultCrypto(chain.id);
        setCryptoCurrency(defaultCrypto);
      }
    }
  }, [isOpen, currentChain]);

  // Fetch quote when amount/crypto changes
  useEffect(() => {
    if (isOpen && step === 'select' && fiatAmount && parseFloat(fiatAmount) > 0 && cryptoCurrency) {
      const debounceTimer = setTimeout(() => {
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [fiatAmount, fiatCurrency, cryptoCurrency, isOpen, step]);

  // Listen for MoonPay widget messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // MoonPay sends messages when transaction status changes
      if (event.origin !== 'https://buy.moonpay.com' && event.origin !== 'https://buy-staging.moonpay.com') {
        return;
      }

      if (event.data.type === 'MOONPAY_TRANSACTION_COMPLETED') {
        setStep('success');
        toast.success('Payment completed! Your crypto will arrive shortly.');
      } else if (event.data.type === 'MOONPAY_TRANSACTION_FAILED') {
        setStep('error');
        setError(event.data.message || 'Payment failed. Please try again.');
        toast.error('Payment failed. Please try again.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchQuote = async () => {
    if (!fiatAmount || parseFloat(fiatAmount) <= 0 || !cryptoCurrency) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/moonpay/quote?baseCurrencyAmount=${fiatAmount}&baseCurrencyCode=${fiatCurrency}&quoteCurrencyCode=${cryptoCurrency}`
      );
      
      const data = await response.json();
      
      if (data.success && data.quote) {
        setQuote(data.quote);
      } else {
        setError(data.error || 'Failed to fetch quote');
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
    if (!quote) {
      toast.error('Please wait for quote to load');
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

      // Get widget URL from API
      const response = await apiPost('/api/moonpay/widget-url', {
        walletAddress,
        currencyCode: cryptoCurrency,
        baseCurrencyCode: fiatCurrency,
        baseCurrencyAmount: parseFloat(fiatAmount),
        theme: 'light',
        mode: 'buy',
      });

      const data = await response.json();

      if (data.success && data.widgetUrl) {
        setWidgetUrl(data.widgetUrl);
        setStep('widget');
        toast.success('Opening payment window...');
      } else {
        throw new Error(data.error || 'Failed to create payment widget');
      }
    } catch (err: any) {
      logger.error('Failed to create payment widget:', err);
      setError(err.message || 'Failed to create payment widget');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['50', '100', '250', '500'];
  const chain = CHAINS[currentChain];
  const supportedAssets = chain ? MoonPayService.getSupportedCryptos(chain.id) : [];

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
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Buy crypto</h2>
                  <p className="text-sm text-gray-600">
                    Purchase crypto with credit card, bank transfer or Apple Pay
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
                    {supportedAssets.map((asset) => (
                      <option key={asset} value={asset}>
                        {asset.toUpperCase()}
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
                          {parseFloat(quote.cryptoAmount).toFixed(6)} {quote.quoteCurrency}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Exchange rate:</span>
                        <span className="text-gray-900 font-medium">
                          1 {quote.quoteCurrency} = {quote.baseCurrency} {parseFloat(quote.exchangeRate).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Service fee:</span>
                        <span className="text-gray-900 font-medium">{quote.baseCurrency} {quote.fee}</span>
                      </div>
                      {parseFloat(quote.networkFee) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Network fee:</span>
                          <span className="text-gray-900 font-medium">{quote.baseCurrency} {quote.networkFee}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-orange-200 flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Total:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {quote.baseCurrency} {quote.totalAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Continue Button */}
                {quote && !loading && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleContinue}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>Buy now</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            )}

            {/* MoonPay Embedded Widget */}
            {step === 'widget' && widgetUrl && (
              <div className="glass-card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Complete Payment</h3>
                    <p className="text-sm text-gray-600">Complete your purchase securely</p>
                  </div>
                  <button
                    onClick={() => {
                      setStep('select');
                      setWidgetUrl(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="w-full" style={{ height: '600px' }}>
                  {/* 
                    IMPORTANT: Apple Pay and Google Pay do NOT work in iframes.
                    For mobile devices, we should redirect to MoonPay's domain instead.
                    However, for desktop and other payment methods, iframe works fine.
                    MoonPay will handle the payment method selection automatically.
                  */}
                  <iframe
                    ref={iframeRef}
                    src={widgetUrl}
                    className="w-full h-full border-0"
                    title="MoonPay Payment Widget"
                    allow="payment"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                  />
                </div>
                {/* Fallback: Open in new tab for mobile payments */}
                <div className="p-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">
                    Having issues with Apple Pay or Google Pay? Try opening in a new tab.
                  </p>
                  <button
                    onClick={() => {
                      window.open(widgetUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Open in New Tab
                  </button>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="glass-card p-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
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
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="glass-card p-12 text-center">
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
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-colors"
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
