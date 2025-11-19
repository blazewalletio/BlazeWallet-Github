'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Shield, PieChart, Zap, MessageSquare, ArrowRight, ArrowLeft } from 'lucide-react';
import { logger } from '@/lib/logger';

interface AIBrainAssistantProps {
  onClose: () => void;
  onOpenFeature: (feature: 'assistant' | 'scanner' | 'advisor' | 'optimizer' | 'chat') => void;
  context?: any;
}

export default function AIBrainAssistant({ 
  onClose,
  onOpenFeature,
  context 
}: AIBrainAssistantProps) {
  const aiFeatures = [
    {
      id: 'assistant' as const,
      icon: Sparkles,
      title: 'Transaction Assistant',
      description: 'Natural language transactions',
      gradient: 'from-yellow-500 to-orange-500',
      tag: '🔥 Popular',
    },
    {
      id: 'scanner' as const,
      icon: Shield,
      title: 'Scam Detector',
      description: 'Real-time security scanning',
      gradient: 'from-blue-500 to-cyan-500',
      tag: '🛡️ Essential',
    },
    {
      id: 'advisor' as const,
      icon: PieChart,
      title: 'Portfolio Advisor',
      description: 'Personalized analysis',
      gradient: 'from-orange-500 to-yellow-500',
      tag: '📊 Smart',
    },
    {
      id: 'optimizer' as const,
      icon: Zap,
      title: 'Gas Optimizer',
      description: 'Save on transaction fees',
      gradient: 'from-green-500 to-emerald-500',
      tag: '💰 Save',
    },
    {
      id: 'chat' as const,
      icon: MessageSquare,
      title: 'Crypto Expert',
      description: '24/7 AI support chat',
      gradient: 'from-orange-500 to-yellow-500',
      tag: '💬 Always available',
    },
  ];

  const insights = [
    { icon: '💎', text: `Portfolio value: €${context?.totalValue?.toFixed(2) || '0.00'}` },
    { icon: '🪙', text: `${context?.tokens?.length || 0} tokens in your wallet` },
    { icon: '⚡', text: 'Gas prices currently average' },
    { icon: '✅', text: 'All AI features active' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Back Button */}
          <button
            onClick={onClose} aria-label="Close modal"
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Brain className="w-6 h-6 text-orange-500" />
              AI Brain
            </h2>
            <p className="text-gray-600">
              All-in-one AI command center
            </p>
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 rounded-xl bg-white border border-gray-200"
              >
                <div className="text-2xl mb-2">{insight.icon}</div>
                <p className="text-xs text-gray-700 font-medium">{insight.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Welcome Message */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20">
            <h3 className="text-lg font-bold mb-2">Welcome to AI Brain 🧠</h3>
            <p className="text-sm text-gray-700">
              Your central AI command center. All AI features combined in one powerful interface.
              Choose which AI tool you want to use below, or use the shortcuts for quick actions.
            </p>
          </div>

          {/* AI Features Grid */}
          <div>
            <h3 className="text-lg font-semibold mb-4">AI Tools</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {aiFeatures.map((feature, i) => (
                <motion.button
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 + 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onOpenFeature(feature.id);
                    onClose();
                  }}
                  className="group relative p-5 rounded-xl bg-white border-2 border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all text-left overflow-hidden"
                >
                  {/* Background gradient on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                        {feature.tag}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                    
                    <div className="flex items-center gap-1 text-sm text-orange-500 font-medium group-hover:gap-2 transition-all">
                      <span>Open tool</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  onOpenFeature('assistant');
                  onClose();
                }}
                className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-orange-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
              >
                <div className="text-2xl mb-2">💬</div>
                <div className="text-sm font-medium text-gray-900">Send with AI</div>
              </button>
              
              <button
                onClick={() => {
                  onOpenFeature('scanner');
                  onClose();
                }}
                className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm font-medium text-gray-900">Scan address</div>
              </button>
              
              <button
                onClick={() => {
                  onOpenFeature('advisor');
                  onClose();
                }}
                className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-orange-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
              >
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm font-medium text-gray-900">Check portfolio</div>
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-700">
              💡 <strong>Pro tip:</strong> AI Brain combines all AI features in one interface.
              Perfect for power users who want to quickly switch between different AI tools.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
