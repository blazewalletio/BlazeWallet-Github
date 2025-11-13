'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, ChevronRight, TrendingUp, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Demo4() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Floating style */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600" />
            <div>
              <div className="text-sm font-bold text-gray-900">Solana</div>
              <div className="text-[10px] text-gray-400 font-mono">0.0710 SOL</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="w-8 h-8 hover:bg-gray-50 flex items-center justify-center transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button className="px-3 h-8 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1">
              SOL
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 pb-24 space-y-3">
        {/* Portfolio - Bento Card (large) */}
        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Portfolio
              </div>
              <div className="text-5xl font-black tracking-tight text-gray-900 mb-1">
                $13.92
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="font-bold text-emerald-500">+0.00%</span>
                <span className="text-gray-400">today</span>
              </div>
            </div>
            <button className="w-8 h-8 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm flex items-center justify-center transition-all">
              <Eye className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          {/* Inline Chart */}
          <div className="h-20 flex items-end gap-0.5 mb-3">
            {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92].map((height, i) => (
              <motion.div
                key={i}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.02, duration: 0.3 }}
                className="flex-1 origin-bottom"
                style={{ 
                  height: `${height}%`,
                  background: i === 11 ? 'linear-gradient(to top, #3b82f6, #2563eb)' : '#e5e7eb'
                }}
              />
            ))}
          </div>

          {/* Compact timeframe */}
          <div className="flex items-center gap-1">
            {['1h', '1d', '1w', '1m', 'All'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Bento Grid: 2x2 Actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-[4/3] bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all flex flex-col items-start justify-between p-4 text-white"
          >
            <CreditCard className="w-6 h-6" />
            <div className="text-left">
              <div className="text-sm font-bold">Buy Crypto</div>
              <div className="text-[10px] opacity-80">Instant purchase</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-[4/3] bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col items-start justify-between p-4"
          >
            <ArrowUpRight className="w-6 h-6 text-gray-900" />
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900">Send</div>
              <div className="text-[10px] text-gray-500">Transfer funds</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-[4/3] bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col items-start justify-between p-4"
          >
            <ArrowDownLeft className="w-6 h-6 text-gray-900" />
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900">Receive</div>
              <div className="text-[10px] text-gray-500">Get paid</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-[4/3] bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col items-start justify-between p-4"
          >
            <RefreshCw className="w-6 h-6 text-gray-900" />
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900">Swap</div>
              <div className="text-[10px] text-gray-500">Exchange tokens</div>
            </div>
          </motion.button>
        </div>

        {/* BLAZE Presale - Compact */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 p-3.5 flex items-center justify-between transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
              <Flame className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900">BLAZE Presale</div>
              <div className="text-[10px] text-gray-600">Early access • Limited slots</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </motion.button>

        {/* Assets - List style */}
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
            Your Assets
          </div>
          <div className="space-y-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm p-3.5 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-600" />
                <div>
                  <div className="text-sm font-bold text-gray-900">Solana</div>
                  <div className="text-[10px] text-gray-500 font-mono">0.0710 SOL</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">$11.07</div>
                <div className="text-[10px] font-bold text-emerald-600">+0.00%</div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm p-3.5 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-cyan-600" />
                <div>
                  <div className="text-sm font-bold text-gray-900">NPC Solana</div>
                  <div className="text-[10px] text-gray-500 font-mono">652.5584 NPCS</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">$1.06</div>
                <div className="text-[10px] font-bold text-red-600">-3.5%</div>
              </div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Bottom Nav - Modern iOS style */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100">
        <div className="max-w-md mx-auto px-2">
          <div className="grid grid-cols-5 gap-1">
            <button className="flex flex-col items-center py-2.5 text-blue-600">
              <Wallet className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-bold">Wallet</span>
            </button>
            <button className="flex flex-col items-center py-2.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Bot className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-bold">AI</span>
            </button>
            <button className="flex flex-col items-center py-2.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Flame className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-bold">Blaze</span>
            </button>
            <button className="flex flex-col items-center py-2.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Clock className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-bold">History</span>
            </button>
            <button className="flex flex-col items-center py-2.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-bold">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="fixed bottom-20 left-0 right-0">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-blue-600 text-white px-3 py-2 text-center text-[10px] font-bold">
            DEMO 4: BENTO GRID • APPLE-STYLE • INFO-RICH
          </div>
        </div>
      </div>
    </div>
  );
}

