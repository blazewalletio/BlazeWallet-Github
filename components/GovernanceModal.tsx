'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Vote, Plus, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';

interface GovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Proposal {
  id: number;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  endTime: Date;
  status: 'active' | 'passed' | 'rejected';
  hasVoted: boolean;
}

export default function GovernanceModal({ isOpen, onClose }: GovernanceModalProps) {
  const [activeTab, setActiveTab] = useState<'vote' | 'create'>('vote');
  const [newProposal, setNewProposal] = useState({ title: '', description: '' });

  // Mock proposals
  const proposals: Proposal[] = [
    {
      id: 1,
      title: 'Reduce swap fees from 0.5% to 0.3%',
      description: 'To stay competitive and attract more users, we propose reducing swap fees.',
      votesFor: 125000,
      votesAgainst: 45000,
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'active',
      hasVoted: false,
    },
    {
      id: 2,
      title: 'Add Avalanche chain support',
      description: 'Integrate Avalanche C-Chain to expand our multi-chain ecosystem.',
      votesFor: 89000,
      votesAgainst: 12000,
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      status: 'active',
      hasVoted: true,
    },
    {
      id: 3,
      title: 'Increase staking rewards by 5%',
      description: 'Boost APY across all staking tiers to incentivize long-term holding.',
      votesFor: 156000,
      votesAgainst: 23000,
      endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: 'passed',
      hasVoted: true,
    },
  ];

  const handleVote = (proposalId: number, support: boolean) => {
    toast(`Voted ${support ? 'FOR' : 'AGAINST'} proposal ${proposalId}!`);
  };

  const handleCreateProposal = () => {
    if (!newProposal.title || !newProposal.description) {
      toast('Please fill in all fields');
      return;
    }
    toast('Proposal created! It will be active in 24 hours.');
    setNewProposal({ title: '', description: '' });
    setActiveTab('vote');
  };

  const getTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    if (diff < 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-theme-bg-card rounded-2xl border border-theme-border-primary/50 pointer-events-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-theme-bg-card/95 backdrop-blur-xl border-b border-theme-border-primary/50 px-6 py-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Vote className="w-6 h-6 text-theme-primary" />
                      Governance
                    </h2>
                    <p className="text-sm text-theme-text-secondary mt-1">
                      Vote with your BLAZE tokens to shape the future
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-theme-text-secondary hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('vote')}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                      activeTab === 'vote'
                        ? 'bg-theme-primary text-white'
                        : 'bg-theme-bg-secondary text-theme-text-secondary hover:text-white'
                    }`}
                  >
                    Vote on Proposals
                  </button>
                  <button
                    onClick={() => setActiveTab('create')}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                      activeTab === 'create'
                        ? 'bg-theme-primary text-white'
                        : 'bg-theme-bg-secondary text-theme-text-secondary hover:text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Create Proposal
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'vote' ? (
                  // Proposals List
                  <div className="space-y-4">
                    {proposals.map((proposal) => {
                      const totalVotes = proposal.votesFor + proposal.votesAgainst;
                      const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
                      const againstPercentage = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;

                      return (
                        <motion.div
                          key={proposal.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`border rounded-xl p-6 ${
                            proposal.status === 'active'
                              ? 'bg-theme-bg-secondary/50 border-theme-border-primary'
                              : proposal.status === 'passed'
                              ? 'bg-theme-primary/10 border-theme-border/30'
                              : 'bg-theme-primary/10 border-theme-border/30'
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold">{proposal.title}</h3>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  proposal.status === 'active'
                                    ? 'bg-theme-primary/20 text-theme-primary'
                                    : proposal.status === 'passed'
                                    ? 'bg-theme-primary/20 text-theme-primary'
                                    : 'bg-theme-primary/20 text-theme-primary'
                                }`}>
                                  {proposal.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-theme-text-secondary">{proposal.description}</p>
                            </div>
                          </div>

                          {/* Voting Progress */}
                          <div className="space-y-3 mb-4">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-theme-primary flex items-center gap-1">
                                  <TrendingUp className="w-4 h-4" />
                                  For ({forPercentage.toFixed(1)}%)
                                </span>
                                <span className="font-semibold">{proposal.votesFor.toLocaleString()} BLAZE</span>
                              </div>
                              <div className="h-2 bg-theme-bg-card rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-theme-primary to-theme-primary"
                                  style={{ width: `${forPercentage}%` }}
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-theme-primary flex items-center gap-1">
                                  <TrendingDown className="w-4 h-4" />
                                  Against ({againstPercentage.toFixed(1)}%)
                                </span>
                                <span className="font-semibold">{proposal.votesAgainst.toLocaleString()} BLAZE</span>
                              </div>
                              <div className="h-2 bg-theme-bg-card rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-theme-primary to-theme-primary"
                                  style={{ width: `${againstPercentage}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-4 border-t border-theme-border-primary">
                            <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
                              <Clock className="w-4 h-4" />
                              {getTimeRemaining(proposal.endTime)}
                            </div>

                            {proposal.status === 'active' && !proposal.hasVoted && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleVote(proposal.id, false)}
                                  className="px-4 py-2 bg-theme-primary/20 hover:bg-theme-primary/30 text-theme-primary rounded-lg font-semibold transition-colors"
                                >
                                  Vote Against
                                </button>
                                <button
                                  onClick={() => handleVote(proposal.id, true)}
                                  className="px-4 py-2 bg-theme-primary/20 hover:bg-theme-primary/30 text-theme-primary rounded-lg font-semibold transition-colors"
                                >
                                  Vote For
                                </button>
                              </div>
                            )}

                            {proposal.hasVoted && (
                              <span className="text-sm text-theme-text-secondary">✓ You voted</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  // Create Proposal
                  <div className="space-y-6">
                    <div className="bg-theme-primary/10 border border-theme-border/20 rounded-xl p-4">
                      <p className="text-sm text-theme-primary">
                        💡 You need at least 1,000 BLAZE to create a proposal. Voting will be open for 3 days.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Proposal Title</label>
                      <input
                        type="text"
                        value={newProposal.title}
                        onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                        placeholder="e.g., Add support for new blockchain"
                        className="w-full px-4 py-3 bg-theme-bg-secondary rounded-xl border border-theme-border-primary focus:border-theme-border focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Description</label>
                      <textarea
                        value={newProposal.description}
                        onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                        placeholder="Provide details about your proposal..."
                        rows={6}
                        className="w-full px-4 py-3 bg-theme-bg-secondary rounded-xl border border-theme-border-primary focus:border-theme-border focus:outline-none resize-none"
                      />
                    </div>

                    <button
                      onClick={handleCreateProposal}
                      className="w-full py-4 bg-gradient-to-r from-theme-primary to-theme-primary hover:from-theme-primary hover:to-theme-primary rounded-xl font-semibold transition-all"
                    >
                      Create Proposal
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
