'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, EyeOff, Zap, TrendingUp, Plus, Wallet, Bot, Flame, Clock, Settings, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export default function Demo9() {
  const [showBalance, setShowBalance] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('1d');

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header - Clean light with blue accent */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            {/* BLAZE Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <span className="text-white font-black text-lg">B</span>
              </div>
              <div>
                <div className="text-sm font-black text-gray-900">BLAZE</div>
                <div className="text-[10px] text-gray-500">Crypto Wallet</div>
              </div>
            </div>

            {/* Chain pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
              <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600" />
              <span className="text-xs font-bold text-gray-900">SOL</span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-5 py-5 pb-24 space-y-4">
        {/* Balance Card - White with blue accent */}
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Total Balance
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={showBalance ? 'shown' : 'hidden'}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-5xl font-black tracking-tight text-gray-900 mb-2">
                    {showBalance ? '$13.92' : '••••••'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200">
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-600">+0.00%</span>
                    </div>
                    <span className="text-xs text-gray-400">24h</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowBalance(!showBalance)}
              className="w-9 h-9 bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center transition-colors"
            >
              {showBalance ? (
                <Eye className="w-4 h-4 text-gray-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-600" />
              )}
            </motion.button>
          </div>

          {/* Chart */}
          <div className="mb-4">
            <div className="h-28 flex items-end gap-0.5 mb-3">
              {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92, 85, 80].map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ 
                    delay: i * 0.02, 
                    duration: 0.3,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  className="flex-1 origin-bottom"
                  style={{ 
                    height: `${height}%`,
                    background: i === 11 
                      ? 'linear-gradient(to top, #2563eb, #3b82f6)' 
                      : '#E5E7EB'
                  }}
                />
              ))}
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-1.5">
              {[
                { label: '1H', value: '1h' },
                { label: '1D', value: '1d' },
                { label: '1W', value: '1w' },
                { label: '1M', value: '1m' },
                { label: 'ALL', value: 'all' },
              ].map(({ label, value }) => (
                <motion.button
                  key={value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedPeriod(value)}
                  className={`flex-1 py-2 text-xs font-bold transition-all ${
                    selectedPeriod === value
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="text-xs text-gray-500 font-mono">
            ≈ 0.071 SOL • Main Wallet
          </div>
        </div>

        {/* Quick Buy - Blue accent CTA */}
        <motion.button
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all relative overflow-hidden group shadow-lg shadow-blue-600/25"
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          
          <div className="relative flex items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">Quick Buy</div>
                <div className="text-xs text-white/80">Instant with card or bank</div>
              </div>
            </div>
            <div className="text-xs font-bold text-white bg-white/20 px-3 py-1.5">
              →
            </div>
          </div>
        </motion.button>

        {/* Actions Grid */}
        <div className="grid grid-cols-3 gap-3">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="h-24 bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-gray-900">Send</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="h-24 bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2"
          >
            <ArrowDownLeft className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-gray-900">Receive</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="h-24 bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-gray-900">Swap</span>
          </motion.button>
        </div>

        {/* BLAZE Presale - Accent card */}
        <motion.button
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full h-16 bg-blue-50 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between px-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900">BLAZE Presale</div>
              <div className="text-xs text-gray-600">Limited slots • Early access</div>
            </div>
          </div>
          <div className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 border border-blue-200">
            JOIN
          </div>
        </motion.button>

        {/* Assets */}
        <div className="bg-white border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Your Assets (2)
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-2.5 h-7 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </motion.button>
          </div>

          <motion.button
            whileHover={{ backgroundColor: '#F9FAFB' }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-5 py-4 border-b border-gray-100 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-600" />
              <div className="text-left">
                <div className="text-sm font-bold text-gray-900">Solana</div>
                <div className="text-xs text-gray-500">0.0710 SOL</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">$11.07</div>
              <div className="text-xs font-bold text-emerald-600">+0.00%</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ backgroundColor: '#F9FAFB' }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-5 py-4 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-cyan-600" />
              <div className="text-left">
                <div className="text-sm font-bold text-gray-900">NPC Solana</div>
                <div className="text-xs text-gray-500">652.5584 NPCS</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">$1.06</div>
              <div className="text-xs font-bold text-red-600">-3.5%</div>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Bottom Nav - Clean light */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 safe-area-inset-bottom">
        <div className="max-w-md mx-auto px-2 pt-2 pb-1">
          <div className="grid grid-cols-5 gap-1">
            {[
              { icon: Wallet, label: 'Wallet', active: true },
              { icon: Bot, label: 'AI', active: false },
              { icon: Flame, label: 'Blaze', active: false },
              { icon: Clock, label: 'History', active: false },
              { icon: Settings, label: 'Settings', active: false },
            ].map(({ icon: Icon, label, active }) => (
              <motion.button
                key={label}
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center py-2 transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600"
                  />
                )}
                <Icon className={`w-6 h-6 mb-1 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-[10px] font-bold ${active ? 'text-blue-600' : 'text-gray-500'}`}>
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="fixed top-4 left-0 right-0 pointer-events-none z-50">
        <div className="max-w-md mx-auto px-5">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 text-[10px] font-bold shadow-lg">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            DEMO 9: BLAZE SIGNATURE (LIGHT + BLUE)
          </div>
        </div>
      </div>
    </div>
  );
}

