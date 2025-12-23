'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getPortfolioHistory } from '@/lib/portfolio-history';
import { logger } from '@/lib/logger';

interface BalanceChartProps {
  address: string;
  chain: string;
  currentBalance: number;
  isPositiveChange: boolean;
  selectedTimeRange: number | null; // hours or null for "Alles"
  onTimeRangeChange?: (hours: number | null) => void;
}

type Timeframe = 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES';

export default function BalanceChart({
  address,
  chain,
  currentBalance,
  isPositiveChange,
  selectedTimeRange,
  onTimeRangeChange,
}: BalanceChartProps) {
  const { formatUSDSync, symbol } = useCurrency();
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1D');
  const [chartData, setChartData] = useState<Array<{ timestamp: number; balance: number; time: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(0);

  const portfolioHistory = getPortfolioHistory();

  // Convert hours to timeframe
  const hoursToTimeframe = (hours: number | null): Timeframe => {
    if (hours === null) return 'ALLES';
    if (hours === 1) return 'LIVE';
    if (hours === 24) return '1D';
    if (hours === 168) return '7D';
    if (hours === 720) return '30D';
    if (hours === 8760) return '1J'; // ~1 year
    return '1D';
  };

  // Convert timeframe to hours
  const timeframeToHours = (timeframe: Timeframe): number | null => {
    switch (timeframe) {
      case 'LIVE': return 1;
      case '1D': return 24;
      case '7D': return 168;
      case '30D': return 720;
      case '1J': return 8760; // ~1 year
      case 'ALLES': return null;
      default: return 24;
    }
  };

  // Load chart data
  useEffect(() => {
    const loadChartData = () => {
      setIsLoading(true);
      
      const hours = timeframeToHours(selectedTimeframe);
      const snapshots = portfolioHistory.getRecentSnapshots(50, hours, chain, address);
      
      if (snapshots.length === 0) {
        // If no history, create a single point with current balance
        const now = Date.now();
        setChartData([{
          timestamp: now,
          balance: currentBalance,
          time: new Date(now).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        }]);
        setMinValue(currentBalance);
        setMaxValue(currentBalance);
        setIsLoading(false);
        return;
      }

      // Add current balance as the latest point
      const now = Date.now();
      const data = [
        ...snapshots.map(s => ({
          timestamp: s.timestamp,
          balance: s.balance,
          time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
            ? new Date(s.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
            : new Date(s.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        })),
        {
          timestamp: now,
          balance: currentBalance,
          time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
            ? new Date(now).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
            : new Date(now).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        },
      ];

      const balances = data.map(d => d.balance);
      const min = Math.min(...balances);
      const max = Math.max(...balances);
      const padding = (max - min) * 0.1; // 10% padding

      setChartData(data);
      setMinValue(Math.max(0, min - padding));
      setMaxValue(max + padding);
      setIsLoading(false);
    };

    loadChartData();

    // For LIVE timeframe, update every 30 seconds
    if (selectedTimeframe === 'LIVE') {
      const interval = setInterval(loadChartData, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedTimeframe, currentBalance, address, chain, portfolioHistory]);

  // Sync selectedTimeframe with selectedTimeRange prop
  useEffect(() => {
    const tf = hoursToTimeframe(selectedTimeRange);
    setSelectedTimeframe(tf);
  }, [selectedTimeRange]);

  const handleTimeframeChange = (timeframe: Timeframe) => {
    setSelectedTimeframe(timeframe);
    const hours = timeframeToHours(timeframe);
    if (onTimeRangeChange) {
      onTimeRangeChange(hours);
    }
  };

  const timeframes: Timeframe[] = ['LIVE', '1D', '7D', '30D', '1J', 'ALLES'];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">
            {formatUSDSync(data.balance)}
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
  const gradientId = 'balanceGradient';

  return (
    <div className="w-full">
      {/* Timeframe Selector - Bitvavo Style */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isPositiveChange ? (
            <TrendingUp className="w-5 h-5 text-green-500" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-500" />
          )}
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">Portfolio</h3>
        </div>
        
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
          {timeframes.map((timeframe) => (
            <motion.button
              key={timeframe}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTimeframeChange(timeframe)}
              className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedTimeframe === timeframe
                  ? `bg-gradient-to-r ${isPositiveChange ? 'from-green-500 to-emerald-500' : 'from-red-500 to-rose-500'} text-white shadow-sm`
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              {timeframe}
            </motion.button>
          ))}
        </div>
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
        ) : chartData.length > 0 ? (
          <>
            {/* Min/Max Labels - Bitvavo Style */}
            <div className="absolute top-3 left-3 text-xs md:text-sm text-gray-500 font-medium z-10">
              {formatUSDSync(minValue)}
            </div>
            <div className="absolute top-3 right-3 text-xs md:text-sm text-gray-500 font-medium z-10">
              {formatUSDSync(maxValue)}
            </div>

            <ResponsiveContainer width="100%" height={400}>
              <AreaChart 
                data={chartData} 
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
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatUSDSync(value)}
                  domain={[minValue, maxValue]}
                  width={80}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={lineColor}
                  strokeWidth={3}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="h-[300px] md:h-[400px] flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500">No chart data available</p>
              <p className="text-xs text-gray-400 mt-1">Balance history will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

