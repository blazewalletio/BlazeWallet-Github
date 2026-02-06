'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Smartphone, MapPin, Chrome, Calendar, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SuggestedDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  lastUsedAt: string;
  location?: {
    city: string;
    country: string;
  };
  browser: string;
  os: string;
}

interface DeviceConfirmationModalProps {
  isOpen: boolean;
  suggestedDevice: SuggestedDevice;
  score: number;
  onConfirmYes: () => Promise<void>;
  onConfirmNo: () => void;
  onCancel: () => void;
}

export default function DeviceConfirmationModal({
  isOpen,
  suggestedDevice,
  score,
  onConfirmYes,
  onConfirmNo,
  onCancel,
}: DeviceConfirmationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleConfirmYes = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await onConfirmYes();
      logger.log('✅ Device confirmed by user');
    } catch (err: any) {
      logger.error('❌ Device confirmation failed:', err);
      setError(err.message || 'Failed to confirm device');
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatLastUsed = (lastUsedAt: string) => {
    const date = new Date(lastUsedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden my-8"
            >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 text-white">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl backdrop-blur">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                Recognize this device?
              </h2>
              <p className="text-white/90 text-center text-sm">
                We think this might be you. Can you confirm?
              </p>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Match Score Badge */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center">
                <div className="text-sm font-medium text-orange-800 mb-1">
                  Match Confidence
                </div>
                <div className="text-3xl font-bold text-orange-600">
                  {score}%
                </div>
                <div className="text-xs text-orange-700 mt-1">
                  Based on device characteristics
                </div>
              </div>
              
              {/* Device Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-gray-900">
                      {suggestedDevice.deviceName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {suggestedDevice.browser} • {suggestedDevice.os}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 pl-15">
                  {suggestedDevice.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span>{suggestedDevice.location.city}, {suggestedDevice.location.country}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Last used {formatLastUsed(suggestedDevice.lastUsedAt)}</span>
                  </div>
                </div>
              </motion.div>
              
              {/* Information Box */}
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-900 text-center">
                  💡 If this is your device, we'll log you in instantly. If not, we'll verify via email for security.
                </p>
              </div>
              
              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"
                >
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </motion.div>
              )}
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleConfirmYes}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-2xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Yes, this is me
                    </>
                  )}
                </button>
                
                <button
                  onClick={onConfirmNo}
                  disabled={isLoading}
                  className="w-full py-4 bg-gray-100 text-gray-800 font-semibold rounded-2xl hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  No, verify with email
                </button>
              </div>
              
              {/* Cancel Button */}
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}

