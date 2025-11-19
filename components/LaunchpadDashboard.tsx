'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, TrendingUp, Users, Clock, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { logger } from '@/lib/logger';

interface LaunchpadDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LaunchpadDashboard({ isOpen, onClose }: LaunchpadDashboardProps) {
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isInvesting, setIsInvesting] = useState(false);

  // Block body scroll when modal is open
  useBlockBodyScroll(isOpen);

  // Mock projects
  const projects = [
    {
      id: 1,
      name: 'DeFi Protocol',
      description: 'Next-generation decentralized finance platform',
      status: 'upcoming' as const,
      targetRaise: 500000,
      raised: 0,
      price: 0.05,
      minAllocation: 100,
      maxAllocation: 50000,
      startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: 2,
      name: 'NFT Marketplace',
      description: 'Revolutionary NFT trading platform',
      status: 'live' as const,
      targetRaise: 300000,
      raised: 150000,
      price: 0.03,
      minAllocation: 50,
      maxAllocation: 25000,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: 3,
      name: 'Gaming Token',
      description: 'Play-to-earn gaming ecosystem',
      status: 'ended' as const,
      targetRaise: 200000,
      raised: 200000,
      price: 0.02,
      minAllocation: 25,
      maxAllocation: 10000,
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];

  const formatTimeRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days}d ${hours}h`;
  };

  const handleInvest = async () => {
    if (!investAmount || parseFloat(investAmount) < selectedProject.minAllocation) {
      setError(`Minimum investment is $${selectedProject.minAllocation}`);
      return;
    }

    try {
      setIsInvesting(true);
      setError('');
      setSuccess('');

      // Simulate investment
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSuccess(`Investment of $${investAmount} submitted successfully!`);
      setInvestAmount('');
      
      setTimeout(() => {
        setSelectedProject(null);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      logger.error('Error investing:', err);
      setError(err.message || 'Failed to invest');
    } finally {
      setIsInvesting(false);
    }
  };

  if (!isOpen) return null;

  const renderProjectDetail = () => {
    if (!selectedProject) return null;
    
    const progress = (selectedProject.raised / selectedProject.targetRaise) * 100;
    
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedProject(null)}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
        >
          ← Back to Projects
        </button>

        {/* Project Header */}
        <div className="glass-card">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedProject.name}</h3>
              <p className="text-gray-600 mb-4">{selectedProject.description}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 px-3 py-1 rounded-lg text-xs font-semibold ${
                    selectedProject.status === 'live'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                      : selectedProject.status === 'upcoming'
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {selectedProject.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Price:</span>
                  <span className="ml-2 font-semibold text-gray-900">${selectedProject.price}</span>
                </div>
                <div>
                  <span className="text-gray-500">Time Left:</span>
                  <span className="ml-2 font-semibold text-gray-900">{formatTimeRemaining(selectedProject.endDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-900">Fundraising Progress</span>
              <span className="text-sm text-gray-600">
                ${selectedProject.raised.toLocaleString()} / ${selectedProject.targetRaise.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {progress.toFixed(1)}% funded
            </div>
          </div>

          {/* Investment Form */}
          {selectedProject.status === 'live' && (
            <div className="glass-card bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Invest Now</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">Investment Amount (USD)</label>
                  <input aria-label="Number input"
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    placeholder={`Min: $${selectedProject.minAllocation} - Max: $${selectedProject.maxAllocation}`}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all"
                  />
                </div>

                {investAmount && parseFloat(investAmount) > 0 && (
                  <div className="glass-card bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Investment:</span>
                        <span className="font-semibold text-gray-900">${parseFloat(investAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tokens to receive:</span>
                        <span className="font-semibold text-gray-900">
                          {(parseFloat(investAmount) / selectedProject.price).toFixed(0)} tokens
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Price per token:</span>
                        <span className="font-semibold text-gray-900">${selectedProject.price}</span>
                      </div>
                    </div>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInvest}
                  disabled={isInvesting || !investAmount || parseFloat(investAmount) < selectedProject.minAllocation}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
                >
                  {isInvesting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Invest Now
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

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
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Launchpad</h2>
                <p className="text-sm text-gray-600">
                  Discover and invest in the next generation of blockchain projects
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

          {/* Project Detail View or Projects List */}
          {selectedProject ? (
            renderProjectDetail()
          ) : (
            <>
              {/* Requirements Notice */}
              <div className="glass-card mb-6 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border border-orange-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Launchpad Requirements</h3>
                    <p className="text-sm text-gray-600">
                      To participate in token launches, you need to hold at least 1,000 BLAZE tokens and complete KYC verification.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
                >
                  <div className="flex items-center gap-2 text-orange-600 mb-2">
                    <Rocket className="w-5 h-5" />
                    <span className="text-sm font-semibold">Active Launches</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">1</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Currently live
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
                >
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm font-semibold">Total Invested</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">$2,500</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Across all projects
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                >
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-semibold">Projects Participated</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">3</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Successful investments
                  </div>
                </motion.div>
              </div>

              {/* Projects */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project, index) => {
                  const progress = (project.raised / project.targetRaise) * 100;
                  
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: project.status === 'live' ? 1.02 : 1 }}
                      whileTap={{ scale: project.status === 'live' ? 0.98 : 1 }}
                      onClick={() => project.status === 'live' && setSelectedProject(project)}
                      className={`glass-card transition-all ${
                        project.status === 'live'
                          ? 'cursor-pointer hover:shadow-lg hover:shadow-orange-500/20'
                          : 'opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{project.name}</h3>
                          <p className="text-sm text-gray-600">{project.description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ml-2 flex-shrink-0 ${
                          project.status === 'live'
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                            : project.status === 'upcoming'
                            ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {project.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-semibold text-gray-900">
                            ${project.raised.toLocaleString()} / ${project.targetRaise.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Price:</span>
                            <span className="ml-2 font-semibold text-gray-900">${project.price}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Min/Max:</span>
                            <span className="ml-2 font-semibold text-gray-900">
                              ${project.minAllocation}/${project.maxAllocation}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-4 h-4" />
                            {formatTimeRemaining(project.endDate)}
                          </div>
                          {project.status === 'live' && (
                            <div className="flex items-center gap-1 text-orange-600 font-medium">
                              Invest <ExternalLink className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
