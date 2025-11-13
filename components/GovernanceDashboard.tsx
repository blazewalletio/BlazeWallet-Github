'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Plus, TrendingUp, TrendingDown, Clock, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { GovernanceService, Proposal, GovernanceStats } from '@/lib/governance-service';
import { logger } from '@/lib/logger';

export default function GovernanceDashboard() {
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

  // Load governance data
  useEffect(() => {
    if (!wallet || !address) {
      setIsLoading(false);
      return;
    }

    const loadGovernanceData = async () => {
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

    loadGovernanceData();
  }, [wallet, address, currentChain]);

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
        window.location.reload();
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
        window.location.reload();
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

  if (!wallet || !address) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500">Please connect your wallet to participate in governance</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading governance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Vote className="w-6 h-6 text-orange-500" />
          Governance
        </h2>
        <p className="text-gray-600">
          Vote on proposals and shape the future of BLAZE ecosystem
        </p>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-500 hover:text-red-700 text-lg font-bold"
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
            className="bg-green-50 border border-green-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-700 text-sm font-medium">{success}</p>
              </div>
              <button
                onClick={() => setSuccess('')}
                className="text-green-500 hover:text-green-700 text-lg font-bold"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Vote className="w-5 h-5" />
            <span className="text-sm font-semibold">Voting Power</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">
            {governanceStats?.votingPowerFormatted.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            BLAZE tokens
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold">Active Proposals</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">
            {governanceStats?.activeProposals || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Currently voting
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold">Total Proposals</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {governanceStats?.totalProposals || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            All time
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-semibold">Proposals Passed</span>
          </div>
          <div className="text-3xl font-bold text-orange-400">
            {governanceStats?.passedProposals || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Successfully passed
          </div>
        </motion.div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('vote')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'vote'
              ? 'bg-white text-purple-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Vote on Proposals
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'create'
              ? 'bg-white text-purple-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Create Proposal
        </button>
      </div>

      {/* Vote Tab */}
      {activeTab === 'vote' && (
        <div className="space-y-6">
          {proposals.length === 0 ? (
            <div className="text-center py-12">
              <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Proposals Yet</h3>
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
                  className="bg-white border border-gray-200 rounded-xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold">Proposal #{proposal.id}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          status === 'active'
                            ? 'bg-orange-500/20 text-orange-400'
                            : status === 'executed'
                            ? 'bg-green-500/20 text-green-400'
                            : status === 'ended'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{proposal.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTimeRemaining(proposal.endTime)}
                        </div>
                        <div>
                          {proposal.hasVoted ? '✓ Voted' : 'Not voted'}
                        </div>
                        <div>
                          Proposer: {proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(38)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vote Results */}
                  {totalVotes > 0n && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Votes For</span>
                        <span className="text-sm font-bold text-green-400">
                          {Number(proposal.voteCountYes).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${forPercentage}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Votes Against</span>
                        <span className="text-sm font-bold text-red-400">
                          {Number(proposal.voteCountNo).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${againstPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Vote Buttons */}
                  {status === 'active' && !proposal.hasVoted && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleVote(proposal.id, 'for')}
                        className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Vote For
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 'against')}
                        className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <TrendingDown className="w-4 h-4" />
                        Vote Against
                      </button>
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
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-700">
                💡 Create proposals to improve the BLAZE ecosystem. Proposals require {proposalThreshold} BLAZE tokens to submit and will be active for 7 days.
              </p>
            </div>

            {!canCreateProposal && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-700 font-medium">
                      Insufficient BLAZE tokens to create a proposal
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      You need at least {proposalThreshold} BLAZE tokens (you have {governanceStats?.votingPowerFormatted.toLocaleString() || '0'} BLAZE)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold mb-2 block">Proposal Description</label>
              <textarea
                value={newProposal.description}
                onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                placeholder="Describe your proposal in detail..."
                rows={6}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-purple-500 focus:outline-none resize-none"
                disabled={!canCreateProposal}
              />
            </div>

            <button
              onClick={handleCreateProposal}
              disabled={!canCreateProposal || !newProposal.description.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Proposal ({proposalThreshold} BLAZE)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
