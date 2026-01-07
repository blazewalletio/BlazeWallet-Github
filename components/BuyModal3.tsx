'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, CheckCircle2, ArrowRight, CreditCard, Shield, Info, History } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { OnramperService } from '@/lib/onramper-service';
import { ProviderSelector } from '@/lib/provider-selector';
import { UserOnRampPreferencesService } from '@/lib/user-onramp-preferences';
import { GeolocationService } from '@/lib/geolocation';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { EstimatedQuoteService } from '@/lib/estimated-quote-service';

interface BuyModal3Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenPurchaseHistory?: () => void; // Optional callback to open purchase history
}

interface Quote {
  cryptoAmount: string;
  exchangeRate: string;
  fee: string;
  totalAmount: string;
  baseCurrency: string;
  quoteCurrency: string;
  isEstimated?: boolean;
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
  estimatedQuote?: Quote & { isEstimated: true };
  isEstimated?: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  processingTime: string;
  fee: string;
}

export default function BuyModal3({ isOpen, onClose, onOpenPurchaseHistory }: BuyModal3Props) {
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
  
  // ⚠️ NEW: Verified available cryptos for current chain (from API)
  const [availableCryptosForChain, setAvailableCryptosForChain] = useState<string[]>([]);
  const [isVerifyingCryptos, setIsVerifyingCryptos] = useState(false);
  const [cryptoVerificationError, setCryptoVerificationError] = useState<string | null>(null);

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
  const [usingFallbackQuotes, setUsingFallbackQuotes] = useState(false);
  const [fallbackPaymentMethod, setFallbackPaymentMethod] = useState<string | null>(null);
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

  // ⚠️ NEW: Fetch verified available cryptos for current chain when crypto step is shown
  const fetchAvailableCryptos = async () => {
    if (!currentChain) return;
    
    const chain = CHAINS[currentChain];
    if (!chain) return;
    
    setIsVerifyingCryptos(true);
    setCryptoVerificationError(null);
    setAvailableCryptosForChain([]); // Clear previous list
    
    try {
      const response = await fetch(`/api/onramper/available-cryptos?chainId=${chain.id}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.cryptos && data.cryptos.length > 0) {
          setAvailableCryptosForChain(data.cryptos);
          // Auto-select first available crypto if none selected
          if (!cryptoCurrency && data.cryptos.length > 0) {
            setCryptoCurrency(data.cryptos[0]);
          }
        } else {
          // No cryptos available - this is OK, just show empty state
          setAvailableCryptosForChain([]);
          setCryptoVerificationError('No cryptocurrencies are currently available for this chain.');
        }
      } else {
        setCryptoVerificationError(data.error || 'Failed to verify available cryptocurrencies');
      }
    } catch (error: any) {
      logger.error('Failed to fetch available cryptos:', error);
      setCryptoVerificationError('Failed to load available cryptocurrencies. Please try again.');
      setAvailableCryptosForChain([]);
    } finally {
      setIsVerifyingCryptos(false);
    }
  };

  // Call when crypto step is shown
  useEffect(() => {
    if (flowStep === 'crypto' && currentChain) {
      fetchAvailableCryptos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowStep, currentChain]);

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
      setUsingFallbackQuotes(false);
      setFallbackPaymentMethod(null);
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
            // ⚠️ CRITICAL: If quote has the correct paymentMethod, accept it immediately
            // This matches the backend logic - if Onramper set paymentMethod to the requested method,
            // we trust that Onramper knows what it's doing, even if there are errors
            if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
              console.log(`✅ [BUYMODAL] Accepting ${q.ramp}: paymentMethod=${q.paymentMethod} matches requested ${paymentMethodLower}`);
              return true; // Trust Onramper's paymentMethod field
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
          
          // Check if we have quotes but none have payout/rate (invalid quotes)
          const validQuotes = quotesToUse.filter((q: ProviderQuote) => q.payout || q.rate);
          const hasQuotesButNoValid = quotesToUse.length > 0 && validQuotes.length === 0;
          
          if (quotesToUse.length === 0 || hasQuotesButNoValid) {
            if (hasQuotesButNoValid) {
              // ⚠️ NEW: Calculate estimated quotes for providers without payout/rate
              console.warn(`⚠️ [BUYMODAL] Found ${quotesToUse.length} quotes but none have payout/rate for ${paymentMethod} + ${cryptoCurrency}!`);
              console.log(`📊 [BUYMODAL] Calculating estimated quotes based on market rates...`);
              
              try {
                // Calculate estimated quotes for all providers
                const estimatedQuotesData = await EstimatedQuoteService.calculateForProviders(
                  parseFloat(fiatAmount),
                  fiatCurrency,
                  cryptoCurrency,
                  quotesToUse
                );
                
                if (estimatedQuotesData.length > 0) {
                  console.log(`✅ [BUYMODAL] Calculated ${estimatedQuotesData.length} estimated quotes`);
                  
                  // Merge estimated quotes with provider quotes
                  const quotesWithEstimated = quotesToUse.map((q: ProviderQuote) => {
                    const estimated = estimatedQuotesData.find(eq => eq.provider === q.ramp);
                    if (estimated) {
                      return {
                        ...q,
                        estimatedQuote: estimated,
                        isEstimated: true,
                      };
                    }
                    return q;
                  });
                  
                  // Use estimated quotes
                  quotesToUse = quotesWithEstimated;
                  
                  // Select first provider and set estimated quote
                  const firstProvider = quotesWithEstimated[0];
                  if (firstProvider.estimatedQuote) {
                    setSelectedProvider(firstProvider.ramp);
                    setQuote(firstProvider.estimatedQuote);
                    console.log(`✅ [BUYMODAL] Using estimated quote for ${firstProvider.ramp}`);
                  }
                } else {
                  console.warn(`⚠️ [BUYMODAL] Failed to calculate estimated quotes, trying fallback payment methods...`);
                  // Fall through to fallback logic below
                }
              } catch (estimateError: any) {
                console.error(`❌ [BUYMODAL] Error calculating estimated quotes:`, estimateError);
                console.warn(`⚠️ [BUYMODAL] Falling back to alternative payment methods...`);
                // Fall through to fallback logic below
              }
              
              // If estimated quotes failed, try fallback payment methods
              if (quotesToUse.length === 0 || !quotesToUse[0]?.estimatedQuote) {
                console.warn(`⚠️ [BUYMODAL] Attempting to fetch fallback quotes from alternative payment methods...`);
                
                // Try alternative payment methods in order of preference
                const fallbackPaymentMethods = ['creditcard', 'applepay', 'googlepay', 'debitcard', 'paypal'];
                let fallbackQuotes: ProviderQuote[] = [];
                let fallbackPaymentMethod: string | null = null;
                
                for (const fallbackPm of fallbackPaymentMethods) {
                  // Skip if it's the same as the requested payment method
                  if (fallbackPm.toLowerCase() === paymentMethod.toLowerCase()) {
                    continue;
                  }
                  
                  try {
                    console.log(`🔄 [BUYMODAL] Trying fallback payment method: ${fallbackPm}`);
                    const fallbackUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${fallbackPm}`;
                    const fallbackResponse = await fetch(fallbackUrl);
                    const fallbackData = await fallbackResponse.json();
                    
                    if (fallbackResponse.ok && fallbackData.success && fallbackData.quotes && fallbackData.quotes.length > 0) {
                      // Filter for valid quotes with payout/rate
                      const validFallbackQuotes = fallbackData.quotes.filter((q: ProviderQuote) => 
                        q.payout || q.rate
                      );
                      
                      if (validFallbackQuotes.length > 0) {
                        console.log(`✅ [BUYMODAL] Found ${validFallbackQuotes.length} fallback quotes for ${fallbackPm}`);
                        fallbackQuotes = validFallbackQuotes;
                        fallbackPaymentMethod = fallbackPm;
                        break; // Use first successful fallback
                      }
                    }
                  } catch (fallbackError: any) {
                    console.warn(`⚠️ [BUYMODAL] Fallback ${fallbackPm} failed:`, fallbackError.message);
                    continue;
                  }
                }
                
                if (fallbackQuotes.length > 0 && fallbackPaymentMethod) {
                  console.log(`✅ [BUYMODAL] Using ${fallbackQuotes.length} fallback quotes from ${fallbackPaymentMethod}`);
                  // Use fallback quotes but keep the original payment method selected
                  // This allows user to see quotes while still being able to proceed with original payment method
                  quotesToUse = fallbackQuotes;
                  setUsingFallbackQuotes(true);
                  setFallbackPaymentMethod(fallbackPaymentMethod);
                } else {
                  // No fallback quotes found either - show error but still try to show any available quotes
                  console.error(`❌ [BUYMODAL] No fallback quotes found either!`);
                  console.error(`❌ [BUYMODAL] Original quotes:`, 
                    data.quotes.map((q: ProviderQuote) => ({
                      ramp: q.ramp,
                      paymentMethod: q.paymentMethod,
                      availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || [],
                      hasErrors: !!(q.errors && q.errors.length > 0)
                    }))
                  );
                  
                  // Try to show ANY quotes from the original response (without payment method filter)
                  if (data.quotes && data.quotes.length > 0) {
                    const anyValidQuotes = data.quotes.filter((q: ProviderQuote) => q.payout || q.rate);
                    if (anyValidQuotes.length > 0) {
                      console.log(`⚠️ [BUYMODAL] Showing ${anyValidQuotes.length} quotes without payment method filter as last resort`);
                      quotesToUse = anyValidQuotes;
                      setUsingFallbackQuotes(true);
                      setFallbackPaymentMethod(null); // Unknown fallback
                    } else {
                      // Really no quotes available
                      setError(`No quotes available for ${cryptoCurrency}. Please try a different cryptocurrency.`);
                      setQuote(null);
                      setProviderQuotes([]);
                      setSelectedProvider(null);
                      return;
                    }
                  } else {
                    setError(`No quotes available for ${cryptoCurrency}. Please try a different cryptocurrency.`);
                    setQuote(null);
                    setProviderQuotes([]);
                    setSelectedProvider(null);
                    return;
                  }
                }
              }
            } else {
              console.warn(`⚠️ [BUYMODAL] NO providers support ${paymentMethod} for ${cryptoCurrency}!`);
              setError(`No providers support ${paymentMethod} for ${cryptoCurrency}. Please try a different payment method or cryptocurrency.`);
              setQuote(null);
              setProviderQuotes([]);
              setSelectedProvider(null);
              return;
            }
          } else {
            console.log(`✅ [BUYMODAL] Filtered quotes details:`, 
              quotesToUse.map((q: ProviderQuote) => ({
                ramp: q.ramp,
                paymentMethod: q.paymentMethod,
                availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
              }))
            );
            // Reset fallback flags when we have quotes for the requested payment method
            setUsingFallbackQuotes(false);
            setFallbackPaymentMethod(null);
          }
        }
        
        // Store filtered provider quotes
        console.log(`💾 [BUYMODAL] Storing ${quotesToUse.length} quotes in state`);
        // Log BANXA quote structure for debugging
        const banxaQuote = quotesToUse.find((q: ProviderQuote) => q.ramp?.toLowerCase() === 'banxa');
        if (banxaQuote) {
          console.log(`🔍 [BUYMODAL] BANXA quote structure:`, {
            ramp: banxaQuote.ramp,
            paymentMethod: banxaQuote.paymentMethod,
            payout: banxaQuote.payout,
            rate: banxaQuote.rate,
            networkFee: banxaQuote.networkFee,
            transactionFee: banxaQuote.transactionFee,
            hasErrors: !!(banxaQuote.errors && banxaQuote.errors.length > 0),
            errors: banxaQuote.errors
          });
        }
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
            
            // Check if this is an estimated quote
            if (selectedQuote.estimatedQuote) {
              // Use estimated quote
              setQuote(selectedQuote.estimatedQuote);
            } else if (selectedQuote.payout) {
              // Use real quote with payout
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
              
              // Check if this is an estimated quote
              if (firstValid.estimatedQuote) {
                setQuote(firstValid.estimatedQuote);
              } else if (firstValid.payout) {
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
    // For iDEAL, allow proceeding even without quote (quote will be calculated during checkout)
    if (!quote && paymentMethod?.toLowerCase() !== 'ideal') {
      return;
    }
    
    // For iDEAL without quote, we still need a provider selected
    if (paymentMethod?.toLowerCase() === 'ideal' && !selectedProvider) {
      return;
    }

    const walletAddress = getCurrentAddress();
    if (!walletAddress) {
      return;
    }

    if (!paymentMethod) {
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
          return;
        }
      }
    }

    if (!providerToUse) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user ID for tracking
      let currentUserId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
        }
      } catch (err) {
        logger.warn('Could not get user ID for checkout intent');
      }

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
          userId: currentUserId, // Include userId for webhook tracking
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
      }
    } catch (err: any) {
      logger.error('Failed to create Onramper checkout intent:', err);
      setError('Failed to create transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['50', '100', '250', '500'];
  const chain = CHAINS[currentChain];

  // ⚠️ Use verified available cryptos from API (no hardcoded fallback)
  const availableCryptos = availableCryptosForChain;

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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Buy crypto (Onramper)</h2>
                    <p className="text-sm text-gray-600">
                      Purchase crypto with credit card, bank transfer or Apple Pay via Onramper
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenPurchaseHistory && (
                    <button
                      onClick={onOpenPurchaseHistory}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                      title="View purchase history"
                    >
                      <History className="w-4 h-4" />
                      History
                    </button>
                  )}
                </div>
              </div>
            </div>


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
                                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white scale-110'
                                  : isCompleted
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <span className={`text-xs mt-2 font-medium ${
                              isActive ? 'text-orange-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
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
                          className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
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
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
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
                      
                      {isVerifyingCryptos ? (
                        <div className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                          <span className="text-sm text-gray-600">Verifying available cryptocurrencies...</span>
                        </div>
                      ) : (
                        <>
                          <select
                            value={cryptoCurrency}
                            onChange={(e) => setCryptoCurrency(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={availableCryptos.length === 0}
                          >
                            <option value="">Select cryptocurrency</option>
                            {availableCryptos.length === 0 ? (
                              <option disabled>No cryptocurrencies available</option>
                            ) : (
                              availableCryptos.map((crypto) => (
                                <option key={crypto} value={crypto}>
                                  {crypto.toUpperCase()}
                                </option>
                              ))
                            )}
                          </select>
                          
                          {cryptoVerificationError && (
                            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {cryptoVerificationError}
                            </p>
                          )}
                          
                          {!cryptoVerificationError && availableCryptos.length === 0 && !isVerifyingCryptos && (
                            <p className="text-xs text-gray-500 mt-2">
                              💡 No cryptocurrencies are currently available for this chain.
                            </p>
                          )}
                        </>
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
                        onClick={handleCryptoNext}
                        disabled={!cryptoCurrency}
                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
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
                                    ? 'border-orange-500 bg-orange-50'
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
                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
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
                    {/* Loading State */}
                    {loading && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        <span className="ml-3 text-gray-600 text-lg">Fetching quotes...</span>
                      </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                      <div className="flex items-center gap-3 p-5 bg-red-50 border-2 border-red-200 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-red-700">{error}</span>
                          {error.includes('No providers available') && (
                            <div className="mt-3">
                              <button
                                onClick={() => setFlowStep('payment')}
                                className="text-sm text-red-600 hover:text-red-700 font-medium underline"
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
                      <div className="space-y-6">
                        {/* Quote Summary Hero - Sticky on scroll */}
                        {quote && (
                          <div className="sticky top-4 z-10 glass-card p-6 bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 shadow-lg">
                            <div className="space-y-4">
                              {/* Estimated Quote Warning */}
                              {quote.isEstimated && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-yellow-800">
                                      <p className="font-semibold mb-1">Estimated Quote</p>
                                      <p>This quote is estimated based on current market rates. The final amount will be calculated by the provider during checkout and may vary slightly.</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Main Quote Display */}
                              <div className="text-center pb-4 border-b border-orange-200">
                                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">You'll receive</div>
                                {parseFloat(quote.cryptoAmount) > 0 ? (
                                  <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-1">
                                    {parseFloat(quote.cryptoAmount).toFixed(6)} {quote.quoteCurrency}
                                    {quote.isEstimated && (
                                      <span className="text-lg text-yellow-600 ml-2">*</span>
                                    )}
                                  </div>
                                ) : paymentMethod?.toLowerCase() === 'ideal' ? (
                                  <div className="flex items-center justify-center gap-2 py-2">
                                    <Info className="w-5 h-5 text-blue-500" />
                                    <span className="text-base text-blue-600 font-medium">
                                      Quote will be calculated during checkout
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-lg text-gray-500 py-2">
                                    Quote not available
                                  </div>
                                )}
                                {selectedProvider && (
                                  <div className="flex items-center justify-center gap-2 mt-2">
                                    <span className="text-xs text-gray-500">via</span>
                                    <span className="text-sm font-semibold capitalize text-orange-700">{selectedProvider}</span>
                                    {userPreferences?.verifiedProviders?.includes(selectedProvider) && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                        <Shield className="w-3 h-3" />
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Quote Details Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="text-center md:text-left">
                                  <div className="text-gray-500 mb-1">Exchange rate</div>
                                  <div className="font-semibold text-gray-900">
                                    1 {quote.quoteCurrency} = {quote.baseCurrency} {parseFloat(quote.exchangeRate).toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-center md:text-left">
                                  <div className="text-gray-500 mb-1">Service fee</div>
                                  <div className="font-semibold text-gray-900">
                                    {quote.baseCurrency} {parseFloat(quote.fee).toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-center md:text-left">
                                  <div className="text-gray-500 mb-1">Total</div>
                                  <div className="font-bold text-lg text-gray-900">
                                    {quote.baseCurrency} {quote.totalAmount}
                                  </div>
                                </div>
                              </div>

                              {/* Buy Now Button - Always visible */}
                              <button
                                onClick={handleContinue}
                                disabled={loading || (!quote && paymentMethod?.toLowerCase() !== 'ideal') || (paymentMethod?.toLowerCase() === 'ideal' && !selectedProvider)}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-bold text-white text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                {loading ? (
                                  <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Loading...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Buy now</span>
                                    <ArrowRight className="w-6 h-6" />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Provider Selection Section */}
                        {providerQuotes.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {providerQuotes.length > 1 ? 'Select a provider' : 'Provider'}
                              </h3>
                              <span className="text-sm text-gray-500">
                                {providerQuotes.length} {providerQuotes.length === 1 ? 'option' : 'options'}
                              </span>
                            </div>

                            {/* Provider Cards Grid - Responsive */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {providerQuotes.map((q) => {
                                const isSelected = selectedProvider === q.ramp;
                                const hasQuote = (q.payout && parseFloat(q.payout.toString()) > 0) || q.estimatedQuote;
                                
                                return (
                                  <button
                                    key={q.ramp}
                                    onClick={() => {
                                      setSelectedProvider(q.ramp);
                                      // Always set quote when provider is selected
                                      // Check if this is an estimated quote first
                                      if (q.estimatedQuote) {
                                        setQuote(q.estimatedQuote);
                                      } else if (q.payout) {
                                        setQuote({
                                          cryptoAmount: q.payout.toString(),
                                          exchangeRate: q.rate?.toString() || '0',
                                          fee: ((q.networkFee || 0) + (q.transactionFee || 0)).toString(),
                                          totalAmount: fiatAmount,
                                          baseCurrency: fiatCurrency,
                                          quoteCurrency: cryptoCurrency,
                                        });
                                      } else if (q.rate && parseFloat(fiatAmount) > 0) {
                                        const calculatedPayout = parseFloat(fiatAmount) / parseFloat(q.rate.toString());
                                        setQuote({
                                          cryptoAmount: calculatedPayout.toString(),
                                          exchangeRate: q.rate.toString(),
                                          fee: ((q.networkFee || 0) + (q.transactionFee || 0)).toString(),
                                          totalAmount: fiatAmount,
                                          baseCurrency: fiatCurrency,
                                          quoteCurrency: cryptoCurrency,
                                        });
                                      } else {
                                        setQuote({
                                          cryptoAmount: '0',
                                          exchangeRate: q.rate?.toString() || '0',
                                          fee: ((q.networkFee || 0) + (q.transactionFee || 0)).toString(),
                                          totalAmount: fiatAmount,
                                          baseCurrency: fiatCurrency,
                                          quoteCurrency: cryptoCurrency,
                                        });
                                      }
                                    }}
                                    className={`relative p-4 border-2 rounded-xl text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                                      isSelected
                                        ? 'border-orange-500 bg-orange-50 shadow-md'
                                        : 'border-gray-200 hover:border-orange-300 bg-white hover:shadow-sm'
                                    } ${!hasQuote && !isSelected ? 'opacity-60' : ''}`}
                                  >
                                    {/* Selected Indicator */}
                                    {isSelected && (
                                      <div className="absolute top-2 right-2">
                                        <CheckCircle2 className="w-5 h-5 text-orange-500" />
                                      </div>
                                    )}

                                    {/* Provider Name */}
                                    <div className="font-semibold text-base capitalize text-gray-900 mb-2 pr-6">
                                      {q.ramp}
                                    </div>

                                    {/* Quote or Status */}
                                    {hasQuote ? (
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500">You'll receive</div>
                                        <div className="text-lg font-bold text-gray-900">
                                          {q.estimatedQuote ? (
                                            <>
                                              {parseFloat(q.estimatedQuote.cryptoAmount).toFixed(6)} {cryptoCurrency}
                                              <span className="text-xs text-yellow-600 ml-1">*</span>
                                            </>
                                          ) : (
                                            <>
                                              {parseFloat(q.payout!.toString()).toFixed(6)} {cryptoCurrency}
                                            </>
                                          )}
                                        </div>
                                        {q.estimatedQuote && (
                                          <div className="text-xs text-yellow-600 italic">Estimated</div>
                                        )}
                                      </div>
                                    ) : q.paymentMethod?.toLowerCase() === 'ideal' ? (
                                      <div className="flex items-start gap-2 text-sm text-blue-600">
                                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>Quote calculated at checkout</span>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-400">Quote not available</div>
                                        {q.errors && q.errors.length > 0 && (
                                          <div className="text-xs text-orange-600 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            May have limitations
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Verified Badge */}
                                    {userPreferences?.verifiedProviders?.includes(q.ramp) && !isSelected && (
                                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                        <Shield className="w-3 h-3" />
                                        Verified
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Provider Comparison */}
                        {showProviderComparison && comparisonQuotes.length > 0 && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">Compare Providers</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                                      isSelected
                                        ? 'border-orange-500 bg-orange-50'
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
                      </div>
                    )}

                    {/* No Quotes State */}
                    {!loading && !error && !quote && providerQuotes.length === 0 && (
                      <div className="text-center py-12">
                        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2 text-lg font-medium">No quotes available</p>
                        <p className="text-sm text-gray-500 mb-6">Please try a different payment method or cryptocurrency</p>
                        <button
                          onClick={() => setFlowStep('payment')}
                          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
                        >
                          Try different payment method
                        </button>
                      </div>
                    )}

                    {/* Back Button */}
                    <div className="flex gap-3 pt-4">
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


