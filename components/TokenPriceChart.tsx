'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart, CandleStickChart, Candlestick } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getTokenPriceHistory } from '@/lib/token-price-history';
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

  // Load price history
  useEffect(() => {
    if (!tokenSymbol) return;

    const loadPriceHistory = async () => {
      setIsLoading(true);
      try {
        let days = 1;
        switch (selectedTimeframe) {
          case 'LIVE':
          case '1D':
            days = 1;
            break;
          case '7D':
            days = 7;
            break;
          case '30D':
            days = 30;
            break;
          case '1J':
            days = 365;
            break;
          case 'ALLES':
            days = 365; // Max available
            break;
        }

        const result = await getTokenPriceHistory(
          tokenSymbol,
          days,
          tokenAddress,
          chain
        );

        if (result.success && result.prices.length > 0) {
          const data = result.prices.map(p => ({
            timestamp: p.timestamp,
            price: p.price,
            time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
              ? new Date(p.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
              : new Date(p.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
          }));

          // Add current price as latest point
          const now = Date.now();
          data.push({
            timestamp: now,
            price: currentPrice,
            time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
              ? new Date(now).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
              : new Date(now).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
          });

          const prices = data.map(d => d.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const padding = (max - min) * 0.1;

          setPriceHistory(data);
          setMinValue(Math.max(0, min - padding));
          setMaxValue(max + padding);

          if (onPriceUpdate && data.length > 0) {
            onPriceUpdate(data[data.length - 1].price);
          }
        } else {
          logger.warn(`⚠️ No price history available for ${tokenSymbol}`);
          setPriceHistory([]);
        }
      } catch (error) {
        logger.error('❌ Failed to load price history:', error);
        setPriceHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPriceHistory();

    // For LIVE timeframe, update every 30 seconds
    if (selectedTimeframe === 'LIVE') {
      const interval = setInterval(loadPriceHistory, 30000);
      return () => clearInterval(interval);
    }
  }, [tokenSymbol, tokenAddress, chain, selectedTimeframe, currentPrice, onPriceUpdate]);

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
            onClick={() => setSelectedTimeframe(timeframe)}
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

      {/* Chart */}
      <div className="relative">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading chart...</p>
            </div>
          </div>
        ) : priceHistory.length > 0 ? (
          <>
            {/* Min/Max Labels */}
            <div className="absolute top-2 left-2 text-xs text-gray-500 font-medium">
              {formatUSDSync(minValue)}
            </div>
            <div className="absolute top-2 right-2 text-xs text-gray-500 font-medium">
              {formatUSDSync(maxValue)}
            </div>

            <ResponsiveContainer width="100%" height={256}>
              {chartType === 'line' ? (
                <AreaChart data={priceHistory} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke="#9ca3af"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#9ca3af"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatUSDSync(value)}
                    domain={[minValue, maxValue]}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: lineColor }}
                  />
                </AreaChart>
              ) : (
                // Candlestick chart - simplified version using line chart with OHLC data
                // Note: Full candlestick requires OHLC data which we'd need to fetch separately
                // For now, we'll show a line chart that looks more like candlesticks
                <LineChart data={priceHistory} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <XAxis
                    dataKey="time"
                    stroke="#9ca3af"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#9ca3af"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatUSDSync(value)}
                    domain={[minValue, maxValue]}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: lineColor }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center">
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

