'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, TrendingUp, Zap, Crown, Gift, Sparkles, Rocket, Target, BarChart3 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StakingModal({ isOpen, onClose }: StakingModalProps) {
  const [amount, setAmount] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'flexible' | 'six-month' | 'one-year'>('flexible');
  const [isStaking, setIsStaking] = useState(false);

  const stakingPlans = [
    {
      id: 'flexible' as const,
      name: 'Flexible',
      apy: 8,
      lockDays: 0,
      icon: Zap,
      color: 'from-theme-primary to-theme-primary',
      description: 'Unstake anytime',
    },
    {
      id: 'six-month' as const,
      name: '6 Months',
      apy: 15,
      lockDays: 180,
      icon: TrendingUp,
      color: 'from-theme-primary to-theme-primary',
      description: 'Higher rewards',
    },
    {
      id: 'one-year' as const,
      name: '1 Year',
      apy: 25,
      lockDays: 365,
      icon: Crown,
      color: 'from-theme-primary to-theme-primary',
      description: 'Maximum rewards',
    },
  ];

  const calculateRewards = () => {
    if (!amount || parseFloat(amount) === 0) return 0;
    const plan = stakingPlans.find(p => p.id === selectedPlan);
    if (!plan) return 0;
    return (parseFloat(amount) * plan.apy) / 100;
  };

  const handleStake = async () => {
    if (!amount || parseFloat(amount) === 0) return;
    
    setIsStaking(true);
    
    // TODO: Implement actual blockchain staking
    // For now, simulate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsStaking(false);
    setAmount('');
    toast(`🔥 Staked ${amount} BLAZE successfully!`);
    onClose();
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
              <div className="sticky top-0 bg-theme-bg-card/95 backdrop-blur-xl border-b border-theme-border-primary/50 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Lock className="w-6 h-6 text-theme-primary" />
                    Stake BLAZE
                  </h2>
                  <p className="text-sm text-theme-text-secondary mt-1">
                    Earn up to 25% APY + unlock premium features
                  </p>
                </div>
                <button
                  onClick={onClose} aria-label="Close modal"
                  className="text-theme-text-secondary hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                
                {/* Staking Plans */}
                <div>
                  <h3 className="font-semibold mb-4">Choose Your Staking Plan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stakingPlans.map((plan) => {
                      const Icon = plan.icon;
                      const isSelected = selectedPlan === plan.id;
                      
                      return (
                        <motion.button
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            relative p-6 rounded-xl border-2 text-left transition-all
                            ${isSelected 
                              ? 'border-theme-border bg-theme-primary/10' 
                              : 'border-theme-border-primary bg-theme-bg-secondary/50 hover:border-slate-600'
                            }
                          `}
                        >
                          <div className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          
                          <div className="mb-4">
                            <div className="text-lg font-bold">{plan.name}</div>
                            <div className="text-sm text-theme-text-secondary">{plan.description}</div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-3xl font-bold text-theme-primary">
                              {plan.apy}%
                            </div>
                            <div className="text-sm text-theme-text-secondary">APY</div>
                          </div>
                          
                          {plan.lockDays > 0 && (
                            <div className="mt-4 pt-4 border-t border-theme-border-primary">
                              <div className="text-sm text-theme-text-secondary flex items-center gap-1.5">
                                <Lock className="w-4 h-4" />
                                <span>Locked for {plan.lockDays} days</span>
                              </div>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Amount to Stake
                  </label>
                  <div className="relative">
                    <input aria-label="Number input"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-4 bg-theme-bg-secondary rounded-xl border border-theme-border-primary focus:border-theme-border focus:outline-none text-xl"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-theme-text-secondary">BLAZE</span>
                      <button
                        onClick={() => setAmount('10000')}
                        className="px-2 py-1 bg-theme-primary/20 text-theme-primary rounded text-sm hover:bg-theme-primary/30 transition-colors"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-theme-text-secondary">
                    Available: 10,000 BLAZE
                  </div>
                </div>

                {/* Rewards Calculation */}
                {amount && parseFloat(amount) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-theme-primary/10 to-theme-primary/10 border border-theme-border/20 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Gift className="w-5 h-5 text-theme-primary" />
                      <h4 className="font-semibold">Estimated Rewards</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-theme-text-secondary mb-1">Yearly Rewards</div>
                        <div className="text-2xl font-bold text-theme-primary">
                          +{calculateRewards().toFixed(2)} BLAZE
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-theme-text-secondary mb-1">USD Value (est.)</div>
                        <div className="text-2xl font-bold text-theme-primary">
                          ${(calculateRewards() * 0.01).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {parseFloat(amount) >= 10000 && (
                      <div className="mt-4 pt-4 border-t border-theme-border/20">
                        <div className="flex items-center gap-2 text-theme-primary">
                          <Crown className="w-5 h-5" />
                          <span className="font-semibold">Premium Member Unlocked!</span>
                        </div>
                        <ul className="mt-2 text-sm text-theme-text-primary space-y-1">
                          <li className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> 0% swap fees (100% discount)</li>
                          <li className="flex items-center gap-1.5"><Rocket className="w-4 h-4" /> Priority support</li>
                          <li className="flex items-center gap-1.5"><Target className="w-4 h-4" /> Launchpad access (if ≥5k)</li>
                          <li className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Advanced analytics</li>
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Benefits */}
                <div className="bg-theme-bg-secondary/50 rounded-xl p-6 border border-theme-border-primary">
                  <h4 className="font-semibold mb-3">Staking Benefits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-theme-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-theme-primary text-xs">✓</span>
                      </div>
                      <span className="text-theme-text-primary">Earn passive income in BLAZE</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-theme-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-theme-primary text-xs">✓</span>
                      </div>
                      <span className="text-theme-text-primary">Compound rewards automatically</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-theme-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-theme-primary text-xs">✓</span>
                      </div>
                      <span className="text-theme-text-primary">Vote on governance proposals</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-theme-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-theme-primary text-xs">✓</span>
                      </div>
                      <span className="text-theme-text-primary">Unlock premium features</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 bg-theme-bg-secondary hover:bg-theme-bg-card rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStake}
                    disabled={!amount || parseFloat(amount) === 0 || isStaking}
                    className="flex-1 py-4 bg-gradient-to-r from-theme-primary to-theme-primary hover:from-theme-primary hover:to-theme-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  >
                    {isStaking ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Staking...
                      </span>
                    ) : (
                      `Stake ${amount || '0'} BLAZE`
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
