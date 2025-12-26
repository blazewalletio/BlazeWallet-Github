'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  ArrowDownLeft, 
  Repeat, 
  Copy, 
  ExternalLink,
  RefreshCw,
  EyeOff,
  Star,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Token } from '@/lib/types';
import { useWalletStore } from '@/lib/wallet-store';
import { useCurrency } from '@/contexts/CurrencyContext';
import { CHAINS } from '@/lib/chains';
import { Chain } from '@/lib/types';
import { refreshTokenMetadata } from '@/lib/spl-token-metadata';
import TokenPriceChart from './TokenPriceChart';
import { logger } from '@/lib/logger';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';

interface TokenDetailModalProps {
  token: Token;
  isOpen: boolean;
  onClose: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  onSwap?: () => void;
  onRefresh?: (address: string) => Promise<void>;
  // Native token data
  nativePriceUSD?: number;
  nativeChange24h?: number;
  walletAddress?: string | null;
}

// Helper function to check if token is native
const isNativeToken = (token: Token, chain: Chain, walletAddress: string | null | undefined): boolean => {
  // Check 1: Address matches wallet address
  if (walletAddress && token.address === walletAddress) return true;
  
  // Check 2: Address is 'native'
  if (token.address === 'native') return true;
  
  // Check 3: Symbol and name match native currency
  if (token.symbol === chain.nativeCurrency.symbol && 
      token.name === chain.nativeCurrency.name) {
    return true;
  }
  
  return false;
};

// Helper function to get explorer URL
const getExplorerUrl = (
  token: Token, 
  chain: Chain, 
  walletAddress: string | null | undefined,
  isNative: boolean
): string => {
  if (isNative && walletAddress) {
    // For native tokens, show wallet address on explorer
    return `${chain.explorerUrl}/address/${walletAddress}`;
  }
  // For ERC-20/SPL tokens, show contract address
  return `${chain.explorerUrl}/address/${token.address}`;
};

export default function TokenDetailModal({
  token,
  isOpen,
  onClose,
  onSend,
  onReceive,
  onSwap,
  onRefresh,
  nativePriceUSD,
  nativeChange24h,
  walletAddress,
}: TokenDetailModalProps) {
  const { currentChain, getCurrentAddress } = useWalletStore();
  const { formatUSDSync, symbol } = useCurrency();
  const chain = CHAINS[currentChain];
  const displayAddress = walletAddress || getCurrentAddress();
  
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Check if token is native
  const isNative = useMemo(() => 
    isNativeToken(token, chain, displayAddress), 
    [token, chain, displayAddress]
  );
  
  const isUnknownToken = token.name === 'Unknown Token';
  const isPositiveChange = (token.change24h || 0) >= 0;
  const explorerUrl = useMemo(() => 
    getExplorerUrl(token, chain, displayAddress, isNative), 
    [token, chain, displayAddress, isNative]
  );
  
  // Block body scroll when modal is open
  useBlockBodyScroll(isOpen);
  
  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  
  // Handle refresh (skip for native tokens)
  const handleRefresh = useCallback(async () => {
    if (isNative || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh(token.address);
    } finally {
      setIsRefreshing(false);
    }
  }, [isNative, onRefresh, token.address]);
  
  // Swipe gesture handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  }, []);
  
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
    
    // Prevent scroll if swiping down
    const diffY = touch.clientY - touchStart.y;
    if (diffY > 10) {
      e.preventDefault();
    }
  }, [touchStart]);
  
  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 100;
    const isDownSwipe = distanceY < -minSwipeDistance;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);
    
    if (isDownSwipe && isVerticalSwipe) {
      onClose();
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, onClose]);
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onSend?.();
            onClose();
          }
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onReceive?.();
            onClose();
          }
          break;
        case 'w':
        case 'W':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onSwap?.();
            onClose();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSend, onReceive, onSwap]);
  
  // Address to display (wallet address for native, contract address for tokens)
  const addressToDisplay = isNative && displayAddress ? displayAddress : token.address;
  const addressLabel = isNative ? 'Address' : 'Contract';
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - Full screen with darker blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />
          
          {/* Full Screen Overlay */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ 
              type: "spring",
              damping: 25,
              stiffness: 300
            }}
            className="fixed inset-0 z-50 overflow-y-auto"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Content Container - Full screen on mobile, centered on desktop */}
            <div className="min-h-screen md:flex md:items-center md:justify-center md:p-4">
              <div className="bg-white/95 backdrop-blur-xl w-full md:max-w-4xl md:rounded-2xl md:shadow-2xl md:border md:border-white/20">
                {/* Header - Fixed with gradient background */}
                <div className="sticky top-0 z-20 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 backdrop-blur-xl border-b border-white/20 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Token Logo */}
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {token.logo && (token.logo.startsWith('http') || token.logo.startsWith('/')) ? (
                          <img 
                            src={token.logo} 
                            alt={token.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.textContent = token.symbol[0];
                                parent.className += ' text-2xl font-bold text-orange-600';
                              }
                            }}
                          />
                        ) : (
                          <span className="text-2xl font-bold text-orange-600">
                            {token.symbol[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900">{token.name}</h2>
                        <p className="text-sm text-gray-600">{token.symbol}</p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="p-2 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-700" />
                    </motion.button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-6 md:p-8 space-y-6 md:space-y-8">
                  {/* Hero Section - Balance & Price */}
                  <div className="text-center py-4 md:py-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 mb-6 overflow-hidden border-4 border-white shadow-lg">
                      {token.logo && (token.logo.startsWith('http') || token.logo.startsWith('/')) ? (
                        <img 
                          src={token.logo} 
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.textContent = token.symbol[0];
                              parent.className += ' text-4xl md:text-5xl font-bold text-orange-600';
                            }
                          }}
                        />
                      ) : (
                        <span className="text-4xl md:text-5xl font-bold text-orange-600">
                          {token.symbol[0]}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
                      {token.name}
                      {isUnknownToken && (
                        <span className="text-xs text-orange-500 bg-orange-100 px-2 py-1 rounded-full">
                          Unknown
                        </span>
                      )}
                    </h3>
                    
                    <p className="text-sm md:text-base text-gray-500 mb-4">{token.symbol}</p>
                    
                    <div className="space-y-2">
                      <div className="text-2xl md:text-3xl font-bold text-gray-900">
                        {parseFloat(token.balance || '0').toFixed(6)} {token.symbol}
                      </div>
                      <div className="text-xl md:text-2xl text-gray-600">
                        ≈ {formatUSDSync(parseFloat(token.balanceUSD || '0'))}
                      </div>
                      {token.change24h !== undefined && (
                        <div className={`flex items-center justify-center gap-1 text-sm md:text-base font-medium ${
                          isPositiveChange ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {isPositiveChange ? (
                            <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                          ) : (
                            <TrendingDown className="w-4 h-4 md:w-5 md:h-5" />
                          )}
                          <span>
                            {isPositiveChange ? '+' : ''}{token.change24h.toFixed(2)}% (24h)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Price Chart - Bitvavo Style */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 md:p-6 border border-gray-200 shadow-lg">
                    <TokenPriceChart
                      tokenSymbol={token.symbol}
                      tokenAddress={isNative ? undefined : token.address}
                      chain={chain.name.toLowerCase()}
                      currentPrice={typeof token.priceUSD === 'string' ? parseFloat(token.priceUSD) : (token.priceUSD || 0)}
                      isPositiveChange={isPositiveChange}
                    />
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        onClose();
                        onSend?.();
                      }}
                      className="flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white hover:brightness-110 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Send className="w-6 h-6 md:w-7 md:h-7" />
                      <span className="text-sm md:text-base font-semibold">Send</span>
                    </motion.button>
                    
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        onClose();
                        onReceive?.();
                      }}
                      className="flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:brightness-110 transition-all shadow-lg hover:shadow-xl"
                    >
                      <ArrowDownLeft className="w-6 h-6 md:w-7 md:h-7" />
                      <span className="text-sm md:text-base font-semibold">Receive</span>
                    </motion.button>
                    
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        onClose();
                        onSwap?.();
                      }}
                      className="flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:brightness-110 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Repeat className="w-6 h-6 md:w-7 md:h-7" />
                      <span className="text-sm md:text-base font-semibold">Swap</span>
                    </motion.button>
                  </div>
                  
                  {/* Token Details */}
                  <div className="bg-gray-50 rounded-xl p-4 md:p-6 space-y-3 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 text-sm md:text-base mb-3">Token details</h4>
                    
                    <div className="space-y-2">
                      {/* Address/Contract - Conditional based on native token */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{addressLabel}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-900 text-xs">
                            {addressToDisplay ? `${addressToDisplay.slice(0, 6)}...${addressToDisplay.slice(-4)}` : 'N/A'}
                          </span>
                          {addressToDisplay && (
                            <>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => copyToClipboard(addressToDisplay)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="Copy address"
                              >
                                {copied ? (
                                  <span className="text-green-600 text-xs">✓</span>
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-gray-600" />
                                )}
                              </motion.button>
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="View on explorer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {token.decimals !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Decimals</span>
                          <span className="font-medium text-gray-900">{token.decimals}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Standard</span>
                        <span className="font-medium text-gray-900">
                          {isNative 
                            ? 'Native' 
                            : currentChain === 'solana' 
                              ? 'SPL Token' 
                              : 'ERC-20'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Chain</span>
                        <span className="font-medium text-gray-900">{chain.name}</span>
                      </div>
                      
                      {token.priceUSD !== undefined && token.priceUSD > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Price</span>
                          <span className="font-medium text-gray-900">
                            {symbol}{typeof token.priceUSD === 'string' 
                              ? parseFloat(token.priceUSD).toFixed(parseFloat(token.priceUSD) < 0.01 ? 6 : 2)
                              : token.priceUSD.toFixed(token.priceUSD < 0.01 ? 6 : 2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Advanced Section */}
                  <div className="border-t border-gray-200 pt-4">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center justify-between w-full text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                    >
                      <span>Advanced options</span>
                      {showAdvanced ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 mt-3">
                            {isUnknownToken && !isNative && (
                              <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                              >
                                <RefreshCw className={`w-5 h-5 text-orange-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">Refresh metadata</div>
                                  <div className="text-xs text-gray-500">Fetch latest info from Jupiter</div>
                                </div>
                              </motion.button>
                            )}
                            
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <Star className="w-5 h-5 text-gray-600" />
                              <div>
                                <div className="font-medium text-gray-900 text-sm">Add to favorites</div>
                                <div className="text-xs text-gray-500">Quick access from dashboard</div>
                              </div>
                            </motion.button>
                            
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <EyeOff className="w-5 h-5 text-gray-600" />
                              <div>
                                <div className="font-medium text-gray-900 text-sm">Hide token</div>
                                <div className="text-xs text-gray-500">Remove from assets list</div>
                              </div>
                            </motion.button>
                            
                            <a
                              href={`https://www.coingecko.com/en/search?query=${token.symbol}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <ExternalLink className="w-5 h-5 text-gray-600" />
                              <div>
                                <div className="font-medium text-gray-900 text-sm">View on CoinGecko</div>
                                <div className="text-xs text-gray-500">Market data and charts</div>
                              </div>
                            </a>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Swipe indicator for mobile */}
                  <div className="md:hidden text-center pt-4 pb-8">
                    <div className="text-xs text-gray-400">Swipe down to close</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
