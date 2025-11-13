'use client';

import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';
import { 
  Bot, 
  Shield, 
  Brain, 
  Zap, 
  Sparkles,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';

const aiTools = [
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    description: 'Natural language transactions',
    icon: Sparkles,
    gradient: 'from-theme-primary to-theme-primary',
    status: 'active',
  },
  {
    id: 'scam-detector',
    title: 'Scam Detector',
    description: 'Real-time risico scanning',
    icon: Shield,
    gradient: 'from-theme-primary to-theme-primary',
    status: 'active',
  },
  {
    id: 'portfolio-advisor',
    title: 'Portfolio Advisor',
    description: 'Gepersonaliseerde tips',
    icon: Brain,
    gradient: 'from-theme-primary to-theme-primary',
    status: 'active',
  },
  {
    id: 'gas-optimizer',
    title: 'Gas Optimizer',
    description: 'Bespaar op gas fees',
    icon: Zap,
    gradient: 'from-theme-primary to-theme-primary',
    status: 'active',
  },
];

interface AIToolsTabProps {
  onOpenTool?: (toolId: string) => void;
}

export default function AIToolsTab({ onOpenTool }: AIToolsTabProps) {
  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-theme-bg-card/95 border-b border-theme-border-primary shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-theme-primary to-theme-primary flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-theme-text-primary">AI Tools</h1>
                <p className="text-sm text-theme-text-muted">Smart crypto assistance</p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="glass-card p-3 rounded-xl hover:bg-theme-bg-secondary"
            >
              <SettingsIcon className="w-5 h-5 text-theme-text-primary" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* AI Tools Grid */}
        <div className="space-y-4">
          {aiTools.map((tool, index) => {
            const Icon = tool.icon;
            
            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card card-hover relative overflow-hidden"
              >
                <div className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center relative`}>
                      <Icon className="w-8 h-8 text-white" />
                      
                      {/* Status indicator */}
                      {tool.status === 'active' && (
                        <motion.div
                          className="absolute -top-1 -right-1 w-4 h-4 bg-theme-primary rounded-full border-2 border-white"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.7, 1],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-theme-text-primary">{tool.title}</h3>
                        {tool.status === 'coming-soon' && (
                          <span className="px-2 py-1 bg-theme-primary text-theme-primary text-xs font-medium rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-theme-text-secondary text-sm">{tool.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {tool.status === 'active' ? (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onOpenTool?.(tool.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-theme-bg-secondary hover:bg-theme-bg-secondary rounded-xl transition-colors"
                      >
                        <span className="text-sm font-medium">Open</span>
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    ) : (
                      <div className="text-theme-text-muted text-sm">
                        In development
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Hover effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-theme-primary/5 to-theme-primary/5 pointer-events-none opacity-0 transition-opacity duration-300 hover:opacity-100" />
              </motion.div>
            );
          })}
        </div>

        {/* AI Overview Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 bg-gradient-to-r from-theme-primary/10 to-theme-primary/10 border border-theme-border/50"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-theme-primary to-theme-primary flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-text-primary">AI-Powered Wallet</h3>
              <p className="text-sm text-theme-text-secondary">Smart features for safer crypto management</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-theme-primary rounded-full animate-pulse" />
              <span className="text-theme-text-secondary">Real-time protection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-theme-primary rounded-full animate-pulse" />
              <span className="text-theme-text-secondary">Smart optimization</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-theme-primary rounded-full animate-pulse" />
              <span className="text-theme-text-secondary">Natural language</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-theme-primary rounded-full" />
              <span className="text-theme-text-secondary">Learning mode</span>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Threats blocked', value: '127', icon: Shield },
            { label: 'Fees saved', value: '$342', icon: Zap },
            { label: 'AI suggestions', value: '23', icon: Brain },
            { label: 'Accuracy rate', value: '94%', icon: Sparkles },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="glass-card p-4 text-center"
              >
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-theme-bg-secondary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-theme-text-secondary" />
                </div>
                <div className="text-2xl font-bold text-theme-text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-theme-text-muted">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
}
