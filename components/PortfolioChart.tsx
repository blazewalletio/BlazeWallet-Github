'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';

interface PortfolioChartProps {
  data?: number[];
  timeframe?: '1D' | '1W' | '1M' | '1Y';
}

export default function PortfolioChart({ data, timeframe = '1D' }: PortfolioChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  // Mock data - in productie zou dit echte historische data zijn
  const mockData = Array.from({ length: 24 }, (_, i) => 
    1000 + Math.random() * 200 + i * 10
  );

  const chartData = data || mockData;
  const maxValue = Math.max(...chartData);
  const minValue = Math.min(...chartData);

  const timeframes = ['1D', '1W', '1M', '1Y', 'ALL'];

  return (
    <div className="glass-card">
      {/* Timeframe Selector */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Portfolio</h3>
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <motion.button
              key={tf}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedTimeframe(tf as any)}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                selectedTimeframe === tf
                  ? 'bg-primary-500 text-white'
                  : 'glass hover:bg-theme-bg-secondary'
              }`}
            >
              {tf}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 flex items-end gap-1">
        {chartData.map((value, index) => {
          const height = ((value - minValue) / (maxValue - minValue)) * 100;
          return (
            <motion.div
              key={index}
              initial={{ height: 0 }}
              animate={{ height: `${height}%` }}
              transition={{ delay: index * 0.02, duration: 0.5 }}
              className="flex-1 bg-gradient-to-t from-primary-500 to-primary-300 rounded-t cursor-pointer hover:opacity-80 transition-opacity"
              title={`$${value.toFixed(2)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
