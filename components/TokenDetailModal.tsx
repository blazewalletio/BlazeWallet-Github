'use client';

import { useState, useEffect } from 'react';
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
  Clock,
  BarChart3
} from 'lucide-react';
import { Token } from '@/lib/types';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { refreshTokenMetadata } from '@/lib/spl-token-metadata';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { getTokenPriceHistory, calculatePriceChange, getPriceRange } from '@/lib/token-price-history';
import { logger } from '@/lib/logger';

interface TokenDetailModalProps {
  token: Token;
  isOpen: boolean;
  onClose: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  onSwap?: () => void;
  onRefresh?: (address: string) => Promise<void>;
}

export default function TokenDetailModal({
  token,
  isOpen,
  onClose,
  onSend,
  onReceive,
  onSwap,
  onRefresh,
}: TokenDetailModalProps) {
  const { currentChain, getCurrentAddress } = useWalletStore();
  const chain = CHAINS[currentChain];
  const displayAddress = getCurrentAddress();
  
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [priceHistory, setPriceHistory] = useState<Array<{ timestamp: number; price: number }>>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  
  const isUnknownToken = token.name === 'Unknown Token';
  const isPositiveChange = (token.change24h || 0) >= 0;
  
  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Handle refresh
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh(token.address);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Load price history when modal opens
  useEffect(() => {
    if (!isOpen || !token.symbol) return;
    
    const loadPriceHistory = async () => {
      setIsLoadingChart(true);
      try {
        const days = chartTimeframe === '24h' ? 1 : chartTimeframe === '7d' ? 7 : 30;
        const result = await getTokenPriceHistory(
          token.symbol, 
          days,
          token.address, // Pass contract address for better lookup
          chain.name.toLowerCase() // Pass chain name
        );
        
        if (result.success) {
          logger.log(`✅ Price history loaded from ${result.source}`);
          setPriceHistory(result.prices);
        } else {
          logger.warn(`⚠️ No price history available for ${token.symbol}: ${result.error}`);
          setPriceHistory([]);
        }
      } catch (error) {
        logger.error('❌ Failed to load price history:', error);
        setPriceHistory([]);
      } finally {
        setIsLoadingChart(false);
      }
    };
    
    loadPriceHistory();
  }, [isOpen, token.symbol, token.address, chain.name, chartTimeframe]);
  
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 300 
            }}
            className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 p-0 md:p-4"
          >
            <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto shadow-2xl">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Token details</h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </motion.button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Token Overview */}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 mb-4 overflow-hidden">
                    {token.logo && (token.logo.startsWith('http') || token.logo.startsWith('/')) ? (
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
                      <span className="text-4xl font-bold text-orange-600">
                        {token.symbol[0]}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
                    {token.name}
                    {isUnknownToken && (
                      <span className="text-xs text-orange-500 bg-orange-100 px-2 py-1 rounded-full">
                        Unknown
                      </span>
                    )}
                  </h3>
                  
                  <p className="text-sm text-gray-500 mb-4">{token.symbol}</p>
                  
                  <div className="inline-flex flex-col items-center gap-2">
                    <div className="text-3xl font-bold text-gray-900">
                      {parseFloat(token.balance || '0').toFixed(6)}
                    </div>
                    <div className="text-xl text-gray-600">
                      ≈ ${token.balanceUSD || '0.00'}
                    </div>
                    {token.change24h !== undefined && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${
                        isPositiveChange ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositiveChange ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span>
                          {isPositiveChange ? '+' : ''}{token.change24h.toFixed(2)}% (24h)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Price Chart */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-gray-700" />
                      <h4 className="font-semibold text-gray-900">Price chart</h4>
                    </div>
                    
                    {/* Timeframe selector */}
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                      {(['24h', '7d', '30d'] as const).map((timeframe) => (
                        <button
                          key={timeframe}
                          onClick={() => setChartTimeframe(timeframe)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                            chartTimeframe === timeframe
                              ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {timeframe}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {isLoadingChart ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                        <p className="text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : priceHistory.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={priceHistory.map(p => ({ 
                          time: new Date(p.timestamp).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            ...(chartTimeframe === '24h' ? { hour: '2-digit' } : {})
                          }), 
                          price: p.price 
                        }))}>
                          <defs>
                            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop 
                                offset="5%" 
                                stopColor={isPositiveChange ? '#10b981' : '#ef4444'} 
                                stopOpacity={0.3}
                              />
                              <stop 
                                offset="95%" 
                                stopColor={isPositiveChange ? '#10b981' : '#ef4444'} 
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="time" 
                            stroke="#9ca3af"
                            style={{ fontSize: '10px' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="#9ca3af"
                            style={{ fontSize: '10px' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value.toFixed(value < 0.01 ? 4 : 2)}`}
                            domain={['dataMin', 'dataMax']}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number) => [`$${value.toFixed(value < 0.01 ? 6 : 2)}`, 'Price']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="price" 
                            stroke={isPositiveChange ? '#10b981' : '#ef4444'}
                            strokeWidth={2}
                            fill="url(#priceGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Chart not available</p>
                        <p className="text-xs text-gray-400 mt-1">Price history unavailable for this token</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Price stats */}
                  {priceHistory.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-200">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Low</div>
                        <div className="text-sm font-semibold text-gray-900">
                          ${getPriceRange(priceHistory).min.toFixed(getPriceRange(priceHistory).min < 0.01 ? 6 : 2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">High</div>
                        <div className="text-sm font-semibold text-gray-900">
                          ${getPriceRange(priceHistory).max.toFixed(getPriceRange(priceHistory).max < 0.01 ? 6 : 2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Change</div>
                        <div className={`text-sm font-semibold ${
                          calculatePriceChange(priceHistory) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {calculatePriceChange(priceHistory) >= 0 ? '+' : ''}
                          {calculatePriceChange(priceHistory).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onSend?.();
                      onClose();
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white hover:brightness-110 transition-all shadow-lg"
                  >
                    <Send className="w-6 h-6" />
                    <span className="text-sm font-semibold">Send</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onReceive?.();
                      onClose();
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:brightness-110 transition-all shadow-lg"
                  >
                    <ArrowDownLeft className="w-6 h-6" />
                    <span className="text-sm font-semibold">Receive</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onSwap?.();
                      onClose();
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:brightness-110 transition-all shadow-lg"
                  >
                    <Repeat className="w-6 h-6" />
                    <span className="text-sm font-semibold">Swap</span>
                  </motion.button>
                </div>
                
                {/* Token Details */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900 text-sm mb-3">Token details</h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Contract</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-900 text-xs">
                          {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => copyToClipboard(token.address)}
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
                          href={`${chain.explorerUrl}/address/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                        </a>
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
                        {currentChain === 'solana' ? 'SPL Token' : 'ERC-20'}
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
                          ${token.priceUSD.toFixed(token.priceUSD < 0.01 ? 6 : 2)}
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
                          {isUnknownToken && (
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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

