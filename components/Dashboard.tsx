'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, ArrowDownLeft, ArrowLeft, RefreshCw, Settings, 
  TrendingUp, Eye, EyeOff, Plus, Zap, ChevronRight,
  Repeat, Wallet as WalletIcon, TrendingDown, PieChart, Rocket, CreditCard,
  Lock, Gift, Vote, Users, Palette, LogOut
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { MultiChainService } from '@/lib/multi-chain-service'; // ✅ Use MultiChainService
import { BlockchainService } from '@/lib/blockchain'; // Keep for formatAddress utility
import { TokenService } from '@/lib/token-service';
import { PriceService } from '@/lib/price-service';
import { CHAINS, POPULAR_TOKENS } from '@/lib/chains';
import { Token } from '@/lib/types';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';
import SwapModal from './SwapModal';
import BuyModal from './BuyModal';
import ChainSelector from './ChainSelector';
import TokenSelector from './TokenSelector';
import PortfolioChart from './PortfolioChart';
import SettingsModal from './SettingsModal';
import DebugPanel from './DebugPanel';
import AnimatedNumber from './AnimatedNumber';
import QuickPayModal from './QuickPayModal';
import FounderDeploy from './FounderDeploy';
import TransactionHistory from './TransactionHistory';
import StakingDashboard from './StakingDashboard';
import GovernanceDashboard from './GovernanceDashboard';
import LaunchpadDashboard from './LaunchpadDashboard';
import ReferralDashboard from './ReferralDashboard';
import NFTMintDashboard from './NFTMintDashboard';
import CashbackTracker from './CashbackTracker';
import PremiumBadge, { PremiumCard } from './PremiumBadge';
import PresaleDashboard from './PresaleDashboard';
import VestingDashboard from './VestingDashboard';
import { getPortfolioHistory } from '@/lib/portfolio-history';
import AITransactionAssistant from './AITransactionAssistant';
import AIRiskScanner from './AIRiskScanner';
import AIPortfolioAdvisor from './AIPortfolioAdvisor';
import AIGasOptimizer from './AIGasOptimizer';
import AIConversationalAssistant from './AIConversationalAssistant';
import AIBrainAssistant from './AIBrainAssistant';
import AISettingsModal from './AISettingsModal';
import { Sparkles, Shield, Brain, MessageSquare } from 'lucide-react';
import BottomNavigation, { TabType } from './BottomNavigation';

export default function Dashboard() {
  const { 
    address, // EVM address (for backward compat)
    balance, 
    updateBalance, 
    currentChain, 
    tokens,
    updateTokens,
    updateActivity,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false); // NEW: Debug panel state
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [showFounderDeploy, setShowFounderDeploy] = useState(false);
  const [showStaking, setShowStaking] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showNFTMint, setShowNFTMint] = useState(false);
  const [showCashback, setShowCashback] = useState(false);
  const [showPresale, setShowPresale] = useState(false);
  const [showVesting, setShowVesting] = useState(false);
  const [totalValueUSD, setTotalValueUSD] = useState(0);
  const [nativePriceUSD, setNativePriceUSD] = useState(0); // ✅ NEW: Store native token price
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null); // ✅ NEW: Track last update time
  const [change24h, setChange24h] = useState(2.5);
  const [chartData, setChartData] = useState<number[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<number | null>(24); // Default: 24 hours
  
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
  
  // PWA detection
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsPWA(isStandalone);
    }
  }, []);

  const chain = CHAINS[currentChain];
  const blockchain = new MultiChainService(currentChain); // ✅ Use MultiChainService
  const tokenService = new TokenService(chain.rpcUrl);
  const priceService = new PriceService();
  const portfolioHistory = getPortfolioHistory();

  const fetchData = async (force = false) => {
    if (!displayAddress) return; // ✅ Use displayAddress instead of address
    
    // Prevent multiple simultaneous refreshes
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    // ✅ If manual refresh (force=true), clear cache for ultra-fresh data
    if (force) {
      console.log('🔄 [Dashboard] Manual refresh - clearing cache');
      priceService.clearCache();
    }
    
    try {
      // Force refresh - bypass any caching
      const timestamp = Date.now();
      console.log(`\n========== FETCH DATA START [${timestamp}] ==========`);
      console.log(`🌐 Chain: ${currentChain} (${chain.name})`);
      console.log(`📍 Display Address: ${displayAddress}`);
      console.log(`🔧 Chain Config:`, {
        name: chain.name,
        symbol: chain.nativeCurrency.symbol,
        rpcUrl: chain.rpcUrl
      });
      
      // ✅ STEP 1: Fetch native balance
      console.log(`\n--- STEP 1: Fetch Native Balance ---`);
      console.log(`[${timestamp}] 🚀 Calling blockchain.getBalance(${displayAddress})...`);
      const bal = await blockchain.getBalance(displayAddress);
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
      console.log(`[${timestamp}] 💰 Prices received:`, pricesMap);
      
      // Extract native price
      const nativePrice = pricesMap[chain.nativeCurrency.symbol] || 0;
      setNativePriceUSD(nativePrice); // ✅ STORE native price in state!
      setLastPriceUpdate(new Date()); // ✅ STORE last update timestamp
      
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
        
        console.log(`[${timestamp}] ✅ Found ${splTokens.length} SPL tokens with balance`);
        console.log(`[${timestamp}] 📊 SPL Tokens:`, splTokens);
        
        if (splTokens.length > 0) {
          // ✅ STEP 4: Fetch prices for SPL tokens
          console.log(`\n--- STEP 4: Fetch SPL Token Prices ---`);
          const splSymbols = splTokens.map((t: any) => t.symbol);
          console.log(`[${timestamp}] 📡 Fetching prices for SPL tokens: ${splSymbols.join(', ')}`);
          
          const splPricesMap = await priceService.getMultiplePrices(splSymbols);
          console.log(`[${timestamp}] 💰 SPL prices received:`, splPricesMap);
          
          // Combine SPL tokens with prices
          tokensWithValue = await Promise.all(
            splTokens.map(async (token: any) => {
              const price = splPricesMap[token.symbol] || 0;
              const balanceNum = parseFloat(token.balance || '0');
              const balanceUSD = balanceNum * price;
              const change24h = await priceService.get24hChange(token.symbol);
              
              console.log(`[${timestamp}] 💰 ${token.symbol}:`, {
                balance: token.balance,
                price: price,
                balanceUSD: balanceUSD.toFixed(2),
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
        
      } else if (popularTokens.length > 0 && displayAddress) {
        // ✅ EVM: Fetch ERC20 tokens
        console.log(`\n--- STEP 3: Fetch Token Balances (EVM) ---`);
        console.log(`[${timestamp}] 🪙 Fetching balances for ${popularTokens.length} ERC20 tokens...`);
        
        const tokensWithBalance = await tokenService.getMultipleTokenBalances(
          popularTokens,
          displayAddress
        );
        
        console.log(`[${timestamp}] ✅ Token balances received:`, tokensWithBalance.map(t => `${t.symbol}: ${t.balance}`));
        
        // ✅ STEP 4: Combine with prices (already fetched in batch!)
        console.log(`\n--- STEP 4: Calculate Token USD Values ---`);
        const tokensWithPrices = await Promise.all(
          tokensWithBalance.map(async (token) => {
            const price = pricesMap[token.symbol] || 0;
            const balanceUSD = parseFloat(token.balance || '0') * price;
            const change24h = await priceService.get24hChange(token.symbol);
            
            console.log(`[${timestamp}] 💰 ${token.symbol}: ${token.balance} × $${price} = $${balanceUSD.toFixed(2)}`);
            
            return {
              ...token,
              priceUSD: price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h,
            };
          })
        );

        // Only show tokens with balance > 0
        tokensWithValue = tokensWithPrices.filter(
          t => parseFloat(t.balance || '0') > 0
        );
      }

      // ✅ STEP 5: Update tokens and calculate total portfolio value
      console.log(`\n--- STEP 5: Calculate Total Portfolio Value ---`);
      
      if (tokensWithValue.length > 0) {
        updateTokens(tokensWithValue);
        
        // Calculate total portfolio value (native + tokens)
        const tokensTotalUSD = tokensWithValue.reduce(
          (sum, token) => sum + parseFloat(token.balanceUSD || '0'),
          0
        );
        const totalValue = nativeValueUSD + tokensTotalUSD;
        setTotalValueUSD(totalValue);
        
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
        updateTokens([]); // Clear tokens
        setTotalValueUSD(nativeValueUSD);
        
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
      setChange24h(nativeChange);
      console.log(`[${timestamp}] 📈 24h Change: ${nativeChange >= 0 ? '+' : ''}${nativeChange.toFixed(2)}%`);
      
      // Update chart data from history based on selected time range
      updateChartData();
      
      console.log(`========== FETCH DATA COMPLETE [${Date.now() - timestamp}ms] ==========\n`);
    
      
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // ALWAYS stop refresh spinner, even if there's an error
      setIsRefreshing(false);
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
        setChange24h(rangeChange);
      }
    }
  };

  useEffect(() => {
    fetchData(true); // Force refresh on mount
    const interval = setInterval(() => fetchData(true), 10000); // ✅ Update every 10 seconds (ultra-fresh)
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
                  {lastPriceUpdate && (
                    <div className="text-xs text-gray-400 mt-1">
                      Updated {Math.floor((Date.now() - lastPriceUpdate.getTime()) / 1000)}s ago
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
                ${(parseFloat(balance) * nativePriceUSD).toFixed(2)}
              </div>
              <div className={`text-sm ${isPositiveChange ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}%
              </div>
            </div>
          </motion.div>

          {/* ERC-20 Tokens */}
          <AnimatePresence>
            {tokens.map((token, index) => (
              <motion.div
                key={token.address}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
                className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl overflow-hidden">
                    {(() => {
                      const logoUrl = token.logo;
                      if (logoUrl && (
                        logoUrl.startsWith('http') ||
                        logoUrl.startsWith('ipfs') ||
                        logoUrl.startsWith('data:')
                      )) {
                        return (
                          <img 
                            src={logoUrl} 
                            alt={token.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to symbol if image fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.textContent = token.symbol[0];
                            }}
                          />
                        );
                      }
                      return logoUrl || token.symbol[0];
                    })()}
                  </div>
                  <div>
                    <div className="font-semibold">{token.name}</div>
                    <div className="text-sm text-slate-400">
                      {parseFloat(token.balance || '0').toFixed(4)} {token.symbol}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${token.balanceUSD}</div>
                  <div className={`text-sm ${(token.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(token.change24h || 0) >= 0 ? '+' : ''}{(token.change24h || 0).toFixed(2)}%
                  </div>
                </div>
              </motion.div>
            ))}
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
                  <div className="text-xs text-slate-400">Natuurlijke taal transacties</div>
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
                    // Reload page to show unlock screen
                    window.location.reload();
                  }}
                  className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-red-50 text-red-600"
                  title="Wallet vergrendelen"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
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
      <SendModal isOpen={showSendModal} onClose={() => setShowSendModal(false)} />
      <ReceiveModal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} />
      <SwapModal isOpen={showSwapModal} onClose={() => setShowSwapModal(false)} />
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
      <QuickPayModal isOpen={showQuickPay} onClose={() => setShowQuickPay(false)} />
      
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
              // Handle action execution
              if (action.type === 'send') {
                setShowSendModal(true);
              } else if (action.type === 'swap') {
                setShowSwapModal(true);
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




