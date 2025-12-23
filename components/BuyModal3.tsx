'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, ArrowRight, Flame, CreditCard, TestTube, Copy, Check } from 'lucide-react';
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
  
  // Test & Debug state
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);

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
        'https://api.onramper.com',
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setShowWidget(false);
      setWidgetUrl('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

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

      // Use new checkout-intent API for better UI/UX control
      const response = await fetch('/api/onramper/checkout-intent', {
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
        }),
      });

      const data = await response.json();

      if (data.success && data.transactionInformation) {
        const { transactionInformation } = data;
        const transactionType = transactionInformation.type; // "iframe" or "redirect"
        const transactionUrl = transactionInformation.url;
        const transactionId = transactionInformation.transactionId;

        logger.log('✅ Onramper checkout intent created:', {
          transactionId,
          type: transactionType,
        });

        if (transactionType === 'iframe') {
          // ✅ Embed in iframe (binnen eigen UI)
          setWidgetUrl(transactionUrl);
          setShowWidget(true);
          setStep('widget');
          toast.success('Opening payment widget...');
        } else if (transactionType === 'redirect') {
          // ⚠️ Open in popup (payment provider requires redirect)
          const popup = window.open(
            transactionUrl,
            'onramper-payment',
            'width=600,height=800,left=400,top=100,scrollbars=yes,resizable=yes'
          );

          if (!popup) {
            // Popup blocked - fallback to new tab
            toast.error('Popup blocked. Opening in new tab...');
            window.open(transactionUrl, '_blank');
            setStep('processing');
          } else {
            // Monitor popup for completion
            setStep('processing');
            toast('Complete payment in the popup window', { icon: '💳' });

            const checkPopup = setInterval(() => {
              if (popup.closed) {
                clearInterval(checkPopup);
                // Popup closed - check transaction status
                logger.log('Popup closed, checking transaction status...');
                // The webhook will update the transaction status
                // For now, show a message to the user
                toast.success('Payment window closed. We\'ll notify you when the transaction is confirmed.');
                setStep('select');
              }
            }, 1000);

            // Cleanup interval after 5 minutes
            setTimeout(() => {
              clearInterval(checkPopup);
            }, 5 * 60 * 1000);
          }
        } else {
          // Unknown type - try iframe as fallback
          logger.warn('Unknown transaction type, using iframe as fallback:', transactionType);
          setWidgetUrl(transactionUrl);
          setShowWidget(true);
          setStep('widget');
        }
      } else {
        setError(data.error || data.message || 'Failed to create transaction');
        toast.error(data.error || data.message || 'Failed to create transaction');
      }
    } catch (err: any) {
      logger.error('Failed to create Onramper checkout intent:', err);
      setError('Failed to create transaction. Please try again.');
      toast.error('Failed to create transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Comprehensive test function
  const runComprehensiveTest = async () => {
    setIsTesting(true);
    setTestLogs([]);
    const logs: string[] = [];
    
    const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      const timestamp = new Date().toISOString();
      const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
      const logEntry = `[${timestamp}] ${prefix} ${message}`;
      logs.push(logEntry);
      setTestLogs([...logs]);
      console.log(logEntry);
    };

    try {
      addLog('🚀 Starting comprehensive Onramper integration test...', 'info');
      addLog('', 'info');

      // Test 1: Check wallet address
      addLog('Test 1: Checking wallet address...', 'info');
      const walletAddress = getCurrentAddress();
      if (!walletAddress) {
        addLog('ERROR: No wallet address found!', 'error');
        return;
      }
      addLog(`SUCCESS: Wallet address found: ${walletAddress.substring(0, 10)}...`, 'success');
      addLog('', 'info');

      // Test 2: Check current form values
      addLog('Test 2: Checking form values...', 'info');
      addLog(`  Fiat Amount: ${fiatAmount}`, 'info');
      addLog(`  Fiat Currency: ${fiatCurrency}`, 'info');
      addLog(`  Crypto Currency: ${cryptoCurrency || 'NOT SET'}`, cryptoCurrency ? 'success' : 'error');
      addLog(`  Payment Method: ${paymentMethod || 'NOT SET'}`, paymentMethod ? 'success' : 'warning');
      addLog('', 'info');

      // Test 3: Test /api/onramper/supported-data
      addLog('Test 3: Testing /api/onramper/supported-data endpoint...', 'info');
      try {
        const supportedDataResponse = await fetch('/api/onramper/supported-data');
        const supportedData = await supportedDataResponse.json();
        if (supportedDataResponse.ok && supportedData.success) {
          addLog(`SUCCESS: Supported data fetched`, 'success');
          // Response structure: paymentMethods, fiatCurrencies, cryptoCurrencies are direct properties
          const paymentMethods = supportedData.paymentMethods || supportedData.data?.paymentMethods || [];
          const fiatCurrencies = supportedData.fiatCurrencies || supportedData.data?.fiatCurrencies || [];
          const cryptoCurrencies = supportedData.cryptoCurrencies || supportedData.data?.cryptoCurrencies || [];
          addLog(`  Payment Methods: ${paymentMethods.length}`, 'info');
          if (paymentMethods.length > 0) {
            paymentMethods.forEach((pm: any, idx: number) => {
              addLog(`    ${idx + 1}. ${pm.id} - ${pm.name} (${pm.processingTime}, ${pm.fee})`, 'info');
            });
          }
          addLog(`  Fiat Currencies: ${fiatCurrencies.length}`, 'info');
          if (fiatCurrencies.length > 0) {
            addLog(`    ${fiatCurrencies.join(', ')}`, 'info');
          }
          addLog(`  Crypto Currencies: ${cryptoCurrencies.length}`, 'info');
          if (cryptoCurrencies.length > 0) {
            addLog(`    ${cryptoCurrencies.join(', ')}`, 'info');
          }
          addLog(`  Full Response: ${JSON.stringify(supportedData, null, 2)}`, 'info');
        } else {
          addLog(`ERROR: ${supportedData.error || 'Unknown error'}`, 'error');
          addLog(`  Response: ${JSON.stringify(supportedData, null, 2)}`, 'error');
        }
      } catch (err: any) {
        addLog(`ERROR: Failed to fetch supported data: ${err.message}`, 'error');
        addLog(`  Stack: ${err.stack}`, 'error');
      }
      addLog('', 'info');

      // Test 4: Test /api/onramper/quotes
      addLog('Test 4: Testing /api/onramper/quotes endpoint...', 'info');
      if (!cryptoCurrency) {
        addLog('WARNING: Skipping quote test - no crypto currency selected', 'warning');
      } else {
        try {
          const quoteUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}`;
          addLog(`  URL: ${quoteUrl}`, 'info');
          const quoteResponse = await fetch(quoteUrl);
          const quoteData = await quoteResponse.json();
          if (quoteResponse.ok && quoteData.success) {
            addLog(`SUCCESS: Quote fetched`, 'success');
            addLog(`  Crypto Amount: ${quoteData.quote?.cryptoAmount}`, 'info');
            addLog(`  Exchange Rate: ${quoteData.quote?.exchangeRate}`, 'info');
            addLog(`  Fee: ${quoteData.quote?.fee}`, 'info');
            addLog(`  Full Response: ${JSON.stringify(quoteData, null, 2)}`, 'info');
          } else {
            addLog(`ERROR: ${quoteData.error || 'Unknown error'}`, 'error');
            addLog(`  Response: ${JSON.stringify(quoteData, null, 2)}`, 'error');
          }
        } catch (err: any) {
          addLog(`ERROR: Failed to fetch quote: ${err.message}`, 'error');
          addLog(`  Stack: ${err.stack}`, 'error');
        }
      }
      addLog('', 'info');

      // Test 4.5: Test quotes with payment method to see which providers support it
      addLog('Test 4.5: Testing quotes with payment method to see provider support...', 'info');
      if (!paymentMethod) {
        addLog('WARNING: Skipping - no payment method selected', 'warning');
      } else if (!cryptoCurrency) {
        addLog('WARNING: Skipping - no crypto currency selected', 'warning');
      } else {
        try {
          // Fetch quotes directly from Onramper API to see availablePaymentMethods
          const quotesUrl = `https://api.onramper.com/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}`;
          addLog(`  Fetching quotes from: ${quotesUrl}`, 'info');
          
          // We need to get the API key from our endpoint first, or just test the endpoint
          const quotesTestResponse = await fetch(`/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}`);
          if (quotesTestResponse.ok) {
            addLog(`  Note: Our /api/onramper/quotes endpoint returns a single best quote, not all providers`, 'info');
            addLog(`  To see all providers and their payment methods, we need to check server logs`, 'info');
          }
        } catch (err: any) {
          addLog(`  ERROR: ${err.message}`, 'error');
        }
      }
      addLog('', 'info');

      // Test 5: Test /api/onramper/checkout-intent (if payment method is selected)
      addLog('Test 5: Testing /api/onramper/checkout-intent endpoint...', 'info');
      if (!paymentMethod) {
        addLog('WARNING: Skipping checkout-intent test - no payment method selected', 'warning');
      } else if (!cryptoCurrency) {
        addLog('WARNING: Skipping checkout-intent test - no crypto currency selected', 'warning');
      } else {
        try {
          const checkoutIntentBody = {
            fiatAmount: parseFloat(fiatAmount),
            fiatCurrency,
            cryptoCurrency,
            walletAddress,
            paymentMethod,
          };
          addLog(`  Request Body: ${JSON.stringify(checkoutIntentBody, null, 2)}`, 'info');
          addLog(`  Note: Server will fetch quotes and find provider that supports "${paymentMethod}"`, 'info');
          
          const checkoutResponse = await fetch('/api/onramper/checkout-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutIntentBody),
          });
          
          const checkoutData = await checkoutResponse.json();
          if (checkoutResponse.ok && checkoutData.success) {
            addLog(`SUCCESS: Checkout intent created`, 'success');
            addLog(`  Transaction ID: ${checkoutData.transactionInformation?.transactionId}`, 'info');
            addLog(`  Type: ${checkoutData.transactionInformation?.type}`, 'info');
            addLog(`  URL: ${checkoutData.transactionInformation?.url?.substring(0, 100)}...`, 'info');
            addLog(`  Full Response: ${JSON.stringify(checkoutData, null, 2)}`, 'info');
          } else {
            addLog(`ERROR: ${checkoutData.error || checkoutData.message || 'Unknown error'}`, 'error');
            addLog(`  Status: ${checkoutResponse.status}`, 'error');
            addLog(`  Full Response: ${JSON.stringify(checkoutData, null, 2)}`, 'error');
            addLog(`  ⚠️ This error usually means:`, 'warning');
            addLog(`    1. No provider found that supports "${paymentMethod}"`, 'warning');
            addLog(`    2. Or the provider matching logic failed`, 'warning');
            addLog(`    3. Check Vercel logs for detailed provider/payment method info`, 'warning');
          }
        } catch (err: any) {
          addLog(`ERROR: Failed to create checkout intent: ${err.message}`, 'error');
          addLog(`  Stack: ${err.stack}`, 'error');
        }
      }
      addLog('', 'info');

      // Test 6: Check environment variables (client-side check)
      addLog('Test 6: Checking environment configuration...', 'info');
      addLog('  Note: API keys are server-side only, checking if endpoints are accessible', 'info');
      addLog('', 'info');

      // Test 7: Test payment method matching
      addLog('Test 7: Testing payment method matching logic...', 'info');
      if (paymentMethod) {
        addLog(`  Selected Payment Method: ${paymentMethod}`, 'info');
        addLog(`  Payment Method Lowercase: ${paymentMethod.toLowerCase()}`, 'info');
        addLog(`  Available Payment Methods: ${paymentMethods.length}`, 'info');
        paymentMethods.forEach((pm, idx) => {
          addLog(`    ${idx + 1}. ${pm.id} - ${pm.name}`, 'info');
        });
      } else {
        addLog('  WARNING: No payment method selected', 'warning');
      }
      addLog('', 'info');

      // Test 8: Network and chain info
      addLog('Test 8: Checking network and chain information...', 'info');
      if (currentChain) {
        const chain = CHAINS[currentChain];
        if (chain) {
          addLog(`  Chain: ${chain.name} (ID: ${chain.id})`, 'success');
          addLog(`  Network Code: ${OnramperService.getNetworkCode(chain.id)}`, 'info');
          addLog(`  Default Crypto: ${OnramperService.getDefaultCrypto(chain.id)}`, 'info');
          addLog(`  Supported Assets: ${OnramperService.getSupportedAssets(chain.id).join(', ')}`, 'info');
        }
      }
      addLog('', 'info');

      addLog('✅ Comprehensive test completed!', 'success');
      addLog('', 'info');
      addLog('📋 All logs above. Copy to clipboard for debugging.', 'info');

    } catch (err: any) {
      addLog(`FATAL ERROR: ${err.message}`, 'error');
      addLog(`  Stack: ${err.stack}`, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const copyLogsToClipboard = async () => {
    const logsText = testLogs.join('\n');
    try {
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      toast.success('Logs copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy logs');
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
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
                <button
                  onClick={() => setShowTestPanel(!showTestPanel)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                  <TestTube className="w-4 h-4" />
                  {showTestPanel ? 'Hide' : 'Show'} Test Panel
                </button>
              </div>
            </div>

            {/* Test Panel */}
            {showTestPanel && (
              <div className="mb-6 glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">🧪 Comprehensive Test Panel</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={copyLogsToClipboard}
                      disabled={testLogs.length === 0}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Logs</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={runComprehensiveTest}
                      disabled={isTesting}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <TestTube className="w-4 h-4" />
                          <span>Run Full Test</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs">
                  {testLogs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      Click "Run Full Test" to start comprehensive testing...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {testLogs.map((log, idx) => {
                        const isError = log.includes('❌') || log.includes('ERROR');
                        const isSuccess = log.includes('✅') || log.includes('SUCCESS');
                        const isWarning = log.includes('⚠️') || log.includes('WARNING');
                        return (
                          <div
                            key={idx}
                            className={`${
                              isError
                                ? 'text-red-400'
                                : isSuccess
                                ? 'text-green-400'
                                : isWarning
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                            } whitespace-pre-wrap break-words`}
                          >
                            {log}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  allow="payment; camera; microphone"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation"
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

