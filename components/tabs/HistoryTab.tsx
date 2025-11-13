'use client';

import { motion } from 'framer-motion';
import { Activity, Clock, ArrowUpRight, ArrowDownLeft, Repeat } from 'lucide-react';
import TransactionHistory from '../TransactionHistory';
import { logger } from '@/lib/logger';

export default function HistoryTab() {
  return (
    <>
      {/* Header - Blaze Style */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Activity</h1>
              <p className="text-sm text-orange-100">Your transaction history</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Quick Filter Buttons - Clean Blaze Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-2"
        >
          {[
            { label: 'All', icon: Activity, active: true },
            { label: 'Sent', icon: ArrowUpRight, active: false },
            { label: 'Received', icon: ArrowDownLeft, active: false },
            { label: 'Swapped', icon: Repeat, active: false },
          ].map((filter) => {
            const Icon = filter.icon;
            return (
              <motion.button
                key={filter.label}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all font-medium ${
                  filter.active
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{filter.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Transaction History Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TransactionHistory />
        </motion.div>
      </div>
    </>
  );
}
