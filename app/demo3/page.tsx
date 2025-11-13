'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, MoreHorizontal, TrendingUp, Zap, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Demo3() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Clean & Minimal */}
      <div className="border-b border-gray-200/50 bg-white">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">SOL</div>
              <div className="text-xs text-gray-500 font-mono">Hz4Y...DcMX</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <button className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center transition-colors">
              <MoreHorizontal className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Portfolio Value - BIG & BOLD */}
        <div className="bg-white border border-gray-200/50 p-6">
          <div className="flex items-baseline gap-3 mb-2">
            <div className="text-6xl font-bold tracking-tight text-gray-900">$13.92</div>
            <div className="flex items-center gap-1 text-sm text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-semibold">0.00%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Eye className="w-3.5 h-3.5" />
            <span className="font-mono">0.07101293 SOL</span>
          </div>
        </div>

        {/* Chart - Clean bars */}
        <div className="bg-white border border-gray-200/50 p-4">
          <div className="h-32 flex items-end justify-between gap-1 mb-4">
            {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${height}%`, opacity: 1 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className={`flex-1 ${
                  selectedTimeframe === '1d' && i === 11
                    ? 'bg-gradient-to-t from-blue-500 to-blue-600'
                    : 'bg-gray-200 hover:bg-gray-300'
                } transition-colors cursor-pointer`}
              />
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex items-center gap-1">
            {['1u', '1d', '3d', '1w', '1m', 'All'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedTimeframe === tf
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons - Blue accent only on Buy */}
        <div className="grid grid-cols-4 gap-2">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all flex flex-col items-center justify-center gap-2 text-white shadow-lg shadow-blue-500/20"
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-semibold">Buy</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-white border border-gray-200/50 hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 text-gray-700"
          >
            <ArrowUpRight className="w-5 h-5" />
            <span className="text-xs font-semibold">Send</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-white border border-gray-200/50 hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 text-gray-700"
          >
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-xs font-semibold">Receive</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-white border border-gray-200/50 hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 text-gray-700"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-xs font-semibold">Swap</span>
          </motion.button>
        </div>

        {/* BLAZE Presale */}
        <motion.div
          whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          className="bg-white border border-orange-200/50 p-4 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">BLAZE Presale</div>
                <div className="text-xs text-gray-500">Early access to tokens</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400" />
          </div>
        </motion.div>

        {/* Assets */}
        <div>
          <div className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-widest px-1">
            ASSETS
          </div>

          <div className="space-y-2">
            {/* Solana */}
            <motion.div
              whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              className="bg-white border border-gray-200/50 p-4 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600" />
                  <div>
                    <div className="font-semibold text-gray-900">Solana</div>
                    <div className="text-xs text-gray-500 font-mono">0.0710 SOL</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">$11.07</div>
                  <div className="text-xs font-semibold text-emerald-600">+0.00%</div>
                </div>
              </div>
            </motion.div>

            {/* NPC Solana */}
            <motion.div
              whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              className="bg-white border border-gray-200/50 p-4 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600" />
                  <div>
                    <div className="font-semibold text-gray-900">NPC Solana</div>
                    <div className="text-xs text-gray-500 font-mono">652.5584 NPCS</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">$1.06</div>
                  <div className="text-xs font-semibold text-red-600">-3.5%</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Add tokens */}
        <button className="w-full py-3 bg-white border border-gray-200/50 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
          + Add tokens
        </button>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200/50 bg-white">
        <div className="max-w-md mx-auto px-4">
          <div className="grid grid-cols-5">
            <button className="flex flex-col items-center gap-1 py-3 text-blue-600">
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Wallet</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-gray-500 hover:text-gray-700 transition-colors">
              <Bot className="w-5 h-5" />
              <span className="text-[10px] font-semibold">AI</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-gray-500 hover:text-gray-700 transition-colors">
              <Flame className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Blaze</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-gray-500 hover:text-gray-700 transition-colors">
              <Clock className="w-5 h-5" />
              <span className="text-[10px] font-semibold">History</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-gray-500 hover:text-gray-700 transition-colors">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 text-center">
          <div className="text-xs font-semibold">
            DEMO 3: LIGHT • MINIMAL • BLUE ACCENT • SHARP • NO EMOJIS
          </div>
        </div>
      </div>
    </div>
  );
}

