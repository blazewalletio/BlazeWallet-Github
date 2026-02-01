'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Monitor, Apple, Chrome, Clock, Trash2, CheckCircle } from 'lucide-react';

interface TrustedDevice {
  id: string;
  device_name: string;
  browser: string;
  os: string;
  last_used_at: string;
  is_current: boolean;
  verified_at: string | null;
}

interface TrustedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: TrustedDevice[];
  onRemoveDevice: (deviceId: string) => void;
}

export default function TrustedDevicesModal({ 
  isOpen, 
  onClose, 
  devices,
  onRemoveDevice 
}: TrustedDevicesModalProps) {
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
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Trusted Devices</h2>
                <p className="text-xs text-gray-600">
                  {devices.length} {devices.length === 1 ? 'device' : 'devices'} verified
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto p-6">
              {devices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No trusted devices yet</h3>
                  <p className="text-sm text-gray-600">
                    Verified devices will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="glass-card p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            device.is_current ? 'bg-orange-100' : 'bg-gray-100'
                          }`}>
                            {device.is_current ? (
                              <Monitor className="w-5 h-5 text-orange-500" />
                            ) : device.os.toLowerCase().includes('ios') || device.os.toLowerCase().includes('iphone') ? (
                              <Apple className="w-5 h-5 text-gray-600" />
                            ) : device.os.toLowerCase().includes('android') ? (
                              <Smartphone className="w-5 h-5 text-gray-600" />
                            ) : (
                              <Monitor className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {device.device_name}
                              </p>
                              {device.is_current && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded flex-shrink-0">
                                  Current
                                </span>
                              )}
                              {device.verified_at && (
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-1">
                              {device.browser} · {device.os}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last used {formatActivityTime(device.last_used_at)}
                            </p>
                          </div>
                        </div>
                        
                        {!device.is_current && (
                          <button
                            onClick={() => onRemoveDevice(device.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="Remove device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

