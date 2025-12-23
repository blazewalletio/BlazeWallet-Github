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
    <div className="w-full mt-6">
      {/* Header met BLAZE styling */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
            isPositiveChange 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
              : 'bg-gradient-to-br from-rose-500 to-orange-500'
          }`}>
            {isPositiveChange ? (
              <TrendingUp className="w-5 h-5 text-white" />
            ) : (
              <TrendingDown className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900">Portfolio</h3>
            <p className="text-xs text-gray-500">Total balance over time</p>
          </div>
        </div>
      </div>

      {/* Timeframe Selector - BLAZE Style */}
      <div className="flex items-center gap-2 mb-4 px-1 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-xl p-1.5 border border-gray-200/50 shadow-sm">
          {timeframes.map((timeframe) => (
            <motion.button
              key={timeframe}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTimeframeChange(timeframe)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                selectedTimeframe === timeframe
                  ? `bg-gradient-to-r ${
                      isPositiveChange 
                        ? 'from-emerald-500 to-teal-500' 
                        : 'from-rose-500 to-orange-500'
                    } text-white shadow-lg`
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {timeframe}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart Container - BLAZE Glass Card */}
      <div className="glass-card rounded-2xl p-4 md:p-6 border border-gray-200/50 shadow-xl relative overflow-hidden">
        {/* Gradient overlay - BLAZE style */}
        <div className={`absolute inset-0 opacity-5 pointer-events-none ${
          isPositiveChange 
            ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
            : 'bg-gradient-to-br from-rose-500 to-orange-500'
        }`} />
        
        <div className="relative z-10">
          {isLoading ? (
            <div className="h-[280px] md:h-[380px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Loading chart data...</p>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <>
              {/* Min/Max Labels - BLAZE Style */}
              <div className="absolute top-4 left-4 z-20">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-gray-200/50">
                  <p className="text-xs font-semibold text-gray-500">Min</p>
                  <p className="text-sm font-bold text-gray-900">{formatUSDSync(minValue)}</p>
                </div>
              </div>
              <div className="absolute top-4 right-4 z-20">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-gray-200/50">
                  <p className="text-xs font-semibold text-gray-500">Max</p>
                  <p className="text-sm font-bold text-gray-900">{formatUSDSync(maxValue)}</p>
                </div>
              </div>

              {/* Chart - Large & Prominent */}
              <div className="h-[280px] md:h-[380px] -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                        <stop offset="50%" stopColor={lineColor} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#9ca3af"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatUSDSync(value)}
                      domain={[minValue, maxValue]}
                      width={75}
                      tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ 
                        stroke: lineColor, 
                        strokeWidth: 2, 
                        strokeDasharray: '5 5',
                        strokeOpacity: 0.5
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={lineColor}
                      strokeWidth={3}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      activeDot={{ 
                        r: 7, 
                        fill: lineColor, 
                        strokeWidth: 3, 
                        stroke: '#fff',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="h-[280px] md:h-[380px] flex items-center justify-center">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                  isPositiveChange 
                    ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10' 
                    : 'bg-gradient-to-br from-rose-500/10 to-orange-500/10'
                }`}>
                  <BarChart3 className={`w-8 h-8 ${
                    isPositiveChange ? 'text-emerald-500' : 'text-rose-500'
                  }`} />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No chart data available</p>
                <p className="text-xs text-gray-500">Start trading to see your portfolio history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

