'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Eye, EyeOff, Zap, TrendingUp, Wallet, Bot, Flame, Clock, Settings } from 'lucide-react';
import { useState } from 'react';

export default function Demo8() {
  const [showBalance, setShowBalance] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('24h');

  return (
    <div className="min-h-screen bg-[#0A0E27]">
      {/* BLAZE Header - Signature gradient */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 opacity-90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        
        <div className="relative max-w-md mx-auto px-5 pt-6 pb-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white flex items-center justify-center font-black text-blue-600">
                B
              </div>
              <span className="text-sm font-bold text-white">BLAZE</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all"
            >
              <Settings className="w-4 h-4 text-white" />
            </motion.button>
          </div>

          {/* Balance Display */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-white/60 mb-1 uppercase tracking-wider font-bold">
                  Total Balance
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={showBalance ? 'shown' : 'hidden'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-5xl font-black text-white tracking-tight"
                  >
                    {showBalance ? '$13.92' : '••••••'}
                  </motion.div>
                </AnimatePresence>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-400/20 border border-emerald-400/30">
                    <TrendingUp className="w-3 h-3 text-emerald-300" />
                    <span className="text-xs font-bold text-emerald-300">+0.00%</span>
                  </div>
                  <span className="text-xs text-white/50">24h</span>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowBalance(!showBalance)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all"
              >
                {showBalance ? (
                  <Eye className="w-4.5 h-4.5 text-white" />
                ) : (
                  <EyeOff className="w-4.5 h-4.5 text-white" />
                )}
              </motion.button>
            </div>

            {/* Chain selector */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-xl border border-white/20">
              <div className="w-5 h-5 bg-gradient-to-br from-purple-400 to-purple-600" />
              <span className="text-xs font-bold text-white flex-1">Solana</span>
              <span className="text-xs text-white/60 font-mono">0.0710 SOL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto -mt-4">
        {/* Chart Card - BLAZE style */}
        <div className="mx-4 mb-4 bg-[#131829] border border-blue-500/20 overflow-hidden">
          {/* Period selector */}
          <div className="flex border-b border-white/5">
            {[
              { label: '1H', value: '1h' },
              { label: '24H', value: '24h' },
              { label: '7D', value: '7d' },
              { label: '30D', value: '30d' },
              { label: 'ALL', value: 'all' },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSelectedPeriod(value)}
                className={`flex-1 py-3 text-xs font-bold transition-all relative ${
                  selectedPeriod === value
                    ? 'text-blue-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {label}
                {selectedPeriod === value && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="p-4">
            <div className="h-32 flex items-end gap-1">
              {[40, 65, 45, 80, 60, 90, 70, 85, 75, 95, 88, 92, 85, 78].map((height, i) => (
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
                      ? 'linear-gradient(to top, #3b82f6, #60a5fa)' 
                      : 'rgba(255,255,255,0.05)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Actions - BLAZE signature layout */}
        <div className="px-4 mb-4">
          {/* Primary action - Full width */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-16 mb-3 bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500 relative overflow-hidden group"
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            <div className="relative flex items-center justify-between px-5">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-white" />
                <div className="text-left">
                  <div className="text-sm font-bold text-white">Quick Buy</div>
                  <div className="text-xs text-white/80">Instant with card</div>
                </div>
              </div>
              <div className="text-xs font-bold text-white bg-white/20 px-3 py-1.5">
                →
              </div>
            </div>
          </motion.button>

          {/* Secondary actions - 3 columns */}
          <div className="grid grid-cols-3 gap-3">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="h-24 bg-[#131829] border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-bold text-white">Send</span>
            </motion.button>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="h-24 bg-[#131829] border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-bold text-white">Receive</span>
            </motion.button>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="h-24 bg-[#131829] border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-bold text-white">Swap</span>
            </motion.button>
          </div>
        </div>

        {/* BLAZE Presale - Signature card */}
        <div className="mx-4 mb-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-16 bg-gradient-to-r from-orange-500 to-red-500 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative flex items-center justify-between px-5">
              <div className="flex items-center gap-3">
                <Flame className="w-6 h-6 text-white animate-pulse" />
                <div className="text-left">
                  <div className="text-sm font-bold text-white">BLAZE Presale</div>
                  <div className="text-xs text-white/80">Limited slots available</div>
                </div>
              </div>
              <div className="text-xs font-bold text-white bg-white/20 px-3 py-1.5">
                LIVE
              </div>
            </div>
          </motion.button>
        </div>

        {/* Assets */}
        <div className="bg-[#131829] border-t border-blue-500/20">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="text-xs font-bold text-white/60 uppercase tracking-widest">
              Your Assets
            </div>
          </div>

          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-5 py-4 border-b border-white/5 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-600" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">Solana</div>
                <div className="text-xs text-white/50">0.0710 SOL</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">$11.07</div>
              <div className="text-xs font-bold text-emerald-400">+0.00%</div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-5 py-4 border-b border-white/5 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-cyan-600" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">NPC Solana</div>
                <div className="text-xs text-white/50">652.5584 NPCS</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">$1.06</div>
              <div className="text-xs font-bold text-red-400">-3.5%</div>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Bottom Nav - BLAZE signature */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0E27]/95 backdrop-blur-xl border-t border-blue-500/20">
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
                className={`relative flex flex-col items-center py-2 transition-colors ${
                  active ? 'text-blue-400' : 'text-white/40'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500"
                  />
                )}
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Signature badge */}
      <div className="fixed top-4 left-0 right-0 pointer-events-none z-50">
        <div className="max-w-md mx-auto px-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-orange-500 text-white px-3 py-1.5 text-[10px] font-bold">
            <Flame className="w-3 h-3" />
            DEMO 8: BLAZE SIGNATURE STYLE
          </div>
        </div>
      </div>
    </div>
  );
}

