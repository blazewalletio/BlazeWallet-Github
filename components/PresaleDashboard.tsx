'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Rocket, TrendingUp, Users, Clock, CheckCircle, AlertCircle, Loader2, Crown, Sparkles } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { PresaleService } from '@/lib/presale-service';
import { PRESALE_CONSTANTS, CURRENT_PRESALE } from '@/lib/presale-config';
import { CHAINS } from '@/lib/chains';
import { ethers } from 'ethers';
import { PriorityListService } from '@/lib/priority-list-service';
import PriorityListModal from '@/components/PriorityListModal';
import CountdownWidget from '@/components/CountdownWidget';
import { logger } from '@/lib/logger';

export default function PresaleDashboard() {
  logger.log('🎯 PresaleDashboard component rendered');
  
  const { wallet, address, currentChain } = useWalletStore();
  const [contributionAmount, setContributionAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Presale stats from contract
  const [presaleInfo, setPresaleInfo] = useState({
    totalRaised: 0,
    hardCap: PRESALE_CONSTANTS.hardCap,
    participants: 0,
    timeRemaining: 0,
    tokenPrice: PRESALE_CONSTANTS.tokenPrice,
    minContribution: PRESALE_CONSTANTS.minContribution,
    maxContribution: PRESALE_CONSTANTS.maxContribution,
    active: false,
    finalized: false,
    bnbPrice: 600, // Default BNB price, will be updated from contract
  });

  const [userInfo, setUserInfo] = useState({
    contribution: 0,
    tokenAllocation: 0,
    hasClaimed: false,
  });

  const [priorityStatus, setPriorityStatus] = useState({
    isInPriorityList: false,
    isRegistrationOpen: false,
    isPriorityOnlyPhase: false,
    isPresaleOpenToAll: false,
    stats: null as any,
    timing: null as any,
  });

  const [showPriorityListModal, setShowPriorityListModal] = useState(false);

  const progress = (presaleInfo.totalRaised / presaleInfo.hardCap) * 100;
  const tokensYouGet = parseFloat(contributionAmount || '0') / presaleInfo.tokenPrice;
  
  // Determine presale status
  const getPresaleStatus = () => {
    if (presaleInfo.finalized) return 'finalized';
    if (!presaleInfo.active) return 'inactive';
    if (presaleInfo.timeRemaining <= 0) return 'ended';
    if (progress >= 100) return 'completed';
    return 'active';
  };

  const presaleStatus = getPresaleStatus();

  // Load presale data
  const loadPresaleData = async () => {
    logger.log('🔄 Loading presale data...');
    
    if (!wallet || !address) {
      logger.log('❌ No wallet or address available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create provider if needed
      let walletWithProvider = wallet;
      
      logger.log('🔗 Wallet details:', {
        hasWallet: !!wallet,
        hasAddress: !!address,
        hasProvider: !!walletWithProvider.provider,
        currentChain: currentChain,
      });
      if (!walletWithProvider.provider) {
        logger.log('🔧 Creating provider for wallet...');
        const chain = CHAINS[currentChain];
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        walletWithProvider = wallet.connect(provider);
        logger.log('✅ Provider created and wallet connected');
      }

      const presaleService = new PresaleService(walletWithProvider);
      
      logger.log('📊 Fetching presale info...');
      const info = await presaleService.getPresaleInfo();
      logger.log('📊 Presale info received:', info);

      setPresaleInfo({
        ...presaleInfo,
        totalRaised: info.raised,
        participants: info.participantCount,
        timeRemaining: info.timeRemaining,
        active: info.active,
        finalized: info.finalized,
        bnbPrice: info.bnbPrice, // Update BNB price from contract
      });

      logger.log('📊 Fetching user info...');
      const user = await presaleService.getUserInfo(address);
      logger.log('📊 User info received:', user);

      setUserInfo({
        contribution: user.contribution,
        tokenAllocation: user.tokenAllocation,
        hasClaimed: user.hasClaimed,
      });

    } catch (err) {
      logger.error('❌ Error loading presale data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load presale data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when component mounts or wallet changes
  useEffect(() => {
    logger.log('🔄 useEffect triggered - loading presale data');
    loadPresaleData();
  }, [wallet, address, currentChain]);

  // Load priority list status separately (only once on mount)
  useEffect(() => {
    loadPriorityListStatus();
  }, [address]); // Only reload when address changes

  // Load priority list status
  const loadPriorityListStatus = async () => {
    try {
      const response = await fetch(`/api/priority-list${address ? `?wallet=${address}` : ''}`);
      const result = await response.json();
      
      if (result.success) {
        setPriorityStatus({
          isInPriorityList: !!result.data.userEntry,
          isRegistrationOpen: result.data.isRegistrationOpen,
          isPriorityOnlyPhase: result.data.isPriorityOnlyPhase,
          isPresaleOpenToAll: result.data.isPresaleOpenToAll,
          stats: result.data.stats,
          timing: result.data.timing,
        });
      }
    } catch (err) {
      logger.error('Error loading priority list status:', err);
    }
  };

  // Handle contribution
  const handleContribute = async () => {
    if (!wallet || !address) {
      setError('Please connect your wallet first');
      return;
    }

    // ✅ PRIORITY LIST ENFORCEMENT: Check if user is in priority list during priority-only phase
    if (priorityStatus.isPriorityOnlyPhase && !priorityStatus.isInPriorityList) {
      setError('Presale is currently only open to priority list members. Please register for the priority list first.');
      setShowPriorityListModal(true); // Open priority list modal
      return;
    }

    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      setError('Please enter a valid contribution amount');
      return;
    }

    const amountUSD = parseFloat(contributionAmount);
    if (amountUSD < presaleInfo.minContribution) {
      setError(`Minimum contribution is $${presaleInfo.minContribution}`);
      return;
    }

    if (amountUSD > presaleInfo.maxContribution) {
      setError(`Maximum contribution is $${presaleInfo.maxContribution}`);
      return;
    }

    setIsContributing(true);
    setError('');
    setSuccess('');

    try {
      logger.log('💰 Starting contribution process...');
      
      // Create provider if needed
      let walletWithProvider = wallet;
      if (!walletWithProvider.provider) {
        const chain = CHAINS[currentChain];
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        walletWithProvider = wallet.connect(provider);
      }

      const presaleService = new PresaleService(walletWithProvider);
      
      logger.log('💰 Contributing amount:', amountUSD);
      const tx = await presaleService.contribute(amountUSD);
      
      logger.log('💰 Transaction submitted:', tx);
      setSuccess(`Contribution successful! Transaction: ${tx.slice(0, 10)}...`);
      
      // Refresh data
      setTimeout(() => {
        loadPresaleData();
      }, 2000);

    } catch (err) {
      logger.error('❌ Contribution error:', err);
      setError(err instanceof Error ? err.message : 'Contribution failed');
    } finally {
      setIsContributing(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (milliseconds: number) => {
    if (milliseconds <= 0) return 'Ended';
    
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-orange-500" />
          BLAZE Token Presale
        </h2>
        <p className="text-gray-600">
          Join the early supporters - 2.4x gain at launch! ($0.008333 → $0.02)
        </p>
      </div>

      {/* Priority List Status Banner */}
      {priorityStatus.isRegistrationOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-1"
        >
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-white/10 to-green-400/0 animate-pulse" />
          
          <div className="relative bg-white rounded-xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Left content */}
              <div className="flex items-start gap-4 flex-1">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                
                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Priority List Registration Open!
                    </h3>
                    <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full animate-pulse">
                      LIVE
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    Register now for <span className="font-semibold text-green-600">1 week early access</span> to the presale starting January 2, 2026
                  </p>
                  
                  {/* Stats row */}
                  {priorityStatus.stats && (
                    <div className="flex items-center gap-4 mt-3 text-xs sm:text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-gray-900">{priorityStatus.stats.total_registered || 0}</span>
                        <span>registered</span>
                      </div>
                      {priorityStatus.stats.total_registered < 500 && (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-yellow-500" />
                          <span className="font-semibold text-gray-900">{500 - priorityStatus.stats.total_registered}</span>
                          <span>Early Bird spots left</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Button */}
              <button
                onClick={() => setShowPriorityListModal(true)}
                className="w-full sm:w-auto flex-shrink-0 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                <Crown className="w-5 h-5" />
                <span>{priorityStatus.isInPriorityList ? 'View Status' : 'Register Now'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {priorityStatus.isPriorityOnlyPhase && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-semibold text-blue-400">Priority List Members Only</h3>
                <p className="text-sm text-blue-300">
                  Presale is currently only open to priority list members. Opens to everyone January 9, 2026
                </p>
              </div>
            </div>
            {priorityStatus.isInPriorityList ? (
              <div className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg font-semibold text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                You're Registered
              </div>
            ) : (
              <button
                onClick={() => setShowPriorityListModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg font-semibold text-white flex items-center gap-2 transition-all"
              >
                <Crown className="w-4 h-4" />
                Join Priority List
              </button>
            )}
          </div>
        </div>
      )}

      {/* Always show Priority List button if not in active phase */}
      {!priorityStatus.isRegistrationOpen && !priorityStatus.isPriorityOnlyPhase && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-1"
        >
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 via-white/10 to-orange-400/0 animate-pulse" />
          
          <div className="relative bg-white rounded-xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Left content */}
              <div className="flex items-start gap-4 flex-1">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                
                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Priority List - Coming Soon!
                    </h3>
                    <span className="flex-shrink-0 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                      UPCOMING
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    Registration opens <span className="font-semibold text-orange-600">December 15, 2025 at 11:00</span> - Get 1 week early access!
                  </p>
                  
                  {/* Benefits */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <CheckCircle className="w-4 h-4 text-orange-500" />
                      <span>Early access</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      <span>Early Bird bonus</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span>Best price</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Button */}
              <button
                onClick={() => setShowPriorityListModal(true)}
                className="w-full sm:w-auto flex-shrink-0 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                <Crown className="w-5 h-5" />
                <span>{priorityStatus.isInPriorityList ? 'View Status' : 'Learn More'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Countdown Widget - When registration is coming soon */}
      {!priorityStatus.isRegistrationOpen && priorityStatus.timing && (
        <CountdownWidget
          targetDate={new Date(Date.now() + (priorityStatus.timing.timeUntilRegistration.days * 24 * 60 * 60 * 1000 + priorityStatus.timing.timeUntilRegistration.hours * 60 * 60 * 1000 + priorityStatus.timing.timeUntilRegistration.minutes * 60 * 1000))}
          title="Priority List Opens In"
          subtitle="Be among the first 500 to get Early Bird bonus!"
          variant="full"
          showStats={true}
          totalRegistered={priorityStatus.stats?.total_registered || 0}
        />
      )}

      {/* Countdown Widget - When presale is coming soon (for priority members) */}
      {priorityStatus.isRegistrationOpen && !priorityStatus.isPriorityOnlyPhase && priorityStatus.timing && (
        <CountdownWidget
          targetDate={new Date(Date.now() + (priorityStatus.timing.timeUntilPresale.days * 24 * 60 * 60 * 1000 + priorityStatus.timing.timeUntilPresale.hours * 60 * 60 * 1000 + priorityStatus.timing.timeUntilPresale.minutes * 60 * 1000))}
          title="Presale Starts In"
          subtitle="Priority list members get 1 week early access!"
          variant="full"
          showStats={true}
          totalRegistered={priorityStatus.stats?.total_registered || 0}
        />
      )}

      {/* Status Banner */}
      <div className={`rounded-xl p-4 ${
        presaleStatus === 'active' ? 'bg-green-500/10 border border-green-500/20' :
        presaleStatus === 'ended' ? 'bg-orange-500/10 border border-orange-500/20' :
        presaleStatus === 'completed' ? 'bg-blue-500/10 border border-blue-500/20' :
        presaleStatus === 'finalized' ? 'bg-orange-500/10 border border-orange-500/20' :
        'bg-gray-500/10 border border-gray-500/20'
      }`}>
        <div className="flex items-center gap-3">
          {presaleStatus === 'active' && <CheckCircle className="w-5 h-5 text-green-400" />}
          {presaleStatus === 'ended' && <Clock className="w-5 h-5 text-orange-400" />}
          {presaleStatus === 'completed' && <TrendingUp className="w-5 h-5 text-blue-400" />}
          {presaleStatus === 'finalized' && <CheckCircle className="w-5 h-5 text-purple-400" />}
          {presaleStatus === 'inactive' && <AlertCircle className="w-5 h-5 text-gray-400" />}
          <div>
            <h3 className="font-semibold">
              {presaleStatus === 'active' && 'Presale is Live!'}
              {presaleStatus === 'ended' && 'Presale Ended'}
              {presaleStatus === 'completed' && 'Hard Cap Reached!'}
              {presaleStatus === 'finalized' && 'Presale Finalized'}
              {presaleStatus === 'inactive' && 'Presale Not Active'}
            </h3>
            <p className="text-sm opacity-75">
              {presaleStatus === 'active' && 'You can now contribute to the presale'}
              {presaleStatus === 'ended' && 'The presale period has ended'}
              {presaleStatus === 'completed' && 'All tokens have been sold'}
              {presaleStatus === 'finalized' && 'Tokens are ready for claiming'}
              {presaleStatus === 'inactive' && 'The presale is not currently active'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold">Total Raised</span>
          </div>
          <div className="text-3xl font-bold text-orange-400">
            ${presaleInfo.totalRaised.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            of ${presaleInfo.hardCap.toLocaleString()}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold">Participants</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{presaleInfo.participants}</div>
          <div className="text-sm text-gray-600 mt-1">
            Early supporters
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-semibold">Time Left</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {formatTimeRemaining(presaleInfo.timeRemaining)}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Until launch
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-orange-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Rocket className="w-5 h-5" />
            <span className="text-sm font-semibold">Launch Gain</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">2.4x</div>
          <div className="text-sm text-gray-600 mt-1">
            Expected return
          </div>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Presale Progress</h3>
          <span className="text-sm text-gray-600">
            {progress.toFixed(1)}% funded
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-600">
          <span>${presaleInfo.totalRaised.toLocaleString()}</span>
          <span>${presaleInfo.hardCap.toLocaleString()}</span>
        </div>
      </div>

      {/* Your Contribution */}
      {userInfo.contribution > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Your Contribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Amount Contributed</div>
              <div className="text-2xl font-bold text-orange-400">
                ${userInfo.contribution.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Tokens Allocated</div>
              <div className="text-2xl font-bold text-blue-400">
                {userInfo.tokenAllocation.toLocaleString()} BLAZE
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Claim Status</div>
              <div className="text-2xl font-bold text-green-400">
                {userInfo.hasClaimed ? 'Claimed' : 'Pending'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Form - Only show if presale is active AND (open to all OR user is in priority list) */}
      {presaleStatus === 'active' && (priorityStatus.isPresaleOpenToAll || (priorityStatus.isPriorityOnlyPhase && priorityStatus.isInPriorityList)) && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Contribute to Presale</h3>
          
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Contribution Amount (USD)
              </label>
              <input aria-label="Number input"
                type="number"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                placeholder="Enter amount in USD"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-500 focus:outline-none"
                disabled={isContributing || isLoading}
              />
              <div className="text-xs text-gray-600 mt-1">
                Min: ${presaleInfo.minContribution} | Max: ${presaleInfo.maxContribution}
              </div>
            </div>

            {/* BNB Equivalent */}
            {contributionAmount && parseFloat(contributionAmount) > 0 && (
              <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">BNB equivalent:</span>
                <span className="text-sm font-bold text-gray-900">
                  {(parseFloat(contributionAmount) / presaleInfo.bnbPrice).toFixed(4)} BNB
                </span>
              </div>
            )}

            {/* Token Preview */}
            {contributionAmount && parseFloat(contributionAmount) > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>You will receive:</span>
                    <span className="font-bold text-blue-400">
                      {tokensYouGet.toLocaleString()} BLAZE
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price per token:</span>
                    <span className="font-semibold">${presaleInfo.tokenPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Launch value (2.4x):</span>
                    <span className="font-semibold text-green-400">
                      ${(tokensYouGet * presaleInfo.tokenPrice * 2.4).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleContribute}
              disabled={!contributionAmount || parseFloat(contributionAmount) <= 0 || isContributing || isLoading}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {isContributing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Contributing...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Contribute Now
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Priority List Modal */}
    <PriorityListModal
      isOpen={showPriorityListModal}
      onClose={() => setShowPriorityListModal(false)}
    />
  </>
  );
}
