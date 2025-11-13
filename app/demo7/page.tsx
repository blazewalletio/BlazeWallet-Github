'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, EyeOff, ChevronRight, TrendingUp, Plus, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState, useRef } from 'react';

export default function Demo7() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
  const [showBalance, setShowBalance] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 50], [0, 1]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Smart Header - appears on scroll */}
      <motion.div 
        style={{ opacity: headerOpacity }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-100"
      >
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">$13.92</span>
          <button className="flex items-center gap-2 px-3 h-8 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors">
            <span>SOL</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div ref={scrollRef} className="max-w-md mx-auto">
        {/* Portfolio Hero - Full bleed */}
        <div className="bg-white px-4 pt-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600" />
              <div>
                <div className="text-sm font-bold text-gray-900">Solana</div>
                <div className="text-xs text-gray-400">Main Wallet</div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowBalance(!showBalance)}
              className="w-9 h-9 hover:bg-gray-50 flex items-center justify-center transition-colors"
            >
              {showBalance ? (
                <Eye className="w-4.5 h-4.5 text-gray-600" />
              ) : (
                <EyeOff className="w-4.5 h-4.5 text-gray-600" />
              )}
            </motion.button>
          </div>

          {/* Balance */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-2">Total Balance</div>
            <div className="flex items-baseline gap-3 mb-3">
              <motion.div
                initial={false}
                animate={{ opacity: showBalance ? 1 : 0.3 }}
                className="text-6xl font-black tracking-tight text-gray-900"
              >
                {showBalance ? '$13.92' : '••••'}
              </motion.div>
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-600">+0.00%</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">≈ 0.071 SOL</div>
          </div>

          {/* Chart */}
          <div className="mb-4">
            <div className="h-24 flex items-end gap-0.5 mb-3">
              {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92].map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ 
                    delay: i * 0.03, 
                    duration: 0.4,
                    ease: [0.23, 1, 0.32, 1] // Custom easing
                  }}
                  className="flex-1 origin-bottom rounded-t-sm"
                  style={{ 
                    height: `${height}%`,
                    background: i === 11 
                      ? 'linear-gradient(to top, #3b82f6, #60a5fa)' 
                      : '#e5e7eb'
                  }}
                />
              ))}
            </div>

            {/* Timeframe Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
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
                  onClick={() => setSelectedTimeframe(value)}
                  className={`flex-shrink-0 px-4 py-2 text-xs font-bold transition-all ${
                    selectedTimeframe === value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions - Mobile optimized */}
        <div className="px-4 py-5 space-y-3">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 px-5 flex items-center justify-between transition-all shadow-lg shadow-blue-500/25"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">Buy Crypto</div>
                <div className="text-xs text-white/80">With card or bank</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60" />
          </motion.button>

          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="h-20 bg-white hover:bg-gray-50 border border-gray-200 flex flex-col items-center justify-center gap-2 transition-all"
            >
              <ArrowUpRight className="w-5 h-5 text-gray-900" />
              <span className="text-xs font-bold text-gray-900">Send</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="h-20 bg-white hover:bg-gray-50 border border-gray-200 flex flex-col items-center justify-center gap-2 transition-all"
            >
              <ArrowDownLeft className="w-5 h-5 text-gray-900" />
              <span className="text-xs font-bold text-gray-900">Receive</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="h-20 bg-white hover:bg-gray-50 border border-gray-200 flex flex-col items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-5 h-5 text-gray-900" />
              <span className="text-xs font-bold text-gray-900">Swap</span>
            </motion.button>
          </div>
        </div>

        {/* BLAZE Presale */}
        <div className="px-4 pb-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-16 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 px-5 flex items-center justify-between transition-all shadow-lg shadow-orange-500/25"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">BLAZE Presale</div>
                <div className="text-xs text-white/80">Limited time offer</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>

        {/* Assets */}
        <div className="bg-white">
          <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100">
            <div className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Assets (2)
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-3 h-8 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </motion.button>
          </div>

          <motion.button
            whileHover={{ backgroundColor: '#f9fafb' }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-4 py-4 flex items-center justify-between transition-all border-b border-gray-50"
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
            whileHover={{ backgroundColor: '#f9fafb' }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-4 py-4 flex items-center justify-between transition-all"
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

      {/* Bottom Nav - Native feel */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-inset-bottom">
        <div className="max-w-md mx-auto px-2 pt-2 pb-1">
          <div className="grid grid-cols-5 gap-1">
            {[
              { icon: Wallet, label: 'Wallet', active: true },
              { icon: Bot, label: 'AI Tools', active: false },
              { icon: Flame, label: 'Blaze', active: false },
              { icon: Clock, label: 'History', active: false },
              { icon: Settings, label: 'Settings', active: false },
            ].map(({ icon: Icon, label, active }) => (
              <motion.button
                key={label}
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center py-2 transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

