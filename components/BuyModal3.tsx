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
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

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

interface PaymentMethodOverrideConfirmation {
  provider: string;
  requestedMethod: string;
  actualMethod: string;
}

export default function BuyModal3({ isOpen, onClose, onOpenPurchaseHistory }: BuyModal3Props) {
  useBlockBodyScroll(isOpen);
  const {
    currentChain,
    address,
    solanaAddress,
    bitcoinAddress,
    litecoinAddress,
    dogecoinAddress,
    bitcoincashAddress,
  } = useWalletStore();
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
  

  // Form state
  const [fiatAmount, setFiatAmount] = useState('100');
  const [fiatCurrency, setFiatCurrency] = useState('EUR');
  const [selectedChain, setSelectedChain] = useState<string>(currentChain);
  const [cryptoCurrency, setCryptoCurrency] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Data state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [providerQuotes, setProviderQuotes] = useState<ProviderQuote[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [pendingPaymentOverride, setPendingPaymentOverride] = useState<PaymentMethodOverrideConfirmation | null>(null);
  const [showProviderComparison, setShowProviderComparison] = useState(false);
  const [comparisonQuotes, setComparisonQuotes] = useState<ProviderQuote[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<{ verifiedProviders: string[]; preferredProvider: string | null } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [fiatCurrencies, setFiatCurrencies] = useState<string[]>(['EUR', 'USD', 'GBP']);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<string[]>([]);
  const [widgetUrl, setWidgetUrl] = useState<string>('');
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const [checkoutCreated, setCheckoutCreated] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMiniStickyQuoteBar, setShowMiniStickyQuoteBar] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const quoteCardRef = useRef<HTMLDivElement | null>(null);
  const quoteCardTriggerRef = useRef<number | null>(null);
  const miniBarStateRef = useRef(false);
  const quoteScrollRafRef = useRef<number | null>(null);

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

  // 🌍 NEW: Detect user's country for accurate Onramper quotes
  // CRITICAL: This ensures we get quotes that work for the USER's location,
  // not Vercel's server location (which may be different)
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Check if already saved in localStorage
        const saved = localStorage.getItem('user_country');
        if (saved) {
          logger.log('✅ [GEOLOCATION] Using saved country:', saved);
          setUserCountry(saved);
          return;
        }

        // Detect via Cloudflare trace (free, fast, reliable)
        logger.log('🌍 [GEOLOCATION] Detecting user country...');
        const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const data = await response.text();
        
        // Parse trace data (format: key=value\n)
        const lines = data.split('\n');
        const country = lines
          .find(line => line.startsWith('loc='))
          ?.split('=')[1]
          ?.trim()
          ?.toUpperCase();
        
        if (country && country.length === 2) {
          logger.log('✅ [GEOLOCATION] Detected country:', country);
          setUserCountry(country);
          localStorage.setItem('user_country', country);
        } else {
          console.warn('⚠️ [GEOLOCATION] Could not detect country, server will detect country');
          setUserCountry(null);
        }
      } catch (error: any) {
        console.error('❌ [GEOLOCATION] Error detecting country:', error.message);
        setUserCountry(null);
      }
    };

    detectCountry();
  }, []);

  const getAddressForChain = (chainKey: string): string => {
    if (chainKey === 'solana') return solanaAddress || '';
    if (chainKey === 'bitcoin') return bitcoinAddress || '';
    if (chainKey === 'litecoin') return litecoinAddress || '';
    if (chainKey === 'dogecoin') return dogecoinAddress || '';
    if (chainKey === 'bitcoincash') return bitcoincashAddress || '';
    // EVM chains share the same address
    return address || '';
  };

  // Initialize default crypto based on current chain
  useEffect(() => {
    if (isOpen && selectedChain) {
      const chain = CHAINS[selectedChain];
      if (chain) {
        const defaultCrypto = OnramperService.getDefaultCrypto(chain.id);
        setCryptoCurrency(defaultCrypto);
      }
    }
  }, [isOpen, selectedChain]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedChain(currentChain);
  }, [isOpen, currentChain]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

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
        logger.log('🔄 [BUYMODAL] Auto-fetching quotes (all fields complete)');
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [paymentMethod]); // ⚠️ ONLY depend on paymentMethod - don't auto-fetch on amount/crypto changes

  useEffect(() => {
    setPendingPaymentOverride(null);
  }, [paymentMethod, selectedProvider, cryptoCurrency, fiatAmount]);

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
      setCheckoutCreated(false);
      setPaymentMethod(''); // ⚠️ CRITICAL: Reset payment method to prevent stale quotes
      setProviderQuotes([]);
      setQuote(null);
      setSelectedProvider(null);
      setShowProviderComparison(false);
      setComparisonQuotes([]);
      setAvailablePaymentMethods(new Set());
      setAvailableCryptosSet(new Set());
      setUnavailableReasons({});
    } else {
      // ⚠️ FIX: Cleanup when modal closes to fix viewport/scroll issues
      // Ensure body scroll is restored and viewport is reset
      if (typeof window !== 'undefined') {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        // Force viewport reset on mobile
        window.scrollTo(0, 0);
        // Trigger a reflow to ensure viewport is correct
        document.body.offsetHeight;
      }
    }
  }, [isOpen]);

  // Fetch available cryptos for current chain when modal opens or chain changes
  useEffect(() => {
    if (isOpen && selectedChain) {
      const fetchAvailableCryptos = async () => {
        try {
          const chain = CHAINS[selectedChain];
          if (!chain) return;

          logger.log(`📊 Fetching available cryptos for chain: ${chain.name} (${chain.id})`);

          const response = await fetch(
            `/api/onramper/available-cryptos?chainId=${chain.id}&fiatCurrency=${fiatCurrency}${userCountry ? `&country=${userCountry}` : ''}`
          );
          
          const data = await response.json();
          
          if (data.success && data.availableCryptos && Array.isArray(data.availableCryptos)) {
            // NATIVE ONLY: Available cryptos will always be just the native token
            setAvailableCryptosSet(new Set(data.availableCryptos));
            logger.log(`✅ Available cryptos for ${chain.name}:`, data.availableCryptos);
          } else {
            // Fallback to supported assets (which is also native only now)
            const supported = OnramperService.getSupportedAssets(chain.id);
            setAvailableCryptosSet(new Set(supported));
            logger.log(`✅ Using fallback (native only) for ${chain.name}:`, supported);
          }
        } catch (error: any) {
          logger.error('Failed to fetch available cryptos:', error);
          // Fallback to supported assets
          const chain = CHAINS[selectedChain];
          if (chain) {
            const supported = OnramperService.getSupportedAssets(chain.id);
            setAvailableCryptosSet(new Set(supported));
          }
        }
      };

      fetchAvailableCryptos();
    }
  }, [isOpen, selectedChain, fiatCurrency, userCountry, cryptoCurrencies]);

  useEffect(() => {
    if (!isOpen) return;
    const chain = CHAINS[selectedChain];
    if (!chain) return;
    const native = OnramperService.getDefaultCrypto(chain.id);
    setCryptoCurrency(native);
    setPaymentMethod('');
    setProviderQuotes([]);
    setQuote(null);
    setSelectedProvider(null);
    setShowProviderComparison(false);
    setComparisonQuotes([]);
    setAvailablePaymentMethods(new Set());
    setUnavailableReasons({});
    setPendingPaymentOverride(null);
  }, [selectedChain, isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'select' || flowStep !== 'quotes' || !quote || !isMobileViewport) {
      setShowMiniStickyQuoteBar(false);
      miniBarStateRef.current = false;
      quoteCardTriggerRef.current = null;
      if (quoteScrollRafRef.current) {
        cancelAnimationFrame(quoteScrollRafRef.current);
        quoteScrollRafRef.current = null;
      }
      return;
    }

    const container = scrollContainerRef.current;
    const card = quoteCardRef.current;
    if (!container || !card) return;

    const recalcTrigger = () => {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      // Show mini sticky bar only when user has scrolled past the full quote card block.
      quoteCardTriggerRef.current = cardRect.top - containerRect.top + container.scrollTop + cardRect.height + 8;
    };

    const onScroll = () => {
      if (quoteScrollRafRef.current) return;
      quoteScrollRafRef.current = requestAnimationFrame(() => {
        quoteScrollRafRef.current = null;
        if (quoteCardTriggerRef.current === null) recalcTrigger();
        const trigger = quoteCardTriggerRef.current ?? Number.POSITIVE_INFINITY;
        const shouldShowMiniBar = container.scrollTop >= trigger;
        if (shouldShowMiniBar !== miniBarStateRef.current) {
          miniBarStateRef.current = shouldShowMiniBar;
          setShowMiniStickyQuoteBar(shouldShowMiniBar);
        }
      });
    };

    recalcTrigger();
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', recalcTrigger);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', recalcTrigger);
      if (quoteScrollRafRef.current) {
        cancelAnimationFrame(quoteScrollRafRef.current);
        quoteScrollRafRef.current = null;
      }
    };
  }, [isOpen, step, flowStep, quote, isMobileViewport]);

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
          // ⚠️ NOTE: iDeal | Wero is supported by BANXA (verified via Onramper API)
          // Availability checking will determine if iDeal | Wero is available for selected crypto
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
          // NATIVE ONLY: Filter out all non-native tokens
          // We only show native tokens per chain (ETH, BNB, MATIC, SOL, etc.)
          const nativeTokens = ['ETH', 'BTC', 'BNB', 'MATIC', 'SOL', 'AVAX', 'FTM', 'CRO', 'LTC', 'DOGE', 'BCH', 'OP', 'ARB'];
          const filteredCryptos = data.cryptoCurrencies.filter((crypto: string) => {
            return nativeTokens.includes(crypto.toUpperCase());
          });
          setCryptoCurrencies(filteredCryptos);
          logger.log('✅ Native tokens only:', filteredCryptos);
        }
      }
    } catch (err: any) {
      logger.error('Failed to fetch Onramper supported data:', err);
    }
  };

  // ⚠️ NEW: Check payment method availability for selected crypto
  const checkPaymentMethodAvailability = async (crypto: string, paymentMethodId: string): Promise<boolean> => {
    try {
      const countryParam = userCountry ? `&country=${userCountry}` : '';
      const url = `/api/onramper/quotes?fiatAmount=250&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&chainId=${CHAINS[selectedChain]?.id || ''}&paymentMethod=${paymentMethodId}${countryParam}`;
      const response = await fetch(url);
      
      // ⚠️ CRITICAL: Check response status - 200 means API worked (even if 0 quotes)
      if (!response.ok) {
        logger.log(`❌ [AVAILABILITY] ${paymentMethodId} with ${crypto}: API error ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      
      // ⚠️ CRITICAL: success=true means API worked, quotes.length > 0 means providers available
      if (data.success && Array.isArray(data.quotes) && data.quotes.length > 0) {
        logger.log(`✅ [AVAILABILITY] ${paymentMethodId} with ${crypto}: ${data.quotes.length} providers available`);
        return true;
      }
      
      logger.log(`⚠️ [AVAILABILITY] ${paymentMethodId} with ${crypto}: 0 providers (valid - not available)`);
      return false;
    } catch (error: any) {
      console.error(`❌ [AVAILABILITY] ${paymentMethodId} with ${crypto}: Error:`, error.message);
      return false;
    }
  };

  // ⚠️ NEW: Check crypto availability
  const checkCryptoAvailability = async (crypto: string): Promise<boolean> => {
    try {
      const countryParam = userCountry ? `&country=${userCountry}` : '';
      const url = `/api/onramper/quotes?fiatAmount=250&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&chainId=${CHAINS[selectedChain]?.id || ''}${countryParam}`;
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
        logger.log(`🔄 [AVAILABILITY] Starting availability check for ${cryptoCurrency}...`);
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
                logger.log(`✅ [AVAILABILITY] ${pm.name} (${pm.id}): Available`);
              } else {
                reasons[pm.id] = `No providers available for ${pm.name} with ${cryptoCurrency}`;
                logger.log(`⚠️ [AVAILABILITY] ${pm.name} (${pm.id}): Not available`);
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
        
        logger.log(`✅ [AVAILABILITY] Check complete: ${available.size}/${paymentMethods.length} methods available`);
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
      logger.log('⚠️ [BUYMODAL] Skipping quote fetch - invalid amount:', fiatAmount);
      setError('Please enter a valid amount');
      return;
    }
    
    if (!cryptoCurrency) {
      logger.log('⚠️ [BUYMODAL] Skipping quote fetch - no crypto selected');
      setError('Please select a cryptocurrency');
      return;
    }
    
    if (!paymentMethod) {
      logger.log('⚠️ [BUYMODAL] Skipping quote fetch - no payment method selected');
      setError('Please select a payment method');
      return;
    }
    
    logger.log('✅ [BUYMODAL] All fields complete, fetching quotes:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      paymentMethod
    });

    try {
      setLoading(true);
      setError(null);
      setCheckoutCreated(false);

      // Fetch quotes from ALL providers
      const countryParam = userCountry ? `&country=${userCountry}` : '';
      const quoteUrl = `/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&chainId=${CHAINS[selectedChain]?.id || ''}${paymentMethod ? `&paymentMethod=${paymentMethod}` : ''}${countryParam}`;
      const quoteResponse = await fetch(quoteUrl);

      logger.log('🔍 [BUYMODAL] Fetching quotes with country:', userCountry || 'auto-detect');

      const data = await quoteResponse.json();
      if (data?.effectiveCountry && typeof data.effectiveCountry === 'string') {
        setUserCountry(data.effectiveCountry.toUpperCase());
      }

      logger.log('🔍 [BUYMODAL] Quote fetch response:', {
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
        
        // Backend is the single source of truth for quote filtering and eligibility.
        const quotesToUse = data.quotes;
        
        // Store filtered provider quotes
        logger.log(`💾 [BUYMODAL] Storing ${quotesToUse.length} quotes in state`);
        // Log BANXA quote structure for debugging
        const banxaQuote = quotesToUse.find((q: ProviderQuote) => q.ramp?.toLowerCase() === 'banxa');
        if (banxaQuote) {
          logger.log(`🔍 [BUYMODAL] BANXA quote structure:`, {
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
            logger.log(`🎯 [BUYMODAL] Selecting provider from ${quotesToUse.length} filtered quotes`);
            const selection = await ProviderSelector.selectProvider(
              quotesToUse, // Use filtered quotes, not all quotes!
              userId,
              paymentMethod
            );
            
            logger.log(`✅ [BUYMODAL] Selected provider: ${selection.quote.ramp} (reason: ${selection.reason})`);
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
          logger.log('⚠️ [BUYMODAL] No payment method selected, clearing quotes');
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

  const handleContinue = async (overrideConfirmed = false) => {
    // For iDeal | Wero, allow proceeding even without quote (quote will be calculated during checkout)
    if (!quote && paymentMethod?.toLowerCase() !== 'ideal') {
      return;
    }
    
    // For iDeal | Wero without quote, we still need a provider selected
    if (paymentMethod?.toLowerCase() === 'ideal' && !selectedProvider) {
      return;
    }

    const walletAddress = getAddressForChain(selectedChain);
    if (!walletAddress) {
      setError(`No wallet address found for ${CHAINS[selectedChain]?.name || selectedChain}`);
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
      let authAccessToken: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        authAccessToken = sessionData.session?.access_token || null;
      } catch (err) {
        logger.warn('Could not get user ID for checkout intent');
      }

      // Use new checkout-intent API - let Onramper choose best provider
      // Onramper's Ranking Engine will automatically select a provider that:
      // 1. Supports the payment method
      // 2. Is available/online (avoids 502 errors)
      // 3. Offers the best rates
      
      // 🔥 FIX: If a provider is selected from fallback quotes (e.g. creditcard when ideal fails),
      // use the payment method from the selected quote, NOT the original user selection
      const selectedQuote = providerToUse ? providerQuotes.find(q => q.ramp === providerToUse) : null;
      const actualPaymentMethod = selectedQuote?.paymentMethod || paymentMethod;
      const requestedMethod = paymentMethod;
      const hasMethodMismatch =
        !!selectedQuote?.paymentMethod &&
        requestedMethod.toLowerCase() !== selectedQuote.paymentMethod.toLowerCase();
      if (hasMethodMismatch && !overrideConfirmed) {
        if (currentUserId) {
          await trackEvent(currentUserId, 'onramp_fallback_prompt_shown', {
            provider: providerToUse,
            requested_method: requestedMethod,
            fallback_method: selectedQuote!.paymentMethod,
          });
        }
        setPendingPaymentOverride({
          provider: providerToUse,
          requestedMethod,
          actualMethod: selectedQuote!.paymentMethod,
        });
        setLoading(false);
        return;
      }
      if (hasMethodMismatch && overrideConfirmed && currentUserId) {
        await trackEvent(currentUserId, 'onramp_fallback_accepted', {
          provider: providerToUse,
          requested_method: requestedMethod,
          fallback_method: selectedQuote!.paymentMethod,
        });
      }
      setPendingPaymentOverride(null);
      
      logger.log(`💳 [BUYMODAL] Using payment method for checkout: ${actualPaymentMethod} (original: ${paymentMethod}, provider: ${providerToUse})`);
      
      // 🌍 CRITICAL: Include userCountry to ensure Onramper returns providers available in user's location
      // Without this, Onramper uses server's location (Vercel datacenter) which may not have same providers
      const response = await fetch('/api/onramper/checkout-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authAccessToken ? { Authorization: `Bearer ${authAccessToken}` } : {}),
        },
        body: JSON.stringify({
          fiatAmount: parseFloat(fiatAmount),
          fiatCurrency,
          cryptoCurrency,
          walletAddress,
          chainId: CHAINS[selectedChain]?.id,
          chainKey: selectedChain,
          paymentMethod: actualPaymentMethod,
          country: userCountry, // 🌍 USER'S country, not server's country
          onramp: providerToUse, // 🏢 Use selected provider (if any) for more specific error messages
          userId: currentUserId, // Include userId for webhook tracking
        }),
      });

      const data = await response.json();
      if (data?.effectiveCountry && typeof data.effectiveCountry === 'string') {
        setUserCountry(data.effectiveCountry.toUpperCase());
      }

      if (data.success && data.transactionInformation) {
        // Track onramp purchase initiated
        if (currentUserId) {
          await trackEvent(currentUserId, 'onramp_purchase_initiated', {
            fiat_amount: parseFloat(fiatAmount),
            fiat_currency: fiatCurrency,
            crypto_currency: cryptoCurrency,
            payment_method: actualPaymentMethod,
            provider: providerToUse,
            country: userCountry,
          });
        }
        
        const { transactionInformation } = data;
        const transactionType = transactionInformation.type; // "iframe" or "redirect"
        const transactionUrl = transactionInformation.url;
        const transactionId = transactionInformation.transactionId;

        // Store transaction ID for tracking
        setLastTransactionId(transactionId);
        setCheckoutCreated(true);
        if (currentUserId) {
          await trackEvent(currentUserId, 'onramp_checkout_created', {
            transaction_id: transactionId,
            provider: providerToUse,
            payment_method: actualPaymentMethod,
            country: userCountry,
          });
        }

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
                      // Payment completed - close popup and keep user in in-app flow.
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
                      
                      // Trigger balance refresh event
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('balanceRefresh'));
                      }

                      if (onOpenPurchaseHistory) {
                        onOpenPurchaseHistory();
                      } else {
                        setShowWidget(false);
                        setStep('success');
                      }
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
        setCheckoutCreated(false);
        if (currentUserId) {
          await trackEvent(currentUserId, 'onramp_checkout_failed', {
            provider: providerToUse,
            payment_method: actualPaymentMethod,
            reason: data.error || data.message || 'unknown',
          });
        }
        setError(data.error || data.message || 'Failed to create transaction');
      }
    } catch (err: any) {
      logger.error('Failed to create Onramper checkout intent:', err);
      setCheckoutCreated(false);
      setError('Failed to create transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['50', '100', '250', '500'];
  const chain = CHAINS[selectedChain];
  const supportedAssets = chain ? OnramperService.getSupportedAssets(chain.id) : [];
  const buyableChainOptions = Object.entries(CHAINS).filter(
    ([chainKey, value]) => !value.isTestnet || chainKey === selectedChain
  );
  const quoteReady = (providerQuotes?.length || 0) > 0 || !!quote;
  const providerSelected = !!selectedProvider;
  const redirectedOrEmbedded = step === 'widget' || step === 'processing' || step === 'success';
  const statusRailItems = [
    { label: 'Quote ready', done: quoteReady },
    { label: 'Provider selected', done: providerSelected },
    { label: 'Checkout created', done: checkoutCreated || !!lastTransactionId },
    { label: 'Redirected / Embedded', done: redirectedOrEmbedded },
  ];

  // Use availableCryptosSet if available, otherwise use supportedAssets
  // Both are now native-only, so this ensures consistency
  const availableCryptos = availableCryptosSet.size > 0 
    ? Array.from(availableCryptosSet)
    : supportedAssets;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50"
        style={{
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: '100dvh', // Dynamic viewport height (fallback to 100vh in older browsers)
        }}
      >
        <div
          ref={scrollContainerRef}
          className="h-full w-full overflow-y-auto" 
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          <div className="min-h-full flex flex-col">
            <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            {/* Header - Clean like SendModal */}
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                ← Back
              </button>
            </div>

            {/* Title Section - Compact & Clean */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Buy crypto</h2>
                    <p className="text-sm text-gray-600">
                      Compare providers and pay with available methods
                    </p>
                  </div>
                </div>
                {onOpenPurchaseHistory && (
                  <button
                    onClick={onOpenPurchaseHistory}
                    className="px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl text-sm"
                    title="View purchase history"
                  >
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">History</span>
                  </button>
                )}
              </div>
            </div>


            {/* Content */}
            {step === 'select' && (
              <div className="glass-card p-6 space-y-6">
                {/* 🎨 SEGMENTED PROGRESS BAR - Clean & Modern */}
                <div className="mb-8">
                  {/* Step Labels */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    {['amount', 'crypto', 'payment', 'quotes'].map((stepName, idx) => {
                      const stepIndex = ['amount', 'crypto', 'payment', 'quotes'].indexOf(flowStep);
                      const isActive = flowStep === stepName;
                      const isCompleted = idx < stepIndex;
                      
                      return (
                        <div key={stepName} className="flex-1 flex flex-col items-center">
                          <motion.div
                            initial={false}
                            animate={{
                              scale: isActive ? [1, 1.05, 1] : 1,
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: isActive ? Infinity : 0,
                              ease: "easeInOut"
                            }}
                            className={`text-xs sm:text-sm font-bold transition-all duration-300 ${
                              isActive
                                ? 'bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent'
                                : isCompleted
                                ? 'text-green-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {isCompleted && '✓ '}
                            {stepName === 'amount' ? 'Amount' : 
                             stepName === 'crypto' ? 'Crypto' :
                             stepName === 'payment' ? 'Payment' : 'Quotes'}
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Segmented Progress Bar */}
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    {/* Background gradient for depth */}
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-200/50 to-transparent" />
                    
                    {/* Segments */}
                    <div className="relative h-full flex">
                      {['amount', 'crypto', 'payment', 'quotes'].map((stepName, idx) => {
                        const stepIndex = ['amount', 'crypto', 'payment', 'quotes'].indexOf(flowStep);
                        const isActive = flowStep === stepName;
                        const isCompleted = idx < stepIndex;
                        
                        return (
                          <div
                            key={stepName}
                            className="flex-1 relative"
                            style={{ 
                              marginRight: idx < 3 ? '2px' : '0' // Tiny gap between segments
                            }}
                          >
                            {/* Segment fill */}
                            <motion.div
                              initial={false}
                              animate={{
                                opacity: isActive || isCompleted ? 1 : 0,
                              }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              className={`absolute inset-0 ${
                                isActive
                                  ? 'bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500'
                                  : isCompleted
                                  ? 'bg-gradient-to-r from-green-500 to-green-400'
                                  : ''
                              }`}
                            />
                            
                            {/* Active segment glow effect */}
                            {isActive && (
                              <>
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-r from-orange-400 to-yellow-400"
                                  animate={{
                                    opacity: [0.6, 1, 0.6],
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />
                                <motion.div
                                  className="absolute -inset-y-1 inset-x-0 bg-gradient-to-r from-orange-500 to-yellow-500 blur-sm opacity-60"
                                  animate={{
                                    opacity: [0.4, 0.8, 0.4],
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />
                              </>
                            )}

                            {/* Shine effect for completed */}
                            {isCompleted && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                initial={{ x: '-100%' }}
                                animate={{ x: '200%' }}
                                transition={{
                                  duration: 1.5,
                                  ease: "easeInOut",
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress Percentage */}
                  <div className="mt-2 text-center">
                    <motion.span
                      key={flowStep}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-semibold text-gray-500"
                    >
                      {flowStep === 'amount' && '25% complete'}
                      {flowStep === 'crypto' && '50% complete'}
                      {flowStep === 'payment' && '75% complete'}
                      {flowStep === 'quotes' && '100% complete'}
                    </motion.span>
                  </div>
                </div>

                {/* STEP 1: Amount Selection */}
                {flowStep === 'amount' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select amount</h3>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount to spend
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Network
                      </label>
                      <select
                        value={selectedChain}
                        onChange={(e) => setSelectedChain(e.target.value)}
                        className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                      >
                        {buyableChainOptions.map(([chainKey, value]) => (
                          <option key={chainKey} value={chainKey}>
                            {value.name} ({value.nativeCurrency.symbol})
                          </option>
                        ))}
                      </select>

                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select cryptocurrency</h3>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cryptocurrency
                      </label>
                      <select
                        value={cryptoCurrency}
                        onChange={(e) => setCryptoCurrency(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                      >
                        <option value="">Select cryptocurrency</option>
                        {availableCryptos.length > 0 ? (
                          availableCryptos.map((crypto) => (
                            <option key={crypto} value={crypto}>
                              {crypto.toUpperCase()}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>Loading available cryptocurrencies...</option>
                        )}
                      </select>
                      {/* Smart, converting hint text */}
                      {availableCryptos.length > 0 && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                          <p className="text-xs font-medium text-orange-800 flex items-center gap-2">
                            <span className="text-base">⚡</span>
                            <span>Native token for {chain?.name} - instant delivery, lowest fees</span>
                          </p>
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
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select payment method</h3>
                      {checkingAvailability && (
                        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Checking availability...</span>
                        </div>
                      )}
                      {paymentMethods.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {paymentMethods.map((pm) => {
                            const isAvailable = availablePaymentMethods.has(pm.id);
                            const isUnavailable = !isAvailable && !!cryptoCurrency && !checkingAvailability;
                            
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
                            Get quotes
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {statusRailItems.map((item) => (
                        <div
                          key={item.label}
                          className={`rounded-lg px-3 py-2 border text-xs font-semibold text-center ${
                            item.done
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-gray-50 border-gray-200 text-gray-500'
                          }`}
                        >
                          {item.done ? '✓ ' : ''}{item.label}
                        </div>
                      ))}
                    </div>

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
                      <div className="space-y-4">
                        {quote && isMobileViewport && showMiniStickyQuoteBar && (
                          <div className="sticky top-2 z-30 rounded-lg border border-orange-200/90 bg-white/95 backdrop-blur-sm px-2.5 py-2 shadow-md">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] uppercase tracking-wide text-gray-500">You'll receive</div>
                                {parseFloat(quote.cryptoAmount) > 0 ? (
                                  <div className="text-base font-bold text-gray-900 leading-tight truncate">
                                    {parseFloat(quote.cryptoAmount).toFixed(6)} {quote.quoteCurrency}
                                  </div>
                                ) : (
                                  <div className="text-xs text-blue-600 font-medium truncate">Quote during checkout</div>
                                )}
                                <div className="text-[11px] text-gray-600 truncate">
                                  {selectedProvider ? (
                                    <>
                                      via <span className="font-semibold capitalize text-orange-700">{selectedProvider}</span> • {quote.baseCurrency} {quote.totalAmount}
                                    </>
                                  ) : (
                                    <>Total: {quote.baseCurrency} {quote.totalAmount}</>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleContinue()}
                                disabled={loading || (!quote && paymentMethod?.toLowerCase() !== 'ideal') || (paymentMethod?.toLowerCase() === 'ideal' && !selectedProvider)}
                                className="shrink-0 h-9 px-3 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-white text-xs font-semibold transition-all duration-200"
                              >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                <span>Buy now</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quote Summary Hero - Compact */}
                        {quote && (
                          <div
                            ref={quoteCardRef}
                            className="glass-card bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 p-4 md:p-5 shadow-sm transition-all duration-200"
                          >
                            <div className="space-y-3">
                              {/* Main Quote Display */}
                              <div className="text-center border-b border-orange-200 pb-3">
                                <div className="uppercase tracking-wide text-gray-500 text-[11px] mb-1">You'll receive</div>
                                {parseFloat(quote.cryptoAmount) > 0 ? (
                                  <div className="font-bold text-gray-900 leading-tight text-3xl md:text-4xl mb-0.5">
                                    {parseFloat(quote.cryptoAmount).toFixed(6)} {quote.quoteCurrency}
                                  </div>
                                ) : paymentMethod?.toLowerCase() === 'ideal' ? (
                                  <div className="flex items-center justify-center gap-2 py-1.5">
                                    <Info className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm text-blue-600 font-medium">
                                      Quote will be calculated during checkout
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-base text-gray-500 py-1.5">
                                    Quote not available
                                  </div>
                                )}
                                {selectedProvider && (
                                  <div className="flex items-center justify-center gap-2 mt-1.5">
                                    <span className="text-[11px] text-gray-500">via</span>
                                    <span className="text-base font-semibold capitalize text-orange-700">{selectedProvider}</span>
                                    {userPreferences?.verifiedProviders?.includes(selectedProvider) && (
                                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-medium">
                                        <Shield className="w-2.5 h-2.5" />
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Quote Details Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-3 text-sm gap-2">
                                <div className="text-center md:text-left rounded-lg bg-white/55 px-3 py-2">
                                  <div className="text-gray-500 text-xs mb-0.5">Exchange rate</div>
                                  <div className="font-semibold text-gray-900">
                                    1 {quote.quoteCurrency} = {quote.baseCurrency} {parseFloat(quote.exchangeRate).toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-center md:text-left rounded-lg bg-white/55 px-3 py-2">
                                  <div className="text-gray-500 text-xs mb-0.5">Service fee</div>
                                  <div className="font-semibold text-gray-900">
                                    {quote.baseCurrency} {parseFloat(quote.fee).toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-center md:text-left rounded-lg bg-white/55 px-3 py-2">
                                  <div className="text-gray-500 text-xs mb-0.5">Total</div>
                                  <div className="font-bold text-base text-gray-900">
                                    {quote.baseCurrency} {quote.totalAmount}
                                  </div>
                                </div>
                              </div>

                              {/* Buy Now Button - Always visible */}
                              {pendingPaymentOverride && (
                                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-3">
                                  <div className="flex items-start gap-2 text-amber-800">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                      <div className="font-semibold">Provider requires payment-method switch</div>
                                      <div className="mt-1">
                                        {pendingPaymentOverride.provider} cannot continue with {pendingPaymentOverride.requestedMethod}. Switch to {pendingPaymentOverride.actualMethod} to continue.
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleContinue(true)}
                                      className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                                    >
                                      Confirm switch
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPendingPaymentOverride(null);
                                        setFlowStep('payment');
                                      }}
                                      className="flex-1 py-2.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 text-sm font-semibold transition-colors"
                                    >
                                      Choose another method
                                    </button>
                                  </div>
                                </div>
                              )}

                              <button
                                onClick={() => handleContinue()}
                                disabled={loading || (!quote && paymentMethod?.toLowerCase() !== 'ideal') || (paymentMethod?.toLowerCase() === 'ideal' && !selectedProvider)}
                                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg transform hover:scale-[1.01] active:scale-[0.98] py-3 text-base"
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
                                const hasQuote = q.payout && parseFloat(q.payout.toString()) > 0;
                                
                                return (
                                  <button
                                    key={q.ramp}
                                    onClick={() => {
                                      setSelectedProvider(q.ramp);
                                      // Always set quote when provider is selected
                                      if (q.payout) {
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
                                          {parseFloat(q.payout!.toString()).toFixed(6)} {cryptoCurrency}
                                        </div>
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment successful!</h3>
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}


