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
import { BlockchainService } from '@/lib/blockchain';
import { TokenService } from '@/lib/token-service';
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

export default function WalletTab() {
  const { 
    address, 
    balance, 
    updateBalance, 
    currentChain, 
    tokens,
    updateTokens,
    updateActivity,
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
  const blockchain = new BlockchainService(currentChain as any);
  const tokenService = new TokenService(chain.rpcUrl);
  const priceService = new PriceService();

  const fetchData = async (force = false) => {
    if (!address) return;
    
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      const timestamp = Date.now();
      logger.log(`[${timestamp}] Fetching balance for ${address} on ${currentChain}`);
      
      const bal = await blockchain.getBalance(address);
      logger.log(`[${timestamp}] Balance received: ${bal} ${chain.nativeCurrency.symbol}`);
      updateBalance(bal);

      const nativePrice = await priceService.getPrice(chain.nativeCurrency.symbol);
      const nativeValueUSD = parseFloat(bal) * nativePrice;
      
      logger.log(`[${timestamp}] Native balance details:`, {
        balance: bal,
        symbol: chain.nativeCurrency.symbol,
        priceUSD: nativePrice,
        valueUSD: nativeValueUSD
      });

      const popularTokens = POPULAR_TOKENS[currentChain] || [];
      if (popularTokens.length > 0) {
        const tokensWithBalance = await tokenService.getMultipleTokenBalances(
          popularTokens,
          address
        );
        
        const tokensWithPrices = await Promise.all(
          tokensWithBalance.map(async (token) => {
            const price = await priceService.getPrice(token.symbol);
            const balanceUSD = parseFloat(token.balance || '0') * price;
            return {
              ...token,
              priceUSD: price,
              balanceUSD: balanceUSD.toFixed(2),
              change24h: await priceService.get24hChange(token.symbol),
            };
          })
        );

        const tokensWithValue = tokensWithPrices.filter(
          t => parseFloat(t.balance || '0') > 0
        );
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

      const nativeChange = await priceService.get24hChange(chain.nativeCurrency.symbol);
      setChange24h(nativeChange);
      
      
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };


  useEffect(() => {
    fetchData(true);
  }, [address, currentChain]);

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
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-xl">
                    {token.logo || token.symbol[0]}
                  </div>
                  <div>
                    <div className="font-semibold">{token.name}</div>
                    <div className="text-sm text-slate-400">
                      {parseFloat(token.balance || '0').toFixed(4)} {token.symbol}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatUSDSync(parseFloat(token.balanceUSD || '0'))}</div>
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
