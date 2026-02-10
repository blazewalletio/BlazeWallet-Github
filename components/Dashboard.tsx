'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic'; // ✅ PERFORMANCE: Code splitting
import { 
  ArrowUpRight, ArrowDownLeft, ArrowLeft, RefreshCw, Settings, 
  TrendingUp, Eye, EyeOff, Plus, Zap, ChevronRight, ChevronUp, ChevronDown,
  Repeat, Wallet as WalletIcon, TrendingDown, PieChart, Rocket, CreditCard,
  Lock, Gift, Vote, Users, User, Palette, LogOut,
  Sparkles, Shield, Brain, MessageSquare, Send, Download, ShoppingCart,
  BarChart3, DollarSign, Flame, Target, Clock, CheckCircle2, XCircle, Inbox,
  Copy, Check
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useCurrency } from '@/contexts/CurrencyContext';
import { MultiChainService } from '@/lib/multi-chain-service';
import { BlockchainService } from '@/lib/blockchain';
import { TokenService } from '@/lib/token-service';
import { PriceService } from '@/lib/price-service';
import { incomingTransactionMonitor } from '@/lib/incoming-transaction-monitor';
import { CHAINS, POPULAR_TOKENS } from '@/lib/chains';
import { Token } from '@/lib/types';
import { tokenBalanceCache } from '@/lib/token-balance-cache';
import { refreshTokenMetadata } from '@/lib/spl-token-metadata';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import ChainSelector from './ChainSelector';
import TokenSelector from './TokenSelector';
import toast from 'react-hot-toast';
import PasswordUnlockModal from './PasswordUnlockModal';
import AnimatedNumber from './AnimatedNumber';
import TransactionHistory from './TransactionHistory';
import PremiumBadge, { PremiumCard } from './PremiumBadge';
import BottomNavigation, { TabType } from './BottomNavigation';
import { PRESALE_FEATURE_ENABLED } from '@/lib/feature-flags';
import { calculateWeightedPortfolioChange } from '@/lib/portfolio-change-calculator';

// ✅ PERFORMANCE FIX: Lazy load modals (reduces initial bundle size by ~200KB)
const SendModal = dynamic(() => import('./SendModal'), { ssr: false });
const ReceiveModal = dynamic(() => import('./ReceiveModal'), { ssr: false });
const SwapModal = dynamic(() => import('./SwapModal'), { ssr: false });
const BuyModal = dynamic(() => import('./BuyModal'), { ssr: false });
const BuyModal2 = dynamic(() => import('./BuyModal2'), { ssr: false });
const BuyModal3 = dynamic(() => import('./BuyModal3'), { ssr: false });
const SettingsModal = dynamic(() => import('./SettingsModal'), { ssr: false });
const QuickPayModal = dynamic(() => import('./QuickPayModal'), { ssr: false });
const TokenDetailModal = dynamic(() => import('./TokenDetailModal'), { ssr: false });
const AddressBook = dynamic(() => import('./AddressBook'), { ssr: false });
const AccountPage = dynamic(() => import('./AccountPage'), { ssr: false });

// ✅ PERFORMANCE FIX: Lazy load dashboards (only load when accessed)
const FounderDeploy = dynamic(() => import('./FounderDeploy'), { ssr: false });
const StakingDashboard = dynamic(() => import('./StakingDashboard'), { ssr: false });
const GovernanceDashboard = dynamic(() => import('./GovernanceDashboard'), { ssr: false });
const LaunchpadDashboard = dynamic(() => import('./LaunchpadDashboard'), { ssr: false });
const ReferralDashboard = dynamic(() => import('./ReferralDashboard'), { ssr: false });
const NFTMintDashboard = dynamic(() => import('./NFTMintDashboard'), { ssr: false });
const CashbackTracker = dynamic(() => import('./CashbackTracker'), { ssr: false });
const PresaleDashboard = dynamic(() => import('./PresaleDashboard'), { ssr: false });
const VestingDashboard = dynamic(() => import('./VestingDashboard'), { ssr: false });

// ✅ PERFORMANCE FIX: Lazy load AI features (heavy components)
const AITransactionAssistant = dynamic(() => import('./AITransactionAssistant'), { ssr: false });
const AIRiskScanner = dynamic(() => import('./AIRiskScanner'), { ssr: false });
const AIPortfolioAdvisor = dynamic(() => import('./AIPortfolioAdvisor'), { ssr: false });
const AIGasOptimizer = dynamic(() => import('./AIGasOptimizer'), { ssr: false });
const AIConversationalAssistant = dynamic(() => import('./AIConversationalAssistant'), { ssr: false });

// Smart Scheduler components
const ScheduledTransactionsPanel = dynamic(() => import('./ScheduledTransactionsPanel'), { ssr: false });
const SavingsTracker = dynamic(() => import('./SavingsTracker'), { ssr: false });
const UpcomingTransactionsBanner = dynamic(() => import('./UpcomingTransactionsBanner'), { ssr: false });

// Onramp components
const OnrampTransactionsPanel = dynamic(() => import('./OnrampTransactionsPanel'), { ssr: false });
const PurchaseHistorySidebar = dynamic(() => import('./PurchaseHistorySidebar'), { ssr: false });

export default function Dashboard() {
  const { 
    address, // EVM address (for backward compat)
    solanaAddress, // Solana address
    balance, 
    updateBalance, 
    currentChain, 
    tokens,
    updateTokens,
    updateActivity,
    checkAutoLock, // ✅ SECURITY FIX: Auto-lock check
    lockWallet,
    getCurrentAddress, // ✅ NEW: Get correct address for current chain
    showUnlockModal, // ✅ NEW: Read from store
    setShowUnlockModal, // ✅ NEW: Write to store
    isTokenHidden, // ✅ NEW: Check if token is hidden
    showToken, // ✅ NEW: Show token (unhide)
    getChainTokens // ✅ NEW: Get tokens for specific chain
  } = useWalletStore();
  
  const { formatUSDSync, symbol } = useCurrency();
  
  // Get the correct address for the current chain (Solana or EVM)
  // ✅ Memoize to prevent unnecessary re-renders
  // Recalculate when currentChain or any address changes (so it updates when wallet is loaded)
  const displayAddress = useMemo(() => getCurrentAddress(), [currentChain, address, solanaAddress]);

  // Founder/Developer wallet addresses (add your addresses here)
  const founderAddresses = [
    '0x18347d3bcb33721e0c603befd2ffac8762d5a24d', // Your main wallet
    '0x742d35cc6634c0532925a3b8d0c9e5c3d3e8d3f5', // Add other founder addresses
    // Add more founder/developer addresses as needed
  ].map(addr => addr.toLowerCase());

  // Check if current wallet is a founder/developer (EVM only)
  const isFounder = address && founderAddresses.includes(address.toLowerCase());
  
  const [showBalance, setShowBalance] = useState(true);
  // ✅ NEW: State for showing/hiding hidden tokens section
  const [showHiddenTokens, setShowHiddenTokens] = useState(false);
  
  const [hideDust, setHideDust] = useState(() => {
    // Load from localStorage, default to TRUE (dust filter ON by default)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('blaze_hide_dust');
      return saved !== null ? saved === 'true' : true; // Default TRUE
    }
    return true;
  });
  const [dustThreshold, setDustThreshold] = useState(() => {
    // Load threshold from localStorage, default to $1
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('blaze_dust_threshold');
      return saved ? parseFloat(saved) : 1;
    }
    return 1;
  });
  // ✅ isRefreshing removed - now derived from chain-specific state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBuyModal2, setShowBuyModal2] = useState(false);
  const [showBuyModal3, setShowBuyModal3] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  
  // ✅ AI Assistant pre-fill data state
  const [sendPrefillData, setSendPrefillData] = useState<any>(null);
  const [swapPrefillData, setSwapPrefillData] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false); // NEW: Debug panel state
  // ✅ REMOVED: showPasswordUnlock now managed by wallet-store
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [quickPayInitialMethod, setQuickPayInitialMethod] = useState<'scanqr' | 'manual' | 'lightning' | undefined>(undefined); // ⚡ Control which method to auto-select
  const [showFounderDeploy, setShowFounderDeploy] = useState(false);
  const [showStaking, setShowStaking] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showNFTMint, setShowNFTMint] = useState(false);
  const [showCashback, setShowCashback] = useState(false);
  const [showPresale, setShowPresale] = useState(false);
  const [showVesting, setShowVesting] = useState(false);
  const [showProfile, setShowProfile] = useState(false); // NEW: Profile/Account page
  const [copiedAddress, setCopiedAddress] = useState(false); // Track copy state for visual feedback
  const [isLongPressing, setIsLongPressing] = useState(false); // Track long-press state for visual feedback
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  
  // ✅ PHASE 1: Chain-Scoped State Management
  // Per-chain state to prevent cross-chain contamination
  interface ChainState {
    nativePriceUSD: number;
    totalValueUSD: number;
    nativeBalance: string;
    change24h: number; // Weighted portfolio change
    nativeChange24h: number; // Native token price change only
    lastUpdate: Date | null;
    isRefreshing: boolean;
    activeFetchId: string | null; // Track async operations
  }
  
  const [chainStates, setChainStates] = useState<Map<string, ChainState>>(new Map());
  
  // ✅ AbortController tracking per chain
  const activeFetchControllers = useRef<Map<string, AbortController>>(new Map());
  // ✅ Refs to track tokens and balance without causing dependency issues
  const tokensRef = useRef(tokens);
  const balanceRef = useRef(balance);
  // ✅ Refs to track callback functions to prevent useEffect re-triggers
  const refreshPricesOnlyRef = useRef<() => Promise<void>>();
  const fetchDataRef = useRef<(force?: boolean) => Promise<void>>();
  // ✅ Ref to track if intervals are already set up to prevent duplicate intervals
  const intervalsSetupRef = useRef<{ priceInterval?: NodeJS.Timeout; fullInterval?: NodeJS.Timeout; address?: string; chain?: string }>({});
  // 🔥 NEW: Track if we're in a critical fetch period (to block visibility change fetches)
  const criticalFetchPeriod = useRef<boolean>(false);
  // 🔥 NEW: Track previous chain + address to detect actual chain switches vs address-only updates
  const previousChainAddress = useRef<{chain: string; address: string | null}>({chain: currentChain, address: displayAddress});
  
  // Update refs when values change
  useEffect(() => {
    tokensRef.current = tokens;
    balanceRef.current = balance;
  }, [tokens, balance]);
  
  // Helper: Get current chain state
  const getCurrentChainState = (): ChainState => {
    return chainStates.get(currentChain) || {
      nativePriceUSD: 0,
      totalValueUSD: 0,
      nativeBalance: '0',
      change24h: 0,
      nativeChange24h: 0, // Native token price change
      lastUpdate: null,
      isRefreshing: false,
      activeFetchId: null,
    };
  };
  
  // Helper: Update current chain state
  const updateCurrentChainState = (updates: Partial<ChainState>) => {
    setChainStates(prev => {
      const updated = new Map(prev);
      const current = prev.get(currentChain) || {
        nativePriceUSD: 0,
        totalValueUSD: 0,
        nativeBalance: '0',
        change24h: 0,
        nativeChange24h: 0, // Native token price change
        lastUpdate: null,
        isRefreshing: false,
        activeFetchId: null,
      };
      updated.set(currentChain, { ...current, ...updates });
      return updated;
    });
  };
  
  // Derived state from current chain
  // Priority List status
  const [isPriorityListLive, setIsPriorityListLive] = useState(false);
  
  // AI Features state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showAIRiskScanner, setShowAIRiskScanner] = useState(false);
  const [showAIPortfolioAdvisor, setShowAIPortfolioAdvisor] = useState(false);
  const [showAIGasOptimizer, setShowAIGasOptimizer] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  
  // Smart Scheduler modals
  const [showScheduledTransactions, setShowScheduledTransactions] = useState(false);
  const [showSavingsTracker, setShowSavingsTracker] = useState(false);
  
  // Onramp modals
  const [showOnrampTransactions, setShowOnrampTransactions] = useState(false); // Full modal (legacy)
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false); // NEW: Sidebar (recommended)

  // Bottom navigation state
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  
  // Get current chain state
  const currentState = getCurrentChainState();
  const isRefreshing = currentState.isRefreshing;
  
  const totalValueUSD = currentState.totalValueUSD;
  const change24h = currentState.change24h;
  
  // ✅ Helper function to create native token object
  const createNativeToken = useCallback((): Token => {
    const chain = CHAINS[currentChain];
    const nativeBalance = balance;
    const nativePriceUSD = currentState.nativePriceUSD;
    const change24h = currentState.change24h;
    
    return {
      address: displayAddress || 'native', // Use wallet address for native tokens
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: chain.nativeCurrency.decimals || 18,
      balance: nativeBalance,
      balanceUSD: (parseFloat(nativeBalance) * nativePriceUSD).toString(),
      priceUSD: nativePriceUSD,
      change24h: change24h,
      logo: chain.logoUrl || chain.icon,
    };
  }, [currentChain, balance, currentState.nativePriceUSD, currentState.change24h, displayAddress]);
  
  // ✅ FIX: Stable callback for password unlock complete handler
  // Using useCallback prevents stale closure issues
  const handlePasswordUnlockComplete = useCallback(() => {
    logger.log('✅ Wallet unlocked successfully');
    
    // ✅ Wait for displayAddress to be available before closing modal
    // This prevents the modal from staying open on first unlock attempt
    let checkCount = 0;
    const checkAddressInterval = setInterval(() => {
      checkCount++;
      const currentAddress = getCurrentAddress();
      if (currentAddress) {
        setShowUnlockModal(false); // ✅ Update store state
        clearInterval(checkAddressInterval);
      }
    }, 50); // Check every 50ms
    
    // Safety timeout: close modal after 3 seconds even if address not available
    setTimeout(() => {
      clearInterval(checkAddressInterval);
      setShowUnlockModal(false); // ✅ Update store state
    }, 3000);
  }, [displayAddress, address, solanaAddress, showUnlockModal, getCurrentAddress, setShowUnlockModal]);
  
  // ✅ Load user preferences from Supabase (cross-device sync)
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('balance_visible')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setShowBalance(profile.balance_visible ?? true);
          logger.log('✅ Loaded balance visibility from Supabase:', profile.balance_visible);
        }
      } catch (error) {
        logger.error('Failed to load user preferences:', error);
        // Default to true if error
        setShowBalance(true);
      }
    };
    
    loadUserPreferences();
  }, []);
  
  // ✅ NEW: Token refresh state
  const [refreshingToken, setRefreshingToken] = useState<string | null>(null);
  
  // ✅ NEW: Token detail modal state
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [showTokenDetail, setShowTokenDetail] = useState(false);
  
  // ✅ Handle balance visibility toggle (syncs to Supabase for cross-device)
  const handleToggleBalanceVisibility = async (newValue: boolean) => {
    setShowBalance(newValue); // Optimistic update
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase
        .from('user_profiles')
        .update({ balance_visible: newValue })
        .eq('user_id', user.id);
      
      logger.log('✅ Balance visibility updated in Supabase:', newValue);
    } catch (error) {
      logger.error('Failed to update balance visibility:', error);
      // Revert on error
      setShowBalance(!newValue);
    }
  };
  
  // PWA detection
  const [isPWA, setIsPWA] = useState(false);

  // ✅ OPTIE A+: Activity tracking for session management
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsPWA(isStandalone);
      
      // Update activity timestamp on user interactions
      const updateActivity = () => {
        sessionStorage.setItem('last_activity', Date.now().toString());
      };
      
      // Track various user interactions
      window.addEventListener('click', updateActivity);
      window.addEventListener('keydown', updateActivity);
      window.addEventListener('scroll', updateActivity);
      window.addEventListener('touchstart', updateActivity);
      
      // Set initial activity timestamp if not present
      if (!sessionStorage.getItem('last_activity')) {
        updateActivity();
      }
      
      return () => {
        window.removeEventListener('click', updateActivity);
        window.removeEventListener('keydown', updateActivity);
        window.removeEventListener('scroll', updateActivity);
        window.removeEventListener('touchstart', updateActivity);
      };
    }
  }, []);

  // ✅ PHASE 5: Chain Switch Hook met Cleanup
  // Proper chain switching with abort, cleanup, and cached data loading
  useEffect(() => {
    // 🔥 CRITICAL FIX: Detect if this is a REAL chain switch or just address update
    const isRealChainSwitch = previousChainAddress.current.chain !== currentChain;
    const isAddressChange = previousChainAddress.current.address !== displayAddress;
    const isInitialLoad = previousChainAddress.current.address === null && displayAddress === null;
    logger.log(`🔄 [Dashboard] Effect triggered: chain=${currentChain}, address=${displayAddress?.substring(0, 8) || 'null'}`);
    logger.log(`   Previous: chain=${previousChainAddress.current.chain}, address=${previousChainAddress.current.address?.substring(0, 8) || 'null'}`);
    logger.log(`   Is real chain switch: ${isRealChainSwitch}`);
    logger.log(`   Is address change only: ${isAddressChange && !isRealChainSwitch}`);
    logger.log(`   Is initial load: ${isInitialLoad}`);
    
    // ✅ SAVE previous values BEFORE updating tracker (needed for unlock detection)
    const wasAddressNull = previousChainAddress.current.address === null;
    const isAddressNowSet = displayAddress !== null;
    
    // Update the previous chain/address tracker
    previousChainAddress.current = { chain: currentChain, address: displayAddress };
    
    // 🚫 SKIP if this is ONLY an address change (wallet unlock) and NOT a chain switch
    // ✅ BUT: Don't skip if address changed from null → address (wallet unlock after hard refresh!)
    const isUnlockAfterRefresh = wasAddressNull && isAddressNowSet;
    const isSignOut = !wasAddressNull && !isAddressNowSet; // address changed from value → null (sign out)
    
    // 🚪 SKIP fetch on sign out (address → null)
    if (isSignOut) {
      logger.log(`🚪 [Dashboard] Skipping fetch - sign out detected`);
      return; // EXIT EARLY
    }
    
    if (!isRealChainSwitch && isAddressChange && displayAddress && !isUnlockAfterRefresh) {
      logger.log(`⏭️ [Dashboard] Skipping fetch - address change only`);
      return; // EXIT EARLY
    }
    
    // ✅ If this is wallet unlock after hard refresh (null → address), PROCEED with fetch
    if (isUnlockAfterRefresh) {
      logger.log(`🔓 [Dashboard] Wallet unlocked - fetching data for ${displayAddress.substring(0, 8)}...`);
    }
    
    const prevChain = activeFetchControllers.current.size > 0 
      ? Array.from(activeFetchControllers.current.keys())[0] 
      : null;
    logger.log(`🔄 [Dashboard] Chain switching: ${prevChain || 'initial'} → ${currentChain}`);
    
    // 🔥 CRITICAL: Block visibility change fetches during chain switch
    criticalFetchPeriod.current = true;
    
    // 1. Abort ALL active fetches (cleanup)
    activeFetchControllers.current.forEach((controller, chain) => {
      controller.abort();
      logger.log(`🚫 [Dashboard] Aborted stale fetch for ${chain}`);
    });
    activeFetchControllers.current.clear();
    
    // 2. Clear any loading states from previous chain
    // (Chain-specific states will handle themselves)
    
    // 3. IMMEDIATELY clear stale tokens from previous chain to prevent display issues
    updateTokens(currentChain, []); // Clear tokens for this chain first
    
    // 4. Load cached data voor nieuwe chain (instant!)
    const loadCachedData = async () => {
      if (!displayAddress) return;
      
      const cachedResult = await tokenBalanceCache.getStale(currentChain, displayAddress);
      
      if (cachedResult.tokens && cachedResult.nativeBalance) {
        logger.log(`⚡ [Dashboard] Loading cached state for ${currentChain}`);
        
        // Update global balance state (voor compatibility)
        updateBalance(cachedResult.nativeBalance);
        
        // Update tokens via store (chain-specific)
        updateTokens(currentChain, cachedResult.tokens);
        
        // Calculate total value from cached data
        const tokensTotalUSD = cachedResult.tokens.reduce(
          (sum, t) => sum + parseFloat(t.balanceUSD || '0'), 
          0
        );
        const totalValue = cachedResult.nativeValueUSD + tokensTotalUSD;
        
        logger.log(`⚡ Cached totals: Native $${cachedResult.nativeValueUSD.toFixed(2)} + Tokens $${tokensTotalUSD.toFixed(2)} = $${totalValue.toFixed(2)}`);
        
        // Update chain-specific state
        updateCurrentChainState({
          nativeBalance: cachedResult.nativeBalance,
          nativePriceUSD: cachedResult.nativePrice || 0,
          totalValueUSD: totalValue,
        });
      }
    };
    
    loadCachedData();
    
    // 5. Start fresh fetch voor nieuwe chain (always fetch to get latest balance!)
    const fetchTimer = setTimeout(() => {
      fetchData(false); // Always fetch fresh data on chain switch
    }, 100);
    
    // 6. 🔥 CRITICAL: Unblock visibility fetches after 2 seconds
    const unblockTimer = setTimeout(() => {
      criticalFetchPeriod.current = false;
      logger.log('🔓 [Dashboard] Critical fetch period ended - visibility fetches allowed');
    }, 2000);
    
    return () => {
      clearTimeout(fetchTimer);
      clearTimeout(unblockTimer);
    };
  }, [currentChain, displayAddress]);

  // ✅ Auto-refresh on visibility change (user returns to tab after transaction)
  // 🔥 FIX: Block during critical fetch periods to prevent race conditions
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && displayAddress) {
        // 🔥 CRITICAL: Skip if we're in a critical fetch period (chain switch/initial load)
        if (criticalFetchPeriod.current) {
          logger.log('👁️ [Dashboard] Tab became visible but in CRITICAL FETCH PERIOD - BLOCKING visibility fetch');
          return;
        }
        
        // Only fetch if there's NO active controller for this chain (no ongoing fetch)
        const activeController = activeFetchControllers.current.get(currentChain);
        if (!activeController) {
          logger.log('👁️ [Dashboard] Tab became visible - checking for fresh data');
          fetchData(false);
        } else {
          logger.log('👁️ [Dashboard] Tab became visible but fetch already in progress - skipping');
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentChain, displayAddress]);

  const chain = CHAINS[currentChain];
  const blockchain = MultiChainService.getInstance(currentChain); // ✅ Use singleton (prevents re-initialization)
  const tokenService = new TokenService(chain.rpcUrl);
  const priceService = new PriceService();

  const fetchData = useCallback(async (force = false) => {
    // ✅ DEBUG: Only log in development mode
    if (process.env.NODE_ENV === 'development') {
    }
    
    // 🔥 CRITICAL: ALWAYS clear price cache to get fresh prices!
    priceService.clearCache();
    
    // ✅ Early return if no displayAddress (normal during initialization)
    if (!displayAddress) {
      // ✅ DEBUG: Only log in development, not as warning
      if (process.env.NODE_ENV === 'development') {
        logger.log('🔍 [Dashboard] fetchData called but wallet not ready yet');
      }
      return;
    }
    
    // ✅ PHASE 2: AbortController Pattern
    // Cancel previous fetch for this chain
    const existingController = activeFetchControllers.current.get(currentChain);
    if (existingController) {
      existingController.abort();
      logger.log(`🚫 [Dashboard] Cancelled previous fetch for ${currentChain}`);
    }
    
    // Create new abort controller for this fetch
    const controller = new AbortController();
    const fetchId = `${currentChain}-${Date.now()}`;
    activeFetchControllers.current.set(currentChain, controller);
    
    // Helper: Check if this fetch is still relevant
    const isStillRelevant = () => {
      if (controller.signal.aborted) {
        logger.log(`⚠️ [Dashboard] Fetch ${fetchId} was aborted`);
        return false;
      }
      const currentController = activeFetchControllers.current.get(currentChain);
      if (currentController !== controller) {
        logger.log(`⚠️ [Dashboard] Fetch ${fetchId} is outdated, newer fetch started`);
        return false;
      }
      return true;
    };
    
    const timestamp = Date.now();
    logger.log(`\n========== FETCH DATA START [${fetchId}] ==========`);
    
    // Update chain state: start refreshing
    updateCurrentChainState({ 
      isRefreshing: true, 
      activeFetchId: fetchId 
    });
    
    // ✅ STALE-WHILE-REVALIDATE: Check cache first
    const { tokens: cachedTokens, nativeBalance: cachedBalance, nativePrice: cachedNativePrice, nativeValueUSD: cachedNativeValueUSD, timestamp: cacheTimestamp, isStale } = 
      await tokenBalanceCache.getStale(currentChain, displayAddress);
    
    if (cachedTokens && cachedBalance) {
      // ✅ Abort check after cache read
      if (!isStillRelevant()) {
        updateCurrentChainState({ isRefreshing: false, activeFetchId: null });
        return;
      }
      
      // ✅ Show cached data INSTANTLY
      logger.log(`⚡ Loaded from cache (${isStale ? 'stale' : 'fresh'}): ${cachedTokens.length} tokens, balance: ${cachedBalance}`);
      
      updateBalance(cachedBalance);
      updateTokens(currentChain, cachedTokens); // ✅ Chain-specific!
      
      // Calculate cached total
      const cachedTokensTotal = cachedTokens.reduce(
        (sum, token) => sum + parseFloat(token.balanceUSD || '0'),
        0
      );
      
      const cachedTotal = cachedNativeValueUSD + cachedTokensTotal;
      
      // Update chain-specific state with cached data
      updateCurrentChainState({
        nativePriceUSD: cachedNativePrice,
        totalValueUSD: cachedTotal,
        nativeBalance: cachedBalance,
      });
      
      logger.log(`💰 Cached total: Native $${cachedNativeValueUSD.toFixed(2)} + Tokens $${cachedTokensTotal.toFixed(2)} = $${cachedTotal.toFixed(2)}`);
      
      // ✅ IMPROVED: Only skip fresh fetch if NOT forced AND cache is very fresh (< 2 min for native balance)
      const cacheAge = cacheTimestamp > 0 ? Date.now() - cacheTimestamp : Infinity;
      const isCacheVeryFresh = cacheAge < 2 * 60 * 1000; // 2 minutes
      
      if (!isStale && !force && isCacheVeryFresh) {
        logger.log('✅ Using fresh cached data, skipping fetch');
        updateCurrentChainState({ isRefreshing: false, activeFetchId: null });
        activeFetchControllers.current.delete(currentChain);
        return;
      }
      
      // ✅ If stale, old (>2 min), or forced, continue to refresh
      logger.log(`🔄 Refreshing data in background... (age: ${Math.round(cacheAge / 1000)}s, forced: ${force})`);
    }
    
    // ✅ If manual refresh, clear price cache for ultra-fresh data
    if (force) {
      logger.log('🔄 [Dashboard] Manual refresh - clearing price cache');
      priceService.clearCache();
    }
    
    try {
      logger.log(`🌐 Chain: ${currentChain} (${chain.name})`);
      logger.log(`📍 Display Address: ${displayAddress}`);
      
      // ✅ STEP 1: Fetch native balance
      if (currentChain === 'ethereum') {
      }
      
      logger.log(`\n--- STEP 1: Fetch Native Balance ---`);
      const bal = await blockchain.getBalance(displayAddress);
      
      // ✅ Abort check after balance fetch
      if (!isStillRelevant()) {
        throw new Error('Fetch aborted');
      }
      
      logger.log(`[${timestamp}] ✅ Balance received: ${bal} ${chain.nativeCurrency.symbol}`);
      
      if (currentChain === 'ethereum') {
      }
      
      updateBalance(bal);

      // ✅ STEP 2: Fetch ALL prices in ONE batch request (optimized!)
      if (currentChain === 'ethereum') {
      }
      
      if (currentChain === 'solana') {
      }
      
      logger.log(`\n--- STEP 2: Fetch Prices (Batch) ---`);
      const popularTokens = POPULAR_TOKENS[currentChain] || [];
      const allSymbols = [chain.nativeCurrency.symbol];
      
      // Add token symbols (EVM only, Solana has no SPL tokens implemented yet)
      if (currentChain !== 'solana' && popularTokens.length > 0) {
        allSymbols.push(...popularTokens.map(t => t.symbol));
      }
      
      if (currentChain === 'ethereum') {
      }
      
      if (currentChain === 'solana') {
      }
      
      logger.log(`[${timestamp}] 📡 Fetching prices + change24h for: ${allSymbols.join(', ')}`);
      
      // 🔥 CRITICAL FIX: Fetch native token price via PriceService (uses cache!)
      // This ensures native tokens get the SAME cache treatment as ERC-20/SPL tokens
      const nativeSymbol = chain.nativeCurrency.symbol;
      
      if (currentChain === 'ethereum') {
      }
      if (currentChain === 'solana') {
      }
      
      const nativePriceData = await priceService.getMultiplePrices([nativeSymbol]);
      const pricesMap: Record<string, { price: number; change24h: number }> = {
        [nativeSymbol]: nativePriceData[nativeSymbol] || { price: 0, change24h: 0 },
      };
      
      const nativePrice = nativePriceData[nativeSymbol] || { price: 0, change24h: 0 };
      
      if (currentChain === 'ethereum') {
      }
      if (currentChain === 'solana') {
      }
      
      // ✅ Abort check after price fetch
      if (!isStillRelevant()) {
        throw new Error('Fetch aborted');
      }
      
      logger.log(`[${timestamp}] 💰 Prices + change24h received:`, pricesMap);
      
      // ✅ Extract native price AND change24h from the result
      const nativePriceValue = nativePrice.price;
      const nativeChange = nativePrice.change24h;
      
      if (currentChain === 'ethereum') {
      }
      
      if (currentChain === 'solana') {
      }
      
      // ✅ Update chain-specific state instead of global state
      updateCurrentChainState({
        nativePriceUSD: nativePriceValue,
        lastUpdate: new Date(),
      });
      
      const nativeValueUSD = parseFloat(bal) * nativePriceValue;
      logger.log(`[${timestamp}] 💵 Native token value:`, {
        balance: bal,
        symbol: chain.nativeCurrency.symbol,
        priceUSD: nativePriceValue,
        valueUSD: nativeValueUSD.toFixed(2)
      });
      
      if (currentChain === 'ethereum') {
      }
      
      if (currentChain === 'solana') {
      }

      // ✅ STEP 3: Fetch token balances (chain-specific)
      let tokensWithValue: Token[] = [];
      
      if (currentChain === 'solana') {
        // ✅ SOLANA: Fetch SPL tokens
        logger.log(`\n--- STEP 3: Fetch SPL Token Balances (Solana) ---`);
        logger.log(`[${timestamp}] 🪙 Fetching SPL tokens from chain...`);
        
        const solanaService = blockchain as any; // Access Solana-specific methods
        const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
        
        // ✅ Abort check after SPL token fetch
        if (!isStillRelevant()) {
          throw new Error('Fetch aborted');
        }
        
        logger.log(`[${timestamp}] ✅ Found ${splTokens.length} SPL tokens with balance`);
        logger.log(`[${timestamp}] 📊 SPL Tokens:`, splTokens);
        
        if (splTokens.length > 0) {
          // ✅ STEP 4: Fetch prices for SPL tokens (using mint addresses for DexScreener!)
          logger.log(`\n--- STEP 4: Fetch SPL Token Prices ---`);
          
          // ✅ Try symbol-based pricing first (CoinGecko/Binance) - returns price + change24h in ONE batch call!
          const splSymbols = splTokens.map((t: any) => t.symbol);
          logger.log(`[${timestamp}] 📡 Fetching prices + change24h for SPL tokens: ${splSymbols.join(', ')}`);
          
          const splPricesMap = await priceService.getMultiplePrices(splSymbols);
          
          // ✅ Abort check after price fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          logger.log(`[${timestamp}] 💰 SPL prices + change24h received:`, splPricesMap);
          
          // ✅ For tokens without a symbol price, try mint-based pricing (DexScreener)
          const tokensNeedingMintPrice = splTokens.filter((t: any) => !splPricesMap[t.symbol] || splPricesMap[t.symbol]?.price === 0);
          
          if (tokensNeedingMintPrice.length > 0) {
            logger.log(`[${timestamp}] 🔍 Fetching DexScreener prices for ${tokensNeedingMintPrice.length} tokens without CoinGecko/Binance prices...`);
            const mints = tokensNeedingMintPrice.map((t: any) => t.address);
            const mintPrices = await priceService.getPricesByMints(mints);
            
            // ✅ Abort check after DexScreener fetch
            if (!isStillRelevant()) {
              throw new Error('Fetch aborted');
            }
            
            // ✅ Merge mint prices into splPricesMap (with both price AND change24h!)
            tokensNeedingMintPrice.forEach((token: any) => {
              const mintPrice = mintPrices.get(token.address);
              if (mintPrice && mintPrice.price > 0) {
                splPricesMap[token.symbol] = { price: mintPrice.price, change24h: mintPrice.change24h };
                logger.log(`[${timestamp}] 💰 DexScreener: ${token.symbol} = $${mintPrice.price}, change24h: ${mintPrice.change24h >= 0 ? '+' : ''}${mintPrice.change24h.toFixed(2)}%`);
              }
            });
          }
          
          // ✅ Combine SPL tokens with prices + change24h (NO extra API calls needed!)
          tokensWithValue = splTokens.map((token: any, index: number) => {
            const priceData = splPricesMap[token.symbol] || { price: 0, change24h: 0 };
            const price = priceData.price || 0;
            const change24h = priceData.change24h || 0;
            const balanceNum = parseFloat(token.balance || '0');
            const balanceUSD = balanceNum * price;
            
            logger.log(`[${timestamp}] 💰 ${token.symbol}:`, {
              balance: token.balance,
              price: price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h: change24h,
              logo: token.logo
            });
            
            return {
              ...token,
              priceUSD: price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h, // ✅ Direct from batch call - no extra API calls!
            };
          });
          
          logger.log(`[${timestamp}] ✅ Final tokensWithValue:`, tokensWithValue);
          
          // 🔍 DEBUG: Totale token value
          const totalTokenValue = tokensWithValue.reduce((sum, token) => {
            return sum + parseFloat(token.balanceUSD || '0');
          }, 0);
        }
        
      } else if (displayAddress) {
        // ✅ EVM: Fetch ERC20 tokens
        if (currentChain === 'ethereum') {
        }
        
        logger.log(`\n--- STEP 3: Fetch Token Balances (EVM) ---`);
        
        // ✅ NEW: Try Alchemy first (auto-detects ALL tokens!)
        let erc20Tokens: any[] = [];
        
        if (currentChain === 'ethereum') {
        }
        
        try {
          logger.log(`[${timestamp}] 🔮 Attempting to fetch ALL ERC20 tokens via Alchemy...`);
          erc20Tokens = await blockchain.getERC20TokenBalances(displayAddress);
          
          // ✅ Abort check after ERC20 fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          if (erc20Tokens.length > 0) {
            logger.log(`[${timestamp}] ✅ Alchemy found ${erc20Tokens.length} ERC20 tokens with balance`);
            
            if (currentChain === 'ethereum') {
              erc20Tokens.forEach((token: any, index: number) => {
              });
            }
            
            // ✅ DEBUG: Log logo URLs to verify they're being fetched
            erc20Tokens.forEach((token: any) => {
              logger.log(`[${timestamp}] 🖼️ Token ${token.symbol}: logo = ${token.logo || 'MISSING'}`);
            });
          } else {
            logger.log(`[${timestamp}] ℹ️ No tokens found via Alchemy, falling back to POPULAR_TOKENS`);
            if (currentChain === 'ethereum') {
            }
          }
        } catch (error) {
          logger.warn(`[${timestamp}] ⚠️ Alchemy failed, falling back to POPULAR_TOKENS:`, error);
          if (currentChain === 'ethereum') {
          }
        }
        
        // Fallback to POPULAR_TOKENS if Alchemy returned nothing
        if (erc20Tokens.length === 0 && popularTokens.length > 0) {
          logger.log(`[${timestamp}] 🪙 Fetching balances for ${popularTokens.length} popular ERC20 tokens...`);
          
          const tokensWithBalance = await tokenService.getMultipleTokenBalances(
            popularTokens,
            displayAddress
          );
          
          // ✅ Abort check after token balance fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          erc20Tokens = tokensWithBalance.filter(t => parseFloat(t.balance || '0') > 0);
          logger.log(`[${timestamp}] ✅ Token balances received:`, erc20Tokens.map(t => `${t.symbol}: ${t.balance}`));
        }
        
        // ✅ STEP 4: Enrich with USD prices
        if (erc20Tokens.length > 0) {
          if (currentChain === 'ethereum') {
          }
          
          logger.log(`\n--- STEP 4: Fetch Token Prices (by Contract Address) ---`);
          
          // ✅ NEW: Use contract addresses instead of symbols!
          const tokenAddresses = erc20Tokens.map((t: any) => t.address);
          logger.log(`[${timestamp}] 📡 Fetching prices for ${tokenAddresses.length} addresses via CoinGecko + DexScreener...`);
          
          if (currentChain === 'ethereum') {
            erc20Tokens.forEach((token: any, idx: number) => {
            });
          }
          
          // Use new address-based price lookup (hybrid: CoinGecko + DexScreener)
          const pricesByAddress = await priceService.getPricesByAddresses(tokenAddresses, currentChain);
          
          // ✅ Abort check after price fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          logger.log(`[${timestamp}] 💰 Received prices for ${pricesByAddress.size}/${tokenAddresses.length} tokens`);
          
          if (currentChain === 'ethereum') {
            erc20Tokens.forEach((token: any) => {
              const priceData = pricesByAddress.get(token.address.toLowerCase());
              if (priceData && priceData.price > 0) {
              } else {
              }
            });
          }
          
          // ✅ STEP 4.5: Fetch missing logos from CoinGecko for tokens without logos
          const tokensNeedingLogos = erc20Tokens.filter((token: any) => 
            !token.logo || 
            token.logo === '/crypto-placeholder.png' || 
            token.logo === '/crypto-eth.png' ||
            token.logo.trim() === ''
          );
          
          if (tokensNeedingLogos.length > 0) {
            logger.log(`[${timestamp}] 🖼️ Fetching logos from CoinGecko for ${tokensNeedingLogos.length} tokens...`);
            
            // Fetch logos in parallel
            await Promise.all(
              tokensNeedingLogos.map(async (token: any) => {
                try {
                  const { getCurrencyLogo } = await import('@/lib/currency-logo-service');
                  const logo = await getCurrencyLogo(token.symbol, token.address, currentChain);
                  if (logo && logo !== '/crypto-eth.png' && logo !== '/crypto-placeholder.png') {
                    token.logo = logo;
                    logger.log(`[${timestamp}] ✅ Fetched logo for ${token.symbol}: ${logo}`);
                  }
                } catch (error) {
                  logger.warn(`[${timestamp}] ⚠️ Failed to fetch logo for ${token.symbol}:`, error);
                }
              })
            );
          }
          
          // Combine tokens with prices
          if (currentChain === 'ethereum') {
          }
          
          const tokensWithPrices = erc20Tokens.map((token: any) => {
            const addressLower = token.address.toLowerCase();
            let priceData = pricesByAddress.get(addressLower) || { price: 0, change24h: 0 };
            const balanceNum = parseFloat(token.balance || '0');
            
            // 🛡️ SANITY CHECK: Detect and fix abnormally high prices
            // Common issues:
            // 1. CoinGecko returning price in wrong unit (e.g., per 1e18 tokens instead of per token)
            // 2. Cached stale data with incorrect values
            // 3. API error returning wrong format
            // Threshold: $10k per token (most tokens should be well below this)
            if (priceData.price > 10000) {
              logger.warn(`⚠️ [Dashboard] SUSPICIOUS HIGH PRICE detected for ${token.symbol}: $${priceData.price.toFixed(2)} per token`);
              logger.warn(`   Balance: ${token.balance}, Address: ${token.address}`);
              logger.warn(`   This would result in: $${(balanceNum * priceData.price).toFixed(2)}`);
              logger.warn(`   Setting price to 0 to prevent incorrect calculation. Will try DexScreener fallback.`);
              
              // Set price to 0 to trigger fallback or show $0 value
              priceData = { price: 0, change24h: 0 };
            }
            
            const balanceUSD = balanceNum * priceData.price;
            
            // ✅ DEBUG: Log price data to identify missing prices
            if (priceData.price === 0 && balanceNum > 0) {
              logger.warn(`⚠️ [Dashboard] No price data for ${token.symbol}! Balance: ${token.balance}, Address: ${token.address}`);
            } else {
              logger.log(`[${timestamp}] 💰 ${token.symbol}: ${token.balance} × $${priceData.price.toFixed(2)} = $${balanceUSD.toFixed(2)}`);
              
              if (currentChain === 'ethereum') {
                // Find index for console logging
                const tokenIndex = erc20Tokens.findIndex((t: any) => t.address === token.address);
              }
            }
            
            // ✅ FIX: Ensure logo is preserved when updating token with prices
            return {
              ...token,
              priceUSD: priceData.price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h: priceData.change24h,
              isNative: false,
              logo: token.logo || '/crypto-placeholder.png', // Preserve logo from Alchemy
            };
          });

          // Only show tokens with balance > 0
          tokensWithValue = tokensWithPrices.filter(
            t => parseFloat(t.balance || '0') > 0
          );
          
          logger.log(`[${timestamp}] ✅ Final ${tokensWithValue.length} tokens with value`);
        }
      }

      // ✅ STEP 5: Update tokens and calculate total portfolio value
      if (currentChain === 'ethereum') {
      }
      
      logger.log(`\n--- STEP 5: Calculate Total Portfolio Value ---`);
      
      // ✅ FINAL abort check before state update
      if (!isStillRelevant()) {
        throw new Error('Fetch aborted');
      }
      
      if (tokensWithValue.length > 0) {
        // ✅ Chain-specific token update
        updateTokens(currentChain, tokensWithValue);

        // Calculate total portfolio value (native + tokens)
        const tokensTotalUSD = tokensWithValue.reduce(
          (sum, token) => sum + parseFloat(token.balanceUSD || '0'),
          0
        );
        const totalValue = nativeValueUSD + tokensTotalUSD;
        
        if (currentChain === 'ethereum') {
        }
        
        // ✅ Update chain-specific state
        updateCurrentChainState({
          totalValueUSD: totalValue,
          nativeBalance: bal,
        });
        
        logger.log(`[${timestamp}] 📊 Portfolio Summary:`, {
          nativeValueUSD: nativeValueUSD.toFixed(2),
          tokensTotalUSD: tokensTotalUSD.toFixed(2),
          tokensCount: tokensWithValue.length,
          totalValueUSD: totalValue.toFixed(2)
        });
        
      } else {
        // No tokens - native value IS total value
        updateTokens(currentChain, []); // Clear tokens for this chain
        
        if (currentChain === 'ethereum') {
        }
        
        // ✅ Update chain-specific state
        updateCurrentChainState({
          totalValueUSD: nativeValueUSD,
          nativeBalance: bal,
        });
        
        logger.log(`[${timestamp}] 📊 Portfolio Summary (Native Only):`, {
          totalValueUSD: nativeValueUSD.toFixed(2)
        });
        
      }

      // ✅ STEP 6: Native 24h change already fetched in batch call above!
      // No extra API call needed - change24h is already in pricesMap!
      if (currentChain === 'ethereum') {
      }
      
      logger.log(`\n--- STEP 6: Native 24h Change (from batch) ---`);
      logger.log(`[${timestamp}] 📈 Native 24h Change: ${nativeChange >= 0 ? '+' : ''}${nativeChange.toFixed(2)}%`);
      
      if (currentChain === 'ethereum') {
      }
      
      // ✅ STEP 7: Calculate weighted portfolio change (instant accurate!)
      // ✅ CRITICAL FIX: Always calculate portfolio change, even if no tokens
      // Filter tokens to ensure they have valid change24h values
      const tokensForCalculation = tokensWithValue.filter(token => {
        const hasBalance = parseFloat(String(token.balanceUSD || '0')) > 0;
        const hasChange = typeof token.change24h === 'number' && !isNaN(token.change24h);
        return hasBalance && hasChange;
      });
      
      logger.log(`[${timestamp}] 🔍 DEBUG: Calculating portfolio change:`, {
        totalTokens: tokensWithValue.length,
        validTokens: tokensForCalculation.length,
        nativeBalance: parseFloat(bal),
        nativePriceValue,
        nativeChange
      });
      
      if (currentChain === 'ethereum') {
      }
      
      tokensForCalculation.forEach((token, idx) => {
        logger.log(`[${timestamp}]   Token ${idx + 1}: ${token.symbol || token.name || 'Unknown'} - balanceUSD: ${token.balanceUSD}, change24h: ${token.change24h}%`);
        
        if (currentChain === 'ethereum') {
        }
      });
      
      // ✅ ALWAYS calculate weighted change (even if no tokens, it will return native change)
      const weightedChange = calculateWeightedPortfolioChange(
        tokensForCalculation,
        parseFloat(bal),
        nativePriceValue,
        nativeChange
      );
      
      // ✅ DEBUG: Log calculation result
      logger.log(`[${timestamp}] 🔍 DEBUG: Weighted change calculated: ${weightedChange.toFixed(2)}% (native: ${nativeChange.toFixed(2)}%)`);
      
      if (currentChain === 'ethereum') {
        const totalPortfolioValue = nativeValueUSD + tokensWithValue.reduce((sum, t) => sum + parseFloat(t.balanceUSD || '0'), 0);
        
        if (totalPortfolioValue > 0) {
          const nativeWeight = nativeValueUSD / totalPortfolioValue;
          const nativeContribution = nativeWeight * nativeChange;
          let tokenContribution = 0;
          tokensForCalculation.forEach((token, idx) => {
            const tokenValue = parseFloat(token.balanceUSD || '0');
            const tokenWeight = tokenValue / totalPortfolioValue;
            const contribution = tokenWeight * (token.change24h || 0);
            tokenContribution += contribution;
          });
        } else {
        }
      }
      
      // ✅ CRITICAL: Update chain-specific state with WEIGHTED change (portfolio) and NATIVE change (asset)
      updateCurrentChainState({
        change24h: weightedChange, // Portfolio weighted change
        nativeChange24h: nativeChange, // Native token price change only
      });
      
      logger.log(`[${timestamp}] 📊 Portfolio 24h Change: ${weightedChange >= 0 ? '+' : ''}${weightedChange.toFixed(2)}%`);
      
      if (currentChain === 'ethereum') {
      }
      
      // ✅ PHASE 4: Cache with native price included
      await tokenBalanceCache.set(
        currentChain, 
        displayAddress, 
        tokensWithValue, 
        bal,
        nativePriceValue, // ✅ STORE native price in cache!
        15 * 60 * 1000 // 15 minutes
      );
      logger.log('💾 Cached fresh token and balance data');
      
      // ✅ Update chart data from history based on selected time range
      // This will override with portfolio history if available (>= 2 snapshots with enough time span), 
      // otherwise it will keep the weighted change we just set above
      
      logger.log(`========== FETCH DATA COMPLETE [${Date.now() - timestamp}ms] ==========\n`);
      
      // ✅ Success: Mark fetch as complete and cleanup
      updateCurrentChainState({
        isRefreshing: false,
        activeFetchId: null,
      });
      activeFetchControllers.current.delete(currentChain);
      
    } catch (error) {
      // ✅ Handle aborted fetches gracefully
      if (error instanceof Error && error.message === 'Fetch aborted') {
        logger.log(`✅ [Dashboard] Fetch ${fetchId} successfully aborted`);
        return; // Silent return, state already cleaned up
      }
      
      logger.error('❌ Error fetching data:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      
      // ✅ Update chain-specific state with error
      updateCurrentChainState({
        isRefreshing: false,
        activeFetchId: null,
      });
      activeFetchControllers.current.delete(currentChain);
    }
  }, [displayAddress, currentChain, updateBalance, updateTokens, updateCurrentChainState]);
  // ✅ Removed chain, priceService, blockchain, tokenService, portfolioHistory from dependencies
  // These are created/accessed inside the function and don't need to be in dependencies
  
  // ✅ Update fetchData ref when function changes
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);


  /**
   * 🔄 NEW: Manually refresh unknown token metadata
   */
  const handleRefreshToken = async (tokenAddress: string) => {
    if (!tokenAddress || refreshingToken) return;
    
    setRefreshingToken(tokenAddress);
    
    try {
      logger.log(`🔄 Refreshing metadata for token: ${tokenAddress}`);
      
      // Fetch fresh metadata from Jupiter
      const metadata = await refreshTokenMetadata(tokenAddress);
      
      if (metadata) {
        logger.log(`✅ Got metadata: ${metadata.name} (${metadata.symbol})`);
        
        // Update token in local state
        // ✅ Use chain-specific updateTokens
        updateTokens(currentChain, tokens.map(token => {
          if (token.address === tokenAddress) {
            return {
              ...token,
              name: metadata.name,
              symbol: metadata.symbol,
              logo: metadata.logoURI || token.logo,
            };
          }
          return token;
        }));
        
        // Refresh full data to update cache
        await fetchData(false);
      } else {
        logger.warn('❌ Failed to fetch token metadata');
      }
    } catch (error) {
      logger.error('❌ Error refreshing token:', error);
    } finally {
      setRefreshingToken(null);
    }
  };

  /**
   * 🔄 NEW: Refresh prices only (without fetching balances)
   * Called every 30 seconds to keep prices up-to-date
   * Memoized with useCallback to prevent recreation on every render
   */
  const refreshPricesOnly = useCallback(async () => {
    if (!displayAddress) {
      logger.log('💰 [Dashboard] Skipping price refresh - no address');
      return;
    }
    
    // Don't refresh if a full fetch is in progress
    if (isRefreshing) {
      logger.log('💰 [Dashboard] Skipping price refresh - full fetch in progress');
      return;
    }
    
    try {
      logger.log('💰 [Dashboard] Refreshing prices only...');
      
      // ✅ CRITICAL FIX: Clear ALL caches (symbol, address, mint) to force fresh fetch
      // This ensures change24h is always fresh, not from stale cache
      priceService.clearCache();
      
      // Get current tokens from ref (avoids dependency issues)
      const currentTokens = tokensRef.current;
      if (!currentTokens || currentTokens.length === 0) {
        logger.log('💰 [Dashboard] No tokens to refresh');
        return;
      }
      
      // Declare variables for both Solana and EVM
      let pricesMap: Record<string, { price: number; change24h: number }> | null = null;
      let pricesByAddress: Map<string, { price: number; change24h: number }> | null = null;
      
      // Fetch fresh prices for all tokens
      let updatedTokens: any[] = [];
      if (currentChain === 'solana') {
        // ✅ Solana: Use symbol-based pricing (returns price + change24h in ONE batch call!)
        const symbols = currentTokens.map(t => t.symbol);
        pricesMap = await priceService.getMultiplePrices(symbols);
        
        // ✅ Update tokens with new prices + change24h (NO extra API calls!)
        updatedTokens = currentTokens.map((token) => {
          const priceData = pricesMap![token.symbol] || { price: token.priceUSD || 0, change24h: token.change24h || 0 };
          const price = priceData.price || 0;
          const change24h = priceData.change24h || 0;
          const balanceNum = parseFloat(token.balance || '0');
          const balanceUSD = balanceNum * price;
          
          return {
            ...token,
            priceUSD: price,
            balanceUSD: balanceUSD.toFixed(2),
            change24h, // ✅ Direct from batch call - no extra API calls!
          };
        });
        
        updateTokens(currentChain, updatedTokens);
      } else {
        // EVM: Use address-based pricing
        const tokenAddresses = currentTokens.map(t => t.address);
        pricesByAddress = await priceService.getPricesByAddresses(tokenAddresses, currentChain);
        
        // Update tokens with new prices
        updatedTokens = currentTokens.map((token) => {
          const addressLower = token.address.toLowerCase();
          const priceData = pricesByAddress!.get(addressLower) || { price: token.priceUSD || 0, change24h: token.change24h || 0 };
          const balanceNum = parseFloat(token.balance || '0');
          const balanceUSD = balanceNum * priceData.price;
          
          return {
            ...token,
            priceUSD: priceData.price,
            balanceUSD: balanceUSD.toFixed(2),
            change24h: priceData.change24h,
          };
        });
        
        updateTokens(currentChain, updatedTokens);
      }
      
      // ✅ Also refresh native token price and change (batch fetch for all native tokens!)
      const currentBalance = balanceRef.current;
      const currentChainConfig = CHAINS[currentChain]; // Read directly to avoid dependency
      
      // ✅ Batch fetch native token price + change24h (no extra calls!)
      const nativeSymbol = currentChainConfig.nativeCurrency.symbol;
      const nativePrices = await priceService.getMultiplePrices([nativeSymbol]);
      const nativePriceData = nativePrices[nativeSymbol] || { price: 0, change24h: 0 };
      const nativePrice = nativePriceData.price || 0;
      const nativeChange = nativePriceData.change24h || 0;
      const nativeValueUSD = parseFloat(currentBalance || '0') * nativePrice;
      
      // Recalculate total portfolio value
      const tokensTotalUSD = updatedTokens.reduce(
        (sum, token) => {
          return sum + parseFloat(String(token.balanceUSD || '0'));
        },
        0
      );
      const totalValue = nativeValueUSD + tokensTotalUSD;
      
      // ✅ Calculate weighted portfolio change (native + all tokens)
      const weightedChange = calculateWeightedPortfolioChange(
        updatedTokens,
        parseFloat(currentBalance || '0'),
        nativePrice,
        nativeChange
      );
      
      updateCurrentChainState({
        nativePriceUSD: nativePrice,
        totalValueUSD: totalValue,
        change24h: weightedChange, // ✅ Portfolio weighted change
        nativeChange24h: nativeChange, // ✅ Native token price change only
      });
      
      logger.log('✅ [Dashboard] Prices refreshed successfully');
    } catch (error) {
      logger.error('❌ [Dashboard] Failed to refresh prices:', error);
    }
  }, [displayAddress, currentChain, isRefreshing, updateTokens, updateCurrentChainState]);
  // ✅ Removed tokens, balance, chain, and priceService from dependencies
  // - tokens and balance: read directly from refs inside the function
  // - chain: derived from currentChain (already in dependencies)
  // - priceService: singleton, doesn't need to be in dependencies
  // This prevents the callback from being recreated on every price update
  
  // ✅ Update refreshPricesOnly ref when function changes
  useEffect(() => {
    refreshPricesOnlyRef.current = refreshPricesOnly;
  }, [refreshPricesOnly]);

  useEffect(() => {
    // ✅ DEBUG: Only log in development mode
    if (process.env.NODE_ENV === 'development') {
    }
    
    // ✅ Early return if no displayAddress (normal during initialization)
    if (!displayAddress) {
      // ✅ DEBUG: Only log in development, not as warning
      if (process.env.NODE_ENV === 'development') {
        logger.log('🔍 [Dashboard] Waiting for wallet address...');
      }
      // Clean up any existing intervals when address becomes null
      const existingSetup = intervalsSetupRef.current;
      if (existingSetup.priceInterval) {
        clearInterval(existingSetup.priceInterval);
      }
      if (existingSetup.fullInterval) {
        clearInterval(existingSetup.fullInterval);
      }
      intervalsSetupRef.current = {};
      return;
    }
    
    // ✅ Check if intervals are already set up for the same address and chain
    const existingSetup = intervalsSetupRef.current;
    if (existingSetup.address === displayAddress && existingSetup.chain === currentChain && 
        existingSetup.priceInterval && existingSetup.fullInterval) {
      // Intervals already set up for this address/chain combination - skip
      if (process.env.NODE_ENV === 'development') {
        logger.log('✅ [Dashboard] Intervals already set up for this address/chain, skipping');
      }
      return;
    }
    
    // ✅ Clean up existing intervals if they exist (different address/chain)
    if (existingSetup.priceInterval) {
      clearInterval(existingSetup.priceInterval);
    }
    if (existingSetup.fullInterval) {
      clearInterval(existingSetup.fullInterval);
    }
    
    // ✅ DEBUG: Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      logger.log('🔄 [Dashboard] Setting up refresh intervals');
    }
    
    // Use ref to call fetchData to avoid dependency issues
    if (fetchDataRef.current) {
      fetchDataRef.current(true).catch(error => {
        // ✅ Better error handling - only log critical errors
        if (error?.message && !error.message.includes('aborted') && !error.message.includes('timeout')) {
          logger.error('❌ [Dashboard] fetchData error:', error);
        } else if (process.env.NODE_ENV === 'development') {
          logger.log('🔍 [Dashboard] fetchData cancelled or timed out (normal during initialization)');
        }
      }); // Force refresh on mount
    }
    
    // 🔥 DISABLED: 30-second price-only refresh was causing portfolio value to jump to wrong values
    // Using ONLY the 60-second full refresh instead for consistency
    // The price-only refresh was updating prices but using stale balance data from refs
    
    // ✅ Full data refresh every 60 seconds (balances, prices, everything)
    const fullRefreshInterval = setInterval(() => {
      // ✅ DEBUG: Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        logger.log('⏰ [Dashboard] Full refresh interval triggered');
      }
      // Use ref to call fetchData to avoid dependency issues
      if (fetchDataRef.current) {
        fetchDataRef.current(false);
      }
    }, 60000); // ✅ Full update every 60 seconds
    
    // ✅ Store interval IDs and current address/chain in ref
    intervalsSetupRef.current = {
      fullInterval: fullRefreshInterval,
      address: displayAddress,
      chain: currentChain
    };
    
    // ✅ REMOVED: Scroll to top was causing scroll issues
    // This was preventing users from scrolling down and causing the page to jump back to top
    // Only scroll on initial mount if needed, not on every refresh
    
    return () => {
      logger.log('🔄 [Dashboard] Cleaning up refresh intervals');
      if (fullRefreshInterval) clearInterval(fullRefreshInterval);
      // Clear the ref when cleaning up
      intervalsSetupRef.current = {};
    };
  }, [displayAddress, currentChain]); // ✅ Only depend on displayAddress and currentChain
  // ✅ Removed refreshPricesOnly and fetchData from dependencies - using refs instead
  // This prevents infinite loops when these functions are recreated

  // Check Priority List status
  useEffect(() => {
    const checkPriorityListStatus = async () => {
      try {
        const response = await fetch('/api/priority-list');
        const result = await response.json();
        
        if (result.success && result.data) {
          setIsPriorityListLive(result.data.isRegistrationOpen || false);
        }
      } catch (error) {
        logger.error('Error checking priority list status:', error);
      }
    };

    checkPriorityListStatus();
    // Check every 60 seconds
    const interval = setInterval(checkPriorityListStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Track user activity
  useEffect(() => {
    const handleUserActivity = () => {
      updateActivity();
    };

    // Track various user interactions
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, [updateActivity]);

  // ✅ SECURITY FIX: Auto-lock check every 30 seconds
  useEffect(() => {
    const autoLockInterval = setInterval(() => {
      checkAutoLock();
    }, 30 * 1000); // Check every 30 seconds

    return () => clearInterval(autoLockInterval);
  }, [checkAutoLock]);

  // ✅ Start monitoring for incoming transactions
  useEffect(() => {
    if (!displayAddress) return;

    // Build addresses object for all chains we support
    const addresses: { [chain: string]: string } = {};
    const chainsToMonitor: string[] = [];

    // Add current chain
    addresses[currentChain] = displayAddress;
    chainsToMonitor.push(currentChain);

    // Optionally add other chains if we have multiple addresses loaded
    // (for now, just monitor the current active chain)

    logger.log('📥 [Dashboard] Starting incoming transaction monitor');
    incomingTransactionMonitor.startMonitoring(chainsToMonitor, addresses);

    // Cleanup: stop monitoring when component unmounts
    return () => {
      logger.log('📥 [Dashboard] Stopping incoming transaction monitor');
      incomingTransactionMonitor.stopMonitoring();
    };
  }, [displayAddress, currentChain]);

  // Update chart when time range changes

  // ✅ Format the CURRENT chain address (not just EVM address)
  const formattedAddress = displayAddress ? BlockchainService.formatAddress(displayAddress) : '';
  const isPositiveChange = change24h >= 0;

  // ✅ Copy address to clipboard function - SIMPLE & WORKS IN PWA
  const copyAddressToClipboard = () => {
    if (!displayAddress) {
      toast.error('No address available', { duration: 2000 });
      return false;
    }

    try {
      // ✅ SIMPLE & RELIABLE: Use execCommand which works everywhere including PWA
      const textArea = document.createElement('textarea');
      textArea.value = displayAddress;
      textArea.style.position = 'fixed';
      textArea.style.left = '0';
      textArea.style.top = '0';
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      textArea.setAttribute('readonly', '');
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, displayAddress.length);
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        // Visual feedback
        setCopiedAddress(true);
        
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        // Toast notification
        toast.success('Address copied!', {
          duration: 2000,
          icon: '✓',
          style: {
            background: 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
          },
        });
        
        setTimeout(() => {
          setCopiedAddress(false);
        }, 2000);
        
        return true;
      }
    } catch (error) {
      logger.error('Copy failed:', error);
    }
    
    // If execCommand fails, try Clipboard API as fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(displayAddress).then(() => {
        setCopiedAddress(true);
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        toast.success('Address copied!', {
          duration: 2000,
          icon: '✓',
          style: {
            background: 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
          },
        });
        setTimeout(() => {
          setCopiedAddress(false);
        }, 2000);
      }).catch((err) => {
        logger.error('Clipboard API also failed:', err);
        toast.error('Failed to copy. Please select and copy manually.', {
          duration: 3000,
        });
      });
      return true; // Assume it will work
    }
    
    toast.error('Copy not supported. Please select and copy manually.', {
      duration: 3000,
    });
    return false;
  };

  // ✅ Desktop: Click handler for copy button
  const handleCopyAddress = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chain selector from opening
    await copyAddressToClipboard();
  };

  // ✅ Mobile: Long-press handler - Copy directly when long-press detected
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); // Prevent chain selector
    touchStartTimeRef.current = Date.now();
    setIsLongPressing(false);
    
    // Store touch event for clipboard (needs user gesture)
    const touchEvent = e.nativeEvent;
    
    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      
      // Haptic feedback when long-press is detected
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
      
      // ✅ CRITICAL: Copy IMMEDIATELY when long-press detected (still in touch context)
      // Use requestAnimationFrame to ensure it's still within user gesture
      requestAnimationFrame(() => {
        performCopy();
      });
    }, 500);
  };
  
  // ✅ Copy function that works in PWA - called on touchEnd
  const performCopy = () => {
    if (!displayAddress) {
      toast.error('No address available', { duration: 2000 });
      return false;
    }
    
    // ✅ SIMPLE & RELIABLE: Use execCommand with proper setup
    try {
      const textArea = document.createElement('textarea');
      textArea.value = displayAddress;
      
      // ✅ Critical: Textarea must be in viewport for iOS/PWA
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.style.zIndex = '-1';
      textArea.setAttribute('readonly', '');
      textArea.setAttribute('aria-hidden', 'true');
      
      document.body.appendChild(textArea);
      
      // ✅ Select text properly
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, displayAddress.length);
      
      // ✅ For iOS, also use selection API
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      // ✅ Execute copy command
      const successful = document.execCommand('copy');
      
      // Clean up
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopiedAddress(true);
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        toast.success('Address copied!', {
          duration: 2000,
          icon: '✓',
          style: {
            background: 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
          },
        });
        setTimeout(() => {
          setCopiedAddress(false);
        }, 2000);
        return true;
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (error) {
      logger.error('execCommand failed:', error);
      
      // ✅ Fallback: Try Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(displayAddress).then(() => {
          setCopiedAddress(true);
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
          toast.success('Address copied!', {
            duration: 2000,
            icon: '✓',
            style: {
              background: 'rgba(16, 185, 129, 0.95)',
              color: '#fff',
            },
          });
          setTimeout(() => {
            setCopiedAddress(false);
          }, 2000);
        }).catch((err) => {
          logger.error('Clipboard API also failed:', err);
          toast.error('Copy failed. Please select and copy manually.', { duration: 3000 });
        });
        return true; // Assume it will work (async)
      }
      
      toast.error('Copy not supported. Please select and copy manually.', { duration: 3000 });
      return false;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation(); // Always prevent chain selector
    
    // Check if long-press was completed
    const wasLongPress = isLongPressing;
    
    // Clear long-press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // ✅ CRITICAL: If long-press was detected, copy NOW (direct in touchEnd event)
    if (wasLongPress) {
      e.preventDefault(); // Prevent any default behavior
      e.nativeEvent.stopImmediatePropagation(); // Stop all event propagation
      
      // Copy directly in touchEnd (still within user gesture context)
      performCopy();
    }
    
    // Reset state
    setTimeout(() => {
      setIsLongPressing(false);
    }, 100);
    
    touchStartTimeRef.current = null;
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    // Clear timer on touch cancel (e.g., scroll)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    setIsLongPressing(false);
    touchStartTimeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel long-press if user moves finger (scrolling)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'wallet':
        return renderWalletContent();
      case 'ai':
        return renderAIContent();
      case 'blaze':
        return renderBlazeContent();
      case 'history':
        return renderHistoryContent();
      case 'contacts':
        return renderContactsContent();
      default:
        return renderWalletContent();
    }
  };

  // Wallet tab content
  const renderWalletContent = () => (
    <div className="space-y-6">
          {/* Portfolio Value Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card relative overflow-hidden card-3d subtle-shimmer"
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-5 animate-gradient" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-2">Portfolio value</div>
                  <div className="flex items-center gap-3 mb-2">
                    {showBalance ? (
                      <>
                        <h2 className="text-4xl md:text-5xl font-bold">
                          <AnimatedNumber 
                            value={totalValueUSD} 
                            decimals={2} 
                            useCurrencyPrefix
                            isUSD={true}
                          />
                        </h2>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            {parseFloat(balance).toFixed(6)} {chain.nativeCurrency.symbol}
                          </div>
                          <div className="text-xs text-gray-400">Native balance</div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleBalanceVisibility(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="w-5 h-5" />
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-4xl md:text-5xl font-bold">••••••</h2>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleBalanceVisibility(true)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <EyeOff className="w-5 h-5" />
                        </motion.button>
                      </>
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-2 text-sm ${isPositiveChange ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isPositiveChange ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>
                      {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}% today
                    </span>
                  </div>
                  
                  {/* ✅ Last updated timestamp */}
                  {currentState.lastUpdate && (
                    <div className="text-xs text-gray-400 mt-1">
                      Updated {Math.floor((Date.now() - currentState.lastUpdate.getTime()) / 1000)}s ago
                    </div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>

          {/* Presale Card - Mobile Only (Hidden when feature flag is disabled) */}
          {PRESALE_FEATURE_ENABLED && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`md:hidden glass-card card-hover relative overflow-hidden border-2 transition-all ${
              isPriorityListLive 
                ? 'border-green-300' 
                : 'border-orange-200'
            }`}
            onClick={() => setShowPresale(true)}
          >
            <div className={`absolute inset-0 ${
              isPriorityListLive
                ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10'
                : 'bg-gradient-to-r from-orange-500/10 to-yellow-500/10'
            }`} />
            <div className="relative z-10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isPriorityListLive
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                        : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                    }`}>
                    <Rocket className="w-6 h-6 text-white" />
                    </div>
                    {isPriorityListLive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-lg"
                        style={{
                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                        }}
                      >
                        LIVE
                      </motion.div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                      BLAZE Presale
                      {isPriorityListLive && (
                        <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className={`text-sm flex items-center gap-1.5 ${
                      isPriorityListLive ? 'text-green-700 font-medium' : 'text-gray-600'
                    }`}>
                      {isPriorityListLive ? (
                        <>
                          <Flame className="w-4 h-4" />
                          <span>Priority List is LIVE!</span>
                        </>
                      ) : (
                        'Early access to tokens'
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </motion.div>
          )}

          {/* Upcoming Transactions Banner */}
          <UpcomingTransactionsBanner
            userId={typeof window !== 'undefined' ? (localStorage.getItem('wallet_email') || displayAddress || '') : ''}
            chain={currentChain}
            onViewAll={() => setShowScheduledTransactions(true)}
          />

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3">
            {/* Buy (Buy3) - Official Buy button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowBuyModal3(true)}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl aspect-square flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <CreditCard className="w-8 h-8 text-white mb-2" />
              <div className="text-sm font-bold text-white text-center">Buy</div>
            </motion.button>

            {/* Buy - Temporarily disabled */}
            {/* <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowBuyModal(true)}
              className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl aspect-square flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <CreditCard className="w-8 h-8 text-white mb-2" />
              <div className="text-sm font-bold text-white text-center">Buy</div>
            </motion.button> */}

            {/* Buy2 - Temporarily disabled */}
            {/* <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowBuyModal2(true)}
              className="bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl aspect-square flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <CreditCard className="w-8 h-8 text-white mb-2" />
              <div className="text-sm font-bold text-white text-center">Buy2</div>
            </motion.button> */}

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowSendModal(true)}
              className="bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl aspect-square flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <ArrowUpRight className="w-8 h-8 text-white mb-2" />
              <div className="text-sm font-bold text-white text-center">Send</div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowReceiveModal(true)}
              className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl aspect-square flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <ArrowDownLeft className="w-8 h-8 text-white mb-2" />
              <div className="text-sm font-bold text-white text-center">Receive</div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowSwapModal(true)}
              className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl aspect-square flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <Repeat className="w-8 h-8 text-white mb-2" />
              <div className="text-sm font-bold text-white text-center">Swap</div>
            </motion.button>
          </div>

          {/* ⚡ Lightning Network Button - Only for Bitcoin */}
          {currentChain === 'bitcoin' && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setQuickPayInitialMethod('lightning'); // ⚡ Auto-select Lightning
                setShowQuickPay(true);
              }}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all group relative overflow-hidden mt-3"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex items-center justify-center gap-3">
                <Zap className="w-6 h-6 text-white animate-pulse" />
                <span className="text-lg font-bold text-white">
                  Lightning Network
                </span>
                <Zap className="w-6 h-6 text-white animate-pulse" />
              </div>
              
              <p className="relative text-sm text-white/90 mt-1 flex items-center justify-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Instant payments • Ultra-low fees</span>
              </p>
            </motion.button>
          )}

          {/* Add Tokens Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowTokenSelector(true)}
            className="w-full glass-card card-hover p-3 flex items-center justify-center gap-2 mt-3"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-semibold">Add tokens</span>
          </motion.button>

      {/* Native Currency */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Assets</h3>
          <button
            onClick={() => {
              const newValue = !hideDust;
              setHideDust(newValue);
              localStorage.setItem('blaze_hide_dust', String(newValue));
            }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors group"
            title={hideDust ? `${tokens.filter(t => parseFloat(t.balanceUSD || '0') < dustThreshold).length} tokens hidden (< $${dustThreshold})` : 'Hide small balances'}
          >
            {hideDust ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {tokens.filter(t => parseFloat(t.balanceUSD || '0') < dustThreshold).length} hidden
                </span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                <span className="text-sm text-gray-400 group-hover:text-gray-600">Hide &lt; ${dustThreshold}</span>
              </>
            )}
          </button>
        </div>
        
        <div className="space-y-3">
          {/* Native Token */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // ✅ Create native token object and open modal
              const nativeToken = createNativeToken();
              setSelectedToken(nativeToken);
              setShowTokenDetail(true);
            }}
            className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl font-bold overflow-hidden"
              >
                {chain.logoUrl ? (
                  <img 
                    src={chain.logoUrl} 
                    alt={chain.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.textContent = chain.icon;
                    }}
                  />
                ) : (
                  chain.icon
                )}
              </div>
              <div>
                <div className="font-semibold">{chain.nativeCurrency.name}</div>
                <div className="text-sm text-slate-400">
                  {parseFloat(balance).toFixed(4)} {chain.nativeCurrency.symbol}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {currentState.nativePriceUSD > 0 
                  ? formatUSDSync(parseFloat(balance) * currentState.nativePriceUSD)
                  : formatUSDSync(0)
                }
              </div>
              <div className={`text-sm ${currentState.nativeChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentState.nativeChange24h >= 0 ? '+' : ''}{currentState.nativeChange24h.toFixed(2)}%
              </div>
            </div>
          </motion.div>

          {/* ERC-20 Tokens / SPL Tokens */}
          <AnimatePresence>
            {tokens
              .filter(token => {
                // ✅ NEW: Filter out hidden tokens
                if (token.address && isTokenHidden(currentChain, token.address)) {
                  return false;
                }
                // Apply dust filter if enabled
                if (!hideDust) return true;
                const balanceUSD = parseFloat(token.balanceUSD || '0');
                return balanceUSD >= dustThreshold;
              })
              .map((token, index) => {
              const isUnknownToken = token.name === 'Unknown Token' && currentChain === 'solana';
              const isRefreshing = refreshingToken === token.address;
              
              return (
                <motion.div
                  key={token.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedToken(token);
                    setShowTokenDetail(true);
                  }}
                  className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer relative"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                      {(() => {
                        const logoUrl = token.logo;
                        
                        // ✅ FIX: Check if logo is placeholder and try to fetch from CoinGecko
                        if (!logoUrl || logoUrl === '/crypto-placeholder.png' || logoUrl === '/crypto-eth.png') {
                          // Try to fetch logo from CoinGecko if we have symbol and address
                          if (token.symbol && token.address) {
                            // Use a placeholder for now, but log that we need to fetch
                            logger.log(`⚠️ [Dashboard] Token ${token.symbol} has placeholder logo, should fetch from CoinGecko`);
                            // Return symbol initial as fallback
                            return <span className="text-gray-600 font-bold">{token.symbol[0]}</span>;
                          }
                          return <span className="text-gray-600 font-bold">{token.symbol[0]}</span>;
                        }
                        
                        // ✅ FIX: Also check for empty string or null
                        if (!logoUrl || logoUrl.trim() === '') {
                          return <span className="text-gray-600 font-bold">{token.symbol[0]}</span>;
                        }
                        
                        // Valid logo URL - try to display it
                        if (
                          logoUrl.startsWith('http') ||
                          logoUrl.startsWith('/') || // ✅ Support local files (e.g. /crypto-wif.png)
                          logoUrl.startsWith('data:') ||
                          logoUrl.startsWith('blob:') // ✅ Support blob URLs from IndexedDB cache
                        ) {
                          return (
                            <img 
                              src={logoUrl} 
                              alt={token.symbol}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                logger.error(`❌ Failed to load logo for ${token.symbol}:`, logoUrl);
                                // Fallback to symbol if image fails to load
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.textContent = token.symbol[0];
                                  parent.className = 'w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl flex-shrink-0';
                                }
                              }}
                            />
                          );
                        }
                        
                        // Invalid logo format - use symbol initial
                        logger.warn(`⚠️ [Dashboard] Invalid logo format for ${token.symbol}:`, logoUrl);
                        return <span className="text-gray-600 font-bold">{token.symbol[0]}</span>;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="truncate">{token.name}</span>
                        {isUnknownToken && (
                          <span className="text-xs text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full flex-shrink-0">
                            Unknown
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 truncate">
                        {parseFloat(token.balance || '0').toFixed(4)} {token.symbol}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-semibold">{formatUSDSync(parseFloat(token.balanceUSD || '0'))}</div>
                      <div className={`text-sm ${(token.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(token.change24h || 0) >= 0 ? '+' : ''}{(token.change24h || 0).toFixed(2)}%
                      </div>
                    </div>
                    
                    {/* ✅ OPTIE A: Altijd zichtbare refresh button voor unknown tokens */}
                    {isUnknownToken && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshToken(token.address);
                        }}
                        disabled={isRefreshing}
                        className="ml-2 p-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-50 flex-shrink-0"
                        title="Refresh token metadata from Jupiter"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {tokens.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <div className="text-3xl mb-2">🪙</div>
              <p className="text-sm">No tokens yet</p>
              <button
                onClick={() => setShowTokenSelector(true)}
                className="text-primary-400 text-sm mt-2 hover:text-primary-300"
              >
                Add token
              </button>
            </div>
          )}

          {/* ✅ NEW: Hidden Tokens Section */}
          {(() => {
            // Get all tokens for current chain (including hidden ones)
            const allChainTokens = getChainTokens(currentChain);
            const hiddenTokensList = allChainTokens.filter(token => 
              token.address && isTokenHidden(currentChain, token.address)
            );

            if (hiddenTokensList.length === 0) return null;

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 pt-6 border-t border-gray-200/50"
              >
                <button
                  onClick={() => setShowHiddenTokens(!showHiddenTokens)}
                  className="flex items-center justify-between w-full mb-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-gray-400" />
                    <h4 className="text-sm font-semibold text-gray-400">
                      Hidden Tokens ({hiddenTokensList.length})
                    </h4>
                  </div>
                  {showHiddenTokens ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                <AnimatePresence>
                  {showHiddenTokens && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3">
                        {hiddenTokensList.map((token, index) => (
                          <motion.div
                            key={token.address}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05 }}
                            className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors opacity-60"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                                {token.logo ? (
                                  <img 
                                    src={token.logo} 
                                    alt={token.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement!.textContent = token.symbol[0];
                                    }}
                                  />
                                ) : (
                                  <span className="text-gray-600 font-bold">{token.symbol[0]}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-gray-400 truncate">
                                    {token.name || token.symbol}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-500 truncate">
                                  {parseFloat(token.balance || '0').toFixed(4)} {token.symbol}
                                </div>
                              </div>
                            </div>
                            
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (token.address) {
                                  showToken(currentChain, token.address);
                                  logger.log(`✅ Token ${token.symbol} shown on chain ${currentChain}`);
                                }
                              }}
                              className="ml-2 p-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-all flex items-center gap-2 flex-shrink-0"
                              title="Show token"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="text-sm font-medium">Show</span>
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })()}
        </div>
      </motion.div>
    </div>
  );

  // AI Tools tab content
  const renderAIContent = () => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="glass-card mt-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI Tools
                </h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* AI Transaction Assistant */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIAssistant(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">AI Assistent</div>
                  <div className="text-xs text-slate-400">Natural language transactions</div>
                </motion.button>

                {/* AI Risk Scanner */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIRiskScanner(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center mb-3">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">Scam Detector</div>
                  <div className="text-xs text-slate-400">Real-time risico scanning</div>
                </motion.button>

                {/* AI Portfolio Advisor */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIPortfolioAdvisor(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mb-3">
                    <PieChart className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">Portfolio Advisor</div>
                  <div className="text-xs text-slate-400">Gepersonaliseerde tips</div>
                </motion.button>

                {/* AI Gas Optimizer */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIGasOptimizer(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center mb-3">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">Gas Optimizer</div>
                  <div className="text-xs text-slate-400">Bespaar op gas fees</div>
                </motion.button>

                {/* AI Chat Assistant */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIChat(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center mb-3">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">Crypto Expert</div>
                  <div className="text-xs text-slate-400">24/7 AI support</div>
                </motion.button>

                {/* AI Brain - COMING SOON */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.01, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.2
                  }}
                  className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                >
                  {/* Content Layer (faded) */}
                  <div className="relative z-0 opacity-40">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center mb-3">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">AI Brain</div>
                  <div className="text-xs text-slate-400">Alles in één interface</div>
                  </div>
                  
                  {/* Frosted Overlay with Lock */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                    <motion.div
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                    >
                      <Lock className="w-8 h-8 text-white/60 mb-2" />
                    </motion.div>
                    <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
  );

  // Blaze Features tab content
  const renderBlazeContent = () => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span>BLAZE Features</span>
              </h3>
              <PremiumBadge isPremium={false} tokenBalance={0} threshold={10000} />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* Staking - COMING SOON */}
              <motion.div
                animate={{ 
                  scale: [1, 1.01, 1],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl"
              >
                {/* Content Layer (faded) */}
                <div className="relative z-0 opacity-40">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Staking</div>
                <div className="text-xs text-slate-400">Earn up to 25% APY</div>
                </div>

                {/* Frosted Overlay with Lock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Lock className="w-8 h-8 text-white/60 mb-2" />
                  </motion.div>
                  <span className="text-xs sm:text-sm font-semibold text-white/90 mb-1">Staking</span>
                  <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                </div>
              </motion.div>

              {/* Cashback - COMING SOON */}
              <motion.div
                animate={{ 
                  scale: [1, 1.01, 1],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.2
                }}
                className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl"
              >
                {/* Content Layer (faded) */}
                <div className="relative z-0 opacity-40">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mb-3">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Cashback</div>
                <div className="text-xs text-slate-400">2% on all transactions</div>
                </div>

                {/* Frosted Overlay with Lock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  >
                    <Lock className="w-8 h-8 text-white/60 mb-2" />
                  </motion.div>
                  <span className="text-xs sm:text-sm font-semibold text-white/90 mb-1">Cashback</span>
                  <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                </div>
              </motion.div>

              {/* Governance - COMING SOON */}
              <motion.div
                animate={{ 
                  scale: [1, 1.01, 1],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.4
                }}
                className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl"
              >
                {/* Content Layer (faded) */}
                <div className="relative z-0 opacity-40">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-3">
                  <Vote className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Governance</div>
                <div className="text-xs text-slate-400">Vote on proposals</div>
                </div>

                {/* Frosted Overlay with Lock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  >
                    <Lock className="w-8 h-8 text-white/60 mb-2" />
                  </motion.div>
                  <span className="text-xs sm:text-sm font-semibold text-white/90 mb-1">Governance</span>
                  <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                </div>
              </motion.div>

              {/* Launchpad - COMING SOON */}
              <motion.div
                animate={{ 
                  scale: [1, 1.01, 1],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.6
                }}
                className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl"
              >
                {/* Content Layer (faded) */}
                <div className="relative z-0 opacity-40">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-3">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Launchpad</div>
                <div className="text-xs text-slate-400">Early access to IDOs</div>
                </div>

                {/* Frosted Overlay with Lock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                  >
                    <Lock className="w-8 h-8 text-white/60 mb-2" />
                  </motion.div>
                  <span className="text-xs sm:text-sm font-semibold text-white/90 mb-1">Launchpad</span>
                  <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                </div>
              </motion.div>

              {/* Referrals - COMING SOON */}
              <motion.div
                animate={{ 
                  scale: [1, 1.01, 1],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.8
                }}
                className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl"
              >
                {/* Content Layer (faded) */}
                <div className="relative z-0 opacity-40">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Referrals</div>
                <div className="text-xs text-slate-400">Earn 50 BLAZE/referral</div>
                </div>

                {/* Frosted Overlay with Lock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                  >
                    <Lock className="w-8 h-8 text-white/60 mb-2" />
                  </motion.div>
                  <span className="text-xs sm:text-sm font-semibold text-white/90 mb-1">Referrals</span>
                  <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                </div>
              </motion.div>

              {/* NFT Skins - COMING SOON */}
              <motion.div
                animate={{ 
                  scale: [1, 1.01, 1],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.0
                }}
                className="glass p-4 rounded-xl text-left cursor-default relative overflow-hidden backdrop-blur-xl"
              >
                {/* Content Layer (faded) */}
                <div className="relative z-0 opacity-40">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center mb-3">
                  <Palette className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">NFT Skins</div>
                <div className="text-xs text-slate-400">Exclusive wallet themes</div>
                </div>
                
                {/* Frosted Overlay with Lock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black/30 via-black/20 to-black/30 backdrop-blur-md z-10">
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.0 }}
                  >
                    <Lock className="w-8 h-8 text-white/60 mb-2" />
                  </motion.div>
                  <span className="text-xs sm:text-sm font-semibold text-white/90 mb-1">NFT Skins</span>
                  <span className="text-[10px] font-bold text-white/80 tracking-wider">UNLOCKING SOON</span>
                </div>
              </motion.div>

              {/* Vesting (Founder Only) */}
              {isFounder && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowVesting(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left border-2 border-purple-500/30"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center mb-3">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">Vesting</div>
                  <div className="text-xs text-slate-400">120M tokens locked</div>
                </motion.button>
              )}
            </div>
          </motion.div>
  );

  // History tab content
  const renderHistoryContent = () => (
    <TransactionHistory />
  );

  // Settings tab content
  const renderContactsContent = () => (
    <AddressBook 
      isOpen={true}
      onClose={() => {}} // No-op in inline mode
      inline={true} // ✅ Render inline without modal wrapper
    />
  );

  return (
    <>
      <div className="min-h-screen pb-24 relative">

        {/* Header with Network Selector */}
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-gray-200 shadow-sm pt-safe">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowChainSelector(true)}
                  className="flex items-center gap-2 glass-card px-3 sm:px-4 py-2 rounded-xl hover:bg-gray-50 min-w-0"
                >
                  <div 
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center text-base sm:text-lg flex-shrink-0 overflow-hidden"
                  >
                    {chain.logoUrl ? (
                      <img 
                        src={chain.logoUrl} 
                        alt={chain.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.textContent = chain.icon;
                        }}
                      />
                    ) : (
                      chain.icon
                    )}
                      </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{chain.shortName}</div>
                    <div className="flex items-center gap-1.5">
                      <motion.div
                        onTouchStart={(e) => {
                          e.stopPropagation(); // Prevent chain selector
                          handleTouchStart(e);
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation(); // Prevent chain selector
                          e.nativeEvent.stopImmediatePropagation(); // Stop all propagation
                          handleTouchEnd(e);
                        }}
                        onTouchCancel={(e) => {
                          e.stopPropagation();
                          handleTouchCancel(e);
                        }}
                        onTouchMove={(e) => {
                          e.stopPropagation();
                          handleTouchMove(e);
                        }}
                        onClick={(e) => {
                          // Prevent click from opening chain selector on mobile after long-press
                          if (isLongPressing || copiedAddress) {
                            e.stopPropagation();
                            e.preventDefault();
                          }
                        }}
                        animate={isLongPressing ? { scale: 0.95 } : { scale: 1 }}
                        className={`text-xs text-gray-500 font-mono truncate select-none cursor-pointer sm:cursor-default ${
                          isLongPressing ? 'text-orange-600 font-semibold bg-orange-50 rounded px-1' : ''
                        } ${copiedAddress ? 'text-green-600' : ''} transition-all duration-200`}
                        style={{ 
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTouchCallout: 'none',
                          touchAction: 'manipulation', // Prevent double-tap zoom
                        }}
                        title="Long-press to copy (mobile)"
                      >
                        {formattedAddress}
                      </motion.div>
                      {/* Desktop: Show copy button, Mobile: Hidden (use long-press) */}
                      {displayAddress && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={handleCopyAddress}
                          className="hidden sm:flex flex-shrink-0 p-1 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors group"
                          title="Copy address"
                          aria-label="Copy wallet address"
                        >
                          {copiedAddress ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-600 transition-colors" />
                          )}
                        </motion.button>
                      )}
                    </div>
                        </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </motion.button>
                      </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {/* Presale button - Hidden on mobile, shown as card below (Hidden when feature flag is disabled) */}
                {PRESALE_FEATURE_ENABLED && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPresale(true)}
                  className="hidden md:flex px-4 py-2.5 sm:py-3 rounded-xl items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all"
                  title="Join Presale"
                >
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm font-semibold whitespace-nowrap">Presale Blaze Token</span>
                </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-gray-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProfile(true)}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-gray-50"
                  title="Profile"
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSettings(true)}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-gray-50"
                  title="Settings"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // ✅ lockWallet() will automatically set showUnlockModal: true in store
                    lockWallet();
                  }}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-orange-50 text-orange-600"
                  title="Lock wallet"
                >
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
                    </div>
                      </div>
                    </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderTabContent()}
          </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      {/* Modals */}
      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
      <BuyModal2 isOpen={showBuyModal2} onClose={() => setShowBuyModal2(false)} />
      <BuyModal3 
        isOpen={showBuyModal3} 
        onClose={() => setShowBuyModal3(false)}
        onOpenPurchaseHistory={() => {
          setShowBuyModal3(false);
          setShowPurchaseHistory(true); // NEW: Open sidebar instead of modal
        }}
      />
      <SendModal 
        isOpen={showSendModal} 
        onClose={() => {
          setShowSendModal(false);
          setSendPrefillData(null); // Clear prefill data on close
        }}
        prefillData={sendPrefillData}
      />
      <ReceiveModal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} />
      <SwapModal 
        isOpen={showSwapModal} 
        onClose={() => {
          setShowSwapModal(false);
          setSwapPrefillData(null); // Clear prefill data on close
        }}
        prefillData={swapPrefillData}
      />
      <ChainSelector isOpen={showChainSelector} onClose={() => setShowChainSelector(false)} />
      <TokenSelector isOpen={showTokenSelector} onClose={() => setShowTokenSelector(false)} />
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
      <QuickPayModal 
        isOpen={showQuickPay} 
        onClose={() => {
          setShowQuickPay(false);
          setQuickPayInitialMethod(undefined); // ⚡ Reset initialMethod on close
        }} 
        initialMethod={quickPayInitialMethod} // ⚡ Only set when Lightning button clicked
      />
      
      {/* AI Feature Modals */}
      <AnimatePresence>
        {showAIAssistant && (
          <AITransactionAssistant
            onClose={() => setShowAIAssistant(false)}
            context={{
              balance: balance || '0',
              tokens: tokens,
              address: address || '',
              chain: currentChain,
            }}
            onExecuteAction={(action) => {
              logger.log('🤖 [Dashboard] Executing AI action:', action);
              
              // Handle action execution with pre-fill data
              if (action.type === 'send') {
                // Map AI params to SendModal format
                setSendPrefillData({
                  amount: action.params?.amount,
                  token: action.params?.token,
                  recipient: action.params?.to || action.params?.recipient
                });
                setShowSendModal(true);
                setShowAIAssistant(false); // Close AI assistant
              } else if (action.type === 'swap') {
                // Map AI params to SwapModal format
                setSwapPrefillData({
                  fromToken: action.params?.fromToken || action.params?.from,
                  toToken: action.params?.toToken || action.params?.to,
                  amount: action.params?.amount
                });
                setShowSwapModal(true);
                setShowAIAssistant(false); // Close AI assistant
              }
            }}
          />
        )}

        {showAIRiskScanner && (
          <AIRiskScanner onClose={() => setShowAIRiskScanner(false)} />
        )}

        {showAIPortfolioAdvisor && (
          <AIPortfolioAdvisor
            onClose={() => setShowAIPortfolioAdvisor(false)}
            tokens={tokens}
            totalValue={totalValueUSD}
            totalValueChange24h={change24h}
            chain={chain.name}
            onBuyToken={(symbol) => {
              setShowAIPortfolioAdvisor(false);
              setShowBuyModal3(true);
            }}
            onSellToken={(symbol) => {
              setShowAIPortfolioAdvisor(false);
              setShowSendModal(true);
            }}
          />
        )}

        {showAIGasOptimizer && (
          <AIGasOptimizer
            onClose={() => setShowAIGasOptimizer(false)}
            chain={(() => {
              // Map display names to API names
              const chainName = chain.name.toLowerCase();
              const chainNameMap: Record<string, string> = {
                'bitcoin cash': 'bitcoincash',
                // Add more mappings if needed
              };
              return chainNameMap[chainName] || chainName;
            })()}
          />
        )}

        {showAIChat && (
          <AIConversationalAssistant
            onClose={() => setShowAIChat(false)}
            context={{
              balance: balance || '0',
              tokens: tokens,
              address: address || '',
              chain: currentChain,
              totalValue: totalValueUSD,
            }}
          />
        )}
      </AnimatePresence>
      
      {/* BLAZE Feature Pages */}
      <StakingDashboard isOpen={showStaking} onClose={() => setShowStaking(false)} />
      <GovernanceDashboard isOpen={showGovernance} onClose={() => setShowGovernance(false)} />
      <CashbackTracker isOpen={showCashback} onClose={() => setShowCashback(false)} />
      <LaunchpadDashboard isOpen={showLaunchpad} onClose={() => setShowLaunchpad(false)} />
      <ReferralDashboard isOpen={showReferrals} onClose={() => setShowReferrals(false)} />
      <NFTMintDashboard isOpen={showNFTMint} onClose={() => setShowNFTMint(false)} />

      <AnimatePresence>
        {PRESALE_FEATURE_ENABLED && showPresale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowPresale(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <PresaleDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVesting && isFounder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowVesting(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <VestingDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Founder Deploy Modal */}
      <AnimatePresence>
        {showFounderDeploy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowFounderDeploy(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl pointer-events-auto border border-gray-200 shadow-soft-xl"
            >
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span>Deploy Blaze Token</span>
                </h2>
                <button
                  onClick={() => setShowFounderDeploy(false)}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  ✕
                </button>
              </div>
              <FounderDeploy />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Password Unlock Modal - for lock/unlock flow */}
      {/* ✅ Single modal reading from wallet-store state */}
      {showUnlockModal && (
        <PasswordUnlockModal
          isOpen={showUnlockModal}
          onComplete={handlePasswordUnlockComplete}
          onFallback={async () => {
            // User clicked "Sign out" - reset everything and reload page
            logger.log('⚠️ User requested sign out - resetting wallet and reloading');
            try {
              // ⚠️ CRITICAL: Preserve device_id before clearing storage
              const preservedDeviceId = localStorage.getItem('blaze_device_id');
              const preservedFingerprint = localStorage.getItem('blaze_device_fingerprint');
              const preservedFingerprintCachedAt = localStorage.getItem('blaze_fingerprint_cached_at');
              
              // Reset wallet store
              const { resetWallet } = useWalletStore.getState();
              resetWallet();
              
              // ✅ CRITICAL: Clear IndexedDB (secure storage) - this is where encrypted_wallet is stored!
              const { secureStorage } = await import('@/lib/secure-storage');
              await secureStorage.clear();
              
              // Clear all storage
              if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();
              }
              
              // ✅ CRITICAL: Restore device_id after clearing localStorage
              if (preservedDeviceId) {
                localStorage.setItem('blaze_device_id', preservedDeviceId);
              }
              if (preservedFingerprint) {
                localStorage.setItem('blaze_device_fingerprint', preservedFingerprint);
              }
              if (preservedFingerprintCachedAt) {
                localStorage.setItem('blaze_fingerprint_cached_at', preservedFingerprintCachedAt);
              }
              
              // Reload page to go back to onboarding
              window.location.href = '/';
            } catch (error) {
              logger.error('❌ Error during sign out:', error);
              // Fallback: just reload
              window.location.href = '/';
            }
          }}
        />
      )}

      {/* Smart Scheduler Modals */}
      <AnimatePresence>
        <ScheduledTransactionsPanel 
          isOpen={showScheduledTransactions}
          chain={currentChain}
          onClose={() => setShowScheduledTransactions(false)}
        />
      </AnimatePresence>

      {/* Onramp Transactions Panel (Legacy Full Modal) */}
      <AnimatePresence>
        <OnrampTransactionsPanel
          isOpen={showOnrampTransactions}
          onClose={() => setShowOnrampTransactions(false)}
        />
      </AnimatePresence>

      {/* Purchase History Sidebar (NEW - Recommended) */}
      <PurchaseHistorySidebar
        isOpen={showPurchaseHistory}
        onClose={() => setShowPurchaseHistory(false)}
      />

      <AnimatePresence>
        {showSavingsTracker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSavingsTracker(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <SavingsTracker />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* ✅ NEW: Token Detail Modal */}
      {selectedToken && (
        <TokenDetailModal
          token={selectedToken}
          isOpen={showTokenDetail}
          onClose={() => {
            setShowTokenDetail(false);
            setSelectedToken(null);
          }}
          onSend={() => {
            setShowTokenDetail(false);
            // ✅ Prefill with token symbol
            setSendPrefillData({ token: selectedToken.symbol });
            setShowSendModal(true);
          }}
          onReceive={() => {
            setShowTokenDetail(false);
            setShowReceiveModal(true);
          }}
          onSwap={() => {
            setShowTokenDetail(false);
            // ✅ Prefill with token symbol
            setSwapPrefillData({ fromToken: selectedToken.symbol });
            setShowSwapModal(true);
          }}
          onRefresh={handleRefreshToken}
          // ✅ Pass native token data
          nativePriceUSD={currentState.nativePriceUSD}
          nativeChange24h={currentState.change24h}
          walletAddress={displayAddress}
        />
      )}
      
      {/* Floating Quick Pay Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowQuickPay(true)}
        className={`fixed ${isPWA ? 'bottom-32' : 'bottom-24'} right-6 z-40 w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full shadow-2xl flex items-center justify-center subtle-glow hover:scale-110 transition-transform duration-300`}
        title="Quick Pay"
      >
        <Zap className="w-8 h-8 text-white" />
      </motion.button>

      {/* Account Page Modal */}
      <AccountPage
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        onOpenSettings={() => {
          setShowProfile(false);
          setShowSettings(true);
        }}
      />

    </>
  );
}




