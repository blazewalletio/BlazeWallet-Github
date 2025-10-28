'use client';

import { motion } from 'framer-motion';
import { Activity, Clock, ArrowUpRight, ArrowDownLeft, Repeat, ExternalLink } from 'lucide-react';
import TransactionHistory from '../TransactionHistory';

export default function HistoryTab() {
  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-theme-bg-card/95 border-b border-theme-border-primary shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-theme-primary to-theme-primary flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-theme-text-primary">Activity</h1>
                <p className="text-sm text-theme-text-muted">Transaction history</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Activity Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          {[
            { label: 'Total Transactions', value: '47', icon: Activity, color: 'blue' },
            { label: 'This Month', value: '12', icon: Clock, color: 'green' },
            { label: 'Gas Saved', value: '$23.50', icon: Repeat, color: 'purple' },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-4 text-center"
              >
                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 flex items-center justify-center mx-auto mb-3`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <div className="text-2xl font-bold text-theme-text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-theme-text-muted">{stat.label}</div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Quick Filter Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3 mb-6 overflow-x-auto pb-2"
        >
          {[
            { label: 'All', icon: Activity, active: true },
            { label: 'Sent', icon: ArrowUpRight, active: false },
            { label: 'Received', icon: ArrowDownLeft, active: false },
            { label: 'Swapped', icon: Repeat, active: false },
          ].map((filter, index) => {
            const Icon = filter.icon;
            return (
              <motion.button
                key={filter.label}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  filter.active
                    ? 'bg-primary-600 text-white shadow-soft'
                    : 'bg-theme-bg-secondary text-theme-text-primary hover:bg-theme-bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{filter.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Transaction History Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <TransactionHistory />
        </motion.div>
      </div>
    </>
  );
}
