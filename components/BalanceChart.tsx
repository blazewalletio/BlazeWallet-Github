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

  // Track if we have tokens/balance for reconstruction
  const hasTokensForReconstruction = tokens.length > 0 || (nativeBalance && parseFloat(nativeBalance) > 0);
  const tokensKey = `${tokens.length}_${tokens.map(t => t.address).join(',')}`; // Unique key when tokens change
  const nativeBalanceKey = nativeBalance || '0'; // Track native balance changes

  // Load chart data with reconstruction fallback
  useEffect(() => {
    const loadChartData = async () => {
      console.log(`🔍 [BalanceChart] ========== LOAD CHART DATA START ==========`);
      console.log(`🔍 [BalanceChart] Selected timeframe: ${selectedTimeframe}`);
      console.log(`🔍 [BalanceChart] Chain: ${chain}, Address: ${address?.substring(0, 10)}...`);
      console.log(`🔍 [BalanceChart] Current balance: $${currentBalance.toFixed(2)}`);
      console.log(`🔍 [BalanceChart] Tokens count: ${tokens.length}`);
      console.log(`🔍 [BalanceChart] Native balance: ${nativeBalance}`);
      
      setIsLoading(true);
      
      const hours = timeframeToHours(selectedTimeframe);
      console.log(`🔍 [BalanceChart] Timeframe '${selectedTimeframe}' converted to hours: ${hours} (${hours === null ? 'ALLES (null)' : hours + ' hours'})`);
      
      console.log(`🔍 [BalanceChart] Calling getRecentSnapshots with: count=50, hours=${hours}, chain=${chain}, address=${address?.substring(0, 10)}...`);
      const snapshots = portfolioHistory.getRecentSnapshots(50, hours, chain, address);
      console.log(`🔍 [BalanceChart] getRecentSnapshots returned ${snapshots.length} snapshots`);
      
      // ✅ FIX: Check if snapshots have enough time span for the requested timeframe
      // If snapshots exist but don't cover enough time, use reconstruction instead
      let shouldUseSnapshots = snapshots.length > 0;
      
      if (snapshots.length > 0) {
        const oldestSnapshot = snapshots[0];
        const newestSnapshot = snapshots[snapshots.length - 1];
        const snapshotTimeSpanHours = (newestSnapshot.timestamp - oldestSnapshot.timestamp) / (1000 * 60 * 60);
        const requestedHours = hours || Infinity; // For ALLES, use Infinity
        
        console.log(`🔍 [BalanceChart] Snapshot time span: ${snapshotTimeSpanHours.toFixed(2)} hours`);
        console.log(`🔍 [BalanceChart] Requested hours: ${hours === null ? 'ALLES (all snapshots)' : hours + ' hours'}`);
        
        // ✅ FIX: For timeframes > 1D, require at least 50% of requested time span
        // For LIVE and 1D, snapshots are OK even if short (they're recent)
        // For ALLES, require at least 7 days of data
        const minRequiredTimeSpan = selectedTimeframe === 'LIVE' || selectedTimeframe === '1D' 
          ? 0.1 // LIVE/1D: accept snapshots even if only 0.1 hours (6 min)
          : selectedTimeframe === 'ALLES'
          ? 168 // ALLES: need at least 7 days (168 hours) of snapshot data
          : requestedHours * 0.5; // 7D/30D/1J: need at least 50% of requested time
        
        console.log(`🔍 [BalanceChart] Minimum required time span: ${minRequiredTimeSpan.toFixed(2)} hours`);
        
        if (snapshotTimeSpanHours < minRequiredTimeSpan) {
          console.log(`🔍 [BalanceChart] ⚠️ Snapshot time span (${snapshotTimeSpanHours.toFixed(2)}h) is less than required (${minRequiredTimeSpan.toFixed(2)}h) - will use reconstruction instead`);
          shouldUseSnapshots = false;
        } else {
          console.log(`🔍 [BalanceChart] ✅ Snapshot time span (${snapshotTimeSpanHours.toFixed(2)}h) is sufficient - will use snapshots`);
        }
      }
      
      if (shouldUseSnapshots && snapshots.length > 0) {
        console.log(`🔍 [BalanceChart] ========== USING SNAPSHOTS ==========`);
        console.log(`🔍 [BalanceChart] Snapshot details:`);
        snapshots.forEach((s, i) => {
          const date = new Date(s.timestamp);
          const ageHours = (Date.now() - s.timestamp) / (1000 * 60 * 60);
          console.log(`🔍 [BalanceChart]   Snapshot ${i + 1}: timestamp=${s.timestamp} (${date.toISOString()}), balance=$${s.balance.toFixed(2)}, age=${ageHours.toFixed(2)} hours, chain=${s.chain}, address=${s.address?.substring(0, 10)}...`);
        });
        
        const oldestSnapshot = snapshots[0];
        const newestSnapshot = snapshots[snapshots.length - 1];
        const timeSpanHours = (newestSnapshot.timestamp - oldestSnapshot.timestamp) / (1000 * 60 * 60);
        console.log(`🔍 [BalanceChart] Snapshot time span: ${timeSpanHours.toFixed(2)} hours (from ${new Date(oldestSnapshot.timestamp).toISOString()} to ${new Date(newestSnapshot.timestamp).toISOString()})`);
        console.log(`🔍 [BalanceChart] Requested hours: ${hours === null ? 'ALLES (all snapshots)' : hours + ' hours'}`);
        
        logger.log(`📊 [BalanceChart] Using ${snapshots.length} snapshots`);
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

        console.log(`🔍 [BalanceChart] Final chart data points: ${data.length}`);
        console.log(`🔍 [BalanceChart] Data point timestamps:`, data.map(d => new Date(d.timestamp).toISOString()));
        console.log(`🔍 [BalanceChart] Data point balances:`, data.map(d => `$${d.balance.toFixed(2)}`));

        const balances = data.map(d => d.balance);
        const min = Math.min(...balances);
        const max = Math.max(...balances);
        const padding = (max - min) * 0.1;

        console.log(`🔍 [BalanceChart] Chart min: $${min.toFixed(2)}, max: $${max.toFixed(2)}, padding: $${padding.toFixed(2)}`);

        setChartData(data);
        setMinValue(Math.max(0, min - padding));
        setMaxValue(max + padding);
        setUseReconstruction(false);
        setIsLoading(false);
        logger.log(`✅ [BalanceChart] Chart data loaded (${data.length} points)`);
        console.log(`🔍 [BalanceChart] ========== SNAPSHOTS PATH COMPLETE ==========`);
        return;
      }
      
      // No snapshots OR snapshots don't have enough time span - use reconstruction
      const reason = snapshots.length === 0 
        ? `No snapshots found (${snapshots.length})`
        : `Snapshots exist but don't have enough time span for ${selectedTimeframe}`;
      console.log(`🔍 [BalanceChart] ========== USING RECONSTRUCTION ==========`);
      console.log(`🔍 [BalanceChart] ${reason}, attempting portfolio reconstruction`);
      console.log(`🔍 [BalanceChart] Reconstruction params: timeframe=${selectedTimeframe}, tokens=${tokens.length}, nativeBalance=${nativeBalance}, nativeSymbol=${chainInfo.nativeCurrency.symbol}, chain=${chain}`);
      logger.log(`📊 [BalanceChart] ${reason}, attempting portfolio reconstruction for ${selectedTimeframe}`);
      logger.log(`📊 [BalanceChart] Tokens: ${tokens.length}, Native balance: ${nativeBalance}`);
      setUseReconstruction(true);
      
      try {
        console.log(`🔍 [BalanceChart] Calling reconstructPortfolioHistory...`);
        const reconstructed = await reconstructPortfolioHistory(
          tokens || [],
          nativeBalance || '0',
          chainInfo.nativeCurrency.symbol,
          chain,
          selectedTimeframe
        );
        
        console.log(`🔍 [BalanceChart] Reconstruction returned ${reconstructed.length} points`);
        console.log(`🔍 [BalanceChart] Reconstruction point details:`);
        reconstructed.forEach((s, i) => {
          const date = new Date(s.timestamp);
          const ageHours = (Date.now() - s.timestamp) / (1000 * 60 * 60);
          console.log(`🔍 [BalanceChart]   Point ${i + 1}: timestamp=${s.timestamp} (${date.toISOString()}), balance=$${s.balance.toFixed(2)}, age=${ageHours.toFixed(2)} hours`);
        });
        
        if (reconstructed.length > 0) {
          const oldestPoint = reconstructed[0];
          const newestPoint = reconstructed[reconstructed.length - 1];
          const timeSpanHours = (newestPoint.timestamp - oldestPoint.timestamp) / (1000 * 60 * 60);
          console.log(`🔍 [BalanceChart] Reconstruction time span: ${timeSpanHours.toFixed(2)} hours (from ${new Date(oldestPoint.timestamp).toISOString()} to ${new Date(newestPoint.timestamp).toISOString()})`);
          console.log(`🔍 [BalanceChart] Expected timeframe: ${selectedTimeframe}`);
          
          logger.log(`📊 [BalanceChart] Reconstruction returned ${reconstructed.length} points`);
          
          const data = reconstructed.map(s => ({
            timestamp: s.timestamp,
            balance: s.balance,
            time: selectedTimeframe === 'LIVE' || selectedTimeframe === '1D'
              ? new Date(s.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
              : new Date(s.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
          }));
          
          console.log(`🔍 [BalanceChart] Mapped data points: ${data.length}`);
          console.log(`🔍 [BalanceChart] Data point timestamps:`, data.map(d => new Date(d.timestamp).toISOString()));
          console.log(`🔍 [BalanceChart] Data point balances:`, data.map(d => `$${d.balance.toFixed(2)}`));
          
          // Ensure we have at least 2 points for a line
          if (data.length === 1) {
            console.log(`🔍 [BalanceChart] Only 1 data point, adding duplicate point for line rendering`);
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
          
          console.log(`🔍 [BalanceChart] Chart min: $${min.toFixed(2)}, max: $${max.toFixed(2)}, padding: $${padding.toFixed(2)}`);
          
          setChartData(data);
          setMinValue(Math.max(0, min - padding));
          setMaxValue(max + padding);
          setUseReconstruction(true);
          setIsLoading(false);
          logger.log(`✅ [BalanceChart] Chart data loaded from reconstruction (${data.length} points)`);
          console.log(`🔍 [BalanceChart] ========== RECONSTRUCTION PATH COMPLETE ==========`);
          return;
        } else {
          console.log(`🔍 [BalanceChart] ⚠️ Reconstruction returned 0 points - this is a problem!`);
          logger.warn(`⚠️ [BalanceChart] Reconstruction returned 0 points`);
        }
      } catch (error) {
        console.error(`🔍 [BalanceChart] ❌ Reconstruction failed with error:`, error);
        logger.error('❌ [BalanceChart] Reconstruction failed:', error);
      }
      
      // Fallback: single point with current balance
      console.log(`🔍 [BalanceChart] ========== USING FALLBACK ==========`);
      console.log(`🔍 [BalanceChart] Using fallback: single point with current balance`);
      logger.log(`📊 [BalanceChart] Using fallback: single point with current balance`);
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
      console.log(`🔍 [BalanceChart] ========== FALLBACK PATH COMPLETE ==========`);
    };

    loadChartData();

    // ✅ OPTIMIZED: For LIVE timeframe, update every 10 seconds for true live feel
    if (selectedTimeframe === 'LIVE') {
      const interval = setInterval(() => {
        logger.log(`📊 [BalanceChart] LIVE interval triggered - reloading chart data`);
        loadChartData();
      }, 10000); // ✅ Changed from 30s to 10s for faster updates
      return () => clearInterval(interval);
    }
  }, [selectedTimeframe, currentBalance, address, chain, portfolioHistory, chainInfo, tokensKey, nativeBalanceKey]); 
  // ✅ Added tokensKey and nativeBalanceKey to trigger reload when tokens/balance become available
  // This ensures reconstruction runs when tokens are loaded, without triggering on every price update

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
              {/* Compact Chart - 120px height */}
              <div className="h-[120px] -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="transparent"
                      tickLine={false}
                      axisLine={false}
                      tick={false}
                      hide={true}
                    />
                    <YAxis
                      stroke="transparent"
                      tickLine={false}
                      axisLine={false}
                      tick={false}
                      hide={true}
                      domain={[minValue, maxValue]}
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

