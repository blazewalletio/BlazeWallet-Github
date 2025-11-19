'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  Rocket, 
  Lock, 
  Gift, 
  Vote, 
  Users, 
  Palette,
  ChevronRight,
  Zap,
  TrendingUp,
  Calendar
} from 'lucide-react';
import PremiumBadge from '../PremiumBadge';
import PresaleDashboard from '../PresaleDashboard';
import StakingDashboard from '../StakingDashboard';
import GovernanceDashboard from '../GovernanceDashboard';
import LaunchpadDashboard from '../LaunchpadDashboard';
import ReferralDashboard from '../ReferralDashboard';
import NFTMintDashboard from '../NFTMintDashboard';
import CashbackTracker from '../CashbackTracker';
import VestingDashboard from '../VestingDashboard';
import { useWalletStore } from '@/lib/wallet-store';
import { logger } from '@/lib/logger';

export default function BlazeTab() {
  const { address } = useWalletStore();
  
  // Founder/Developer wallet addresses
  const founderAddresses = [
    '0x18347d3bcb33721e0c603befd2ffac8762d5a24d',
    '0x742d35cc6634c0532925a3b8d0c9e5c3d3e8d3f5',
  ].map(addr => addr.toLowerCase());

  const isFounder = address && founderAddresses.includes(address.toLowerCase());

  const [activeModal, setActiveModal] = useState<string | null>(null);

  const blazeFeatures = [
    {
      id: 'presale',
      title: 'BLAZE Presale',
      description: 'Early access to tokens',
      icon: Rocket,
      gradient: 'from-orange-500 to-yellow-500',
      badge: 'Live',
      onClick: () => setActiveModal('presale'),
    },
    {
      id: 'staking',
      title: 'Staking',
      description: 'Earn up to 25% APY',
      icon: Lock,
      gradient: 'from-orange-500 to-red-500',
      onClick: () => setActiveModal('staking'),
    },
    {
      id: 'cashback',
      title: 'Cashback',
      description: '2% on all transactions',
      icon: Gift,
      gradient: 'from-green-500 to-emerald-500',
      onClick: () => setActiveModal('cashback'),
    },
    {
      id: 'governance',
      title: 'Governance',
      description: 'Vote on proposals',
      icon: Vote,
      gradient: 'from-orange-500 to-yellow-500',
      onClick: () => setActiveModal('governance'),
    },
    {
      id: 'launchpad',
      title: 'Launchpad',
      description: 'Early access to IDOs',
      icon: Rocket,
      gradient: 'from-blue-500 to-cyan-500',
      onClick: () => setActiveModal('launchpad'),
    },
    {
      id: 'referrals',
      title: 'Referrals',
      description: 'Earn 50 BLAZE/referral',
      icon: Users,
      gradient: 'from-yellow-500 to-orange-500',
      onClick: () => setActiveModal('referrals'),
    },
    {
      id: 'nft-skins',
      title: 'NFT Skins',
      description: 'Exclusive wallet themes',
      icon: Palette,
      gradient: 'from-pink-500 to-purple-500',
      onClick: () => setActiveModal('nft-mint'),
    },
    ...(isFounder ? [{
      id: 'vesting',
      title: 'Vesting',
      description: '120M tokens locked',
      icon: Lock,
      gradient: 'from-purple-500 to-indigo-500',
      onClick: () => setActiveModal('vesting'),
    }] : []),
  ];

  const renderModal = () => {
    if (!activeModal || activeModal === 'staking' || activeModal === 'governance' || activeModal === 'cashback' || activeModal === 'launchpad' || activeModal === 'referrals' || activeModal === 'nft-mint') return null; // These have their own modals

    const modalContent = {
      presale: <PresaleDashboard />,
      vesting: isFounder ? <VestingDashboard /> : null,
    };

    const content = modalContent[activeModal as keyof typeof modalContent];
    if (!content) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          <button
            onClick={() => setActiveModal(null)}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold"
          >
            ← Terug naar Blaze Features
          </button>
          {content}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/95 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center relative">
                <Flame className="w-6 h-6 text-white" />
                <motion.div
                  className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Blaze Features</h1>
                <p className="text-sm text-gray-500">DeFi ecosystem & utilities</p>
              </div>
            </div>
            <PremiumBadge isPremium={false} tokenBalance={0} threshold={10000} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Presale Card - Prominent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card card-hover relative overflow-hidden border-2 border-orange-200/50"
          onClick={() => setActiveModal('presale')}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-yellow-500/10" />
          <div className="relative z-10 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center relative">
                  <Rocket className="w-8 h-8 text-white" />
                  <motion.div
                    className="absolute -top-1 -right-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full"
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    Live
                  </motion.div>
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-xl mb-1">BLAZE Presale</div>
                  <div className="text-gray-600 mb-2">Early access to tokens at $0.00417</div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-orange-600">
                      <TrendingUp className="w-4 h-4" />
                      <span>2.4x ROI potential</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>30 days left</span>
                    </div>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {blazeFeatures.slice(1).map((feature, index) => {
            const Icon = feature.icon;
            
            return (
              <motion.button
                key={feature.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={feature.onClick}
                className="glass-card card-hover p-4 rounded-xl text-left hover:bg-white/10 transition-all relative overflow-hidden group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="font-semibold text-gray-900 mb-1 text-sm">{feature.title}</div>
                <div className="text-xs text-gray-500">{feature.description}</div>
                
                {/* Hover glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.button>
            );
          })}
        </div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Total Staked', value: '$2.1M', change: '+12%' },
            { label: 'Active Users', value: '10.2K', change: '+8%' },
            { label: 'Presale Raised', value: '$125K', change: '+25%' },
            { label: 'APY Average', value: '18.5%', change: 'Stable' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="glass-card p-4 text-center"
            >
              <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500 mb-1">{stat.label}</div>
              <div className="text-xs text-green-600 font-medium">{stat.change}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* BLAZE Token Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200/50"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">BLAZE Token</h3>
              <p className="text-sm text-gray-600">Powering the ecosystem</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Price</div>
              <div className="font-bold text-gray-900">$0.00417</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Market Cap</div>
              <div className="font-bold text-gray-900">$2.5M</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Total Supply</div>
              <div className="font-bold text-gray-900">1B</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <StakingDashboard 
        isOpen={activeModal === 'staking'} 
        onClose={() => setActiveModal(null)} 
      />
      <GovernanceDashboard 
        isOpen={activeModal === 'governance'} 
        onClose={() => setActiveModal(null)} 
      />
      <CashbackTracker 
        isOpen={activeModal === 'cashback'} 
        onClose={() => setActiveModal(null)} 
      />
      <LaunchpadDashboard 
        isOpen={activeModal === 'launchpad'} 
        onClose={() => setActiveModal(null)} 
      />
      <ReferralDashboard 
        isOpen={activeModal === 'referrals'} 
        onClose={() => setActiveModal(null)} 
      />
      <NFTMintDashboard 
        isOpen={activeModal === 'nft-mint'} 
        onClose={() => setActiveModal(null)} 
      />
      
      <AnimatePresence>
        {renderModal()}
      </AnimatePresence>
    </>
  );
}
