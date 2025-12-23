'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getPortfolioHistory } from '@/lib/portfolio-history';
import { reconstructPortfolioHistory } from '@/lib/portfolio-reconstruction';
import { logger } from '@/lib/logger';
import { Token } from '@/lib/types';
import { CHAINS } from '@/lib/chains';
import { useWalletStore } from '@/lib/wallet-store';

interface BalanceChartProps {
  address: string;
  chain: string;
  currentBalance: number;
  isPositiveChange: boolean;
  selectedTimeRange: number | null; // hours or null for "Alles"
  onTimeRangeChange?: (hours: number | null) => void;
  tokens?: Token[]; // Current token holdings for reconstruction
  nativeBalance?: string; // Native token balance
}

type Timeframe = 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES';

export default function BalanceChart({
  address,
  chain,
  currentBalance,
  isPositiveChange,
  selectedTimeRange,
  onTimeRangeChange,
  tokens = [],
  nativeBalance = '0',
}: BalanceChartProps) {
  const { formatUSDSync, symbol } = useCurrency();
  const { currentChain } = useWalletStore();
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1D');
  const [chartData, setChartData] = useState<Array<{ timestamp: number; balance: number; time: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(0);
  const [useReconstruction, setUseReconstruction] = useState(false);

  const portfolioHistory = getPortfolioHistory();
  const chainInfo = CHAINS[chain] || CHAINS[currentChain];

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

  // Load chart data with reconstruction fallback
  useEffect(() => {
    const loadChartData = async () => {
      setIsLoading(true);
      
      const hours = timeframeToHours(selectedTimeframe);
      const snapshots = portfolioHistory.getRecentSnapshots(50, hours, chain, address);
      
      // If we have snapshots, use them
      if (snapshots.length > 0) {
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
        const padding = (max - min) * 0.1;

        setChartData(data);
        setMinValue(Math.max(0, min - padding));
        setMaxValue(max + padding);
        setUseReconstruction(false);
        setIsLoading(false);
        return;
      }
      
      // No snapshots - ALWAYS try reconstruction (like Bitvavo)
      logger.log(`📊 [BalanceChart] No snapshots (${snapshots.length}), attempting portfolio reconstruction for ${selectedTimeframe}`);
      logger.log(`📊 [BalanceChart] Tokens: ${tokens.length}, Native balance: ${nativeBalance}`);
      setUseReconstruction(true);
      
      try {
        const reconstructed = await reconstructPortfolioHistory(
          tokens || [],
          nativeBalance || '0',
          chainInfo.nativeCurrency.symbol,
          chain,
          selectedTimeframe
        );
        
        logger.log(`📊 [BalanceChart] Reconstruction returned ${reconstructed.length} points`);
        
        if (reconstructed.length > 0) {
          const data = reconstructed.map(s => ({
            timestamp: s.timestamp,
            balance: s.balance,
            time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
              ? new Date(s.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
              : new Date(s.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
          }));
          
          // Ensure we have at least 2 points for a line
          if (data.length === 1) {
            // Add a point 1 hour ago with same balance (flat line)
            data.unshift({
              timestamp: data[0].timestamp - 3600000,
              balance: data[0].balance,
              time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
                ? new Date(data[0].timestamp - 3600000).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                : new Date(data[0].timestamp - 3600000).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
            });
          }
          
          const balances = data.map(d => d.balance);
          const min = Math.min(...balances);
          const max = Math.max(...balances);
          const padding = Math.max((max - min) * 0.1, max * 0.02); // At least 2% padding
          
          setChartData(data);
          setMinValue(Math.max(0, min - padding));
          setMaxValue(max + padding);
          setIsLoading(false);
          return;
        } else {
          logger.warn(`⚠️ [BalanceChart] Reconstruction returned 0 points`);
        }
      } catch (error) {
        logger.error('❌ [BalanceChart] Reconstruction failed:', error);
      }
      
      // Fallback: single point with current balance
      const now = Date.now();
      setChartData([{
        timestamp: now,
        balance: currentBalance,
        time: new Date(now).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
      }]);
      setMinValue(currentBalance);
      setMaxValue(currentBalance);
      setUseReconstruction(false);
      setIsLoading(false);
    };

    loadChartData();

    // For LIVE timeframe, update every 30 seconds
    if (selectedTimeframe === 'LIVE') {
      const interval = setInterval(loadChartData, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedTimeframe, currentBalance, address, chain, portfolioHistory, tokens, nativeBalance, chainInfo]);

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

  // Compact tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1.5">
          <p className="text-xs font-semibold text-gray-900">
            {formatUSDSync(data.balance)}
          </p>
          <p className="text-[10px] text-gray-500">
            {new Date(data.timestamp).toLocaleString('nl-NL', {
              day: 'numeric',
              month: 'short',
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
    <div className="w-full mt-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Portfolio</h3>
        </div>
        {/* Compact Timeframe Selector */}
        <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5">
          {timeframes.map((timeframe) => (
            <motion.button
              key={timeframe}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTimeframeChange(timeframe)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap ${
                selectedTimeframe === timeframe
                  ? `bg-white text-gray-900 shadow-sm`
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {timeframe}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Compact Chart Container */}
      <div className="bg-gray-50 rounded-lg p-2 relative overflow-hidden">
        {/* Gradient overlay - BLAZE style */}
        <div className={`absolute inset-0 opacity-5 pointer-events-none ${
          isPositiveChange 
            ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
            : 'bg-gradient-to-br from-rose-500 to-orange-500'
        }`} />
        
        <div className="relative z-10">
          {isLoading ? (
            <div className="h-[120px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-500">Loading...</p>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <>
              {/* Compact Min/Max Labels */}
              <div className="absolute top-1 left-1 z-20">
                <div className="bg-white/95 backdrop-blur-sm rounded px-1.5 py-0.5 shadow-sm border border-gray-200/50">
                  <p className="text-[9px] font-medium text-gray-500">Min</p>
                  <p className="text-[10px] font-semibold text-gray-900">{formatUSDSync(minValue)}</p>
                </div>
              </div>
              <div className="absolute top-1 right-1 z-20">
                <div className="bg-white/95 backdrop-blur-sm rounded px-1.5 py-0.5 shadow-sm border border-gray-200/50">
                  <p className="text-[9px] font-medium text-gray-500">Max</p>
                  <p className="text-[10px] font-semibold text-gray-900">{formatUSDSync(maxValue)}</p>
                </div>
              </div>

              {/* Compact Chart - 120px height */}
              <div className="h-[120px] -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#d1d5db"
                      style={{ fontSize: '9px' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fill: '#9ca3af' }}
                    />
                    <YAxis
                      stroke="#d1d5db"
                      style={{ fontSize: '9px' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatUSDSync(value)}
                      domain={[minValue, maxValue]}
                      width={50}
                      tick={{ fill: '#9ca3af' }}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ 
                        stroke: lineColor, 
                        strokeWidth: 1, 
                        strokeDasharray: '3 3',
                        strokeOpacity: 0.4
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={lineColor}
                      strokeWidth={2}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      activeDot={{ 
                        r: 4, 
                        fill: lineColor, 
                        strokeWidth: 2, 
                        stroke: '#fff'
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="h-[120px] flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className={`w-5 h-5 mx-auto mb-1 ${
                  isPositiveChange ? 'text-emerald-500' : 'text-rose-500'
                }`} />
                <p className="text-[10px] text-gray-500">No data available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

