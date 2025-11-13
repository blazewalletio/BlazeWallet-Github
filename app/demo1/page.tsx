'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Zap, TrendingUp, Eye } from 'lucide-react';
import { useState } from 'react';

export default function Demo1() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30 p-4">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white font-black text-lg">B</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">SOL</div>
              <div className="text-[10px] text-gray-500 font-mono">Hz4Yqp...DcMX</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-sm bg-white/60 backdrop-blur-lg border border-white/40 flex items-center justify-center hover:bg-white/80 transition-all">
              <RefreshCw className="w-4 h-4 text-gray-700" />
            </button>
            <button className="w-9 h-9 rounded-sm bg-white/60 backdrop-blur-lg border border-white/40 flex items-center justify-center hover:bg-white/80 transition-all">
              <span className="text-gray-700">⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto space-y-3">
        {/* Portfolio Card - Glassmorphism with Sharp Corners */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="bg-white/90 backdrop-blur-2xl border border-white/40 rounded-sm shadow-[0_8px_32px_rgba(14,165,233,0.08)] overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gray-400 mb-2">
                  PORTFOLIO VALUE
                </div>
                <div className="text-5xl font-black tracking-tight text-gray-900 mb-1">
                  $13.92
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-500">+0.00% today</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-gradient-to-r from-blue-400/10 to-purple-400/10 border border-blue-200/30">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-500" />
                <span className="text-xs font-bold text-gray-700">SOL</span>
              </div>
            </div>

            {/* Native Balance */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-mono">0.07101293 SOL Native balance</span>
            </div>

            {/* Chart Placeholder */}
            <div className="h-32 mb-4 rounded-sm bg-gradient-to-br from-blue-50 to-purple-50 flex items-end justify-around p-4">
              {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95].map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="w-2 bg-gradient-to-t from-blue-400 to-purple-400 rounded-t-sm"
                />
              ))}
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              {['1u', '1d', '3d', '1w', '1m', 'Alles'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-all ${
                    selectedTimeframe === tf
                      ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-lg'
                      : 'bg-white/60 text-gray-600 hover:bg-white/80'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Action Buttons Grid - 4 Different Gradient Colors! */}
        <div className="grid grid-cols-4 gap-2">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 12px 40px rgba(59,130,246,0.3)" }}
            whileTap={{ scale: 0.95 }}
            className="aspect-square rounded-sm bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 text-white"
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-xs font-bold">Buy</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 12px 40px rgba(244,114,182,0.3)" }}
            whileTap={{ scale: 0.95 }}
            className="aspect-square rounded-sm bg-gradient-to-br from-pink-400 to-pink-500 shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 text-white"
          >
            <ArrowUpRight className="w-6 h-6" />
            <span className="text-xs font-bold">Send</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 12px 40px rgba(45,212,191,0.3)" }}
            whileTap={{ scale: 0.95 }}
            className="aspect-square rounded-sm bg-gradient-to-br from-teal-400 to-emerald-500 shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 text-white"
          >
            <ArrowDownLeft className="w-6 h-6" />
            <span className="text-xs font-bold">Receive</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 12px 40px rgba(192,132,252,0.3)" }}
            whileTap={{ scale: 0.95 }}
            className="aspect-square rounded-sm bg-gradient-to-br from-purple-400 to-purple-500 shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2 text-white"
          >
            <RefreshCw className="w-6 h-6" />
            <span className="text-xs font-bold">Swap</span>
          </motion.button>
        </div>

        {/* BLAZE Presale - Glassmorphism */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="bg-gradient-to-r from-amber-400/20 to-orange-400/20 backdrop-blur-xl border border-amber-200/40 rounded-sm p-4 cursor-pointer hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-sm bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900">BLAZE Presale</div>
                <div className="text-xs text-gray-600">Early access to tokens</div>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gray-400" />
          </div>
        </motion.div>

        {/* Assets List */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gray-400 px-1">
            ASSETS
          </div>

          {/* Solana Asset */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="bg-white/60 backdrop-blur-lg border border-white/30 rounded-sm p-4 hover:bg-white/80 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white text-lg">◎</span>
                </div>
                <div>
                  <div className="font-bold text-gray-900">Solana</div>
                  <div className="text-xs text-gray-500 font-mono">0.0710 SOL</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">$11.07</div>
                <div className="text-xs font-semibold text-emerald-500">+0.00%</div>
              </div>
            </div>
          </motion.div>

          {/* NPC Solana Asset */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="bg-white/60 backdrop-blur-lg border border-white/30 rounded-sm p-4 hover:bg-white/80 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                  <span className="text-white text-lg">🧑</span>
                </div>
                <div>
                  <div className="font-bold text-gray-900">NPC Solana</div>
                  <div className="text-xs text-gray-500 font-mono">652.5584 NPCS</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">$1.06</div>
                <div className="text-xs font-semibold text-red-500">-3.5%</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Add Tokens Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-sm bg-white/60 backdrop-blur-lg border border-white/30 text-gray-700 font-semibold text-sm hover:bg-white/80 transition-all"
        >
          + Add tokens
        </motion.button>
      </div>

      {/* Bottom Navigation */}
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-white/90 backdrop-blur-2xl border border-white/40 rounded-sm shadow-lg p-2">
          <div className="grid grid-cols-5 gap-1">
            {[
              { icon: '💰', label: 'Wallet', active: true },
              { icon: '🤖', label: 'AI Tools', active: false },
              { icon: '🔥', label: 'Blaze', active: false },
              { icon: '📊', label: 'History', active: false },
              { icon: '⚙️', label: 'Settings', active: false },
            ].map((item) => (
              <button
                key={item.label}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-sm transition-all ${
                  item.active
                    ? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white'
                    : 'text-gray-600 hover:bg-white/60'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[9px] font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Design Info Badge */}
      <div className="max-w-md mx-auto mt-6">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-sm p-4 text-white text-center">
          <div className="text-xs font-bold mb-1">🎨 BLAZE WALLET 2.0 - MODERN REDESIGN</div>
          <div className="text-[10px] opacity-80">
            Sharp Corners • Glassmorphism • Pastel Gradients • Bento Grid • 4-Color Action Buttons
          </div>
        </div>
      </div>
    </div>
  );
}

