'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Clock, Monitor, TrendingUp, AlertTriangle, Settings } from 'lucide-react';

interface ActivityLog {
  id: string;
  activity_type: string;
  description: string;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

interface RecentActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityLog[];
}

export default function RecentActivityModal({ isOpen, onClose, activities }: RecentActivityModalProps) {
  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login': return Monitor;
      case 'transaction': return TrendingUp;
      case 'security_alert': return AlertTriangle;
      case 'settings_change': return Settings;
      default: return Activity;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-gray-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-0 bg-gray-50 overflow-y-auto"
          >
            {/* Header - Sticky */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shadow-sm z-10">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                <p className="text-xs text-gray-600">
                  {activities.length > 0 ? `Last ${activities.length} actions` : 'No activity yet'}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto p-6">
              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No recent activity</h3>
                  <p className="text-sm text-gray-600">
                    Your account activity will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const Icon = getActivityIcon(activity.activity_type);
                    
                    return (
                      <div
                        key={activity.id}
                        className="glass-card p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-50 rounded-lg flex-shrink-0">
                            <Icon className="w-5 h-5 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {activity.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                              {activity.ip_address && (
                                <span className="font-mono">{activity.ip_address}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatActivityTime(activity.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

