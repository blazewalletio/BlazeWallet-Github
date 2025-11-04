'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic'; // ✅ PERFORMANCE: Code splitting
import { 
  ArrowUpRight, ArrowDownLeft, ArrowLeft, RefreshCw, Settings, 
  TrendingUp, Eye, EyeOff, Plus, Zap, ChevronRight,
  Repeat, Wallet as WalletIcon, TrendingDown, PieChart, Rocket, CreditCard,
  Lock, Gift, Vote, Users, Palette, LogOut
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { MultiChainService } from '@/lib/multi-chain-service';
import { BlockchainService } from '@/lib/blockchain';
import { TokenService } from '@/lib/token-service';
import { PriceService } from '@/lib/price-service';
import { CHAINS, POPULAR_TOKENS } from '@/lib/chains';
import { Token } from '@/lib/types';
import { tokenBalanceCache } from '@/lib/token-balance-cache';
import { refreshTokenMetadata } from '@/lib/spl-token-metadata';
import ChainSelector from './ChainSelector';
import TokenSelector from './TokenSelector';
import PortfolioChart from './PortfolioChart';
import PasswordUnlockModal from './PasswordUnlockModal';
import DebugPanel from './DebugPanel';
import AnimatedNumber from './AnimatedNumber';
import TransactionHistory from './TransactionHistory';
import PremiumBadge, { PremiumCard } from './PremiumBadge';
import { getPortfolioHistory } from '@/lib/portfolio-history';
import { Sparkles, Shield, Brain, MessageSquare } from 'lucide-react';
import BottomNavigation, { TabType } from './BottomNavigation';

// ✅ PERFORMANCE FIX: Lazy load modals (reduces initial bundle size by ~200KB)
const SendModal = dynamic(() => import('./SendModal'), { ssr: false });
const ReceiveModal = dynamic(() => import('./ReceiveModal'), { ssr: false });
const SwapModal = dynamic(() => import('./SwapModal'), { ssr: false });
const BuyModal = dynamic(() => import('./BuyModal'), { ssr: false });
const SettingsModal = dynamic(() => import('./SettingsModal'), { ssr: false });
const QuickPayModal = dynamic(() => import('./QuickPayModal'), { ssr: false });
const TokenDetailModal = dynamic(() => import('./TokenDetailModal'), { ssr: false });

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
const AIBrainAssistant = dynamic(() => import('./AIBrainAssistant'), { ssr: false });
const AISettingsModal = dynamic(() => import('./AISettingsModal'), { ssr: false });

export default function Dashboard() {
  const { 
    address, // EVM address (for backward compat)
    balance, 
    updateBalance, 
    currentChain, 
    tokens,
    updateTokens,
    updateActivity,
    checkAutoLock, // ✅ SECURITY FIX: Auto-lock check
    lockWallet,
    getCurrentAddress // ✅ NEW: Get correct address for current chain
  } = useWalletStore();
  
  // Get the correct address for the current chain (Solana or EVM)
  const displayAddress = getCurrentAddress();

  // Founder/Developer wallet addresses (add your addresses here)
  const founderAddresses = [
    '0x18347d3bcb33721e0c603befd2ffac8762d5a24d', // Your main wallet
    '0x742d35cc6634c0532925a3b8d0c9e5c3d3e8d3f5', // Add other founder addresses
    // Add more founder/developer addresses as needed
  ].map(addr => addr.toLowerCase());

  // Check if current wallet is a founder/developer (EVM only)
  const isFounder = address && founderAddresses.includes(address.toLowerCase());
  
  const [showBalance, setShowBalance] = useState(true);
  // ✅ isRefreshing removed - now derived from chain-specific state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  
  // ✅ AI Assistant pre-fill data state
  const [sendPrefillData, setSendPrefillData] = useState<any>(null);
  const [swapPrefillData, setSwapPrefillData] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false); // NEW: Debug panel state
  const [showPasswordUnlock, setShowPasswordUnlock] = useState(false); // ✅ NEW: Password unlock modal state
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
  
  // ✅ PHASE 1: Chain-Scoped State Management
  // Per-chain state to prevent cross-chain contamination
  interface ChainState {
    nativePriceUSD: number;
    totalValueUSD: number;
    nativeBalance: string;
    change24h: number;
    lastUpdate: Date | null;
    isRefreshing: boolean;
    activeFetchId: string | null; // Track async operations
  }
  
  const [chainStates, setChainStates] = useState<Map<string, ChainState>>(new Map());
  const [chartData, setChartData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<number | null>(24); // Default: 24 hours
  
  // ✅ AbortController tracking per chain
  const activeFetchControllers = useRef<Map<string, AbortController>>(new Map());
  
  // Helper: Get current chain state
  const getCurrentChainState = (): ChainState => {
    return chainStates.get(currentChain) || {
      nativePriceUSD: 0,
      totalValueUSD: 0,
      nativeBalance: '0',
      change24h: 0,
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
        lastUpdate: null,
        isRefreshing: false,
        activeFetchId: null,
      };
      updated.set(currentChain, { ...current, ...updates });
      return updated;
    });
  };
  
  // Derived state from current chain
  const currentState = getCurrentChainState();
  const isRefreshing = currentState.isRefreshing;
  const totalValueUSD = currentState.totalValueUSD;
  const change24h = currentState.change24h;
  
  // Priority List status
  const [isPriorityListLive, setIsPriorityListLive] = useState(false);
  
  // AI Features state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showAIRiskScanner, setShowAIRiskScanner] = useState(false);
  const [showAIPortfolioAdvisor, setShowAIPortfolioAdvisor] = useState(false);
  const [showAIGasOptimizer, setShowAIGasOptimizer] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAIBrain, setShowAIBrain] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  // Bottom navigation state
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  
  // ✅ NEW: Token refresh state
  const [refreshingToken, setRefreshingToken] = useState<string | null>(null);
  
  // ✅ NEW: Token detail modal state
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [showTokenDetail, setShowTokenDetail] = useState(false);
  
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
    const prevChain = activeFetchControllers.current.size > 0 
      ? Array.from(activeFetchControllers.current.keys())[0] 
      : null;
    
    console.log(`🔄 [Dashboard] Chain switching: ${prevChain || 'initial'} → ${currentChain}`);
    
    // 1. Abort ALL active fetches (cleanup)
    activeFetchControllers.current.forEach((controller, chain) => {
      controller.abort();
      console.log(`🚫 [Dashboard] Aborted stale fetch for ${chain}`);
    });
    activeFetchControllers.current.clear();
    
    // 2. Clear any loading states from previous chain
    // (Chain-specific states will handle themselves)
    
    // 3. Load cached data voor nieuwe chain (instant!)
    const loadCachedData = async () => {
      if (!displayAddress) return;
      
      const cachedResult = await tokenBalanceCache.getStale(currentChain, displayAddress);
      
      if (cachedResult.tokens && cachedResult.nativeBalance) {
        console.log(`⚡ [Dashboard] Loading cached state for ${currentChain}`);
        
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
        
        console.log(`⚡ Cached totals: Native $${cachedResult.nativeValueUSD.toFixed(2)} + Tokens $${tokensTotalUSD.toFixed(2)} = $${totalValue.toFixed(2)}`);
        
        // Update chain-specific state
        updateCurrentChainState({
          nativeBalance: cachedResult.nativeBalance,
          nativePriceUSD: cachedResult.nativePrice || 0,
          totalValueUSD: totalValue,
        });
      }
    };
    
    loadCachedData();
    
    // 4. Start fresh fetch voor nieuwe chain (always fetch to get latest balance!)
    const fetchTimer = setTimeout(() => {
      fetchData(false); // Always fetch fresh data on chain switch
    }, 100);
    
    return () => {
      clearTimeout(fetchTimer);
    };
  }, [currentChain, displayAddress]);

  // ✅ Auto-refresh on visibility change (user returns to tab after transaction)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && displayAddress) {
        console.log('👁️ [Dashboard] Tab became visible - checking for fresh data');
        // Force a fresh fetch when user returns to tab
        fetchData(false);
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
  const portfolioHistory = getPortfolioHistory();

  const fetchData = async (force = false) => {
    if (!displayAddress) return;
    
    // ✅ PHASE 2: AbortController Pattern
    // Cancel previous fetch for this chain
    const existingController = activeFetchControllers.current.get(currentChain);
    if (existingController) {
      existingController.abort();
      console.log(`🚫 [Dashboard] Cancelled previous fetch for ${currentChain}`);
    }
    
    // Create new abort controller for this fetch
    const controller = new AbortController();
    const fetchId = `${currentChain}-${Date.now()}`;
    activeFetchControllers.current.set(currentChain, controller);
    
    // Helper: Check if this fetch is still relevant
    const isStillRelevant = () => {
      if (controller.signal.aborted) {
        console.log(`⚠️ [Dashboard] Fetch ${fetchId} was aborted`);
        return false;
      }
      const currentController = activeFetchControllers.current.get(currentChain);
      if (currentController !== controller) {
        console.log(`⚠️ [Dashboard] Fetch ${fetchId} is outdated, newer fetch started`);
        return false;
      }
      return true;
    };
    
    const timestamp = Date.now();
    console.log(`\n========== FETCH DATA START [${fetchId}] ==========`);
    
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
      console.log(`⚡ Loaded from cache (${isStale ? 'stale' : 'fresh'}): ${cachedTokens.length} tokens, balance: ${cachedBalance}`);
      
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
      
      console.log(`💰 Cached total: Native $${cachedNativeValueUSD.toFixed(2)} + Tokens $${cachedTokensTotal.toFixed(2)} = $${cachedTotal.toFixed(2)}`);
      
      // ✅ IMPROVED: Only skip fresh fetch if NOT forced AND cache is very fresh (< 2 min for native balance)
      const cacheAge = cacheTimestamp > 0 ? Date.now() - cacheTimestamp : Infinity;
      const isCacheVeryFresh = cacheAge < 2 * 60 * 1000; // 2 minutes
      
      if (!isStale && !force && isCacheVeryFresh) {
        console.log('✅ Using fresh cached data, skipping fetch');
        updateCurrentChainState({ isRefreshing: false, activeFetchId: null });
        activeFetchControllers.current.delete(currentChain);
        return;
      }
      
      // ✅ If stale, old (>2 min), or forced, continue to refresh
      console.log(`🔄 Refreshing data in background... (age: ${Math.round(cacheAge / 1000)}s, forced: ${force})`);
    }
    
    // ✅ If manual refresh, clear price cache for ultra-fresh data
    if (force) {
      console.log('🔄 [Dashboard] Manual refresh - clearing price cache');
      priceService.clearCache();
    }
    
    try {
      console.log(`🌐 Chain: ${currentChain} (${chain.name})`);
      console.log(`📍 Display Address: ${displayAddress}`);
      
      // ✅ STEP 1: Fetch native balance
      console.log(`\n--- STEP 1: Fetch Native Balance ---`);
      const bal = await blockchain.getBalance(displayAddress);
      
      // ✅ Abort check after balance fetch
      if (!isStillRelevant()) {
        throw new Error('Fetch aborted');
      }
      
      console.log(`[${timestamp}] ✅ Balance received: ${bal} ${chain.nativeCurrency.symbol}`);
      updateBalance(bal);

      // ✅ STEP 2: Fetch ALL prices in ONE batch request (optimized!)
      console.log(`\n--- STEP 2: Fetch Prices (Batch) ---`);
      const popularTokens = POPULAR_TOKENS[currentChain] || [];
      const allSymbols = [chain.nativeCurrency.symbol];
      
      // Add token symbols (EVM only, Solana has no SPL tokens implemented yet)
      if (currentChain !== 'solana' && popularTokens.length > 0) {
        allSymbols.push(...popularTokens.map(t => t.symbol));
      }
      
      console.log(`[${timestamp}] 📡 Fetching prices for: ${allSymbols.join(', ')}`);
      const pricesMap = await priceService.getMultiplePrices(allSymbols);
      
      // ✅ Abort check after price fetch
      if (!isStillRelevant()) {
        throw new Error('Fetch aborted');
      }
      
      console.log(`[${timestamp}] 💰 Prices received:`, pricesMap);
      
      // Extract native price
      const nativePrice = pricesMap[chain.nativeCurrency.symbol] || 0;
      
      // ✅ Update chain-specific state instead of global state
      updateCurrentChainState({
        nativePriceUSD: nativePrice,
        lastUpdate: new Date(),
      });
      
      const nativeValueUSD = parseFloat(bal) * nativePrice;
      console.log(`[${timestamp}] 💵 Native token value:`, {
        balance: bal,
        symbol: chain.nativeCurrency.symbol,
        priceUSD: nativePrice,
        valueUSD: nativeValueUSD.toFixed(2)
      });

      // ✅ STEP 3: Fetch token balances (chain-specific)
      let tokensWithValue: Token[] = [];
      
      if (currentChain === 'solana') {
        // ✅ SOLANA: Fetch SPL tokens
        console.log(`\n--- STEP 3: Fetch SPL Token Balances (Solana) ---`);
        console.log(`[${timestamp}] 🪙 Fetching SPL tokens from chain...`);
        
        const solanaService = blockchain as any; // Access Solana-specific methods
        const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
        
        // ✅ Abort check after SPL token fetch
        if (!isStillRelevant()) {
          throw new Error('Fetch aborted');
        }
        
        console.log(`[${timestamp}] ✅ Found ${splTokens.length} SPL tokens with balance`);
        console.log(`[${timestamp}] 📊 SPL Tokens:`, splTokens);
        
        if (splTokens.length > 0) {
          // ✅ STEP 4: Fetch prices for SPL tokens (using mint addresses for DexScreener!)
          console.log(`\n--- STEP 4: Fetch SPL Token Prices ---`);
          
          // Try symbol-based pricing first (CoinGecko/Binance) for popular tokens
          const splSymbols = splTokens.map((t: any) => t.symbol);
          console.log(`[${timestamp}] 📡 Fetching prices for SPL tokens: ${splSymbols.join(', ')}`);
          
          const splPricesMap = await priceService.getMultiplePrices(splSymbols);
          
          // ✅ Abort check after price fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          console.log(`[${timestamp}] 💰 SPL prices received:`, splPricesMap);
          
          // For tokens without a symbol price, try mint-based pricing (DexScreener)
          const tokensNeedingMintPrice = splTokens.filter((t: any) => !splPricesMap[t.symbol] || splPricesMap[t.symbol] === 0);
          
          if (tokensNeedingMintPrice.length > 0) {
            console.log(`[${timestamp}] 🔍 Fetching DexScreener prices for ${tokensNeedingMintPrice.length} tokens without CoinGecko/Binance prices...`);
            const mints = tokensNeedingMintPrice.map((t: any) => t.address);
            const mintPrices = await priceService.getPricesByMints(mints);
            
            // ✅ Abort check after DexScreener fetch
            if (!isStillRelevant()) {
              throw new Error('Fetch aborted');
            }
            
            // Merge mint prices into splPricesMap
            tokensNeedingMintPrice.forEach((token: any) => {
              const mintPrice = mintPrices.get(token.address);
              if (mintPrice && mintPrice.price > 0) {
                splPricesMap[token.symbol] = mintPrice.price;
                console.log(`[${timestamp}] 💰 DexScreener: ${token.symbol} = $${mintPrice.price}`);
              }
            });
          }
          
          // Combine SPL tokens with prices
          tokensWithValue = await Promise.all(
            splTokens.map(async (token: any) => {
              const price = splPricesMap[token.symbol] || 0;
              const balanceNum = parseFloat(token.balance || '0');
              const balanceUSD = balanceNum * price;
              
              // Get 24h change (try mint-based if symbol fails)
              let change24h = 0;
              if (price > 0) {
                try {
                  // Try symbol first
                  change24h = await priceService.get24hChange(token.symbol);
                  
                  // If symbol failed, try mint
                  if (change24h === 0) {
                    const mintPrice = await priceService.getPriceByMint(token.address);
                    change24h = mintPrice.change24h;
                  }
                } catch (error) {
                  console.warn(`Failed to get 24h change for ${token.symbol}:`, error);
                }
              }
              
              console.log(`[${timestamp}] 💰 ${token.symbol}:`, {
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
                change24h,
              };
            })
          );
          
          console.log(`[${timestamp}] ✅ Final tokensWithValue:`, tokensWithValue);
        }
        
      } else if (displayAddress) {
        // ✅ EVM: Fetch ERC20 tokens
        console.log(`\n--- STEP 3: Fetch Token Balances (EVM) ---`);
        
        // ✅ NEW: Try Alchemy first (auto-detects ALL tokens!)
        let erc20Tokens: any[] = [];
        
        try {
          console.log(`[${timestamp}] 🔮 Attempting to fetch ALL ERC20 tokens via Alchemy...`);
          erc20Tokens = await blockchain.getERC20TokenBalances(displayAddress);
          
          // ✅ Abort check after ERC20 fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          if (erc20Tokens.length > 0) {
            console.log(`[${timestamp}] ✅ Alchemy found ${erc20Tokens.length} ERC20 tokens with balance`);
          } else {
            console.log(`[${timestamp}] ℹ️ No tokens found via Alchemy, falling back to POPULAR_TOKENS`);
          }
        } catch (error) {
          console.warn(`[${timestamp}] ⚠️ Alchemy failed, falling back to POPULAR_TOKENS:`, error);
        }
        
        // Fallback to POPULAR_TOKENS if Alchemy returned nothing
        if (erc20Tokens.length === 0 && popularTokens.length > 0) {
          console.log(`[${timestamp}] 🪙 Fetching balances for ${popularTokens.length} popular ERC20 tokens...`);
          
          const tokensWithBalance = await tokenService.getMultipleTokenBalances(
            popularTokens,
            displayAddress
          );
          
          // ✅ Abort check after token balance fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          erc20Tokens = tokensWithBalance.filter(t => parseFloat(t.balance || '0') > 0);
          console.log(`[${timestamp}] ✅ Token balances received:`, erc20Tokens.map(t => `${t.symbol}: ${t.balance}`));
        }
        
        // ✅ STEP 4: Enrich with USD prices
        if (erc20Tokens.length > 0) {
          console.log(`\n--- STEP 4: Fetch Token Prices (by Contract Address) ---`);
          
          // ✅ NEW: Use contract addresses instead of symbols!
          const tokenAddresses = erc20Tokens.map((t: any) => t.address);
          console.log(`[${timestamp}] 📡 Fetching prices for ${tokenAddresses.length} addresses via CoinGecko + DexScreener...`);
          
          // Use new address-based price lookup (hybrid: CoinGecko + DexScreener)
          const pricesByAddress = await priceService.getPricesByAddresses(tokenAddresses, currentChain);
          
          // ✅ Abort check after price fetch
          if (!isStillRelevant()) {
            throw new Error('Fetch aborted');
          }
          
          console.log(`[${timestamp}] 💰 Received prices for ${pricesByAddress.size}/${tokenAddresses.length} tokens`);
          
          // Combine tokens with prices
          const tokensWithPrices = erc20Tokens.map((token: any) => {
            const addressLower = token.address.toLowerCase();
            const priceData = pricesByAddress.get(addressLower) || { price: 0, change24h: 0 };
            const balanceNum = parseFloat(token.balance || '0');
            const balanceUSD = balanceNum * priceData.price;
            
            // ✅ DEBUG: Log price data to identify missing prices
            if (priceData.price === 0 && balanceNum > 0) {
              console.warn(`⚠️ [Dashboard] No price data for ${token.symbol}! Balance: ${token.balance}, Address: ${token.address}`);
            } else {
              console.log(`[${timestamp}] 💰 ${token.symbol}: ${token.balance} × $${priceData.price.toFixed(2)} = $${balanceUSD.toFixed(2)}`);
            }
            
            return {
              ...token,
              priceUSD: priceData.price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h: priceData.change24h,
              isNative: false,
            };
          });

          // Only show tokens with balance > 0
          tokensWithValue = tokensWithPrices.filter(
            t => parseFloat(t.balance || '0') > 0
          );
          
          console.log(`[${timestamp}] ✅ Final ${tokensWithValue.length} tokens with value`);
        }
      }

      // ✅ STEP 5: Update tokens and calculate total portfolio value
      console.log(`\n--- STEP 5: Calculate Total Portfolio Value ---`);
      
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
        
        // ✅ Update chain-specific state
        updateCurrentChainState({
          totalValueUSD: totalValue,
          nativeBalance: bal,
        });
        
        console.log(`[${timestamp}] 📊 Portfolio Summary:`, {
          nativeValueUSD: nativeValueUSD.toFixed(2),
          tokensTotalUSD: tokensTotalUSD.toFixed(2),
          tokensCount: tokensWithValue.length,
          totalValueUSD: totalValue.toFixed(2)
        });
        
        // Save to portfolio history
        if (displayAddress) {
          portfolioHistory.addSnapshot(totalValue, displayAddress, currentChain);
        }
      } else {
        // No tokens - native value IS total value
        updateTokens(currentChain, []); // Clear tokens for this chain
        
        // ✅ Update chain-specific state
        updateCurrentChainState({
          totalValueUSD: nativeValueUSD,
          nativeBalance: bal,
        });
        
        console.log(`[${timestamp}] 📊 Portfolio Summary (Native Only):`, {
          totalValueUSD: nativeValueUSD.toFixed(2)
        });
        
        // Save to portfolio history
        if (displayAddress) {
          portfolioHistory.addSnapshot(nativeValueUSD, displayAddress, currentChain);
        }
      }

      // ✅ STEP 6: Get 24h change for native token
      console.log(`\n--- STEP 6: Fetch 24h Change ---`);
      const nativeChange = await priceService.get24hChange(chain.nativeCurrency.symbol);
      
      // ✅ Abort check after 24h change fetch
      if (!isStillRelevant()) {
        throw new Error('Fetch aborted');
      }
      
      // ✅ Update chain-specific state
      updateCurrentChainState({
        change24h: nativeChange,
      });
      
      console.log(`[${timestamp}] 📈 24h Change: ${nativeChange >= 0 ? '+' : ''}${nativeChange.toFixed(2)}%`);
      
      // ✅ PHASE 4: Cache with native price included
      await tokenBalanceCache.set(
        currentChain, 
        displayAddress, 
        tokensWithValue, 
        bal,
        nativePrice, // ✅ STORE native price in cache!
        15 * 60 * 1000 // 15 minutes
      );
      console.log('💾 Cached fresh token and balance data');
      
      // Update chart data from history based on selected time range
      updateChartData();
      
      console.log(`========== FETCH DATA COMPLETE [${Date.now() - timestamp}ms] ==========\n`);
      
      // ✅ Success: Mark fetch as complete and cleanup
      updateCurrentChainState({
        isRefreshing: false,
        activeFetchId: null,
      });
      activeFetchControllers.current.delete(currentChain);
      
    } catch (error) {
      // ✅ Handle aborted fetches gracefully
      if (error instanceof Error && error.message === 'Fetch aborted') {
        console.log(`✅ [Dashboard] Fetch ${fetchId} successfully aborted`);
        return; // Silent return, state already cleaned up
      }
      
      console.error('❌ Error fetching data:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      
      // ✅ Update chain-specific state with error
      updateCurrentChainState({
        isRefreshing: false,
        activeFetchId: null,
      });
      activeFetchControllers.current.delete(currentChain);
    }
  };

  // Update chart data when time range changes
  const updateChartData = () => {
    const recentSnapshots = portfolioHistory.getRecentSnapshots(20, selectedTimeRange);
    if (recentSnapshots.length > 0) {
      setChartData(recentSnapshots.map(s => s.balance));
      
      // Update change percentage for selected range
      const rangeChange = portfolioHistory.getChangePercentage(selectedTimeRange);
      if (rangeChange !== 0) {
        // ✅ Update chain-specific state instead of global setChange24h
        updateCurrentChainState({ change24h: rangeChange });
      }
    }
  };

  /**
   * 🔄 NEW: Manually refresh unknown token metadata
   */
  const handleRefreshToken = async (tokenAddress: string) => {
    if (!tokenAddress || refreshingToken) return;
    
    setRefreshingToken(tokenAddress);
    
    try {
      console.log(`🔄 Refreshing metadata for token: ${tokenAddress}`);
      
      // Fetch fresh metadata from Jupiter
      const metadata = await refreshTokenMetadata(tokenAddress);
      
      if (metadata) {
        console.log(`✅ Got metadata: ${metadata.name} (${metadata.symbol})`);
        
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
        console.warn('❌ Failed to fetch token metadata');
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
    } finally {
      setRefreshingToken(null);
    }
  };

  useEffect(() => {
    fetchData(true); // Force refresh on mount
    const interval = setInterval(() => fetchData(false), 60000); // ✅ Update every 60 seconds (was 10s - too aggressive!)
    return () => clearInterval(interval);
  }, [displayAddress, currentChain]); // ✅ Use displayAddress (changes when chain switches)

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
        console.error('Error checking priority list status:', error);
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

  // Update chart when time range changes
  useEffect(() => {
    updateChartData();
  }, [selectedTimeRange]);

  // ✅ Format the CURRENT chain address (not just EVM address)
  const formattedAddress = displayAddress ? BlockchainService.formatAddress(displayAddress) : '';
  const isPositiveChange = change24h >= 0;

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
      case 'settings':
        return renderSettingsContent();
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
                            prefix="$"
                          />
                        </h2>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">{balance} {chain.nativeCurrency.symbol}</div>
                          <div className="text-xs text-gray-400">Native balance</div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowBalance(false)}
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
                          onClick={() => setShowBalance(true)}
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
                      {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}% 
                      {selectedTimeRange === 1 ? " last hour" : 
                       selectedTimeRange === 24 ? " today" : 
                       selectedTimeRange === 72 ? " last 3 days" :
                       selectedTimeRange === 168 ? " this week" :
                       selectedTimeRange === 720 ? " this month" :
                       " total"}
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

              {/* Mini Chart - Real Data */}
              <div className="h-20 flex items-end gap-1 mb-4">
                {chartData.length > 0 ? (
                  // Show real portfolio history
                  (() => {
                    const minValue = Math.min(...chartData);
                    const maxValue = Math.max(...chartData);
                    const range = maxValue - minValue || 1; // Avoid division by zero
                    
                    return chartData.map((value, i) => {
                      const heightPercent = ((value - minValue) / range) * 80 + 20;
                      return (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ delay: i * 0.03, duration: 0.5 }}
                          className={`flex-1 rounded-t ${isPositiveChange ? 'bg-emerald-400/40' : 'bg-rose-400/40'}`}
                        />
                      );
                    });
                  })()
                ) : (
                  // Placeholder while loading data
                  Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: '50%' }}
                      transition={{ delay: i * 0.05, duration: 0.5 }}
                      className="flex-1 rounded-t bg-gray-300/40"
                    />
                  ))
                )}
              </div>

              {/* Time Range Selector */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: '1u', hours: 1 },
                  { label: '1d', hours: 24 },
                  { label: '3d', hours: 72 },
                  { label: '1w', hours: 168 },
                  { label: '1m', hours: 720 },
                  { label: 'Alles', hours: null },
                ].map((range) => (
                  <motion.button
                    key={range.label}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedTimeRange(range.hours)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedTimeRange === range.hours
                        ? 'bg-primary-600 text-white shadow-soft'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {range.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Presale Card - Mobile Only */}
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
                    <div className={`text-sm ${
                      isPriorityListLive ? 'text-green-700 font-medium' : 'text-gray-600'
                    }`}>
                      {isPriorityListLive ? '🔥 Priority List is LIVE!' : 'Early access to tokens'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowBuyModal(true)}
              className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-5 text-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <CreditCard className="w-8 h-8 mx-auto text-white mb-2" />
              <div className="text-sm font-bold text-white">Buy</div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowSendModal(true)}
              className="bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl p-5 text-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <ArrowUpRight className="w-8 h-8 mx-auto text-white mb-2" />
              <div className="text-sm font-bold text-white">Send</div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowReceiveModal(true)}
              className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-5 text-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <ArrowDownLeft className="w-8 h-8 mx-auto text-white mb-2" />
              <div className="text-sm font-bold text-white">Receive</div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowSwapModal(true)}
              className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-5 text-center shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              <Repeat className="w-8 h-8 mx-auto text-white mb-2" />
              <div className="text-sm font-bold text-white">Swap</div>
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
              
              <p className="relative text-sm text-white/90 mt-1">
                ⚡ Instant payments • Ultra-low fees
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
        </div>
        
        <div className="space-y-3">
          {/* Native Token */}
          <motion.div
            whileTap={{ scale: 0.98 }}
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
                ${(parseFloat(balance) * currentState.nativePriceUSD).toFixed(2)}
              </div>
              <div className={`text-sm ${isPositiveChange ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}%
              </div>
            </div>
          </motion.div>

          {/* ERC-20 Tokens / SPL Tokens */}
          <AnimatePresence>
            {tokens.map((token, index) => {
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
                        
                        if (logoUrl && (
                          logoUrl.startsWith('http') ||
                          logoUrl.startsWith('/') || // ✅ Support local files (e.g. /crypto-wif.png)
                          logoUrl.startsWith('data:')
                        )) {
                          return (
                            <img 
                              src={logoUrl} 
                              alt={token.symbol}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error(`❌ Failed to load logo for ${token.symbol}:`, logoUrl);
                                // Fallback to symbol if image fails to load
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.textContent = token.symbol[0];
                              }}
                            />
                          );
                        }
                        
                        console.log(`⚠️ Using fallback for ${token.symbol}, logo:`, logoUrl);
                        return logoUrl || token.symbol[0];
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
                      <div className="font-semibold">${token.balanceUSD}</div>
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
                <button
                  onClick={() => setShowAISettings(true)}
                  className="text-xs text-purple-500 hover:text-purple-600 flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Configureer
                </button>
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

                {/* AI Brain - All Features */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIBrain(true)}
                  className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center mb-3">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold mb-1">AI Brain</div>
                  <div className="text-xs text-slate-400">Alles in één interface</div>
                </motion.button>
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
                🔥 BLAZE Features
              </h3>
              <PremiumBadge isPremium={false} tokenBalance={0} threshold={10000} />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* Staking */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowStaking(true)}
                className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Staking</div>
                <div className="text-xs text-slate-400">Earn up to 25% APY</div>
              </motion.button>

              {/* Cashback */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCashback(true)}
                className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mb-3">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Cashback</div>
                <div className="text-xs text-slate-400">2% on all transactions</div>
              </motion.button>

              {/* Governance */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowGovernance(true)}
                className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-3">
                  <Vote className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Governance</div>
                <div className="text-xs text-slate-400">Vote on proposals</div>
              </motion.button>

              {/* Launchpad */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowLaunchpad(true)}
                className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-3">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Launchpad</div>
                <div className="text-xs text-slate-400">Early access to IDOs</div>
              </motion.button>

              {/* Referrals */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowReferrals(true)}
                className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">Referrals</div>
                <div className="text-xs text-slate-400">Earn 50 BLAZE/referral</div>
              </motion.button>

              {/* NFT Collection */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNFTMint(true)}
                className="glass p-4 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center mb-3">
                  <Palette className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold mb-1">NFT Skins</div>
                <div className="text-xs text-slate-400">Exclusive wallet themes</div>
              </motion.button>

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
  const renderSettingsContent = () => (
    <div className="space-y-4">
      <div className="glass-card">
        <h3 className="text-xl font-semibold mb-4">Wallet settings</h3>
            <div className="space-y-3">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-gray-600" />
                  <div>
                <div className="font-semibold">General settings</div>
                <div className="text-sm text-gray-500">Configure wallet preferences</div>
                    </div>
                  </div>
          </button>
          
          <button
            onClick={() => {
              lockWallet();
              window.location.reload();
            }}
            className="w-full p-4 rounded-xl border border-gray-200 hover:bg-red-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-red-600" />
              <div>
                <div className="font-semibold text-red-600">Lock wallet</div>
                <div className="text-sm text-gray-500">Lock your wallet for security</div>
                </div>
                  </div>
          </button>
                  </div>
                </div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen pb-24">
        {/* Header with Network Selector */}
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-gray-200 shadow-sm">
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
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{chain.shortName}</div>
                    <div className="text-xs text-gray-500 font-mono truncate">{formattedAddress}</div>
                        </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </motion.button>
                      </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {/* Presale button - Hidden on mobile, shown as card below */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPresale(true)}
                  className="hidden md:flex px-4 py-2.5 sm:py-3 rounded-xl items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all"
                  title="Join Presale"
                >
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm font-semibold whitespace-nowrap">Presale Blaze Token</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-gray-50"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSettings(true)}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    lockWallet();
                    setShowPasswordUnlock(true); // ✅ Show unlock modal immediately
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
        onOpenDebug={() => {
          setShowSettings(false);
          setShowDebugPanel(true);
        }}
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
              console.log('🤖 [Dashboard] Executing AI action:', action);
              
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
          />
        )}

        {showAIGasOptimizer && (
          <AIGasOptimizer
            onClose={() => setShowAIGasOptimizer(false)}
            currentGasPrice={30} // TODO: Get real gas price from chain
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

        {showAIBrain && (
          <AIBrainAssistant
            onClose={() => setShowAIBrain(false)}
            onOpenFeature={(feature) => {
              setShowAIBrain(false);
              if (feature === 'assistant') setShowAIAssistant(true);
              else if (feature === 'scanner') setShowAIRiskScanner(true);
              else if (feature === 'advisor') setShowAIPortfolioAdvisor(true);
              else if (feature === 'optimizer') setShowAIGasOptimizer(true);
              else if (feature === 'chat') setShowAIChat(true);
            }}
            context={{
              balance: balance || '0',
              tokens: tokens,
              address: address || '',
              chain: currentChain,
              totalValue: totalValueUSD,
            }}
          />
        )}

        {showAISettings && (
          <AISettingsModal onClose={() => setShowAISettings(false)} />
        )}
      </AnimatePresence>
      
      {/* BLAZE Feature Pages */}
      <AnimatePresence>
        {showStaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowStaking(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <StakingDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGovernance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowGovernance(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <GovernanceDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLaunchpad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowLaunchpad(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <LaunchpadDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNFTMint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowNFTMint(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <NFTMintDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPresale && (
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
      
      {/* Full Screen Modals for Dashboards */}
      <AnimatePresence>
        {showReferrals && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowReferrals(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                ← Back to Dashboard
              </button>
              <ReferralDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showCashback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <button
                onClick={() => setShowCashback(false)}
                className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
              >
                ← Back to Dashboard
              </button>
              <CashbackTracker />
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
                <h2 className="text-xl font-bold text-gray-900">🔥 Deploy Blaze Token</h2>
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
      
      <DebugPanel 
        externalOpen={showDebugPanel} 
        onExternalClose={() => setShowDebugPanel(false)} 
      />
      
      {/* Password Unlock Modal - for lock/unlock flow */}
      <PasswordUnlockModal
        isOpen={showPasswordUnlock}
        onComplete={() => {
          console.log('✅ Wallet unlocked successfully - refreshing data');
          setShowPasswordUnlock(false);
          fetchData(true); // Refresh all wallet data
        }}
        onFallback={() => {
          // User wants to use recovery phrase instead
          console.log('⚠️ User requested fallback to recovery phrase');
          // Keep modal open, user will use recovery phrase option in modal
        }}
      />
      
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
            setShowSendModal(true);
          }}
          onReceive={() => {
            setShowTokenDetail(false);
            setShowReceiveModal(true);
          }}
          onSwap={() => {
            setShowTokenDetail(false);
            setShowSwapModal(true);
          }}
          onRefresh={handleRefreshToken}
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

    </>
  );
}




