'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getTokenPriceHistory } from '@/lib/token-price-history';
import { priceHistoryCache } from '@/lib/price-history-cache';
import { logger } from '@/lib/logger';

interface TokenPriceChartProps {
  tokenSymbol: string;
  tokenAddress?: string;
  chain?: string;
  currentPrice: number;
  isPositiveChange: boolean;
  onPriceUpdate?: (price: number) => void;
}

type Timeframe = 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES';
type ChartType = 'line' | 'candlestick';

export default function TokenPriceChart({
  tokenSymbol,
  tokenAddress,
  chain,
  currentPrice,
  isPositiveChange,
  onPriceUpdate,
}: TokenPriceChartProps) {
  const { formatUSDSync, symbol } = useCurrency();
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1D');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [priceHistory, setPriceHistory] = useState<Array<{ timestamp: number; price: number; time: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(0);
  
  // ✅ REFS: Track intervals and prevent memory leaks
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ✅ Get days for timeframe
  const getDaysForTimeframe = useCallback((timeframe: Timeframe): number => {
    switch (timeframe) {
      case 'LIVE':
      case '1D':
        return 1;
      case '7D':
        return 7;
      case '30D':
        return 30;
      case '1J':
        return 365;
      case 'ALLES':
        return 365; // Max available
      default:
        return 1;
    }
  }, []);

  // ✅ Get refresh interval for timeframe (like Bitvavo/Coinbase)
  const getRefreshInterval = useCallback((timeframe: Timeframe): number => {
    switch (timeframe) {
      case 'LIVE':
        return 1000; // ✅ 1 seconde voor echt live data (zoals Bitvavo)
      case '1D':
        return 60000; // 1 minuut voor 1D
      case '7D':
        return 5 * 60000; // 5 minuten voor 7D
      case '30D':
        return 10 * 60000; // 10 minuten voor 30D
      case '1J':
      case 'ALLES':
        return 30 * 60000; // 30 minuten voor langere timeframes
      default:
        return 60000;
    }
  }, []);

  // ✅ LIVE data: Update only the latest price point (no full history fetch)
  const updateLivePrice = useCallback(async () => {
    if (!tokenSymbol || selectedTimeframe !== 'LIVE' || !isMountedRef.current) {
      logger.log(`[TokenPriceChart:LIVE] ⏭️ Skipping updateLivePrice`, {
        hasSymbol: !!tokenSymbol,
        timeframe: selectedTimeframe,
        isMounted: isMountedRef.current,
      });
      return;
    }
    
    logger.log(`[TokenPriceChart:LIVE] 🔄 updateLivePrice called`, {
      symbol: tokenSymbol,
      currentPrice,
      priceHistoryLength: priceHistory.length,
    });
    
    // For LIVE, we only update the current price point
    // Use the existing price history and just update the last point
    setPriceHistory(prev => {
      if (prev.length === 0 || currentPrice <= 0) return prev;
      
      const now = Date.now();
      const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      };
      
      // Update last point or add new one
      const lastPoint = prev[prev.length - 1];
      const timeSinceLastPoint = now - lastPoint.timestamp;
      
      // Only update if price changed or more than 1 second passed
      if (timeSinceLastPoint > 1000 || Math.abs(currentPrice - lastPoint.price) / lastPoint.price > 0.0001) {
        const newData = [...prev];
        
        // Keep only last 60 points for LIVE (last minute of data)
        if (newData.length >= 60) {
          newData.shift();
        }
        
        // Update or add latest point
        if (timeSinceLastPoint < 5000 && newData.length > 0) {
          // Update existing point
          newData[newData.length - 1] = {
            timestamp: now,
            price: currentPrice,
            time: formatTime(now),
          };
        } else {
          // Add new point
          newData.push({
            timestamp: now,
            price: currentPrice,
            time: formatTime(now),
          });
        }
        
        // Update min/max
        const prices = newData.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const padding = range > 0 ? range * 0.05 : max * 0.01;
        
        setMinValue(Math.max(0, min - padding));
        setMaxValue(max + padding);
        
        logger.log(`[TokenPriceChart:LIVE] ✅ Price updated`, {
          dataPoints: newData.length,
          latestPrice: currentPrice,
          minValue: min - padding,
          maxValue: max + padding,
        });
        
        if (onPriceUpdate) {
          onPriceUpdate(currentPrice);
        }
        
        return newData;
      }
      
      return prev;
    });
  }, [tokenSymbol, selectedTimeframe, currentPrice, onPriceUpdate, priceHistory.length]);

  // ✅ Load price history with smart caching
  const loadPriceHistory = useCallback(async (forceRefresh = false) => {
    if (!tokenSymbol || !isMountedRef.current) {
      logger.log(`[TokenPriceChart:${selectedTimeframe}] ⏭️ Skipping load - no symbol or unmounted`, {
        hasSymbol: !!tokenSymbol,
        isMounted: isMountedRef.current,
      });
      return;
    }

    const days = getDaysForTimeframe(selectedTimeframe);
    
    logger.log(`[TokenPriceChart:${selectedTimeframe}] 🔄 Starting loadPriceHistory`, {
      timeframe: selectedTimeframe,
      days,
      symbol: tokenSymbol,
      tokenAddress: tokenAddress || 'native',
      chain,
      forceRefresh,
    });
    
    // ✅ Check cache first (unless forced refresh or LIVE mode)
    // LIVE mode: No cache, always fresh data
    if (!forceRefresh && selectedTimeframe !== 'LIVE') {
      const cached = priceHistoryCache.get(tokenSymbol, days, tokenAddress, chain);
      logger.log(`[TokenPriceChart:${selectedTimeframe}] 📦 Cache check`, {
        hasCache: !!cached,
        cacheDataPoints: cached?.prices?.length || 0,
      });
      
      if (cached && cached.prices.length > 0) {
        // Use cached data immediately
        const formatTime = (timestamp: number) => {
          const date = new Date(timestamp);
          // Note: selectedTimeframe cannot be 'LIVE' here because we skip cache for LIVE
          if (selectedTimeframe === '1D') {
            return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
          } else if (selectedTimeframe === '7D' || selectedTimeframe === '30D') {
            return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
          } else {
            return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' });
          }
        };

        const data = cached.prices.map(p => ({
          timestamp: p.timestamp,
          price: p.price,
          time: formatTime(p.timestamp),
        }));

        // ✅ EXACT CoinGecko data - NO manipulation!
        // CoinGecko already provides complete data, including the latest price point
        // We should NOT add currentPrice as it would distort the chart shape

        const prices = data.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const padding = range > 0 ? range * 0.05 : max * 0.01;

        setPriceHistory(data);
        setMinValue(Math.max(0, min - padding));
        setMaxValue(max + padding);
        setIsLoading(false);

        logger.log(`[TokenPriceChart:${selectedTimeframe}] ✅ Using cached data`, {
          dataPoints: data.length,
          minPrice: min - padding,
          maxPrice: max + padding,
          firstTimestamp: data[0]?.timestamp,
          lastTimestamp: data[data.length - 1]?.timestamp,
        });

        // ✅ Background refresh if cache is getting stale (but not for LIVE)
        if (selectedTimeframe !== 'LIVE' && priceHistoryCache.needsRefresh(tokenSymbol, days, tokenAddress, chain)) {
          logger.log(`[TokenPriceChart:${selectedTimeframe}] 🔄 Cache getting stale, refreshing in background...`);
          loadPriceHistory(true); // Refresh in background
        }
        return;
      }
    } else if (selectedTimeframe === 'LIVE') {
      logger.log(`[TokenPriceChart:LIVE] ⚡ Skipping cache - LIVE mode always uses fresh data`);
    }

    setIsLoading(true);
    logger.log(`[TokenPriceChart:${selectedTimeframe}] 📡 Fetching from API`, {
      symbol: tokenSymbol,
      days,
      tokenAddress: tokenAddress || 'native',
      chain,
    });
    
    const apiStartTime = Date.now();
    
    try {
      const result = await getTokenPriceHistory(
        tokenSymbol,
        days,
        tokenAddress,
        chain
      );
      
      const apiDuration = Date.now() - apiStartTime;
      
      logger.log(`[TokenPriceChart:${selectedTimeframe}] 📥 API response received`, {
        success: result.success,
        dataPoints: result.prices?.length || 0,
        error: result.error,
        source: result.source,
        coinGeckoId: result.coinGeckoId,
        duration: `${apiDuration}ms`,
      });

      if (result.success && result.prices && result.prices.length > 0) {
        logger.log(`[TokenPriceChart:${selectedTimeframe}] 🔍 Processing raw data`, {
          rawDataPoints: result.prices.length,
          firstRawPoint: result.prices[0] ? {
            timestamp: result.prices[0].timestamp,
            price: result.prices[0].price,
          } : null,
          lastRawPoint: result.prices[result.prices.length - 1] ? {
            timestamp: result.prices[result.prices.length - 1].timestamp,
            price: result.prices[result.prices.length - 1].price,
          } : null,
        });
        
        // ✅ IMPROVED: Filter and validate price data
        const validPrices = result.prices
          .filter(p => p && p.timestamp && p.price && p.price > 0 && !isNaN(p.price) && !isNaN(p.timestamp))
          .sort((a, b) => a.timestamp - b.timestamp); // Ensure chronological order

        logger.log(`[TokenPriceChart:${selectedTimeframe}] ✅ Data validation complete`, {
          rawPoints: result.prices.length,
          validPoints: validPrices.length,
          filteredOut: result.prices.length - validPrices.length,
        });

        if (validPrices.length === 0) {
          logger.error(`[TokenPriceChart:${selectedTimeframe}] ❌ No valid price data after filtering`, {
            symbol: tokenSymbol,
            rawDataPoints: result.prices.length,
            timeframe: selectedTimeframe,
          });
          if (isMountedRef.current) {
            setPriceHistory([]);
            setIsLoading(false);
          }
          return;
        }

        // ✅ Cache the result
        priceHistoryCache.set(
          tokenSymbol,
          days,
          validPrices,
          result.coinGeckoId,
          tokenAddress,
          chain,
          result.source || 'CoinGecko'
        );
        
        logger.log(`[TokenPriceChart:${selectedTimeframe}] 💾 Data cached`, {
          dataPoints: validPrices.length,
          source: result.source || 'CoinGecko',
        });

        // Format time labels based on timeframe (like Bitvavo)
        const formatTime = (timestamp: number) => {
          const date = new Date(timestamp);
          if (selectedTimeframe === 'LIVE' || selectedTimeframe === '1D') {
            return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
          } else if (selectedTimeframe === '7D' || selectedTimeframe === '30D') {
            return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
          } else {
            return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' });
          }
        };

        let data = validPrices.map(p => ({
          timestamp: p.timestamp,
          price: p.price,
          time: formatTime(p.timestamp),
        }));
        
        logger.log(`[TokenPriceChart:${selectedTimeframe}] 📊 Data formatted`, {
          formattedPoints: data.length,
          firstFormatted: data[0] ? {
            timestamp: data[0].timestamp,
            price: data[0].price,
            time: data[0].time,
          } : null,
          lastFormatted: data[data.length - 1] ? {
            timestamp: data[data.length - 1].timestamp,
            price: data[data.length - 1].price,
            time: data[data.length - 1].time,
          } : null,
        });

        // ✅ EXACT CoinGecko data - NO manipulation!
        // CoinGecko already provides complete data, including the latest price point
        // We should NOT add currentPrice as it would distort the chart shape
        // Only use CoinGecko's exact data points to match their website exactly

        // Calculate min/max with proper padding
        const prices = data.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const padding = range > 0 ? range * 0.05 : max * 0.01;
        
        const finalMin = Math.max(0, min - padding);
        const finalMax = max + padding;
        
        logger.log(`[TokenPriceChart:${selectedTimeframe}] 📈 Price range calculated`, {
          minPrice: min,
          maxPrice: max,
          range,
          padding,
          finalMin,
          finalMax,
        });

        if (isMountedRef.current) {
          setPriceHistory(data);
          setMinValue(finalMin);
          setMaxValue(finalMax);
          setIsLoading(false);

          if (onPriceUpdate && data.length > 0) {
            onPriceUpdate(data[data.length - 1].price);
          }
          
          logger.log(`[TokenPriceChart:${selectedTimeframe}] ✅ State updated successfully`, {
            dataPoints: data.length,
            minValue: finalMin,
            maxValue: finalMax,
            isLoading: false,
          });
        } else {
          logger.warn(`[TokenPriceChart:${selectedTimeframe}] ⚠️ Component unmounted, skipping state update`);
        }

        logger.log(`[TokenPriceChart:${selectedTimeframe}] ✅ Loaded ${data.length} price points for ${tokenSymbol} (${days}d)`);
      } else {
        logger.error(`[TokenPriceChart:${selectedTimeframe}] ❌ No price history available`, {
          symbol: tokenSymbol,
          error: result.error || 'Unknown error',
          success: result.success,
          dataPoints: result.prices?.length || 0,
          timeframe: selectedTimeframe,
          days,
        });
        
        // ✅ IMPROVED: If we have current price but no history, create a simple chart
        if (currentPrice > 0 && isMountedRef.current) {
          logger.log(`[TokenPriceChart:${selectedTimeframe}] 🔄 Creating fallback chart`, {
            currentPrice,
            days,
          });
          const now = Date.now();
          const pastTime = now - (days * 24 * 60 * 60 * 1000);
          
          const fallbackData = [
            {
              timestamp: pastTime,
              price: currentPrice * 0.95, // 5% lower
              time: new Date(pastTime).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
            },
            {
              timestamp: now,
              price: currentPrice,
              time: new Date(now).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
            },
          ];
          
          setPriceHistory(fallbackData);
          setMinValue(currentPrice * 0.90);
          setMaxValue(currentPrice * 1.05);
          setIsLoading(false);
          logger.log(`⚠️ [TokenPriceChart] Using fallback chart for ${tokenSymbol}`);
        } else if (isMountedRef.current) {
          setPriceHistory([]);
          setIsLoading(false);
        }
      }
    } catch (error: any) {
      logger.error(`[TokenPriceChart:${selectedTimeframe}] ❌ Failed to load price history`, {
        symbol: tokenSymbol,
        timeframe: selectedTimeframe,
        days,
        error: error?.message || 'Unknown error',
        stack: error?.stack,
        tokenAddress: tokenAddress || 'native',
        chain,
      });
      if (isMountedRef.current) {
        setPriceHistory([]);
        setIsLoading(false);
        logger.log(`[TokenPriceChart:${selectedTimeframe}] 🧹 State cleared due to error`);
      }
    }
  }, [tokenSymbol, tokenAddress, chain, selectedTimeframe, currentPrice, onPriceUpdate, getDaysForTimeframe]);

  // ✅ Main effect: Load data and set up refresh intervals
  useEffect(() => {
    if (!tokenSymbol) {
      logger.log(`[TokenPriceChart:${selectedTimeframe}] ⏭️ Skipping effect - no symbol`);
      return;
    }
    
    logger.log(`[TokenPriceChart:${selectedTimeframe}] 🎯 Effect triggered`, {
      timeframe: selectedTimeframe,
      symbol: tokenSymbol,
      tokenAddress: tokenAddress || 'native',
      chain,
    });
    
    isMountedRef.current = true;
    
    // Initial load
    if (selectedTimeframe === 'LIVE') {
      logger.log(`[TokenPriceChart:LIVE] 🚀 Loading initial history for LIVE mode`);
      // For LIVE, load initial history then update only price
      loadPriceHistory(false);
    } else {
      logger.log(`[TokenPriceChart:${selectedTimeframe}] 🚀 Loading history for ${selectedTimeframe}`);
      loadPriceHistory(false);
    }

    // ✅ Set up smart refresh interval based on timeframe
    const refreshInterval = getRefreshInterval(selectedTimeframe);
    
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval
    if (selectedTimeframe === 'LIVE') {
      // ✅ LIVE: Update only price (no full history fetch)
      refreshIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          updateLivePrice();
        }
      }, refreshInterval);
      
      // Also refresh full history every 30 seconds for LIVE (to get new data points)
      const historyRefreshInterval = setInterval(() => {
        if (isMountedRef.current) {
          logger.log(`🔄 [TokenPriceChart] Refreshing LIVE history for ${tokenSymbol}`);
          loadPriceHistory(false);
        }
      }, 30000);
      
      // Cleanup
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        clearInterval(historyRefreshInterval);
        isMountedRef.current = false;
      };
    } else {
      // Other timeframes: Full refresh
      logger.log(`[TokenPriceChart:${selectedTimeframe}] 🔄 Setting up auto-refresh interval`, {
        interval: `${refreshInterval}ms`,
      });
      refreshIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          logger.log(`[TokenPriceChart:${selectedTimeframe}] 🔄 Auto-refresh triggered for ${tokenSymbol}`);
          loadPriceHistory(false); // Use cache if available, refresh if stale
        }
      }, refreshInterval);

      // Cleanup
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        isMountedRef.current = false;
      };
    }
  }, [tokenSymbol, tokenAddress, chain, selectedTimeframe, loadPriceHistory, getRefreshInterval, updateLivePrice]);

  const timeframes: Timeframe[] = ['LIVE', '1D', '7D', '30D', '1J', 'ALLES'];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">
            {formatUSDSync(data.price)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(data.timestamp).toLocaleString('nl-NL', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  const lineColor = isPositiveChange ? '#10b981' : '#ef4444';
  const gradientId = 'priceGradient';

  return (
    <div className="w-full">
      {/* Header with Chart Type Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isPositiveChange ? (
            <TrendingUp className="w-5 h-5 text-green-500" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-500" />
          )}
          <h4 className="font-semibold text-gray-900">Price chart</h4>
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                chartType === 'line'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Line chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setChartType('candlestick')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                chartType === 'candlestick'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Candlestick chart"
            >
              <BarChart3 className="w-3.5 h-3.5 rotate-90" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 mb-4">
        {timeframes.map((timeframe) => (
          <motion.button
            key={timeframe}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const previousTimeframe = selectedTimeframe;
              const days = getDaysForTimeframe(timeframe);
              logger.log(`[TokenPriceChart] 🎯 Timeframe selected`, {
                previous: previousTimeframe,
                new: timeframe,
                days,
                symbol: tokenSymbol,
                tokenAddress: tokenAddress || 'native',
                chain,
              });
              setSelectedTimeframe(timeframe);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedTimeframe === timeframe
                ? `bg-gradient-to-r ${isPositiveChange ? 'from-green-500 to-emerald-500' : 'from-red-500 to-rose-500'} text-white shadow-sm`
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {timeframe}
          </motion.button>
        ))}
      </div>

      {/* Chart - Bitvavo Style (Large and Prominent) */}
      <div className="relative w-full" style={{ minHeight: '300px' }}>
        {isLoading ? (
          <div className="h-[300px] md:h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading chart...</p>
            </div>
          </div>
        ) : priceHistory.length > 0 ? (
          <>
            {/* Min/Max Labels - Bitvavo Style */}
            <div className="absolute top-3 left-3 text-xs md:text-sm text-gray-500 font-medium z-10">
              {formatUSDSync(minValue)}
            </div>
            <div className="absolute top-3 right-3 text-xs md:text-sm text-gray-500 font-medium z-10">
              {formatUSDSync(maxValue)}
            </div>

            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'line' ? (
                <AreaChart 
                  data={priceHistory} 
                  margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    hide={true}
                    // ✅ No labels on X-axis (saves space, cleaner look like CoinGecko)
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[minValue, maxValue]}
                    hide={true}
                    // ✅ No labels on Y-axis (saves space, cleaner look like CoinGecko)
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={3}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              ) : (
                // Candlestick chart - using line chart with thicker strokes
                <LineChart 
                  data={priceHistory} 
                  margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                >
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    hide={true}
                    // ✅ No labels on X-axis (saves space, cleaner look like CoinGecko)
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[minValue, maxValue]}
                    hide={true}
                    // ✅ No labels on Y-axis (saves space, cleaner look like CoinGecko)
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: '#fff' }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </>
        ) : (
          <div className="h-[300px] md:h-[400px] flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Chart not available</p>
              <p className="text-xs text-gray-400 mt-1">Price history unavailable for this token</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

