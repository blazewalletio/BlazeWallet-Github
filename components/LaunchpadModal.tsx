'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, Lock, TrendingUp, Users, Clock, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface LaunchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LaunchpadProject {
  id: number;
  name: string;
  symbol: string;
  description: string;
  logo: string;
  totalRaise: number;
  raised: number;
  participants: number;
  startTime: Date;
  endTime: Date;
  minAllocation: number;
  maxAllocation: number;
  tokenPrice: number;
  status: 'upcoming' | 'live' | 'ended';
}

export default function LaunchpadModal({ isOpen, onClose }: LaunchpadModalProps) {
  const [selectedProject, setSelectedProject] = useState<LaunchpadProject | null>(null);
  const [investAmount, setInvestAmount] = useState('');

  // Mock projects
  const projects: LaunchpadProject[] = [
    {
      id: 1,
      name: 'DeFiMax Protocol',
      symbol: 'DMAX',
      description: 'Next-generation yield aggregator with AI-powered strategies',
      logo: '🎯',
      totalRaise: 500000,
      raised: 350000,
      participants: 1250,
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      minAllocation: 100,
      maxAllocation: 5000,
      tokenPrice: 0.05,
      status: 'live',
    },
    {
      id: 2,
      name: 'GameFi Arena',
      symbol: 'GFA',
      description: 'Play-to-earn gaming platform with NFT marketplace',
      logo: '🎮',
      totalRaise: 750000,
      raised: 0,
      participants: 0,
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      minAllocation: 200,
      maxAllocation: 10000,
      tokenPrice: 0.10,
      status: 'upcoming',
    },
    {
      id: 3,
      name: 'NFT Swap',
      symbol: 'NFTS',
      description: 'Cross-chain NFT marketplace and exchange protocol',
      logo: '🖼️',
      totalRaise: 400000,
      raised: 400000,
      participants: 2100,
      startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      minAllocation: 100,
      maxAllocation: 3000,
      tokenPrice: 0.08,
      status: 'ended',
    },
  ];

  const handleInvest = () => {
    if (!selectedProject || !investAmount) return;
    toast(`Invested $${investAmount} in ${selectedProject.name}!`);
    setInvestAmount('');
    setSelectedProject(null);
  };

  const getTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    if (diff < 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
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
              className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-theme-bg-card rounded-2xl border border-theme-border-primary/50 pointer-events-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-theme-bg-card/95 backdrop-blur-xl border-b border-theme-border-primary/50 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Rocket className="w-6 h-6 text-theme-primary" />
                    Launchpad
                  </h2>
                  <p className="text-sm text-theme-text-secondary mt-1">
                    Invest early in promising crypto projects (Requires 5,000+ BLAZE)
                  </p>
                </div>
                <button
                  onClick={onClose} aria-label="Close modal"
                  className="text-theme-text-secondary hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {!selectedProject ? (
                  // Projects Grid
                  <div className="space-y-6">
                    {/* Requirements Notice */}
                    <div className="bg-theme-primary/10 border border-theme-border/20 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-theme-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-theme-primary mb-1">Whitelist Requirements</p>
                          <p className="text-theme-text-primary">
                            Hold at least 5,000 BLAZE tokens to participate in launchpad projects. 
                            Stake your tokens to qualify instantly!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Projects */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {projects.map((project) => {
                        const progress = (project.raised / project.totalRaise) * 100;

                        return (
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => project.status === 'live' && setSelectedProject(project)}
                            className={`border rounded-xl p-6 transition-all ${
                              project.status === 'live'
                                ? 'bg-theme-bg-secondary/50 border-theme-border-primary cursor-pointer hover:border-theme-border'
                                : project.status === 'upcoming'
                                ? 'bg-theme-primary/5 border-theme-border/20'
                                : 'bg-theme-bg-secondary/30 border-theme-border-primary/50 opacity-60'
                            }`}
                          >
                            {/* Project Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="text-4xl">{project.logo}</div>
                                <div>
                                  <h3 className="text-lg font-bold">{project.name}</h3>
                                  <span className="text-sm text-theme-text-secondary">${project.symbol}</span>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                project.status === 'live'
                                  ? 'bg-theme-primary/20 text-theme-primary animate-pulse'
                                  : project.status === 'upcoming'
                                  ? 'bg-theme-primary/20 text-theme-primary'
                                  : 'bg-slate-500/20 text-theme-text-secondary'
                              }`}>
                                {project.status.toUpperCase()}
                              </span>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-theme-text-secondary mb-4">{project.description}</p>

                            {/* Stats */}
                            <div className="space-y-3 mb-4">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-theme-text-secondary">Progress</span>
                                  <span className="font-semibold">
                                    ${project.raised.toLocaleString()} / ${project.totalRaise.toLocaleString()}
                                  </span>
                                </div>
                                <div className="h-2 bg-theme-bg-card rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-theme-gradient-primary"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2 text-theme-text-secondary">
                                  <Users className="w-4 h-4" />
                                  {project.participants} participants
                                </div>
                                <div className="flex items-center gap-2 text-theme-text-secondary">
                                  <Clock className="w-4 h-4" />
                                  {getTimeRemaining(project.endTime)}
                                </div>
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="pt-4 border-t border-theme-border-primary">
                              <div className="flex justify-between text-sm">
                                <span className="text-theme-text-secondary">Token Price</span>
                                <span className="font-semibold">${project.tokenPrice}</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Project Details & Investment
                  <div className="space-y-6">
                    <button
                      onClick={() => setSelectedProject(null)}
                      className="text-theme-text-secondary hover:text-white transition-colors flex items-center gap-2"
                    >
                      ← Back to Projects
                    </button>

                    {/* Project Info */}
                    <div className="bg-theme-bg-secondary/50 border border-theme-border-primary rounded-xl p-6">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="text-6xl">{selectedProject.logo}</div>
                        <div className="flex-1">
                          <h2 className="text-3xl font-bold mb-2">{selectedProject.name}</h2>
                          <p className="text-theme-text-secondary mb-4">{selectedProject.description}</p>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="text-theme-text-secondary">Token: </span>
                              <span className="font-semibold">${selectedProject.symbol}</span>
                            </div>
                            <div>
                              <span className="text-theme-text-secondary">Price: </span>
                              <span className="font-semibold">${selectedProject.tokenPrice}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Investment Form */}
                      <div className="bg-theme-bg-card/50 rounded-xl p-6 border border-theme-border-primary">
                        <h3 className="font-semibold mb-4">Invest Now</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold mb-2">Investment Amount (USD)</label>
                            <input aria-label="Number input"
                              type="number"
                              value={investAmount}
                              onChange={(e) => setInvestAmount(e.target.value)}
                              placeholder={`Min: $${selectedProject.minAllocation} - Max: $${selectedProject.maxAllocation}`}
                              className="w-full px-4 py-3 bg-theme-bg-secondary rounded-xl border border-theme-border-primary focus:border-theme-border focus:outline-none"
                            />
                          </div>

                          {investAmount && parseFloat(investAmount) > 0 && (
                            <div className="bg-theme-primary/10 border border-theme-border/20 rounded-lg p-4">
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-theme-text-secondary">You will receive:</span>
                                  <span className="font-bold text-theme-primary">
                                    {(parseFloat(investAmount) / selectedProject.tokenPrice).toFixed(2)} {selectedProject.symbol}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-theme-text-secondary">Vesting:</span>
                                  <span>25% TGE, 75% over 3 months</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            onClick={handleInvest}
                            disabled={!investAmount || parseFloat(investAmount) < selectedProject.minAllocation}
                            className="w-full py-4 bg-theme-gradient-primary hover:from-theme-primary hover:to-theme-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Invest ${investAmount || '0'}
                          </button>
                        </div>
                      </div>
                    </div>
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
