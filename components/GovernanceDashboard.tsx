'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Plus, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { GovernanceService, Proposal, GovernanceStats } from '@/lib/governance-service';
import { logger } from '@/lib/logger';

interface GovernanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GovernanceDashboard({ isOpen, onClose }: GovernanceDashboardProps) {
  const { wallet, address, currentChain } = useWalletStore();
  const [activeTab, setActiveTab] = useState<'vote' | 'create'>('vote');
  const [newProposal, setNewProposal] = useState({ title: '', description: '' });
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [governanceStats, setGovernanceStats] = useState<GovernanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [proposalThreshold, setProposalThreshold] = useState('10000');
  const [canCreateProposal, setCanCreateProposal] = useState(false);

  // Block body scroll when modal is open
  useBlockBodyScroll(isOpen);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadGovernanceData();
    }
  }, [isOpen, wallet, address, currentChain]);

  const loadGovernanceData = async () => {
    if (!wallet || !address) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const governanceService = new GovernanceService(wallet);
      
      // Load all data in parallel
      const [proposalsData, stats, threshold, canCreate] = await Promise.all([
        governanceService.getProposals(),
        governanceService.getGovernanceStats(address),
        governanceService.getProposalThreshold(),
        governanceService.canCreateProposal(address)
      ]);
      
      setProposals(proposalsData);
      setGovernanceStats(stats);
      setProposalThreshold(threshold);
      setCanCreateProposal(canCreate);
      
    } catch (error: any) {
      logger.error('Error loading governance data:', error);
      setError(error.message || 'Failed to load governance data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (proposalId: number, vote: 'for' | 'against') => {
    if (!wallet) {
      setError('Wallet not connected');
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const governanceService = new GovernanceService(wallet);
      const txHash = await governanceService.vote(proposalId, vote === 'for');
      
      setSuccess(`Vote cast successfully! Transaction: ${txHash.substring(0, 10)}...`);
      
      // Reload proposals to update vote status
      setTimeout(() => {
        loadGovernanceData();
      }, 2000);
      
    } catch (error: any) {
      logger.error('Error voting:', error);
      setError(error.message || 'Failed to cast vote');
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.description.trim()) {
      setError('Please enter a proposal description');
      return;
    }

    if (!wallet) {
      setError('Wallet not connected');
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const governanceService = new GovernanceService(wallet);
      const txHash = await governanceService.createProposal(newProposal.description);
      
      setSuccess(`Proposal created successfully! Transaction: ${txHash.substring(0, 10)}...`);
      setNewProposal({ title: '', description: '' });
      setActiveTab('vote');
      
      // Reload proposals to show the new one
      setTimeout(() => {
        loadGovernanceData();
      }, 2000);
      
    } catch (error: any) {
      logger.error('Error creating proposal:', error);
      setError(error.message || 'Failed to create proposal');
    }
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    
    return `${days}d ${hours}h`;
  };

  const getProposalStatus = (proposal: Proposal) => {
    const now = Math.floor(Date.now() / 1000);
    if (proposal.executed) return 'executed';
    if (proposal.endTime <= now) return 'ended';
    if (proposal.startTime <= now) return 'active';
    return 'pending';
  };

  if (!isOpen) return null;

  if (!wallet || !address) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Vote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-500">Please connect your wallet to participate in governance</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading governance data...</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6 pb-24">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Vote className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Governance</h2>
                <p className="text-sm text-gray-600">
                  Vote on proposals and shape the future of BLAZE ecosystem
                </p>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card p-4 mb-6 border-l-4 border-red-500"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                  <button
                    onClick={() => setError('')}
                    className="text-red-500 hover:text-red-700 text-xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card p-4 mb-6 border-l-4 border-green-500"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                  <button
                    onClick={() => setSuccess('')}
                    className="text-green-500 hover:text-green-700 text-xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-orange-500/20"
            >
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Vote className="w-5 h-5" />
                <span className="text-sm font-semibold">Voting Power</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {governanceStats?.votingPowerFormatted.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                BLAZE tokens
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
            >
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-semibold">Active Proposals</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {governanceStats?.activeProposals || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Currently voting
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
            >
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-semibold">Total Proposals</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {governanceStats?.totalProposals || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                All time
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20"
            >
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-semibold">Proposals Passed</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {governanceStats?.passedProposals || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Successfully passed
              </div>
            </motion.div>
          </div>

          {/* Tab Navigation */}
          <div className="glass-card p-1 mb-6">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('vote')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  activeTab === 'vote'
                    ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-purple-500/30'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Vote on Proposals
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-purple-500/30'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Create Proposal
              </button>
            </div>
          </div>

          {/* Vote Tab */}
          {activeTab === 'vote' && (
            <div className="space-y-4">
              {proposals.length === 0 ? (
                <div className="glass-card text-center py-12">
                  <Vote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Proposals Yet</h3>
                  <p className="text-gray-500">Be the first to create a proposal!</p>
                </div>
              ) : (
                proposals.map((proposal) => {
                  const totalVotes = BigInt(proposal.voteCountYes) + BigInt(proposal.voteCountNo);
                  const forPercentage = totalVotes > 0n ? (Number(proposal.voteCountYes) / Number(totalVotes)) * 100 : 0;
                  const againstPercentage = totalVotes > 0n ? (Number(proposal.voteCountNo) / Number(totalVotes)) * 100 : 0;
                  const status = getProposalStatus(proposal);
                  
                  return (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">Proposal #{proposal.id}</h3>
                            <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              status === 'active'
                                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                                : status === 'executed'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                : status === 'ended'
                                ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3 leading-relaxed">{proposal.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTimeRemaining(proposal.endTime)}
                            </div>
                            <div className={proposal.hasVoted ? 'text-green-600 font-medium' : ''}>
                              {proposal.hasVoted ? '✓ Voted' : 'Not voted'}
                            </div>
                            <div className="font-mono text-xs">
                              {proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(38)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vote Results */}
                      {totalVotes > 0n && (
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">Votes For</span>
                            <span className="text-sm font-bold text-green-600">
                              {Number(proposal.voteCountYes).toLocaleString()} ({forPercentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500 shadow-sm"
                              style={{ width: `${forPercentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <span className="text-sm font-semibold text-gray-700">Votes Against</span>
                            <span className="text-sm font-bold text-red-600">
                              {Number(proposal.voteCountNo).toLocaleString()} ({againstPercentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full transition-all duration-500 shadow-sm"
                              style={{ width: `${againstPercentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Vote Buttons */}
                      {status === 'active' && !proposal.hasVoted && (
                        <div className="flex gap-3">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleVote(proposal.id, 'for')}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                          >
                            <TrendingUp className="w-4 h-4" />
                            Vote For
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleVote(proposal.id, 'against')}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
                          >
                            <TrendingDown className="w-4 h-4" />
                            Vote Against
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <div className="glass-card">
              <div className="space-y-6">
                <div className="glass-card bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20">
                  <p className="text-sm text-gray-700">
                    💡 Create proposals to improve the BLAZE ecosystem. Proposals require <span className="font-semibold">{proposalThreshold} BLAZE tokens</span> to submit and will be active for 7 days.
                  </p>
                </div>

                {!canCreateProposal && (
                  <div className="glass-card bg-gradient-to-br from-red-500/5 to-rose-500/5 border border-red-500/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-700 font-semibold mb-1">
                          Insufficient BLAZE tokens to create a proposal
                        </p>
                        <p className="text-sm text-red-600">
                          You need at least {proposalThreshold} BLAZE tokens (you have {governanceStats?.votingPowerFormatted.toLocaleString() || '0'} BLAZE)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">Proposal Description</label>
                  <textarea
                    value={newProposal.description}
                    onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                    placeholder="Describe your proposal in detail..."
                    rows={6}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none resize-none transition-all"
                    disabled={!canCreateProposal}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: canCreateProposal && newProposal.description.trim() ? 1.02 : 1 }}
                  whileTap={{ scale: canCreateProposal && newProposal.description.trim() ? 0.98 : 1 }}
                  onClick={handleCreateProposal}
                  disabled={!canCreateProposal || !newProposal.description.trim()}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
                >
                  <Plus className="w-5 h-5" />
                  Create Proposal ({proposalThreshold} BLAZE)
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
