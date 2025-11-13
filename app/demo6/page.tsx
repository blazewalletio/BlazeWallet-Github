'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, TrendingUp, ChevronDown, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Demo6() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Spacious Header */}
      <div className="bg-white">
        <div className="max-w-md mx-auto px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600" />
              <div>
                <div className="text-base font-bold text-gray-900">Solana</div>
                <div className="text-xs text-gray-400 font-mono">0.07101293 SOL</div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors">
              <span className="text-xs font-semibold text-gray-700">Switch</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-6 space-y-6">
        {/* Portfolio - Zen layout */}
        <div className="bg-white border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Total Balance
            </div>
            <button className="w-7 h-7 hover:bg-gray-50 flex items-center justify-center transition-colors">
              <Eye className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          <div className="mb-6">
            <div className="text-5xl font-black tracking-tight text-gray-900 mb-2">
              $13.92
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-600">+0.00%</span>
              </div>
              <span className="text-xs text-gray-500">Last 24 hours</span>
            </div>
          </div>

          {/* Elegant chart */}
          <div className="h-28 flex items-end gap-1 mb-5">
            {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92].map((height, i) => (
              <motion.div
                key={i}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: 'easeOut' }}
                className="flex-1 origin-bottom"
                style={{ 
                  height: `${height}%`,
                  background: i === 11 
                    ? 'linear-gradient(to top, #3b82f6, #60a5fa)' 
                    : '#f3f4f6'
                }}
              />
            ))}
          </div>

          {/* Spaced timeframe */}
          <div className="flex items-center gap-2">
            {['1 hour', '1 day', '1 week', '1 month', 'All time'].map((tf, index) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(['1h', '1d', '1w', '1m', 'All'][index])}
                className={`flex-1 py-2 text-[10px] font-bold transition-all ${
                  selectedTimeframe === ['1h', '1d', '1w', '1m', 'All'][index]
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {['1H', '1D', '1W', '1M', 'ALL'][index]}
              </button>
            ))}
          </div>
        </div>

        {/* Spacious Actions */}
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 p-5 transition-all shadow-lg shadow-blue-500/20"
          >
            <CreditCard className="w-6 h-6 text-white mb-3" />
            <div className="text-left">
              <div className="text-base font-bold text-white mb-0.5">Buy Crypto</div>
              <div className="text-[10px] text-white/80">Instant with card</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md p-5 transition-all"
          >
            <ArrowUpRight className="w-6 h-6 text-gray-900 mb-3" />
            <div className="text-left">
              <div className="text-base font-bold text-gray-900 mb-0.5">Send</div>
              <div className="text-[10px] text-gray-500">Transfer funds</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md p-5 transition-all"
          >
            <ArrowDownLeft className="w-6 h-6 text-gray-900 mb-3" />
            <div className="text-left">
              <div className="text-base font-bold text-gray-900 mb-0.5">Receive</div>
              <div className="text-[10px] text-gray-500">Get paid easily</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md p-5 transition-all"
          >
            <RefreshCw className="w-6 h-6 text-gray-900 mb-3" />
            <div className="text-left">
              <div className="text-base font-bold text-gray-900 mb-0.5">Swap</div>
              <div className="text-[10px] text-gray-500">Exchange tokens</div>
            </div>
          </motion.button>
        </div>

        {/* BLAZE Presale - Spacious */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 p-5 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-base font-bold text-gray-900 mb-0.5">BLAZE Presale</div>
              <div className="text-xs text-gray-600">Early access to exclusive tokens</div>
            </div>
            <div className="text-xs font-bold text-orange-600 bg-white px-3 py-1.5 border border-orange-200">
              Join →
            </div>
          </div>
        </motion.button>

        {/* Assets - Spacious cards */}
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-1">
            Your Assets
          </div>
          <div className="space-y-3">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md p-4 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-600" />
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-0.5">Solana</div>
                    <div className="text-xs text-gray-500 font-mono">0.0710 SOL</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 mb-0.5">$11.07</div>
                  <div className="text-xs font-bold text-emerald-600">+0.00%</div>
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md p-4 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-cyan-600" />
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-0.5">NPC Solana</div>
                    <div className="text-xs text-gray-500 font-mono">652.5584 NPCS</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 mb-0.5">$1.06</div>
                  <div className="text-xs font-bold text-red-600">-3.5%</div>
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Spacious Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100">
        <div className="max-w-md mx-auto px-6">
          <div className="grid grid-cols-5 gap-2 py-3">
            <button className="flex flex-col items-center gap-1.5 text-blue-600">
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] font-bold">Wallet</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Bot className="w-5 h-5" />
              <span className="text-[10px] font-bold">AI</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Flame className="w-5 h-5" />
              <span className="text-[10px] font-bold">Blaze</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Clock className="w-5 h-5" />
              <span className="text-[10px] font-bold">History</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-bold">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="fixed top-4 left-0 right-0 pointer-events-none">
        <div className="max-w-md mx-auto px-6">
          <div className="bg-white border border-gray-200 px-3 py-2 text-center text-[10px] font-bold text-gray-700 inline-block shadow-sm">
            DEMO 6: SPACIOUS ZEN • BREATHING ROOM • PREMIUM
          </div>
        </div>
      </div>
    </div>
  );
}

