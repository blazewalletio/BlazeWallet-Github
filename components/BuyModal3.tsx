'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, ArrowRight, Flame, CreditCard } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { OnramperService } from '@/lib/onramper-service';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface BuyModal3Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Quote {
  cryptoAmount: string;
  exchangeRate: string;
  fee: string;
  totalAmount: string;
  baseCurrency: string;
  quoteCurrency: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  processingTime: string;
  fee: string;
}

export default function BuyModal3({ isOpen, onClose }: BuyModal3Props) {
  useBlockBodyScroll(isOpen);
  const { currentChain, getCurrentAddress } = useWalletStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State management
  const [step, setStep] = useState<'select' | 'widget' | 'processing' | 'success' | 'error'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);

  // Form state
  const [fiatAmount, setFiatAmount] = useState('100');
  const [fiatCurrency, setFiatCurrency] = useState('EUR');
  const [cryptoCurrency, setCryptoCurrency] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  // Data state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [fiatCurrencies, setFiatCurrencies] = useState<string[]>(['EUR', 'USD', 'GBP']);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<string[]>([]);
  const [widgetUrl, setWidgetUrl] = useState<string>('');

  const supportedFiats = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'NOK', 'SEK', 'DKK'];

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

  // Fetch supported data when modal opens
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

  // Listen for messages from Onramper widget
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from Onramper domains
      const allowedOrigins = [
        'https://buy.onramper.com',
        'https://buy-staging.onramper.com',
        'https://onramper.com',
      ];

      if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
        return;
      }

      logger.log('📨 Onramper widget message:', event.data);

      // Handle different event types from Onramper
      if (event.data?.type === 'ONRAMPER_TRANSACTION_COMPLETED') {
        setStep('success');
        setShowWidget(false);
        toast.success('Payment completed! Your crypto will arrive shortly.');
      } else if (event.data?.type === 'ONRAMPER_TRANSACTION_FAILED') {
        setError(event.data.message || 'Payment failed');
        setStep('error');
        setShowWidget(false);
      } else if (event.data?.type === 'ONRAMPER_WIDGET_CLOSED') {
        setShowWidget(false);
        setStep('select');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchSupportedData = async () => {
    try {
      const response = await fetch('/api/onramper/supported-data?country=NL');
      const data = await response.json();

      if (data.success) {
        if (data.paymentMethods) {
          setPaymentMethods(data.paymentMethods);
        }
        if (data.fiatCurrencies) {
          setFiatCurrencies(data.fiatCurrencies);
        }
        if (data.cryptoCurrencies) {
          setCryptoCurrencies(data.cryptoCurrencies);
        }
      }
    } catch (err: any) {
      logger.error('Failed to fetch Onramper supported data:', err);
    }
  };

  const fetchQuote = async () => {
    if (!fiatAmount || parseFloat(fiatAmount) <= 0 || !cryptoCurrency) return;

    try {
      setLoading(true);
      setError(null);

      const quoteResponse = await fetch(
        `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}`
      );

      const data = await quoteResponse.json();

      if (data.success && data.quote) {
        setQuote(data.quote);
      } else {
        setError(data.error || 'Failed to fetch quote');
        setQuote(null);
      }
    } catch (err: any) {
      logger.error('Failed to fetch Onramper quote:', err);
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

    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create transaction via Onramper
      const response = await fetch('/api/onramper/create-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fiatAmount: parseFloat(fiatAmount),
          fiatCurrency,
          cryptoCurrency,
          walletAddress,
          paymentMethod,
          useDirectCheckout: true, // Use direct checkout for better UX
        }),
      });

      const data = await response.json();

      if (data.success && data.transaction?.paymentUrl) {
        setWidgetUrl(data.transaction.paymentUrl);
        setShowWidget(true);
        setStep('widget');
      } else {
        setError(data.error || 'Failed to create transaction');
        toast.error(data.error || 'Failed to create transaction');
      }
    } catch (err: any) {
      logger.error('Failed to create Onramper transaction:', err);
      setError('Failed to create transaction. Please try again.');
      toast.error('Failed to create transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['50', '100', '250', '500'];
  const chain = CHAINS[currentChain];
  const supportedAssets = chain ? OnramperService.getSupportedAssets(chain.id) : [];

  // Filter crypto currencies based on supported assets for current chain
  const availableCryptos = cryptoCurrencies.length > 0
    ? cryptoCurrencies.filter(crypto => 
        supportedAssets.some(asset => asset.toLowerCase() === crypto.toLowerCase())
      )
    : supportedAssets;

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
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Buy crypto (Onramper)</h2>
                  <p className="text-sm text-gray-600">
                    Purchase crypto with credit card, bank transfer or Apple Pay via Onramper
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
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    >
                      {fiatCurrencies.map((fiat) => (
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select cryptocurrency</option>
                    {availableCryptos.map((crypto) => (
                      <option key={crypto} value={crypto}>
                        {crypto.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Selection */}
                {paymentMethods.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {paymentMethods.map((pm) => (
                        <button
                          key={pm.id}
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`p-3 border-2 rounded-xl transition-all ${
                            paymentMethod === pm.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-semibold text-sm">{pm.name}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {pm.processingTime} • {pm.fee}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quote Display */}
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
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
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
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
                      <div className="pt-2 border-t border-purple-200 flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Total:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {quote.baseCurrency} {quote.totalAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Continue Button */}
                {quote && !loading && paymentMethod && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleContinue}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
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

            {/* Onramper Widget (Embedded iFrame) */}
            {step === 'widget' && showWidget && widgetUrl && (
              <div className="glass-card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Complete Payment (Onramper)</h3>
                    <p className="text-sm text-gray-600">Complete your purchase securely via Onramper</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowWidget(false);
                      setStep('select');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <iframe
                  ref={iframeRef}
                  src={widgetUrl}
                  className="w-full min-h-[600px] border-0"
                  allow="payment"
                  title="Onramper Payment Widget"
                />
              </div>
            )}

            {step === 'processing' && (
              <div className="glass-card p-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
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
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-colors"
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
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-colors"
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

