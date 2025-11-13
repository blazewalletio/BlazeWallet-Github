'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, MoreHorizontal, TrendingUp, Zap, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Demo2() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - Ultra minimal */}
      <div className="border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500" />
            <div>
              <div className="text-sm font-medium">SOL</div>
              <div className="text-xs text-white/40 font-mono">Hz4Y...DcMX</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 hover:bg-white/5 flex items-center justify-center transition-colors">
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
            <button className="w-8 h-8 hover:bg-white/5 flex items-center justify-center transition-colors">
              <MoreHorizontal className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Portfolio Value - BRUTAL MINIMALISM */}
        <div>
          <div className="flex items-baseline gap-3 mb-2">
            <div className="text-6xl font-bold tracking-tight">$13.92</div>
            <div className="flex items-center gap-1 text-sm text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-medium">0.00%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Eye className="w-3.5 h-3.5" />
            <span className="font-mono">0.07101293 SOL</span>
          </div>
        </div>

        {/* Chart - Minimal bars */}
        <div>
          <div className="h-32 flex items-end justify-between gap-1 mb-3">
            {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${height}%`, opacity: 1 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className={`flex-1 ${
                  selectedTimeframe === '1d' && i === 11
                    ? 'bg-blue-500'
                    : 'bg-white/10 hover:bg-white/20'
                } transition-colors cursor-pointer`}
              />
            ))}
          </div>

          {/* Timeframe - Minimal pills */}
          <div className="flex items-center gap-1">
            {['1u', '1d', '3d', '1w', '1m', 'All'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTimeframe === tf
                    ? 'bg-white text-black'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons - MONOCHROME with single accent */}
        <div className="grid grid-cols-4 gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-blue-500 hover:bg-blue-400 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-medium">Buy</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-5 h-5" />
            <span className="text-xs font-medium">Send</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-xs font-medium">Receive</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="aspect-square bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-xs font-medium">Swap</span>
          </motion.button>
        </div>

        {/* BLAZE Presale - Subtle */}
        <motion.div
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          className="border border-white/10 p-4 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="font-medium">BLAZE Presale</div>
                <div className="text-xs text-white/40">Early access</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/20" />
          </div>
        </motion.div>

        {/* Assets - Clean list */}
        <div>
          <div className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">
            Assets
          </div>

          <div className="space-y-2">
            {/* Solana */}
            <motion.div
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              className="flex items-center justify-between p-3 border border-white/5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500" />
                <div>
                  <div className="font-medium">Solana</div>
                  <div className="text-xs text-white/40 font-mono">0.0710 SOL</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">$11.07</div>
                <div className="text-xs text-emerald-400">+0.00%</div>
              </div>
            </motion.div>

            {/* NPC Solana */}
            <motion.div
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              className="flex items-center justify-between p-3 border border-white/5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500" />
                <div>
                  <div className="font-medium">NPC Solana</div>
                  <div className="text-xs text-white/40 font-mono">652.5584 NPCS</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">$1.06</div>
                <div className="text-xs text-red-400">-3.5%</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Add tokens */}
        <button className="w-full py-3 border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
          + Add tokens
        </button>
      </div>

      {/* Bottom Nav - Minimal with REAL ICONS */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/5 bg-black">
        <div className="max-w-md mx-auto px-4">
          <div className="grid grid-cols-5">
            <button className="flex flex-col items-center gap-1 py-3 text-white">
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] font-medium">Wallet</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-white/40 hover:text-white/60 transition-colors">
              <Bot className="w-5 h-5" />
              <span className="text-[10px] font-medium">AI</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-white/40 hover:text-white/60 transition-colors">
              <Flame className="w-5 h-5" />
              <span className="text-[10px] font-medium">Blaze</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-white/40 hover:text-white/60 transition-colors">
              <Clock className="w-5 h-5" />
              <span className="text-[10px] font-medium">History</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 text-white/40 hover:text-white/60 transition-colors">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-medium">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="border border-blue-500/30 bg-blue-500/10 p-3 text-center">
          <div className="text-xs font-medium text-blue-400">
            DEMO 2: DARK • MINIMAL • MONOCHROME • NO EMOJIS • GROWN-UP
          </div>
        </div>
      </div>
    </div>
  );
}

