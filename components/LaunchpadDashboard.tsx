'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, TrendingUp, Users, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function LaunchpadDashboard() {
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [investAmount, setInvestAmount] = useState('');

  // Mock projects
  const projects = [
    {
      id: 1,
      name: 'DeFi Protocol',
      logo: '🚀',
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
      logo: '🎨',
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
      logo: '🎮',
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

  const handleInvest = () => {
    if (!investAmount || parseFloat(investAmount) < selectedProject.minAllocation) {
      alert(`Minimum investment is $${selectedProject.minAllocation}`);
      return;
    }
    alert(`Investment of $${investAmount} submitted!`);
    setSelectedProject(null);
    setInvestAmount('');
  };

  if (selectedProject) {
    const progress = (selectedProject.raised / selectedProject.targetRaise) * 100;
    
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedProject(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Projects
        </button>

        {/* Project Header */}
        <div className="glass-card p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="text-6xl">{selectedProject.logo}</div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{selectedProject.name}</h2>
              <p className="text-gray-600 mb-4">{selectedProject.description}</p>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                    selectedProject.status === 'live'
                      ? 'bg-green-500/20 text-green-400'
                      : selectedProject.status === 'upcoming'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {selectedProject.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Price:</span>
                  <span className="ml-2 font-semibold">${selectedProject.price}</span>
                </div>
                <div>
                  <span className="text-gray-500">Time Left:</span>
                  <span className="ml-2 font-semibold">{formatTimeRemaining(selectedProject.endDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Fundraising Progress</span>
              <span className="text-sm text-gray-600">
                ${selectedProject.raised.toLocaleString()} / ${selectedProject.targetRaise.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {progress.toFixed(1)}% funded
            </div>
          </div>

          {/* Investment Form */}
          {selectedProject.status === 'live' && (
            <div className="glass-card p-6 border border-gray-200">
              <h3 className="font-semibold mb-4">Invest Now</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Investment Amount (USD)</label>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    placeholder={`Min: $${selectedProject.minAllocation} - Max: $${selectedProject.maxAllocation}`}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {investAmount && parseFloat(investAmount) > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Investment:</span>
                        <span className="font-semibold">${parseFloat(investAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tokens to receive:</span>
                        <span className="font-semibold">
                          {(parseFloat(investAmount) / selectedProject.price).toFixed(0)} tokens
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price per token:</span>
                        <span className="font-semibold">${selectedProject.price}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleInvest}
                  disabled={!investAmount || parseFloat(investAmount) < selectedProject.minAllocation}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Rocket className="w-5 h-5" />
                  Invest Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-orange-400" />
          Launchpad
        </h2>
        <p className="text-gray-600">
          Discover and invest in the next generation of blockchain projects
        </p>
      </div>

      {/* Requirements Notice */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Rocket className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-orange-400 mb-1">Launchpad Requirements</h3>
            <p className="text-sm text-orange-300">
              To participate in token launches, you need to hold at least 1,000 BLAZE tokens and complete KYC verification.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Rocket className="w-5 h-5" />
            <span className="text-sm font-semibold">Active Launches</span>
          </div>
          <div className="text-3xl font-bold text-orange-400">1</div>
          <div className="text-sm text-gray-600 mt-1">
            Currently live
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold">Total Invested</span>
          </div>
          <div className="text-3xl font-bold text-green-400">$2,500</div>
          <div className="text-sm text-gray-600 mt-1">
            Across all projects
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold">Projects Participated</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">3</div>
          <div className="text-sm text-gray-600 mt-1">
            Successful investments
          </div>
        </motion.div>
      </div>

      {/* Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => {
          const progress = (project.raised / project.targetRaise) * 100;
          
          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => project.status === 'live' && setSelectedProject(project)}
              className={`glass-card p-6 cursor-pointer transition-all ${
                project.status === 'live'
                  ? 'hover:shadow-lg hover:shadow-orange-500/20'
                  : 'opacity-75'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{project.logo}</div>
                  <div>
                    <h3 className="text-xl font-bold">{project.name}</h3>
                    <p className="text-sm text-gray-600">{project.description}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  project.status === 'live'
                    ? 'bg-green-500/20 text-green-400'
                    : project.status === 'upcoming'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {project.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-semibold">
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
                    <span className="text-gray-600">Price:</span>
                    <span className="ml-2 font-semibold">${project.price}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Min/Max:</span>
                    <span className="ml-2 font-semibold">
                      ${project.minAllocation}/${project.maxAllocation}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    {formatTimeRemaining(project.endDate)}
                  </div>
                  {project.status === 'live' && (
                    <button className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors">
                      Invest <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
