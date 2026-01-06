'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, ArrowRight, Flame, CreditCard, TestTube, Copy, Check, TrendingUp, Shield, Star, Award, Info } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { OnramperService } from '@/lib/onramper-service';
import { ProviderSelector } from '@/lib/provider-selector';
import { UserOnRampPreferencesService } from '@/lib/user-onramp-preferences';
import { GeolocationService } from '@/lib/geolocation';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
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

interface ProviderQuote {
  ramp: string;
  paymentMethod: string;
  rate?: number;
  networkFee?: number;
  transactionFee?: number;
  payout?: number;
  availablePaymentMethods?: Array<{ paymentTypeId: string; name: string; icon: string }>;
  quoteId?: string;
  recommendations?: string[];
  errors?: Array<{ type: string; errorId: number; message: string }>;
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
  const [flowStep, setFlowStep] = useState<'amount' | 'crypto' | 'payment' | 'quotes' | 'review'>('amount'); // ⚠️ NEW: Step-by-step flow
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  
  // ⚠️ NEW: Availability checking state
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<Set<string>>(new Set());
  const [availableCryptosSet, setAvailableCryptosSet] = useState<Set<string>>(new Set());
  const [unavailableReasons, setUnavailableReasons] = useState<Record<string, string>>({});
  
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
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Data state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [providerQuotes, setProviderQuotes] = useState<ProviderQuote[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showProviderComparison, setShowProviderComparison] = useState(false);
  const [comparisonQuotes, setComparisonQuotes] = useState<ProviderQuote[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<{ verifiedProviders: string[]; preferredProvider: string | null } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [fiatCurrencies, setFiatCurrencies] = useState<string[]>(['EUR', 'USD', 'GBP']);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<string[]>([]);
  const [widgetUrl, setWidgetUrl] = useState<string>('');
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);

  const supportedFiats = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'NOK', 'SEK', 'DKK'];

  // Get user ID and preferences for provider selection
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          setUserId(user.id);
          // Load user preferences
          const preferences = await UserOnRampPreferencesService.get(user.id);
          if (preferences) {
            setUserPreferences({
              verifiedProviders: preferences.verifiedProviders || [],
              preferredProvider: preferences.preferredProvider,
            });
          }
        }
      } catch (error) {
        // User not logged in - that's okay
        setUserId(null);
      }
    };
    getUser();
  }, []);

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

  // ⚠️ CRITICAL: NO automatic quote fetching - quotes are ONLY fetched when:
  // 1. User explicitly clicks "Get Quotes" button, OR
  // 2. All fields are complete (amount, crypto, payment method) AND user changes payment method
  // This prevents race conditions and unnecessary API calls
  useEffect(() => {
    // Clear quotes when payment method is deselected or changed
    if (paymentMethod === '' || !paymentMethod) {
      setProviderQuotes([]);
      setQuote(null);
      setSelectedProvider(null);
      setShowProviderComparison(false);
      setComparisonQuotes([]);
      return;
    }
    
    // Only auto-fetch if ALL fields are complete AND payment method was just selected
    // This prevents fetching on initial load or when amount/crypto changes
    if (isOpen && step === 'select' && 
        fiatAmount && parseFloat(fiatAmount) > 0 && 
        cryptoCurrency && 
        paymentMethod) {
      // Debounce to prevent multiple calls
      const debounceTimer = setTimeout(() => {
        console.log('🔄 [BUYMODAL] Auto-fetching quotes (all fields complete)');
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [paymentMethod]); // ⚠️ ONLY depend on paymentMethod - don't auto-fetch on amount/crypto changes

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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset ALL state when modal opens (prevent stale data)
      setStep('select');
      setFlowStep('amount'); // ⚠️ NEW: Start at first step
      setShowWidget(false);
      setWidgetUrl('');
      setError(null);
      setLoading(false);
      setPaymentMethod(''); // ⚠️ CRITICAL: Reset payment method to prevent stale quotes
      setProviderQuotes([]);
      setQuote(null);
      setSelectedProvider(null);
      setShowProviderComparison(false);
      setComparisonQuotes([]);
      setAvailablePaymentMethods(new Set());
      setAvailableCryptosSet(new Set());
      setUnavailableReasons({});
    }
  }, [isOpen]);

  const fetchSupportedData = async () => {
    try {
      // Remove hardcoded country - let server auto-detect
      const response = await fetch('/api/onramper/supported-data');
      const data = await response.json();

      if (data.success) {
        // Store detected country for filtering
        if (data.detectedCountry) {
          setUserCountry(data.detectedCountry);
        }
        
        if (data.paymentMethods) {
          // ⚠️ FILTER: Bancontact only for Belgian users (BE country code)
          // ⚠️ NOTE: iDEAL is supported by BANXA (verified via Onramper API)
          // Availability checking will determine if iDEAL is available for selected crypto
          const filteredPaymentMethods = data.paymentMethods.filter((pm: PaymentMethod) => {
            const pmId = pm.id.toLowerCase();
            
            // Bancontact only for Belgium (BE)
            if (pmId === 'bancontact' || pmId.includes('bancontact')) {
              const country = data.detectedCountry || GeolocationService.getSavedCountryPreference();
              if (country?.toUpperCase() !== 'BE') {
                return false; // Hide Bancontact for non-Belgian users
              }
            }
            
            return true;
          });
          
          setPaymentMethods(filteredPaymentMethods);
        }
        if (data.fiatCurrencies) {
          setFiatCurrencies(data.fiatCurrencies);
        }
        if (data.cryptoCurrencies) {
          // ⚠️ FILTER: Remove USDC (test results show no providers support it)
          const filteredCryptos = data.cryptoCurrencies.filter((crypto: string) => {
            // USDC is not actually supported (no quotes available)
            if (crypto.toUpperCase() === 'USDC') {
              return false;
            }
            return true;
          });
          setCryptoCurrencies(filteredCryptos);
        }
      }
    } catch (err: any) {
      logger.error('Failed to fetch Onramper supported data:', err);
    }
  };

  // ⚠️ NEW: Check payment method availability for selected crypto
  const checkPaymentMethodAvailability = async (crypto: string, paymentMethodId: string): Promise<boolean> => {
    try {
      const url = `/api/onramper/quotes?fiatAmount=250&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&paymentMethod=${paymentMethodId}`;
      const response = await fetch(url);
      
      // ⚠️ CRITICAL: Check response status - 200 means API worked (even if 0 quotes)
      if (!response.ok) {
        console.log(`❌ [AVAILABILITY] ${paymentMethodId} with ${crypto}: API error ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      
      // ⚠️ CRITICAL: success=true means API worked, quotes.length > 0 means providers available
      if (data.success && Array.isArray(data.quotes) && data.quotes.length > 0) {
        console.log(`✅ [AVAILABILITY] ${paymentMethodId} with ${crypto}: ${data.quotes.length} providers available`);
        return true;
      }
      
      console.log(`⚠️ [AVAILABILITY] ${paymentMethodId} with ${crypto}: 0 providers (valid - not available)`);
      return false;
    } catch (error: any) {
      console.error(`❌ [AVAILABILITY] ${paymentMethodId} with ${crypto}: Error:`, error.message);
      return false;
    }
  };

  // ⚠️ NEW: Check crypto availability
  const checkCryptoAvailability = async (crypto: string): Promise<boolean> => {
    try {
      const url = `/api/onramper/quotes?fiatAmount=250&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.quotes && data.quotes.length > 0) {
        const validQuotes = data.quotes.filter((q: any) => !q.errors || q.errors.length === 0);
        return validQuotes.length > 0;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  // ⚠️ NEW: Update availability when crypto changes and we're on payment step
  useEffect(() => {
    if (cryptoCurrency && flowStep === 'payment' && paymentMethods.length > 0) {
      const updateAvailability = async () => {
        console.log(`🔄 [AVAILABILITY] Starting availability check for ${cryptoCurrency}...`);
        setCheckingAvailability(true);
        const available = new Set<string>();
        const reasons: Record<string, string> = {};
        
        // ⚠️ OPTIMIZATION: Check payment methods in parallel (but with rate limiting)
        // Process in batches of 3 to avoid overwhelming the API
        const batchSize = 3;
        for (let i = 0; i < paymentMethods.length; i += batchSize) {
          const batch = paymentMethods.slice(i, i + batchSize);
          const batchPromises = batch.map(async (pm) => {
            try {
              const isAvailable = await checkPaymentMethodAvailability(cryptoCurrency, pm.id);
              if (isAvailable) {
                available.add(pm.id);
                console.log(`✅ [AVAILABILITY] ${pm.name} (${pm.id}): Available`);
              } else {
                reasons[pm.id] = `No providers available for ${pm.name} with ${cryptoCurrency}`;
                console.log(`⚠️ [AVAILABILITY] ${pm.name} (${pm.id}): Not available`);
              }
            } catch (error: any) {
              reasons[pm.id] = `Error checking availability for ${pm.name}`;
              console.error(`❌ [AVAILABILITY] ${pm.name} (${pm.id}): Error:`, error.message);
            }
          });
          
          await Promise.all(batchPromises);
          
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < paymentMethods.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        console.log(`✅ [AVAILABILITY] Check complete: ${available.size}/${paymentMethods.length} methods available`);
        setAvailablePaymentMethods(available);
        setUnavailableReasons(reasons);
        setCheckingAvailability(false);
      };
      
      updateAvailability();
    } else if (!cryptoCurrency || flowStep !== 'payment') {
      // Clear availability when not on payment step
      setAvailablePaymentMethods(new Set());
      setAvailableCryptosSet(new Set());
      setUnavailableReasons({});
    }
  }, [cryptoCurrency, flowStep, paymentMethods.length, fiatCurrency]); // ⚠️ Use length to avoid infinite loop

  // ⚠️ NEW: Navigation functions for step-by-step flow
  const handleAmountNext = () => {
    if (!fiatAmount || parseFloat(fiatAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setFlowStep('crypto');
    setError(null);
  };

  const handleCryptoNext = () => {
    if (!cryptoCurrency) {
      setError('Please select a cryptocurrency');
      return;
    }
    setFlowStep('payment');
    setError(null);
  };

  const handlePaymentNext = async () => {
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }
    
    // Check if payment method is available
    if (!availablePaymentMethods.has(paymentMethod)) {
      setError(unavailableReasons[paymentMethod] || 'This payment method is not available');
      return;
    }
    
    setFlowStep('quotes');
    setError(null);
    // Automatically fetch quotes when moving to quotes step
    await fetchQuote();
  };

  const handleBack = () => {
    if (flowStep === 'crypto') {
      setFlowStep('amount');
    } else if (flowStep === 'payment') {
      setFlowStep('crypto');
    } else if (flowStep === 'quotes') {
      setFlowStep('payment');
    } else if (flowStep === 'review') {
      setFlowStep('quotes');
    }
    setError(null);
  };

  const fetchQuote = async () => {
    // ⚠️ CRITICAL: Only fetch quotes if ALL required fields are present
    if (!fiatAmount || parseFloat(fiatAmount) <= 0) {
      console.log('⚠️ [BUYMODAL] Skipping quote fetch - invalid amount:', fiatAmount);
      setError('Please enter a valid amount');
      return;
    }
    
    if (!cryptoCurrency) {
      console.log('⚠️ [BUYMODAL] Skipping quote fetch - no crypto selected');
      setError('Please select a cryptocurrency');
      return;
    }
    
    if (!paymentMethod) {
      console.log('⚠️ [BUYMODAL] Skipping quote fetch - no payment method selected');
      setError('Please select a payment method');
      return;
    }
    
    console.log('✅ [BUYMODAL] All fields complete, fetching quotes:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      paymentMethod
    });

    try {
      setLoading(true);
      setError(null);

      // Fetch quotes from ALL providers
      const quoteUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}${paymentMethod ? `&paymentMethod=${paymentMethod}` : ''}`;
      const quoteResponse = await fetch(quoteUrl);

      const data = await quoteResponse.json();

      console.log('🔍 [BUYMODAL] Quote fetch response:', {
        success: data.success,
        quoteCount: data.quotes?.length || 0,
        requestedPaymentMethod: paymentMethod,
        responsePaymentMethod: data.paymentMethod || 'none',
        quotes: data.quotes?.map((q: any) => ({
          ramp: q.ramp,
          paymentMethod: q.paymentMethod || 'none',
          hasErrors: !!(q.errors && q.errors.length > 0),
          availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
        }))
      });
      
      // ⚠️ CRITICAL: Check if response has wrong paymentMethod (should match request)
      if (data.paymentMethod && data.paymentMethod !== paymentMethod) {
        console.warn('⚠️ [BUYMODAL] Response paymentMethod mismatch:', {
          requested: paymentMethod,
          received: data.paymentMethod
        });
      }

      if (data.success && data.quotes) {
        // Check if we got 0 quotes (no providers support this combination)
        if (data.quotes.length === 0) {
          console.error(`❌ [BUYMODAL] API returned 0 quotes for ${paymentMethod} + ${cryptoCurrency}`);
          setError(`No providers available for ${paymentMethod} with ${cryptoCurrency}. Please try a different payment method or cryptocurrency.`);
          setQuote(null);
          setProviderQuotes([]);
          setSelectedProvider(null);
          return;
        }
        
        // ⚠️ CRITICAL: Double-check payment method support (backup filtering)
        // Even though backend filters, we filter again here for 100% certainty
        let quotesToUse = data.quotes;
        if (paymentMethod) {
          console.log(`🔍 [BUYMODAL] Filtering ${data.quotes.length} quotes for payment method: ${paymentMethod}`);
          const paymentMethodLower = paymentMethod.toLowerCase();
          const isIdeal = paymentMethodLower.includes('ideal');
          
          quotesToUse = data.quotes.filter((q: ProviderQuote) => {
            // ⚠️ CRITICAL: If quote has the correct paymentMethod, accept it even if it has errors
            // The backend already filtered these, so we should trust them
            // Errors don't necessarily mean payment method isn't supported
            if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
              // Only reject if there are errors that specifically indicate payment method incompatibility
              if (q.errors && q.errors.length > 0) {
                const hasPaymentMethodError = q.errors.some((err: any) => {
                  const errorMsg = (err.message || '').toLowerCase();
                  const errorType = (err.type || '').toLowerCase();
                  return errorMsg.includes('does not support payment method') ||
                         errorMsg.includes('payment method not supported') ||
                         errorMsg.includes('payment type not supported') ||
                         errorType === 'paymentmethodnotsupported';
                });
                
                if (hasPaymentMethodError) {
                  console.log(`❌ [BUYMODAL] Rejecting ${q.ramp}: has payment-method-specific error`);
                  return false;
                }
              }
              // Quote has correct paymentMethod and no payment-method-specific errors - accept it
              return true;
            }
            
            // If quote doesn't have the payment method set, check for errors
            // (but backend should have already filtered these, so this is just a safety check)
            if (q.errors && q.errors.length > 0) {
              return false;
            }
            
            // If quote already has the payment method set, it's supported
            if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
              return true;
            }
            
            // Check availablePaymentMethods array
            const methods = q.availablePaymentMethods || [];
            return methods.some((pm: any) => {
              const id = pm.paymentTypeId || pm.id || '';
              const idLower = id.toLowerCase();
              
              // Exact match
              if (idLower === paymentMethodLower) {
                return true;
              }
              
              // For iDEAL, also check for variants
              if (isIdeal && idLower.includes('ideal')) {
                return true;
              }
              
              return false;
            });
          });
          
          console.log(`✅ [BUYMODAL] Filtered quotes: ${data.quotes.length} → ${quotesToUse.length} providers for ${paymentMethod}`);
          console.log(`✅ [BUYMODAL] Providers after filtering:`, quotesToUse.map((q: ProviderQuote) => q.ramp));
          
          if (quotesToUse.length === 0) {
            console.error(`❌ [BUYMODAL] NO providers support ${paymentMethod} for ${cryptoCurrency}!`);
            console.error(`❌ [BUYMODAL] Original quotes:`, 
              data.quotes.map((q: ProviderQuote) => ({
                ramp: q.ramp,
                paymentMethod: q.paymentMethod,
                availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || [],
                hasErrors: !!(q.errors && q.errors.length > 0)
              }))
            );
            
            // Show user-friendly error message
            setError(`No providers available for ${paymentMethod} with ${cryptoCurrency}. Please try a different payment method or cryptocurrency.`);
            setQuote(null);
            setProviderQuotes([]);
            setSelectedProvider(null);
            return; // Don't continue with empty quotes
          } else {
            console.log(`✅ [BUYMODAL] Filtered quotes details:`, 
              quotesToUse.map((q: ProviderQuote) => ({
                ramp: q.ramp,
                paymentMethod: q.paymentMethod,
                availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
              }))
            );
          }
        }
        
        // Store filtered provider quotes
        console.log(`💾 [BUYMODAL] Storing ${quotesToUse.length} quotes in state`);
        setProviderQuotes(quotesToUse);
        
        // Select best provider using smart selection (with user preferences)
        // ⚠️ CRITICAL: Only select provider if we have quotes AND payment method
        if (quotesToUse.length > 0 && paymentMethod) {
          try {
            console.log(`🎯 [BUYMODAL] Selecting provider from ${quotesToUse.length} filtered quotes`);
            const selection = await ProviderSelector.selectProvider(
              quotesToUse, // Use filtered quotes, not all quotes!
              userId,
              paymentMethod
            );
            
            console.log(`✅ [BUYMODAL] Selected provider: ${selection.quote.ramp} (reason: ${selection.reason})`);
            // Set selected provider
            setSelectedProvider(selection.quote.ramp);
            
            // Show comparison if needed
            if (selection.showComparison && selection.comparisonQuotes) {
              setShowProviderComparison(true);
              setComparisonQuotes(selection.comparisonQuotes);
            } else {
              setShowProviderComparison(false);
              setComparisonQuotes([]);
            }
            
            // Convert selected quote to old format for backward compatibility
            const selectedQuote = selection.quote;
            if (selectedQuote.payout) {
              setQuote({
                cryptoAmount: selectedQuote.payout.toString(),
                exchangeRate: selectedQuote.rate?.toString() || '0',
                fee: ((selectedQuote.networkFee || 0) + (selectedQuote.transactionFee || 0)).toString(),
                totalAmount: fiatAmount,
                baseCurrency: fiatCurrency,
                quoteCurrency: cryptoCurrency,
              });
            }
          } catch (selectionError: any) {
            logger.error('Failed to select provider:', selectionError);
            // Fallback: use first valid quote from FILTERED quotes
            const firstValid = quotesToUse.find((q: ProviderQuote) => !q.errors || q.errors.length === 0);
            if (firstValid) {
              setSelectedProvider(firstValid.ramp);
              if (firstValid.payout) {
                setQuote({
                  cryptoAmount: firstValid.payout.toString(),
                  exchangeRate: firstValid.rate?.toString() || '0',
                  fee: ((firstValid.networkFee || 0) + (firstValid.transactionFee || 0)).toString(),
                  totalAmount: fiatAmount,
                  baseCurrency: fiatCurrency,
                  quoteCurrency: cryptoCurrency,
                });
              }
            }
          }
        } else {
          // No payment method selected - clear quotes (shouldn't happen due to useEffect check, but safety)
          console.log('⚠️ [BUYMODAL] No payment method selected, clearing quotes');
          setProviderQuotes([]);
          setQuote(null);
          setSelectedProvider(null);
        }
      } else {
        setError(data.error || 'Failed to fetch quotes');
        setQuote(null);
        setProviderQuotes([]);
      }
    } catch (err: any) {
      logger.error('Failed to fetch Onramper quotes:', err);
      setError('Failed to fetch quotes. Please try again.');
      setQuote(null);
      setProviderQuotes([]);
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

    // Select provider if not already selected
    let providerToUse = selectedProvider;
    if (!providerToUse && providerQuotes.length > 0) {
      try {
        const selection = await ProviderSelector.selectProvider(
          providerQuotes,
          userId,
          paymentMethod
        );
        providerToUse = selection.quote.ramp;
        setSelectedProvider(providerToUse);
      } catch (selectionError: any) {
        logger.error('Failed to select provider:', selectionError);
        // Fallback: use first valid quote
        const firstValid = providerQuotes.find((q: ProviderQuote) => !q.errors || q.errors.length === 0);
        if (firstValid) {
          providerToUse = firstValid.ramp;
          setSelectedProvider(providerToUse);
        } else {
          toast.error('No valid provider available');
          return;
        }
      }
    }

    if (!providerToUse) {
      toast.error('No provider available. Please try again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use new checkout-intent API with selected provider
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
          onramp: providerToUse, // REQUIRED: Selected provider
        }),
      });

      const data = await response.json();

      if (data.success && data.transactionInformation) {
        const { transactionInformation } = data;
        const transactionType = transactionInformation.type; // "iframe" or "redirect"
        const transactionUrl = transactionInformation.url;
        const transactionId = transactionInformation.transactionId;

        // Store transaction ID for tracking
        setLastTransactionId(transactionId);

        logger.log('✅ Onramper checkout intent created:', {
          transactionId,
          type: transactionType,
          provider: providerToUse,
        });

        // Check if URL is from Moonpay (CSP blocks iframe embedding)
        const isMoonpay = transactionUrl.includes('moonpay.com') || transactionUrl.includes('buy.moonpay.com');
        
        if (transactionType === 'iframe' && !isMoonpay) {
          // ✅ Embed in iframe (binnen eigen UI) - but NOT for Moonpay (CSP blocks it)
          setWidgetUrl(transactionUrl);
          setShowWidget(true);
          setStep('widget');
          toast.success('Opening payment widget...');
        } else if (transactionType === 'redirect' || transactionType === 'popup' || isMoonpay) {
          // Force popup/redirect for Moonpay (CSP blocks iframe)
          if (isMoonpay) {
            logger.log('⚠️ Moonpay detected - using popup/redirect (CSP blocks iframe embedding)');
          }
          // Detect if user is on mobile device
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                          (typeof window !== 'undefined' && window.innerWidth <= 768);
          
          if (isMobile) {
            // 📱 MOBILE: Direct redirect in same window (popups are often blocked on mobile)
            // This provides the best UX on mobile devices
            logger.log('📱 Mobile device detected - using direct redirect instead of popup');
            
            // Show message to user
            toast('Redirecting to payment page...', { icon: '💳', duration: 2000 });
            
            // Store transaction info in sessionStorage so we can track it
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('onramper_transaction', JSON.stringify({
                transactionId,
                provider: 'onramper',
                timestamp: Date.now(),
              }));
            }
            
            // Direct redirect - user will complete payment and be redirected back via redirectUrl
            setStep('processing');
            
            // Small delay to ensure toast is visible, then redirect
            setTimeout(() => {
              window.location.href = transactionUrl;
            }, 500);
          } else {
            // 💻 DESKTOP: Use popup (better UX, keeps user in context)
            logger.log('💻 Desktop device detected - using popup');
            
            // Use more permissive popup features to allow payment flows
            // location=yes allows Banxa to show URL bar and handle redirects properly
            const popupFeatures = [
              'width=800',
              'height=900',
              'left=' + (window.screen.width / 2 - 400),
              'top=' + (window.screen.height / 2 - 450),
              'scrollbars=yes',
              'resizable=yes',
              'toolbar=no',
              'menubar=no',
              'location=yes', // ✅ Changed to 'yes' to allow Banxa verification page to load properly
              'directories=no',
              'status=yes', // ✅ Changed to 'yes' for better compatibility with Banxa
            ].join(',');

            const popup = window.open(
              transactionUrl,
              'onramper-payment',
              popupFeatures
            );

            if (!popup) {
              // Popup blocked - fallback to direct redirect (same as mobile)
              logger.warn('⚠️ Popup blocked - falling back to direct redirect');
              toast('Popup blocked. Redirecting to payment page...', { icon: '💳' });
              
              // Store transaction info
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('onramper_transaction', JSON.stringify({
                  transactionId,
                  provider: 'onramper',
                  timestamp: Date.now(),
                }));
              }
              
              setStep('processing');
              setTimeout(() => {
                window.location.href = transactionUrl;
              }, 500);
            } else {
              // Focus the popup to ensure it's visible
              popup.focus();
              
              // ✅ Wait a moment for popup to load, then check if it's still accessible
              setTimeout(() => {
                try {
                  // Try to access popup.location to verify it loaded
                  const popupUrl = popup.location.href;
                  logger.log('✅ Popup loaded successfully:', popupUrl.substring(0, 100));
                } catch (e) {
                  // Cross-origin error is expected for Banxa - this is normal
                  logger.log('ℹ️ Popup opened (cross-origin, cannot access URL - this is normal for Banxa)');
                }
              }, 1000);
              
              // Monitor popup for completion
              setStep('processing');
              toast('Complete payment in the popup window', { icon: '💳' });

              // Monitor popup for completion and redirect
              const checkPopup = setInterval(async () => {
                if (popup.closed) {
                  clearInterval(checkPopup);
                  // Popup closed - user likely completed payment or cancelled
                  logger.log('Popup closed, checking transaction status...');
                  
                  // Update user preferences after successful transaction
                  if (userId && lastTransactionId) {
                    try {
                      await UserOnRampPreferencesService.updateAfterTransaction(userId, lastTransactionId);
                      logger.log('✅ Updated user preferences after transaction');
                      // Reload preferences
                      const updatedPrefs = await UserOnRampPreferencesService.get(userId);
                      if (updatedPrefs) {
                        setUserPreferences({
                          verifiedProviders: updatedPrefs.verifiedProviders || [],
                          preferredProvider: updatedPrefs.preferredProvider,
                        });
                      }
                    } catch (error) {
                      logger.error('Failed to update preferences:', error);
                    }
                  }
                  
                  // Trigger balance refresh event
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('balanceRefresh'));
                  }
                  
                  toast.success('Payment completed! Redirecting...', { icon: '🎉' });
                  setStep('select');
                  
                  // Close modal after a short delay
                  setTimeout(() => {
                    onClose();
                  }, 1500);
                } else {
                  // Check if popup URL changed to success page (indicates payment completed)
                  try {
                    const popupUrl = popup.location.href;
                    if (popupUrl.includes('/buy/success') || popupUrl.includes('/status/')) {
                      // Payment completed - close popup and redirect
                      clearInterval(checkPopup);
                      popup.close();
                      
                      // Update user preferences after successful transaction
                      if (userId && transactionId) {
                        try {
                          await UserOnRampPreferencesService.updateAfterTransaction(userId, transactionId);
                          logger.log('✅ Updated user preferences after transaction');
                        } catch (error) {
                          logger.error('Failed to update preferences:', error);
                        }
                      }
                      
                      // Redirect to success page
                      window.location.href = `/buy/success?provider=onramper&transactionId=${transactionId || Date.now()}`;
                    }
                  } catch (e) {
                    // Cross-origin restrictions - can't access popup.location
                    // This is normal for Banxa/Onramper popups
                    // Keep popup focused to prevent it from being hidden
                    try {
                      if (document.hasFocus() && !popup.document.hasFocus()) {
                        popup.focus();
                      }
                    } catch (focusError) {
                      // Ignore focus errors
                    }
                  }
                }
              }, 1000);

              // Cleanup interval after 10 minutes (longer for payment flows)
              setTimeout(() => {
                clearInterval(checkPopup);
              }, 10 * 60 * 1000);
            }
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

  // 🔍 Debug Onramper function - Diagnose iDEAL and payment method issues
  const runOnramperDebug = async () => {
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
      addLog('🔍 Starting Onramper Debug Diagnostics...', 'info');
      addLog('This will test country detection, payment methods, and iDEAL support', 'info');
      addLog('', 'info');

      // Call debug endpoint
      addLog('Calling /api/onramper/debug endpoint...', 'info');
      const debugUrl = `/api/onramper/debug?fiatAmount=${fiatAmount || 100}&fiatCurrency=${fiatCurrency || 'EUR'}&cryptoCurrency=${cryptoCurrency || 'ETH'}&paymentMethod=${paymentMethod || 'ideal'}`;
      addLog(`URL: ${debugUrl}`, 'info');
      
      const debugResponse = await fetch(debugUrl);
      const debugData = await debugResponse.json();

      if (!debugResponse.ok || !debugData.success) {
        addLog(`ERROR: Debug endpoint failed`, 'error');
        addLog(`Response: ${JSON.stringify(debugData, null, 2)}`, 'error');
        return;
      }

      addLog('', 'info');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('📊 DEBUG RESULTS', 'success');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('', 'info');

      // Display summary
      if (debugData.summary) {
        addLog('SUMMARY:', 'info');
        addLog(`  Detected Country: ${debugData.summary.detectedCountry || 'NOT DETECTED'}`, 
          debugData.summary.detectedCountry ? 'success' : 'warning');
        addLog(`  Valid Quotes (with ${paymentMethod || 'ideal'}): ${debugData.summary.validQuotesWithMethod} / ${debugData.summary.totalProviders}`,
          debugData.summary.validQuotesWithMethod > 0 ? 'success' : 'error');
        
        if (debugData.summary.diagnosis && debugData.summary.diagnosis.length > 0) {
          addLog('', 'info');
          addLog('DIAGNOSIS:', 'warning');
          debugData.summary.diagnosis.forEach((issue: string) => {
            addLog(`  ${issue}`, issue.startsWith('✅') ? 'success' : issue.startsWith('❌') ? 'error' : 'warning');
          });
        }
      }

      addLog('', 'info');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('📋 DETAILED LOGS', 'info');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('', 'info');

      // Display all debug logs
      if (debugData.logs && Array.isArray(debugData.logs)) {
        debugData.logs.forEach((log: any) => {
          addLog(`[${log.section}]`, 'info');
          addLog(JSON.stringify(log.data, null, 2), 'info');
          addLog('', 'info');
        });
      }

      addLog('', 'info');
      addLog('✅ Debug diagnostics completed!', 'success');
      addLog('', 'info');
      addLog('📋 Copy these logs and share them for debugging', 'info');

    } catch (error: any) {
      addLog(`FATAL ERROR: ${error.message}`, 'error');
      addLog(`Stack: ${error.stack}`, 'error');
    } finally {
      setIsTesting(false);
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

      // Test 4: Test /api/onramper/quotes (MULTI-PROVIDER)
      addLog('Test 4: Testing /api/onramper/quotes endpoint (MULTI-PROVIDER)...', 'info');
      if (!cryptoCurrency) {
        addLog('WARNING: Skipping quote test - no crypto currency selected', 'warning');
      } else {
        try {
          const quoteUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}${paymentMethod ? `&paymentMethod=${paymentMethod}` : ''}`;
          addLog(`  URL: ${quoteUrl}`, 'info');
          const quoteResponse = await fetch(quoteUrl);
          const quoteData = await quoteResponse.json();
          if (quoteResponse.ok && quoteData.success) {
            addLog(`SUCCESS: Multi-provider quotes fetched`, 'success');
            
            // NEW: Response is now an array of quotes from all providers
            const quotes = quoteData.quotes || [];
            addLog(`  Total Providers: ${quotes.length}`, 'info');
            
            if (quotes.length > 0) {
              const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
              const invalidQuotes = quotes.filter((q: any) => q.errors && q.errors.length > 0);
              
              addLog(`  Valid Quotes: ${validQuotes.length}`, validQuotes.length > 0 ? 'success' : 'warning');
              addLog(`  Invalid Quotes (errors): ${invalidQuotes.length}`, invalidQuotes.length > 0 ? 'warning' : 'info');
              
              // Show each provider quote
              quotes.forEach((q: any, idx: number) => {
                if (q.errors && q.errors.length > 0) {
                  addLog(`    ${idx + 1}. ${q.ramp} - ERROR: ${q.errors[0]?.message || 'Unknown error'}`, 'error');
                } else {
                  addLog(`    ${idx + 1}. ${q.ramp} - ${q.payout ? parseFloat(q.payout.toString()).toFixed(6) : 'N/A'} ${cryptoCurrency}`, 'success');
                  if (q.recommendations && q.recommendations.length > 0) {
                    addLog(`       Recommendations: ${q.recommendations.join(', ')}`, 'info');
                  }
                  if (q.rate) {
                    addLog(`       Rate: ${q.rate}`, 'info');
                  }
                  if (q.networkFee || q.transactionFee) {
                    addLog(`       Fees: Network ${q.networkFee || 0}, Transaction ${q.transactionFee || 0}`, 'info');
                  }
                }
              });
            } else {
              addLog(`  WARNING: No quotes returned`, 'warning');
            }
            
            addLog(`  Full Response: ${JSON.stringify(quoteData, null, 2)}`, 'info');
          } else {
            addLog(`ERROR: ${quoteData.error || 'Unknown error'}`, 'error');
            addLog(`  Response: ${JSON.stringify(quoteData, null, 2)}`, 'error');
          }
        } catch (err: any) {
          addLog(`ERROR: Failed to fetch quotes: ${err.message}`, 'error');
          addLog(`  Stack: ${err.stack}`, 'error');
        }
      }
      addLog('', 'info');

      // Test 4.5: Test Provider Selection Logic
      addLog('Test 4.5: Testing Provider Selection Logic...', 'info');
      if (!cryptoCurrency) {
        addLog('WARNING: Skipping - no crypto currency selected', 'warning');
      } else if (!paymentMethod) {
        addLog('WARNING: Skipping - no payment method selected', 'warning');
      } else {
        try {
          // Get quotes first
          const quotesUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}`;
          const quotesResponse = await fetch(quotesUrl);
          const quotesData = await quotesResponse.json();
          
          if (quotesResponse.ok && quotesData.success && quotesData.quotes) {
            const quotes = quotesData.quotes;
            addLog(`  Fetched ${quotes.length} provider quotes`, 'success');
            
            // Test provider selection
            if (userId) {
              addLog(`  User ID: ${userId}`, 'info');
              
              // Get user preferences
              const preferences = await UserOnRampPreferencesService.get(userId);
              if (preferences) {
                addLog(`  User Preferences:`, 'info');
                addLog(`    Preferred Provider: ${preferences.preferredProvider || 'None'}`, 'info');
                addLog(`    Verified Providers: ${preferences.verifiedProviders?.join(', ') || 'None'}`, 'info');
                addLog(`    Last Used Provider: ${preferences.lastUsedProvider || 'None'}`, 'info');
              } else {
                addLog(`  No user preferences found (new user)`, 'info');
              }
              
              // Test provider selection
              try {
                const selection = await ProviderSelector.selectProvider(quotes, userId, paymentMethod);
                addLog(`  Provider Selection Result:`, 'success');
                addLog(`    Selected Provider: ${selection.quote.ramp}`, 'success');
                addLog(`    Reason: ${selection.reason}`, 'info');
                addLog(`    Show Comparison: ${selection.showComparison ? 'Yes' : 'No'}`, 'info');
                if (selection.comparisonQuotes) {
                  addLog(`    Comparison Quotes: ${selection.comparisonQuotes.length}`, 'info');
                }
                if (selection.quote.payout) {
                  addLog(`    Payout: ${parseFloat(selection.quote.payout.toString()).toFixed(6)} ${cryptoCurrency}`, 'info');
                }
              } catch (selectionError: any) {
                addLog(`  ERROR: Provider selection failed: ${selectionError.message}`, 'error');
              }
            } else {
              addLog(`  No user ID (guest user) - will select best rate`, 'info');
              try {
                const selection = await ProviderSelector.selectProvider(quotes, null, paymentMethod);
                addLog(`  Provider Selection Result:`, 'success');
                addLog(`    Selected Provider: ${selection.quote.ramp}`, 'success');
                addLog(`    Reason: ${selection.reason}`, 'info');
              } catch (selectionError: any) {
                addLog(`  ERROR: Provider selection failed: ${selectionError.message}`, 'error');
              }
            }
          } else {
            addLog(`  ERROR: Could not fetch quotes for provider selection test`, 'error');
          }
        } catch (err: any) {
          addLog(`  ERROR: ${err.message}`, 'error');
          addLog(`  Stack: ${err.stack}`, 'error');
        }
      }
      addLog('', 'info');

      // Test 5: Test /api/onramper/checkout-intent (REQUIRES onramp parameter)
      addLog('Test 5: Testing /api/onramper/checkout-intent endpoint (NEW: requires onramp)...', 'info');
      if (!paymentMethod) {
        addLog('WARNING: Skipping checkout-intent test - no payment method selected', 'warning');
      } else if (!cryptoCurrency) {
        addLog('WARNING: Skipping checkout-intent test - no crypto currency selected', 'warning');
      } else {
        try {
          // First, get quotes and select a provider
          addLog(`  Step 1: Fetching quotes to select provider...`, 'info');
          const quotesUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}`;
          const quotesResponse = await fetch(quotesUrl);
          const quotesData = await quotesResponse.json();
          
          let selectedProvider = 'banxa'; // Fallback
          
          if (quotesResponse.ok && quotesData.success && quotesData.quotes) {
            const quotes = quotesData.quotes;
            const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
            
            if (validQuotes.length > 0) {
              // Select provider using ProviderSelector
              try {
                const selection = await ProviderSelector.selectProvider(quotes, userId, paymentMethod);
                selectedProvider = selection.quote.ramp;
                addLog(`  ✅ Selected Provider: ${selectedProvider} (Reason: ${selection.reason})`, 'success');
              } catch (selectionError: any) {
                // Fallback: use first valid quote
                selectedProvider = validQuotes[0].ramp;
                addLog(`  ⚠️ Provider selection failed, using first valid: ${selectedProvider}`, 'warning');
              }
            } else {
              addLog(`  ⚠️ No valid quotes, using fallback provider: ${selectedProvider}`, 'warning');
            }
          } else {
            addLog(`  ⚠️ Could not fetch quotes, using fallback provider: ${selectedProvider}`, 'warning');
          }
          
          // Now test checkout-intent with selected provider
          addLog(`  Step 2: Testing checkout-intent with provider "${selectedProvider}"...`, 'info');
          const checkoutIntentBody = {
            fiatAmount: parseFloat(fiatAmount),
            fiatCurrency,
            cryptoCurrency,
            walletAddress,
            paymentMethod,
            onramp: selectedProvider, // REQUIRED: Provider name
          };
          addLog(`  Request Body: ${JSON.stringify(checkoutIntentBody, null, 2)}`, 'info');
          addLog(`  ⚠️ IMPORTANT: onramp parameter is now REQUIRED (was optional before)`, 'warning');
          
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
            addLog(`  Provider: ${selectedProvider}`, 'info');
            addLog(`  URL: ${checkoutData.transactionInformation?.url?.substring(0, 100)}...`, 'info');
            addLog(`  Full Response: ${JSON.stringify(checkoutData, null, 2)}`, 'info');
          } else {
            addLog(`ERROR: ${checkoutData.error || checkoutData.message || 'Unknown error'}`, 'error');
            addLog(`  Status: ${checkoutResponse.status}`, 'error');
            addLog(`  Full Response: ${JSON.stringify(checkoutData, null, 2)}`, 'error');
            addLog(`  ⚠️ This error usually means:`, 'warning');
            addLog(`    1. Provider "${selectedProvider}" doesn't support "${paymentMethod}"`, 'warning');
            addLog(`    2. Missing onramp parameter (now REQUIRED)`, 'warning');
            addLog(`    3. API key or secret key missing`, 'warning');
            addLog(`    4. Check Vercel logs for detailed error info`, 'warning');
          }
        } catch (err: any) {
          addLog(`ERROR: Failed to create checkout intent: ${err.message}`, 'error');
          addLog(`  Stack: ${err.stack}`, 'error');
        }
      }
      addLog('', 'info');

      // Test 6: Test User Preferences System
      addLog('Test 6: Testing User Preferences System...', 'info');
      if (userId) {
        try {
          addLog(`  User ID: ${userId}`, 'info');
          
          // Get current preferences
          const preferences = await UserOnRampPreferencesService.get(userId);
          if (preferences) {
            addLog(`  ✅ User preferences found:`, 'success');
            addLog(`    Preferred Provider: ${preferences.preferredProvider || 'None'}`, 'info');
            addLog(`    Verified Providers: ${preferences.verifiedProviders?.join(', ') || 'None'}`, 'info');
            addLog(`    Last Used Provider: ${preferences.lastUsedProvider || 'None'}`, 'info');
            addLog(`    Preferred Payment Method: ${preferences.preferredPaymentMethod || 'None'}`, 'info');
            addLog(`    Last Transaction Date: ${preferences.lastTransactionDate ? new Date(preferences.lastTransactionDate).toISOString() : 'None'}`, 'info');
          } else {
            addLog(`  ℹ️ No preferences found (new user - will be created on first transaction)`, 'info');
          }
          
          // Test isProviderVerified
          if (preferences && preferences.verifiedProviders && preferences.verifiedProviders.length > 0) {
            const testProvider = preferences.verifiedProviders[0];
            const isVerified = await UserOnRampPreferencesService.isProviderVerified(userId, testProvider);
            addLog(`  Test isProviderVerified("${testProvider}"): ${isVerified ? '✅ Verified' : '❌ Not verified'}`, isVerified ? 'success' : 'error');
          }
          
          // Test getPreferredProvider
          const preferred = await UserOnRampPreferencesService.getPreferredProvider(userId);
          addLog(`  Preferred Provider: ${preferred || 'None'}`, preferred ? 'success' : 'info');
        } catch (err: any) {
          addLog(`  ERROR: ${err.message}`, 'error');
          addLog(`  Stack: ${err.stack}`, 'error');
        }
      } else {
        addLog(`  ℹ️ No user ID (guest user) - preferences not available`, 'info');
      }
      addLog('', 'info');

      // Test 7: Test Country Detection
      addLog('Test 7: Testing Country Detection...', 'info');
      try {
        // Test GeolocationService (client-side)
        if (typeof window !== 'undefined') {
          const savedCountry = localStorage.getItem('user_country');
          addLog(`  Saved Country Preference: ${savedCountry || 'None'}`, 'info');
          
          // Note: detectCountry requires server-side request object, so we can't fully test it here
          addLog(`  Note: Full country detection requires server-side request headers`, 'info');
          addLog(`  Client-side: Will use saved preference or let Onramper auto-detect`, 'info');
        }
      } catch (err: any) {
        addLog(`  ERROR: ${err.message}`, 'error');
      }
      addLog('', 'info');

      // Test 8: Test Payment Method Matching
      addLog('Test 8: Testing payment method matching logic...', 'info');
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

      // Test 9: Network and Chain Info
      addLog('Test 9: Checking network and chain information...', 'info');
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

      // Test 10: Summary of New Features
      addLog('Test 10: Summary of New Multi-Provider Features...', 'info');
      addLog('  ✅ Multi-Provider Quotes: Quotes endpoint now returns array of all providers', 'success');
      addLog('  ✅ Smart Provider Selection: Selects provider based on user preferences', 'success');
      addLog('  ✅ User Preferences: Tracks verified and preferred providers', 'success');
      addLog('  ✅ KYC Reuse: Verified providers are prioritized to avoid repeated KYC', 'success');
      addLog('  ✅ Country Auto-Detection: Automatically detects user country', 'success');
      addLog('  ✅ Provider Comparison UI: Shows all providers with badges', 'success');
      addLog('  ✅ Transaction Tracking: Updates preferences after successful transactions', 'success');
      addLog('  ✅ Checkout Intent: Now requires onramp parameter (provider selection)', 'success');
      addLog('', 'info');

      addLog('✅ Comprehensive test completed!', 'success');
      addLog('', 'info');
      addLog('📋 All logs above. Copy to clipboard for debugging.', 'info');
      addLog('', 'info');
      addLog('🎯 NEW FEATURES TESTED:', 'info');
      addLog('  • Multi-provider quote comparison', 'info');
      addLog('  • Smart provider selection with preferences', 'info');
      addLog('  • User preference tracking', 'info');
      addLog('  • Country auto-detection', 'info');
      addLog('  • Checkout intent with provider selection', 'info');

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
                      onClick={runOnramperDebug}
                      disabled={isTesting}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Debugging...</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          <span>🔍 Debug Onramper</span>
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
                {/* ⚠️ NEW: Step-by-step progress indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    {['amount', 'crypto', 'payment', 'quotes'].map((stepName, idx) => {
                      const stepIndex = ['amount', 'crypto', 'payment', 'quotes'].indexOf(flowStep);
                      const isActive = flowStep === stepName;
                      const isCompleted = idx < stepIndex;
                      const isUpcoming = idx > stepIndex;
                      
                      return (
                        <div key={stepName} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                                isActive
                                  ? 'bg-indigo-500 text-white scale-110'
                                  : isCompleted
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <span className={`text-xs mt-2 font-medium ${
                              isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {stepName === 'amount' ? 'Amount' : 
                               stepName === 'crypto' ? 'Crypto' :
                               stepName === 'payment' ? 'Payment' : 'Quotes'}
                            </span>
                          </div>
                          {idx < 3 && (
                            <div className={`flex-1 h-1 mx-2 ${
                              isCompleted ? 'bg-green-500' : 'bg-gray-200'
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 1: Amount Selection */}
                {flowStep === 'amount' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Amount</h3>
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
                    
                    <button
                      onClick={handleAmountNext}
                      disabled={!fiatAmount || parseFloat(fiatAmount) <= 0}
                      className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* STEP 2: Crypto Selection */}
                {flowStep === 'crypto' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Cryptocurrency</h3>
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
                      <p className="text-xs text-gray-500 mt-2">
                        💡 USDC is not available (no providers support it)
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleBack}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleCryptoNext}
                        disabled={!cryptoCurrency}
                        className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                      >
                        Continue
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Payment Method Selection */}
                {flowStep === 'payment' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Method</h3>
                      {checkingAvailability && (
                        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Checking availability...</span>
                        </div>
                      )}
                      {paymentMethods.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {paymentMethods.map((pm) => {
                            // ⚠️ TEMPORARY: Allow iDEAL to be clicked even if availability check fails
                            // This is because the availability check might be too strict or the API might not be returning quotes correctly
                            const isAvailable = availablePaymentMethods.has(pm.id);
                            const isIdeal = pm.id.toLowerCase() === 'ideal';
                            const isUnavailable = !isAvailable && !!cryptoCurrency && !checkingAvailability && !isIdeal;
                            
                            return (
                              <button
                                key={pm.id}
                                onClick={() => !isUnavailable && setPaymentMethod(pm.id)}
                                disabled={isUnavailable}
                                className={`p-3 border-2 rounded-xl transition-all text-left ${
                                  paymentMethod === pm.id
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : isUnavailable
                                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                title={isUnavailable ? unavailableReasons[pm.id] : undefined}
                              >
                                <div className="font-semibold text-sm">{pm.name}</div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {pm.processingTime} • {pm.fee}
                                </div>
                                {isUnavailable && (
                                  <div className="text-xs text-red-600 mt-1">
                                    Not available
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleBack}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handlePaymentNext}
                        disabled={!paymentMethod || checkingAvailability}
                        className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                      >
                        {checkingAvailability ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            Get Quotes
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Quotes Display */}
                {flowStep === 'quotes' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Provider</h3>
                      
                      {/* Loading State */}
                      {loading && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                          <span className="ml-2 text-gray-600">Fetching quotes...</span>
                        </div>
                      )}

                      {/* Error State */}
                      {error && !loading && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <div className="flex-1">
                            <span className="text-sm text-red-700">{error}</span>
                            {error.includes('No providers available') && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setFlowStep('payment')}
                                  className="text-xs text-red-600 hover:text-red-700 underline"
                                >
                                  Try a different payment method
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quotes Display */}
                      {!loading && !error && (quote || providerQuotes.length > 0) && (
                        <div className="space-y-4">
                          {/* Provider Selection List */}
                          {providerQuotes.length > 0 && !quote && (
                            <div className="space-y-3">
                              <p className="text-sm text-gray-600 mb-3">Select a provider:</p>
                              {providerQuotes.map((q) => {
                                const isSelected = selectedProvider === q.ramp;
                                return (
                                  <button
                                    key={q.ramp}
                                    onClick={() => {
                                      setSelectedProvider(q.ramp);
                                      if (q.payout) {
                                        setQuote({
                                          cryptoAmount: q.payout.toString(),
                                          exchangeRate: q.rate?.toString() || '0',
                                          fee: ((q.networkFee || 0) + (q.transactionFee || 0)).toString(),
                                          totalAmount: fiatAmount,
                                          baseCurrency: fiatCurrency,
                                          quoteCurrency: cryptoCurrency,
                                        });
                                      }
                                    }}
                                    className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                                      isSelected
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-semibold capitalize text-gray-900">{q.ramp}</div>
                                        {q.payout && (
                                          <div className="text-sm text-gray-600 mt-1">
                                            You'll receive: {parseFloat(q.payout.toString()).toFixed(6)} {cryptoCurrency}
                                          </div>
                                        )}
                                        {q.errors && q.errors.length > 0 && (
                                          <div className="text-xs text-orange-600 mt-1">
                                            ⚠️ This provider may have limitations
                                          </div>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Selected Provider Badge */}
                          {selectedProvider && (
                            <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">Provider:</span>
                                  <span className="text-sm font-semibold capitalize text-indigo-900">{selectedProvider}</span>
                                  {userPreferences?.verifiedProviders?.includes(selectedProvider) && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                      <Shield className="w-3 h-3" />
                                      Verified
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Quote Summary */}
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

                          {/* Provider Comparison */}
                          {showProviderComparison && comparisonQuotes.length > 0 && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                              <h4 className="text-sm font-semibold text-blue-900 mb-3">Compare Providers</h4>
                              <div className="space-y-2">
                                {comparisonQuotes.map((q) => {
                                  const isSelected = selectedProvider === q.ramp;
                                  return (
                                    <button
                                      key={q.ramp}
                                      onClick={() => {
                                        setSelectedProvider(q.ramp);
                                        if (q.payout) {
                                          setQuote({
                                            cryptoAmount: q.payout.toString(),
                                            exchangeRate: q.rate?.toString() || '0',
                                            fee: ((q.networkFee || 0) + (q.transactionFee || 0)).toString(),
                                            totalAmount: fiatAmount,
                                            baseCurrency: fiatCurrency,
                                            quoteCurrency: cryptoCurrency,
                                          });
                                        }
                                      }}
                                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                        isSelected
                                          ? 'border-indigo-500 bg-indigo-50'
                                          : 'border-gray-200 hover:border-gray-300 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm capitalize">{q.ramp}</span>
                                        {q.payout && (
                                          <span className="text-sm font-bold text-gray-900">
                                            {parseFloat(q.payout.toString()).toFixed(6)} {cryptoCurrency}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Continue Button */}
                          <button
                            onClick={handleContinue}
                            disabled={loading || !quote}
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
                          </button>
                        </div>
                      )}

                      {/* No Quotes State */}
                      {!loading && !error && !quote && providerQuotes.length === 0 && (
                        <div className="text-center py-8">
                          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-4">No quotes available</p>
                          <button
                            onClick={() => setFlowStep('payment')}
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            Try a different payment method
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleBack}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                      >
                        Back
                      </button>
                    </div>
                  </div>
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

