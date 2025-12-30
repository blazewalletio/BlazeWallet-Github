'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowUpRight, ArrowDownLeft, RefreshCw, ChevronRight,
  TrendingUp, Eye, EyeOff, Repeat, CreditCard, Plus,
  TrendingDown
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useCurrency } from '@/contexts/CurrencyContext';
import { MultiChainService } from '@/lib/multi-chain-service';
import { BlockchainService } from '@/lib/blockchain';
import { PriceService } from '@/lib/price-service';
import { CHAINS, POPULAR_TOKENS } from '@/lib/chains';
import SendModal from '../SendModal';
import ReceiveModal from '../ReceiveModal';
import SwapModal from '../SwapModal';
import BuyModal from '../BuyModal';
import BuyModal2 from '../BuyModal2';
import BuyModal3 from '../BuyModal3';
import TokenSelector from '../TokenSelector';
import AnimatedNumber from '../AnimatedNumber';
import { logger } from '@/lib/logger';
import { calculateWeightedPortfolioChange } from '@/lib/portfolio-change-calculator';
import { getCurrencyLogo } from '@/lib/currency-logo-service';

export default function WalletTab() {
  const { 
    address, 
    solanaAddress,
    balance, 
    updateBalance, 
    currentChain, 
    tokens,
    updateTokens,
    updateActivity,
    getCurrentAddress,
  } = useWalletStore();
  
  const { formatUSDSync, symbol } = useCurrency();

  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBuyModal2, setShowBuyModal2] = useState(false);
  const [showBuyModal3, setShowBuyModal3] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [totalValueUSD, setTotalValueUSD] = useState(0);
  const [change24h, setChange24h] = useState(2.5);

  const chain = CHAINS[currentChain];
  const blockchain = MultiChainService.getInstance(currentChain);
  const priceService = new PriceService();

  const fetchData = async (force = false) => {
    // ✅ Get correct address for current chain (Solana uses solanaAddress, EVM uses address)
    const displayAddress = getCurrentAddress ? getCurrentAddress() : (currentChain === 'solana' ? solanaAddress : address);
    
    if (!displayAddress) {
      console.log('⚠️ [WalletTab] No address available for chain:', currentChain);
      return;
    }
    
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      const timestamp = Date.now();
      logger.log(`[${timestamp}] Fetching balance for ${displayAddress} on ${currentChain}`);
      
      const bal = await blockchain.getBalance(displayAddress);
      logger.log(`[${timestamp}] Balance received: ${bal} ${chain.nativeCurrency.symbol}`);
      updateBalance(bal);

      // ✅ Batch fetch native token price + change24h (ONE API call instead of 2!)
      const nativeSymbol = chain.nativeCurrency.symbol;
      const nativePrices = await priceService.getMultiplePrices([nativeSymbol]);
      const nativePriceData = nativePrices[nativeSymbol] || { price: 0, change24h: 0 };
      const nativePrice = nativePriceData.price || 0;
      const nativeChange = nativePriceData.change24h || 0;
      const nativeValueUSD = parseFloat(bal) * nativePrice;
      
      logger.log(`[${timestamp}] Native balance details:`, {
        balance: bal,
        symbol: chain.nativeCurrency.symbol,
        priceUSD: nativePrice,
        valueUSD: nativeValueUSD
      });

      let tokensWithValue: any[] = [];
      
      // ✅ SOLANA: Fetch SPL tokens (like Dashboard does)
      if (currentChain === 'solana' && displayAddress) {
        console.log('🪙 [WalletTab] Fetching SPL tokens for Solana...');
        console.log('📍 [WalletTab] Solana Address:', displayAddress);
        
        try {
          const solanaService = blockchain as any; // Access Solana-specific methods
          const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
          
          console.log(`✅ [WalletTab] Found ${splTokens.length} SPL tokens`);
          console.log('📊 [WalletTab] SPL Tokens:', splTokens.map((t: any) => ({
            symbol: t.symbol,
            name: t.name,
            address: t.address,
            balance: t.balance,
            logo: t.logo || 'MISSING'
          })));
          
          if (splTokens.length > 0) {
            // ✅ Fetch prices for SPL tokens
            const splSymbols = splTokens.map((t: any) => t.symbol);
            console.log('💰 [WalletTab] Fetching prices for SPL tokens:', splSymbols);
            
            const splPricesMap = await priceService.getMultiplePrices(splSymbols);
            console.log('💰 [WalletTab] SPL prices received:', splPricesMap);
            
            // ✅ For tokens without a symbol price, try mint-based pricing (DexScreener)
            const tokensNeedingMintPrice = splTokens.filter((t: any) => !splPricesMap[t.symbol] || splPricesMap[t.symbol]?.price === 0);
            
            if (tokensNeedingMintPrice.length > 0) {
              console.log(`🔍 [WalletTab] Fetching DexScreener prices for ${tokensNeedingMintPrice.length} tokens...`);
              const mints = tokensNeedingMintPrice.map((t: any) => t.address);
              const mintPrices = await priceService.getPricesByMints(mints);
              
              // ✅ Merge mint prices into splPricesMap
              tokensNeedingMintPrice.forEach((token: any) => {
                const mintPrice = mintPrices.get(token.address);
                if (mintPrice && mintPrice.price > 0) {
                  splPricesMap[token.symbol] = { price: mintPrice.price, change24h: mintPrice.change24h };
                  console.log(`✅ [WalletTab] DexScreener: ${token.symbol} = $${mintPrice.price}`);
                }
              });
            }
            
            // ✅ Combine SPL tokens with prices
            tokensWithValue = splTokens.map((token: any) => {
              const priceData = splPricesMap[token.symbol] || { price: 0, change24h: 0 };
              const balanceNum = parseFloat(token.balance || '0');
              const balanceUSD = balanceNum * priceData.price;
              
              console.log(`💰 [WalletTab] Token ${token.symbol}:`, {
                balance: token.balance,
                price: priceData.price,
                balanceUSD: balanceUSD,
                logo: token.logo || 'MISSING'
              });
              
              return {
                ...token,
                logo: token.logo || '/crypto-placeholder.png',
                priceUSD: priceData.price,
                balanceUSD: balanceUSD.toFixed(2),
                change24h: priceData.change24h,
              };
            });
            
            console.log(`✅ [WalletTab] Final Solana tokensWithValue: ${tokensWithValue.length} tokens`);
          }
        } catch (error) {
          console.error('❌ [WalletTab] Solana token fetch failed:', error);
          logger.warn(`[WalletTab] ⚠️ Solana token fetch failed:`, error);
        }
      }
      // ✅ EVM: Fetch ALL ERC20 tokens via Alchemy (like Dashboard does)
      // Only fetch for EVM chains (not Solana, not Bitcoin chains)
      else if (currentChain !== 'solana' && currentChain !== 'bitcoin' && currentChain !== 'bitcoincash' && currentChain !== 'litecoin' && currentChain !== 'doge' && displayAddress) {
        let erc20Tokens: any[] = [];
        
        try {
          console.log('🔮 [WalletTab] Attempting to fetch ALL ERC20 tokens via Alchemy...');
          console.log('📍 [WalletTab] Address:', displayAddress);
          logger.log(`[WalletTab] 🔮 Attempting to fetch ALL ERC20 tokens via Alchemy...`);
          erc20Tokens = await blockchain.getERC20TokenBalances(displayAddress);
          
          if (erc20Tokens.length > 0) {
            console.log(`✅ [WalletTab] Alchemy found ${erc20Tokens.length} ERC20 tokens with balance`);
            console.log('📊 [WalletTab] Tokens from Alchemy:', erc20Tokens.map(t => ({
              symbol: t.symbol,
              name: t.name,
              address: t.address,
              balance: t.balance,
              logo: t.logo || 'MISSING'
            })));
            logger.log(`[WalletTab] ✅ Alchemy found ${erc20Tokens.length} ERC20 tokens with balance`);
          } else {
            console.log(`ℹ️ [WalletTab] No tokens found via Alchemy, falling back to POPULAR_TOKENS`);
            logger.log(`[WalletTab] ℹ️ No tokens found via Alchemy, falling back to POPULAR_TOKENS`);
          }
        } catch (error) {
          console.error('⚠️ [WalletTab] Alchemy failed:', error);
          logger.warn(`[WalletTab] ⚠️ Alchemy failed, falling back to POPULAR_TOKENS:`, error);
        }
        
        // Fallback to POPULAR_TOKENS if Alchemy returned nothing
        if (erc20Tokens.length === 0) {
          const popularTokens = POPULAR_TOKENS[currentChain] || [];
          if (popularTokens.length > 0) {
            // Use MultiChainService fallback method if available
            logger.log(`[WalletTab] 🪙 Fetching balances for ${popularTokens.length} popular ERC20 tokens...`);
            // Note: MultiChainService doesn't have getMultipleTokenBalances, so we'll keep Alchemy result
          }
        }
        
        if (erc20Tokens.length > 0) {
          // ✅ Batch fetch prices by contract address (more accurate than symbol)
          const tokenAddresses = erc20Tokens.map(t => t.address);
          console.log('💰 [WalletTab] Fetching prices for addresses:', tokenAddresses);
          console.log('💰 [WalletTab] Chain:', currentChain);
          const pricesByAddress = await priceService.getPricesByAddresses(tokenAddresses, currentChain);
          
          console.log(`💰 [WalletTab] Received prices for ${pricesByAddress.size}/${tokenAddresses.length} tokens`);
          console.log('💰 [WalletTab] Prices map:', Array.from(pricesByAddress.entries()).map(([addr, data]) => ({
            address: addr,
            price: data.price,
            change24h: data.change24h
          })));
          logger.log(`[WalletTab] 💰 Received prices for ${pricesByAddress.size}/${tokenAddresses.length} tokens`);
          
          // ✅ Fetch missing logos from CoinGecko for tokens without logos
          const tokensNeedingLogos = erc20Tokens.filter((token: any) => 
            !token.logo || 
            token.logo === '/crypto-placeholder.png' || 
            token.logo === '/crypto-eth.png' ||
            token.logo.trim() === ''
          );
          
          console.log(`🖼️ [WalletTab] Tokens needing logos: ${tokensNeedingLogos.length}`);
          console.log('🖼️ [WalletTab] Tokens needing logos:', tokensNeedingLogos.map(t => ({
            symbol: t.symbol,
            address: t.address,
            currentLogo: t.logo || 'MISSING'
          })));
          
          if (tokensNeedingLogos.length > 0) {
            console.log(`🖼️ [WalletTab] Fetching logos from CoinGecko for ${tokensNeedingLogos.length} tokens...`);
            logger.log(`[WalletTab] 🖼️ Fetching logos from CoinGecko for ${tokensNeedingLogos.length} tokens...`);
            
            // Fetch logos in parallel
            await Promise.all(
              tokensNeedingLogos.map(async (token: any) => {
                try {
                  console.log(`🖼️ [WalletTab] Fetching logo for ${token.symbol} (${token.address})...`);
                  const logo = await getCurrencyLogo(token.symbol, token.address);
                  console.log(`🖼️ [WalletTab] Logo result for ${token.symbol}:`, logo);
                  if (logo && logo !== '/crypto-eth.png' && logo !== '/crypto-placeholder.png') {
                    token.logo = logo;
                    console.log(`✅ [WalletTab] Set logo for ${token.symbol}: ${logo}`);
                    logger.log(`[WalletTab] ✅ Fetched logo for ${token.symbol}: ${logo}`);
                  } else {
                    console.log(`⚠️ [WalletTab] Invalid logo for ${token.symbol}: ${logo}`);
                  }
                } catch (error) {
                  console.error(`❌ [WalletTab] Failed to fetch logo for ${token.symbol}:`, error);
                  logger.warn(`[WalletTab] ⚠️ Failed to fetch logo for ${token.symbol}:`, error);
                }
              })
            );
          }
          
          const tokensWithPrices = erc20Tokens.map((token: any) => {
            const addressLower = token.address.toLowerCase();
            const priceData = pricesByAddress.get(addressLower) || { price: 0, change24h: 0 };
            const balanceNum = parseFloat(token.balance || '0');
            const balanceUSD = balanceNum * priceData.price;
            
            console.log(`💰 [WalletTab] Token ${token.symbol}:`, {
              address: addressLower,
              balance: token.balance,
              price: priceData.price,
              balanceUSD: balanceUSD,
              logo: token.logo || 'MISSING',
              change24h: priceData.change24h
            });
            
            return {
              ...token,
              logo: token.logo || '/crypto-placeholder.png',
              priceUSD: priceData.price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h: priceData.change24h,
            };
          });

          tokensWithValue = tokensWithPrices.filter(
            t => parseFloat(t.balance || '0') > 0
          );
          
          console.log(`✅ [WalletTab] Final tokensWithValue: ${tokensWithValue.length} tokens`);
          console.log('📊 [WalletTab] Final tokens:', tokensWithValue.map(t => ({
            symbol: t.symbol,
            name: t.name,
            balance: t.balance,
            balanceUSD: t.balanceUSD,
            priceUSD: t.priceUSD,
            logo: t.logo,
            address: t.address
          })));
          logger.log(`[WalletTab] ✅ Final tokensWithValue: ${tokensWithValue.length} tokens`);
        }
        
        // ✅ Use chain-specific updateTokens
        updateTokens(currentChain, tokensWithValue);

        const tokensTotalUSD = tokensWithValue.reduce(
          (sum, token) => sum + parseFloat(token.balanceUSD || '0'),
          0
        );
        const totalValue = nativeValueUSD + tokensTotalUSD;
        setTotalValueUSD(totalValue);
        
      } else {
        setTotalValueUSD(nativeValueUSD);
      }

      // ✅ Calculate weighted portfolio change (native + all tokens)
      if (tokensWithValue.length > 0) {
        const weightedChange = calculateWeightedPortfolioChange(
          tokensWithValue,
          parseFloat(bal),
          nativePrice,
          nativeChange
        );
        setChange24h(weightedChange);
      } else {
        // No tokens, only native - use native change
        setChange24h(nativeChange);
      }
      
      
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };


  useEffect(() => {
    fetchData(true);
  }, [address, solanaAddress, currentChain]);

  const formattedAddress = address ? BlockchainService.formatAddress(address) : '';
  const isPositiveChange = change24h >= 0;

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <motion.div className="flex items-center gap-2 glass-card px-3 sm:px-4 py-2 rounded-xl min-w-0">
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
              </motion.div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="glass-card p-2.5 sm:p-3 rounded-xl hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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
                    {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}% today
                  </span>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-6 gap-3">
          <motion.button
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
          </motion.button>

          <motion.button
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
          </motion.button>

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

        {/* Assets */}
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
                  {formatUSDSync(parseFloat(balance) * (totalValueUSD > 0 ? totalValueUSD / (parseFloat(balance) + tokens.reduce((sum, t) => sum + parseFloat(t.balance || '0'), 0)) : 0))}
                </div>
                <div className={`text-sm ${isPositiveChange ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}%
                </div>
              </div>
            </motion.div>

            {/* ERC-20 Tokens */}
            {tokens.map((token, index) => (
              <motion.div
                key={token.address}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
                className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-xl overflow-hidden">
                    {(() => {
                      const logoUrl = token.logo;
                      
                      console.log(`🖼️ [WalletTab Render] Token ${token.symbol} logo:`, logoUrl);
                      
                      // Check if logo is valid URL
                      if (logoUrl && 
                          (logoUrl.startsWith('http') || 
                           logoUrl.startsWith('/') || 
                           logoUrl.startsWith('data:')) &&
                          logoUrl !== '/crypto-placeholder.png' &&
                          logoUrl !== '/crypto-eth.png') {
                        console.log(`✅ [WalletTab Render] Rendering <img> for ${token.symbol} with logo:`, logoUrl);
                        return (
                          <img 
                            src={logoUrl} 
                            alt={token.symbol}
                            className="w-full h-full object-cover"
                            onLoad={() => {
                              console.log(`✅ [WalletTab Render] Logo loaded successfully for ${token.symbol}:`, logoUrl);
                            }}
                            onError={(e) => {
                              console.error(`❌ [WalletTab Render] Failed to load logo for ${token.symbol}:`, logoUrl);
                              // Fallback to symbol initial if image fails
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.textContent = token.symbol[0];
                                parent.className = 'w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-xl';
                              }
                            }}
                          />
                        );
                      }
                      
                      console.log(`⚠️ [WalletTab Render] Using fallback initial for ${token.symbol} (logo: ${logoUrl})`);
                      // Fallback to symbol initial
                      return <span className="text-white font-bold">{token.symbol[0]}</span>;
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
                  <div className="font-semibold">
                    {(() => {
                      const balanceUSD = parseFloat(token.balanceUSD || '0');
                      // Show more precision for very small values
                      if (balanceUSD > 0 && balanceUSD < 0.01) {
                        return `$${balanceUSD.toFixed(6)}`;
                      }
                      return formatUSDSync(balanceUSD);
                    })()}
                  </div>
                  <div className={`text-sm ${(token.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(token.change24h || 0) >= 0 ? '+' : ''}{(token.change24h || 0).toFixed(2)}%
                  </div>
                </div>
              </motion.div>
            ))}

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

      {/* Modals */}
      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
      <BuyModal2 isOpen={showBuyModal2} onClose={() => setShowBuyModal2(false)} />
      <BuyModal3 isOpen={showBuyModal3} onClose={() => setShowBuyModal3(false)} />
      <SendModal isOpen={showSendModal} onClose={() => setShowSendModal(false)} />
      <ReceiveModal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} />
      <SwapModal isOpen={showSwapModal} onClose={() => setShowSwapModal(false)} />
      <TokenSelector isOpen={showTokenSelector} onClose={() => setShowTokenSelector(false)} />
    </>
  );
}
