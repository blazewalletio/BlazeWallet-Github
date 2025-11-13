'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, TrendingUp, Plus, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Demo5() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600" />
            <span className="text-xs font-bold text-gray-900">SOL</span>
            <span className="text-[10px] text-gray-400 font-mono">0.0710</span>
          </div>
          <div className="flex items-center gap-1">
            {['1h', '1d', '1w', '1m'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2 py-1 text-[10px] font-bold transition-colors ${
                  selectedTimeframe === tf
                    ? 'text-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto pb-20">
        {/* Ultra Compact Portfolio */}
        <div className="bg-white border-b border-gray-100 px-4 py-4">
          <div className="flex items-baseline gap-2 mb-2">
            <div className="text-4xl font-black tracking-tight text-gray-900">$13.92</div>
            <div className="flex items-center gap-1 text-[11px]">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="font-bold text-emerald-500">0.00%</span>
            </div>
          </div>
          
          {/* Mini inline chart */}
          <div className="h-12 flex items-end gap-px mb-2">
            {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92].map((height, i) => (
              <motion.div
                key={i}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.015, duration: 0.2 }}
                className="flex-1 origin-bottom"
                style={{ 
                  height: `${height}%`,
                  background: i === 11 ? '#3b82f6' : '#e5e7eb'
                }}
              />
            ))}
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-4 gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Buy
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Send
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Receive
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Swap
            </motion.button>
          </div>
        </div>

        {/* BLAZE Presale - Compact banner */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white px-4 py-3 flex items-center justify-between border-b border-orange-600/20"
        >
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <div className="text-left">
              <div className="text-xs font-bold">BLAZE Presale Live</div>
              <div className="text-[10px] opacity-90">Join now • Limited time</div>
            </div>
          </div>
          <div className="text-[10px] font-bold bg-white/20 px-2 py-1">→</div>
        </motion.button>

        {/* Dense Asset List */}
        <div className="bg-white">
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Assets (2)
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600" />
              <div>
                <div className="text-xs font-bold text-gray-900">Solana</div>
                <div className="text-[10px] text-gray-500 font-mono">0.0710 SOL</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-gray-900">$11.07</div>
              <div className="text-[10px] font-bold text-emerald-600">+0.00%</div>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600" />
              <div>
                <div className="text-xs font-bold text-gray-900">NPC Solana</div>
                <div className="text-[10px] text-gray-500 font-mono">652.5584 NPCS</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-gray-900">$1.06</div>
              <div className="text-[10px] font-bold text-red-600">-3.5%</div>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-gray-600"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-bold">Add Token</span>
          </motion.button>
        </div>
      </div>

      {/* Compact Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto px-1">
          <div className="grid grid-cols-5">
            <button className="flex flex-col items-center py-2 text-blue-600">
              <Wallet className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[9px] font-bold">Wallet</span>
            </button>
            <button className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bot className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[9px] font-bold">AI</span>
            </button>
            <button className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Flame className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[9px] font-bold">Blaze</span>
            </button>
            <button className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Clock className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[9px] font-bold">History</span>
            </button>
            <button className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[9px] font-bold">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="fixed top-16 left-0 right-0 pointer-events-none">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-gray-900 text-white px-2.5 py-1.5 text-center text-[9px] font-bold inline-block">
            DEMO 5: ULTRA COMPACT • DATA DENSE • FAST
          </div>
        </div>
      </div>
    </div>
  );
}

