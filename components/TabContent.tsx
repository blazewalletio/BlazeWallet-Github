'use client';

import { motion } from 'framer-motion';
import { TabType } from './BottomNavigation';
import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, ArrowDownLeft, RefreshCw, TrendingUp, Eye, EyeOff, Plus, Zap, ChevronRight,
  Repeat, Wallet as WalletIcon, TrendingDown, PieChart, Rocket, CreditCard,
  Lock, Gift, Vote, Users as UsersIcon, Palette, Settings as SettingsIcon, History, Bot, Flame
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { BlockchainService } from '@/lib/blockchain';
import { CHAINS } from '@/lib/chains';
import AnimatedNumber from './AnimatedNumber';
import TransactionHistory from './TransactionHistory';
import SettingsModal from './SettingsModal';
import StakingDashboard from './StakingDashboard';
import GovernanceDashboard from './GovernanceDashboard';
import LaunchpadDashboard from './LaunchpadDashboard';
import ReferralDashboard from './ReferralDashboard';
import NFTMintDashboard from './NFTMintDashboard';
import CashbackTracker from './CashbackTracker';
import PresaleDashboard from './PresaleDashboard';
import AddressBook from './AddressBook';
import { logger } from '@/lib/logger';
import { PRESALE_FEATURE_ENABLED } from '@/lib/feature-flags';

interface TabContentProps {
  activeTab: TabType;
  tokens: any[];
  totalValueUSD: number;
  change24h: number;
  setShowSendModal: (show: boolean) => void;
  setShowReceiveModal: (show: boolean) => void;
  setShowSwapModal: (show: boolean) => void;
  setShowBuyModal: (show: boolean) => void;
  setShowTokenSelector: (show: boolean) => void;
  setShowQuickPay: (show: boolean) => void;
  fetchData: () => void;
  isRefreshing: boolean;
}

export default function TabContent({
  activeTab,
  tokens,
  totalValueUSD,
  change24h,
  setShowSendModal,
  setShowReceiveModal,
  setShowSwapModal,
  setShowBuyModal,
  setShowTokenSelector,
  setShowQuickPay,
  fetchData,
  isRefreshing
}: TabContentProps) {
  const { address, balance, currentChain, getCurrentAddress } = useWalletStore();
  const displayAddress = getCurrentAddress(); // ✅ Get correct address for current chain
  const chain = CHAINS[currentChain];
  const formattedAddress = displayAddress ? BlockchainService.formatAddress(displayAddress) : '';
  const isPositiveChange = change24h >= 0;

  // Modal states for each tab
  const [showSettings, setShowSettings] = useState(false);
  const [showStaking, setShowStaking] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showNFTMint, setShowNFTMint] = useState(false);
  const [showCashback, setShowCashback] = useState(false);
  const [showPresale, setShowPresale] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);

  const [showBalance, setShowBalance] = useState(true);

  // Priority List status
  const [isPriorityListLive, setIsPriorityListLive] = useState(false);

  // Check Priority List status
  useEffect(() => {
    const checkPriorityListStatus = async () => {
      try {
        const response = await fetch('/api/priority-list');
        const result = await response.json();
        
        if (result.success && result.data) {
          setIsPriorityListLive(result.data.isRegistrationOpen || false);
        }
      } catch (error) {
        logger.error('Error checking priority list status:', error);
      }
    };

    checkPriorityListStatus();
    // Check every 60 seconds
    const interval = setInterval(checkPriorityListStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Wallet Tab Content
  const WalletTab = () => (
    <div className="space-y-4">
      {/* Portfolio Balance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Portfolio value</h2>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {showBalance ? <Eye className="w-5 h-5 text-gray-600" /> : <EyeOff className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
        
        <div className="mb-4">
          {showBalance ? (
            <div className="text-3xl font-bold text-gray-900 mb-2">
              <AnimatedNumber value={totalValueUSD} useCurrencyPrefix decimals={2} />
            </div>
          ) : (
            <div className="text-3xl font-bold text-gray-900 mb-2">••••••</div>
          )}
          
          <div className="flex items-center gap-3 mb-3">
            <div className="text-gray-600">
              {showBalance ? `${parseFloat(balance).toFixed(4)} ${chain.nativeCurrency.symbol}` : '••••••'}
            </div>
            <div className="text-sm text-gray-500">Native balance</div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-1 rounded hover:bg-gray-100"
            >
              {showBalance ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {isPositiveChange ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
              {isPositiveChange ? '+' : ''}{change24h.toFixed(2)}% today
            </span>
          </div>
        </div>

      </motion.div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowBuyModal(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Buy</div>
          <div className="text-sm text-gray-600">Crypto kopen met fiat</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSendModal(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-6 h-6 text-red-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Send</div>
          <div className="text-sm text-gray-600">Crypto verzenden</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowReceiveModal(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ArrowDownLeft className="w-6 h-6 text-green-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Receive</div>
          <div className="text-sm text-gray-600">Receive crypto</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSwapModal(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Repeat className="w-6 h-6 text-purple-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Swap</div>
          <div className="text-sm text-gray-600">Tokens wisselen</div>
        </motion.button>
      </div>

      {/* Add Tokens Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowTokenSelector(true)}
        className="w-full glass-card p-4 rounded-2xl flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Plus className="w-5 h-5 text-gray-600" />
        </div>
        <div className="text-left">
          <div className="font-semibold text-gray-900">Add tokens</div>
          <div className="text-sm text-gray-600">Add custom tokens</div>
        </div>
      </motion.button>
    </div>
  );

  // AI Tools Tab Content
  const AIToolsTab = () => (
    <div className="space-y-4">
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI Tools</h2>
            <p className="text-sm text-gray-600">Smart crypto assistance</p>
          </div>
        </div>
      </div>

      {/* AI Tools Grid */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          whileTap={{ scale: 0.95 }}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-orange-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">AI Assistent</div>
          <div className="text-sm text-gray-600">Natural language transactions</div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.95 }}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Scam Detector</div>
          <div className="text-sm text-gray-600">Real-time risico scanning</div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.95 }}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <PieChart className="w-6 h-6 text-purple-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Portfolio Advisor</div>
          <div className="text-sm text-gray-600">Gepersonaliseerde tips</div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.95 }}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-green-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Gas Optimizer</div>
          <div className="text-sm text-gray-600">Bespaar op gas fees</div>
        </motion.div>
      </div>
    </div>
  );

  // Blaze Tab Content
  const BlazeTab = () => (
    <div className="space-y-4">
      {/* BLAZE Presale Card (Hidden when feature flag is disabled) */}
      {PRESALE_FEATURE_ENABLED && (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPresale(true)}
        className={`w-full glass-card p-6 rounded-2xl text-left transition-all group border-2 relative overflow-hidden ${
          isPriorityListLive 
            ? 'border-green-300 hover:bg-green-50' 
            : 'border-orange-200 hover:bg-orange-50'
        }`}
      >
        {/* Background gradient effect */}
        <div className={`absolute inset-0 transition-opacity ${
          isPriorityListLive 
            ? 'bg-gradient-to-r from-green-500/5 to-emerald-500/5' 
            : 'bg-gradient-to-r from-orange-500/5 to-yellow-500/5'
        }`} />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
              isPriorityListLive
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'bg-gradient-to-r from-orange-500 to-yellow-500'
            }`}>
              <Rocket className="w-6 h-6 text-white" />
            </div>
            
            {/* LIVE badge */}
            {isPriorityListLive && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-lg"
                style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}
              >
                LIVE
              </motion.div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              BLAZE Presale
              {isPriorityListLive && (
                <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  Registration Open
                </span>
              )}
            </div>
            <div className={`text-sm flex items-center gap-1.5 ${
              isPriorityListLive ? 'text-green-700' : 'text-gray-600'
            }`}>
              {isPriorityListLive ? (
                <>
                  <Flame className="w-4 h-4" />
                  <span>Priority List is LIVE!</span>
                </>
              ) : (
                'Early access to tokens'
              )}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </motion.button>
      )}

      {/* Blaze Features Grid */}
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowStaking(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-orange-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Staking</div>
          <div className="text-sm text-gray-600">Earn 8-20% APY</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowGovernance(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Vote className="w-6 h-6 text-blue-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Governance</div>
          <div className="text-sm text-gray-600">Vote on proposals</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLaunchpad(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Launchpad</div>
          <div className="text-sm text-gray-600">Early token access</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowReferrals(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UsersIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Referrals</div>
          <div className="text-sm text-gray-600">Earn rewards</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNFTMint(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Palette className="w-6 h-6 text-pink-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">NFT Skins</div>
          <div className="text-sm text-gray-600">Customize wallet</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCashback(true)}
          className="glass-card p-6 rounded-2xl text-left hover:bg-gray-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Gift className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Cashback</div>
          <div className="text-sm text-gray-600">Earn on transactions</div>
        </motion.button>
      </div>
    </div>
  );

  // History Tab Content
  const HistoryTab = () => (
    <div className="space-y-4">
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <History className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
            <p className="text-sm text-gray-600">Alle wallet activiteit</p>
          </div>
        </div>
      </div>
      
      <TransactionHistory />
    </div>
  );

  // Settings Tab Content
  const SettingsTab = () => (
    <div className="space-y-4">
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-600">Wallet & app configuratie</p>
          </div>
        </div>
        
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSettings(true)}
          className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div className="font-medium text-gray-900">Open Settings</div>
          <div className="text-sm text-gray-600">Security, network and more</div>
        </motion.button>
      </div>
    </div>
  );

  // Contacts Tab Content - shows inline address book
  const ContactsTab = () => (
    <div className="space-y-4">
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
            <UsersIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Contacts</h2>
            <p className="text-sm text-gray-600">Manage your saved addresses</p>
          </div>
        </div>
        
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddressBook(true)}
          className="w-full p-4 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white transition-colors text-left shadow-sm"
        >
          <div className="font-medium">Open Address Book</div>
          <div className="text-sm text-white/90">View and manage your contacts</div>
        </motion.button>
      </div>
    </div>
  );

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'wallet':
        return <WalletTab />;
      case 'ai':
        return <AIToolsTab />;
      case 'blaze':
        return <BlazeTab />;
      case 'history':
        return <HistoryTab />;
      case 'contacts':
        return <ContactsTab />;
      default:
        return <WalletTab />;
    }
  };

  return (
    <>
      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="px-4 pb-24"
      >
        {renderTabContent()}
      </motion.div>

      {/* Modals */}
      {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />}
      {showAddressBook && <AddressBook isOpen={showAddressBook} onClose={() => setShowAddressBook(false)} />}
      
      {/* Full Screen Modals */}
      <StakingDashboard isOpen={showStaking} onClose={() => setShowStaking(false)} />
      <GovernanceDashboard isOpen={showGovernance} onClose={() => setShowGovernance(false)} />
      <CashbackTracker isOpen={showCashback} onClose={() => setShowCashback(false)} />
      <LaunchpadDashboard isOpen={showLaunchpad} onClose={() => setShowLaunchpad(false)} />
      <ReferralDashboard isOpen={showReferrals} onClose={() => setShowReferrals(false)} />
      <NFTMintDashboard isOpen={showNFTMint} onClose={() => setShowNFTMint(false)} />
      
      {PRESALE_FEATURE_ENABLED && showPresale && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="p-4">
            <button 
              onClick={() => setShowPresale(false)}
              className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <PresaleDashboard />
          </div>
        </div>
      )}
    </>
  );
}
