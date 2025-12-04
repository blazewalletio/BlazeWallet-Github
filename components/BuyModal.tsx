'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  CreditCard, 
  Banknote, 
  Flame, 
  Loader2, 
  Check, 
  ChevronDown,
  CheckCircle2,
  Building,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { CHAINS } from '@/lib/chains';
import { OnramperService } from '@/lib/onramper-service';
import { logger } from '@/lib/logger';
import { apiPost } from '@/lib/api-client';

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

interface Transaction {
  transactionId: string;
  paymentUrl: string;
  status: string;
}

export default function BuyModal({ isOpen, onClose }: BuyModalProps) {
  const { address, currentChain, solanaAddress, bitcoinAddress } = useWalletStore();
  const chain = CHAINS[currentChain];
  
  const [step, setStep] = useState<'input' | 'confirm' | 'payment' | 'processing'>('input');
  const [fiatAmount, setFiatAmount] = useState('');
  const [selectedFiat, setSelectedFiat] = useState('EUR');
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('PENDING');
  const [error, setError] = useState('');
  const [showIframe, setShowIframe] = useState(false);
  
  // Dropdown states
  const [showFiatDropdown, setShowFiatDropdown] = useState(false);
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);
  
  // Supported data
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [fiatCurrencies, setFiatCurrencies] = useState<string[]>(['EUR', 'USD', 'GBP']);
  const [supportedCryptos, setSupportedCryptos] = useState<string[]>([]);

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

  // Initialize: Load supported data and set default crypto
  useEffect(() => {
    if (isOpen && address) {
      // Set default crypto for current chain
      const defaultCrypto = OnramperService.getDefaultCrypto(chain.id);
      setSelectedCrypto(defaultCrypto);
      setSupportedCryptos(OnramperService.getSupportedAssets(chain.id));
      
      // Load supported data
      loadSupportedData();
    } else {
      // Reset state when modal closes
      setStep('input');
      setFiatAmount('');
      setSelectedFiat('EUR');
      setSelectedCrypto(null);
      setSelectedPaymentMethod(null);
      setQuote(null);
      setTransaction(null);
      setTransactionStatus('PENDING');
      setError('');
      setShowFiatDropdown(false);
      setShowCryptoDropdown(false);
      setShowIframe(false);
    }
  }, [isOpen, address, currentChain]);

  // Fetch quote when amount or selections change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fiatAmount && parseFloat(fiatAmount) >= 10 && selectedCrypto && selectedFiat) {
        fetchQuote();
      } else {
        setQuote(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fiatAmount, selectedFiat, selectedCrypto, selectedPaymentMethod]);

  const loadSupportedData = async () => {
    try {
      const response = await fetch('/api/onramper/supported-data');
      const data = await response.json();
      
      // Always use the data from response (API returns fallback if no key)
      if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
      if (data.fiatCurrencies) setFiatCurrencies(data.fiatCurrencies);
      if (data.cryptoCurrencies) {
        // Merge with chain-specific supported assets
        const chainAssets = OnramperService.getSupportedAssets(chain.id);
        const merged = [...new Set([...data.cryptoCurrencies, ...chainAssets])];
        setSupportedCryptos(merged);
      } else {
        // Fallback to chain-specific assets
        setSupportedCryptos(OnramperService.getSupportedAssets(chain.id));
      }
    } catch (error) {
      logger.error('Error loading supported data:', error);
      // Use defaults
      setPaymentMethods([
        { id: 'creditcard', name: 'Credit/Debit Card', icon: 'card', processingTime: 'Instant', fee: '€2.00' },
        { id: 'applepay', name: 'Apple Pay', icon: 'applepay', processingTime: 'Instant', fee: '€1.50' },
        { id: 'googlepay', name: 'Google Pay', icon: 'googlepay', processingTime: 'Instant', fee: '€1.50' },
        { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
        { id: 'bancontact', name: 'Bancontact', icon: 'bancontact', processingTime: 'Instant', fee: '€0.50' },
        { id: 'sepa', name: 'SEPA Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
      ]);
      setSupportedCryptos(OnramperService.getSupportedAssets(chain.id));
    }
  };

  // NO FALLBACK - We MUST use real Onramper rates only

  const fetchQuote = async () => {
    if (!fiatAmount || parseFloat(fiatAmount) < 10) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setError('');

    try {
      // CRITICAL: Don't include paymentMethod in quote request
      // Onramper returns different structure with paymentMethod that doesn't include payout/rate
      // Payment method is only used when creating the transaction, not for getting quotes
      const response = await fetch(
        `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${selectedFiat}&cryptoCurrency=${selectedCrypto}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || errorData.message || `Failed to fetch quote (${response.status})`;
        logger.error('❌ Quote API error:', errorMessage);
        setError(errorMessage);
        setQuote(null);
        return;
      }

      const data = await response.json();
      
      // CRITICAL: Only accept real Onramper quotes, no fallbacks
      if (data.success && data.quote) {
        // Validate quote has valid crypto amount
        const cryptoAmount = parseFloat(data.quote.cryptoAmount || '0');
        if (cryptoAmount > 0) {
          setQuote(data.quote);
          setError('');
          logger.log('✅ Real Onramper quote received:', data.quote);
        } else {
          // Quote returned but cryptoAmount is 0 - this is an error
          const errorMsg = 'Invalid quote received from Onramper (cryptoAmount is 0)';
          logger.error('❌', errorMsg);
          setError(errorMsg);
          setQuote(null);
        }
      } else {
        // No quote in response - error
        const errorMsg = data.error || data.message || 'Failed to get quote from Onramper';
        logger.error('❌ No quote in response:', errorMsg);
        setError(errorMsg);
        setQuote(null);
      }
    } catch (err: any) {
      logger.error('❌ Error fetching quote:', err);
      setError(err.message || 'Failed to fetch quote. Please try again.');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleMaxAmount = () => {
    setFiatAmount('10000'); // Max allowed
  };

  const handleContinue = () => {
    setError('');
    
    if (!fiatAmount || parseFloat(fiatAmount) < 10) {
      setError('Minimum amount is €10');
      return;
    }

    if (parseFloat(fiatAmount) > 10000) {
      setError('Maximum amount is €10,000');
      return;
    }

    if (!selectedCrypto) {
      setError('Please select a crypto currency');
      return;
    }

    if (!selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (!quote) {
      setError('Please wait for quote to load');
      return;
    }

    setStep('confirm');
  };

  const handleCreateTransaction = async () => {
    if (!fiatAmount || !selectedCrypto || !selectedPaymentMethod) {
      setError('Missing required information');
      return;
    }

    // CRITICAL: Get correct wallet address for selected crypto
    // Solana needs solanaAddress, Bitcoin needs bitcoinAddress, EVM uses address
    let walletAddress: string | null = null;
    if (selectedCrypto === 'SOL') {
      walletAddress = solanaAddress || null;
    } else if (selectedCrypto === 'BTC') {
      walletAddress = bitcoinAddress || null;
    } else {
      // All EVM chains (ETH, USDT, USDC, MATIC, BNB, etc.) use the same address
      walletAddress = address || null;
    }

    if (!walletAddress) {
      setError(`No wallet address available for ${selectedCrypto}. Please ensure your wallet is properly set up.`);
      return;
    }

    setError('');
    setStep('payment');

    try {
      const response = await apiPost('/api/onramper/create-transaction', {
        fiatAmount: parseFloat(fiatAmount),
        fiatCurrency: selectedFiat,
        cryptoCurrency: selectedCrypto,
        walletAddress: walletAddress,
        paymentMethod: selectedPaymentMethod,
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresApiKey) {
          throw new Error('Onramper API key is required to process transactions. Please add ONRAMPER_API_KEY to environment variables.');
        }
        throw new Error(errorData.error || errorData.message || 'Failed to create transaction');
      }

      const data = await response.json();
      if (data.success && data.transaction) {
        setTransaction(data.transaction);
        
        // Show iframe with payment URL (blijft binnen Blaze Wallet!)
        if (data.transaction.paymentUrl) {
          setShowIframe(true);
          setStep('payment');
          setTransactionStatus('PENDING');
          
          // Start polling for status updates
          pollTransactionStatus(data.transaction.transactionId);
        }
      } else {
        throw new Error('Failed to create transaction');
      }
    } catch (err: any) {
      logger.error('Error creating transaction:', err);
      setError(err.message || 'Failed to create transaction');
      setStep('confirm');
    }
  };

  const pollTransactionStatus = async (transactionId: string) => {
    // Poll for status updates (webhook will handle actual updates)
    // This is a fallback polling mechanism
    const interval = setInterval(async () => {
      try {
        // In a real implementation, you'd poll the transaction status
        // For now, we'll rely on webhooks
        // This is just a placeholder
      } catch (error) {
        logger.error('Error polling transaction status:', error);
      }
    }, 5000);

    // Clear interval after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const handleClose = () => {
    setStep('input');
    setFiatAmount('');
    setSelectedFiat('EUR');
    setSelectedCrypto(null);
    setSelectedPaymentMethod(null);
    setQuote(null);
    setTransaction(null);
    setTransactionStatus('PENDING');
    setError('');
    setShowFiatDropdown(false);
    setShowCryptoDropdown(false);
    onClose();
  };

  const getPaymentMethodIcon = (icon: string, isSelected: boolean) => {
    const iconClass = isSelected ? 'text-white' : 'text-gray-600';
    switch (icon) {
      case 'ideal':
        return <Banknote className={`w-5 h-5 ${iconClass}`} />;
      case 'card':
        return <CreditCard className={`w-5 h-5 ${iconClass}`} />;
      case 'bank':
        return <Building className={`w-5 h-5 ${iconClass}`} />;
      default:
        return <CreditCard className={`w-5 h-5 ${iconClass}`} />;
    }
  };

  const getPaymentMethodName = (id: string) => {
    return paymentMethods.find(m => m.id === id)?.name || id;
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
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            <div className="pt-4 pb-2">
          <button
                onClick={handleClose}
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
                    Purchase crypto with iDEAL, credit card or bank transfer
                </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pb-6">
              {step === 'input' && (
                <>
                  {!address ? (
                    <div className="glass-card p-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Your Wallet</h3>
                      <p className="text-gray-600 mb-6">Please connect your wallet to buy crypto</p>
                      <button
                        onClick={handleClose}
                        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
                      >
                        Go Back
                      </button>
                    </div>
                  ) : (
                    <div className="glass-card p-6 space-y-6">
                      {/* Fiat Currency Selector */}
                      <div>
                        <label className="text-sm font-medium text-gray-900 mb-2 block">
                          Pay with
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setShowFiatDropdown(!showFiatDropdown)}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{selectedFiat === 'EUR' ? '€' : selectedFiat === 'USD' ? '$' : '£'}</span>
                              <span>{selectedFiat}</span>
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </button>
                          
                          {showFiatDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden"
                            >
                              {fiatCurrencies.map((fiat) => (
                                <button
                                  key={fiat}
                                  onClick={() => {
                                    setSelectedFiat(fiat);
                                    setShowFiatDropdown(false);
                                  }}
                                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                    selectedFiat === fiat ? 'bg-orange-50' : ''
                                  }`}
                                >
                                  <span className="font-medium text-gray-900">{fiat}</span>
                                  {selectedFiat === fiat && (
                                    <Check className="w-5 h-5 text-orange-500" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
            </div>
          </div>

                      {/* Amount Input */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-gray-900">
                            Amount ({selectedFiat})
                          </label>
                          <span className="text-sm text-gray-600">
                            Min: {selectedFiat === 'EUR' ? '€10' : selectedFiat === 'USD' ? '$10' : '£10'} • Max: {selectedFiat === 'EUR' ? '€10,000' : selectedFiat === 'USD' ? '$10,000' : '£10,000'}
                          </span>
                  </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={fiatAmount}
                            onChange={(e) => setFiatAmount(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="10"
                            max="10000"
                            className="input-field pr-20 text-2xl font-bold"
                          />
                          <button
                            onClick={handleMaxAmount}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700 text-sm font-semibold"
                          >
                            MAX
                          </button>
                  </div>
                        {/* Quick Amount Buttons */}
                        <div className="grid grid-cols-4 gap-2 mt-3">
                          {[50, 100, 250, 500].map((amount) => (
                            <button
                              key={amount}
                              onClick={() => setFiatAmount(amount.toString())}
                              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                                fiatAmount === amount.toString()
                                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                              }`}
                            >
                              {selectedFiat === 'EUR' ? '€' : selectedFiat === 'USD' ? '$' : '£'}{amount}
                            </button>
                          ))}
                  </div>
                </div>

                      {/* Crypto Currency Selector */}
                      <div>
                        <label className="text-sm font-medium text-gray-900 mb-2 block">
                          Receive
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setShowCryptoDropdown(!showCryptoDropdown)}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                          >
                            {selectedCrypto && (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {selectedCrypto.charAt(0)}
                                </div>
                                <span>{selectedCrypto}</span>
              </div>
                            )}
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </button>
                          
                          {showCryptoDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
                            >
                              {supportedCryptos.map((crypto) => (
                                <button
                                  key={crypto}
                                  onClick={() => {
                                    setSelectedCrypto(crypto);
                                    setShowCryptoDropdown(false);
                                  }}
                                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                    selectedCrypto === crypto ? 'bg-orange-50' : ''
                                  }`}
                      >
                        <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                      {crypto.charAt(0)}
                          </div>
                                    <span className="font-medium text-gray-900">{crypto}</span>
                          </div>
                                  {selectedCrypto === crypto && (
                                    <Check className="w-5 h-5 text-orange-500" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Quote Display */}
                      {quote && !isLoadingQuote && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="glass-card p-6 space-y-4"
                        >
                          {/* Main Quote Display */}
                          <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200 rounded-xl p-6">
                            <div className="text-sm text-gray-600 mb-1">You'll receive</div>
                            <div className="text-4xl font-bold text-gray-900 mb-1">
                              {quote.cryptoAmount} {selectedCrypto}
                            </div>
                            <div className="text-sm text-gray-600">
                              ≈ {fiatAmount} {selectedFiat}
                </div>
              </div>

                          {/* Breakdown */}
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Exchange rate</span>
                              <span className="font-semibold text-gray-900">
                                1 {selectedCrypto} = {parseFloat(quote.exchangeRate).toFixed(2)} {selectedFiat}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Onramper fee</span>
                              <span className="font-semibold text-gray-900">
                                {quote.fee} {selectedFiat}
                              </span>
                            </div>
                            <div className="h-px bg-gray-200" />
                            <div className="flex justify-between font-semibold text-base">
                              <span className="text-gray-900">Total</span>
                              <span className="text-gray-900">
                                {fiatAmount} {selectedFiat}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Loading Quote */}
                      {isLoadingQuote && (
                        <div className="flex items-center justify-center gap-3 text-orange-600 py-4">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm font-medium">Fetching best rate...</span>
                        </div>
                      )}

                      {/* Payment Method Selection */}
                      {quote && !isLoadingQuote && (
              <div className="glass-card p-6">
                          <label className="text-sm font-medium text-gray-900 mb-4 block">
                            Payment method
                          </label>
                          <div className="space-y-3">
                            {paymentMethods.map((method) => (
                              <button
                                key={method.id}
                                onClick={() => setSelectedPaymentMethod(method.id)}
                                className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
                                  selectedPaymentMethod === method.id
                                    ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-500 shadow-md'
                                    : 'bg-white border-gray-200 hover:border-orange-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                      selectedPaymentMethod === method.id
                                        ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                                        : 'bg-gray-100'
                                    }`}>
                                      {getPaymentMethodIcon(method.icon, selectedPaymentMethod === method.id)}
                  </div>
                                    <div>
                                      <div className="font-semibold text-gray-900">{method.name}</div>
                                      <div className="text-xs text-gray-600">
                                        {method.processingTime} • Fee: {method.fee}
                  </div>
                </div>
                                  </div>
                                  {selectedPaymentMethod === method.id && (
                                    <Check className="w-5 h-5 text-orange-500" />
                                  )}
                                </div>
                              </button>
                            ))}
              </div>
            </div>
                      )}

                      {/* Error */}
                      {error && (
            <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
                        >
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm font-medium text-red-700">{error}</p>
                        </motion.div>
                      )}

                      {/* Continue Button */}
                      <button
                        onClick={handleContinue}
                        disabled={!fiatAmount || !selectedCrypto || !selectedPaymentMethod || !quote || isLoadingQuote}
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                      >
                        Continue
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {step === 'confirm' && quote && selectedCrypto && (
                <div className="space-y-6">
                  {/* Main Amount Display */}
                  <div className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200">
                    <div className="text-sm text-gray-600 mb-1">You're buying</div>
                    <div className="text-4xl font-bold text-gray-900 mb-1">
                      {quote.cryptoAmount} {selectedCrypto}
                    </div>
                    <div className="text-sm text-gray-600">
                      ≈ {fiatAmount} {selectedFiat}
                    </div>
                  </div>
                  
                  {/* Details */}
                  <div className="glass-card p-6 space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment method</span>
                      <span className="font-medium text-gray-900">{getPaymentMethodName(selectedPaymentMethod || '')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Exchange rate</span>
                      <span className="font-medium text-gray-900">
                        1 {selectedCrypto} = {parseFloat(quote.exchangeRate).toFixed(2)} {selectedFiat}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fee</span>
                      <span className="font-medium text-gray-900">{quote.fee} {selectedFiat}</span>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div className="flex justify-between font-semibold text-base">
                      <span className="text-gray-900">Total</span>
                      <span className="text-gray-900">{fiatAmount} {selectedFiat}</span>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-red-700 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('input')}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreateTransaction}
                      className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                    >
                      Continue to payment
                    </button>
                  </div>
                </div>
              )}

              {step === 'payment' && transaction && showIframe && (
                <div className="space-y-4">
                  {/* Iframe Header */}
                  <div className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Complete your payment</h3>
                        <p className="text-sm text-gray-600">Secure payment powered by Onramper</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowIframe(false);
                        setStep('input');
                        setTransaction(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Onramper Widget iframe - Full height, naadloos geïntegreerd */}
                  <div className="glass-card overflow-hidden" style={{ height: '600px' }}>
                    <iframe
                      src={transaction.paymentUrl}
                      className="w-full h-full border-0"
                      allow="payment; camera; microphone; geolocation"
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                      title="Onramper Payment Widget"
                    />
                  </div>

                  {/* Info Banner */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-1">Complete the payment in the widget above</p>
                      <p className="text-blue-600">Your crypto will be sent to your wallet once the payment is confirmed.</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 'processing' && transaction && (
                <div className="glass-card p-12 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full mx-auto mb-4"
                  />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {transactionStatus === 'PENDING' && 'Payment pending...'}
                    {transactionStatus === 'PROCESSING' && 'Processing your purchase...'}
                    {transactionStatus === 'COMPLETED' && 'Purchase completed!'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {transactionStatus === 'PENDING' && 'Waiting for payment confirmation'}
                    {transactionStatus === 'PROCESSING' && 'Your crypto is being sent to your wallet'}
                    {transactionStatus === 'COMPLETED' && 'Your crypto has been sent successfully'}
                  </p>
                  
                  {transactionStatus === 'COMPLETED' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </motion.div>
                  )}

                  {transactionStatus === 'COMPLETED' && (
                    <button
                      onClick={handleClose}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
                    >
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
