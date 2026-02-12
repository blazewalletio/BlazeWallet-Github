'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, QrCode, Shield, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { QRAuthService } from '@/lib/qr-auth-service';
import { useWalletStore } from '@/lib/wallet-store';
import { logger } from '@/lib/logger';

interface QRLoginModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function QRLoginModal({ isOpen, onSuccess, onCancel }: QRLoginModalProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'waiting' | 'approved' | 'expired' | 'error'>('generating');
  const [error, setError] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [qrAuthService] = useState(() => QRAuthService.getInstance());
  const { address } = useWalletStore();

  useEffect(() => {
    if (isOpen) {
      generateQRCode();
    } else {
      // Cleanup when modal closes
      if (sessionId) {
        qrAuthService.removeSession(sessionId);
      }
      setSessionId('');
      setQrCode('');
      setStatus('generating');
      setError('');
    }
  }, [isOpen]);

  const generateQRCode = async () => {
    try {
      setStatus('generating');
      setError('');

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: Date.now()
      };

      const { sessionId: newSessionId, qrCode: newQrCode } = await qrAuthService.createLoginSession(deviceInfo);
      
      setSessionId(newSessionId);
      setQrCode(newQrCode);
      setDeviceInfo(deviceInfo);
      setStatus('waiting');

      // Start waiting for approval
      waitForApproval(newSessionId);

    } catch (error: any) {
      logger.error('Error generating QR code:', error);
      setError('Could not generate QR code. Please try again.');
      setStatus('error');
    }
  };

  const waitForApproval = async (sessionId: string) => {
    try {
      const result = await qrAuthService.waitForApproval(sessionId);
      
      if (!result) {
        setStatus('expired');
        return;
      }

      if (result.status === 'approved') {
        setStatus('approved');
        
        // Success! Close modal after a short delay
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else if (result.status === 'rejected') {
        setError('Login geweigerd door mobiele app');
        setStatus('error');
      } else {
        setStatus('expired');
      }
    } catch (error: any) {
      logger.error('Error waiting for approval:', error);
      setError('An error occurred while waiting for approval');
      setStatus('error');
    }
  };

  const handleRefresh = () => {
    generateQRCode();
  };

  const handleCancel = () => {
    if (sessionId) {
      qrAuthService.removeSession(sessionId);
    }
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-theme-primary to-theme-primary rounded-full flex items-center justify-center mx-auto mb-4">
              {status === 'approved' ? (
                <CheckCircle className="w-8 h-8 text-white" />
              ) : status === 'expired' ? (
                <AlertCircle className="w-8 h-8 text-white" />
              ) : (
                <Smartphone className="w-8 h-8 text-white" />
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">
              {status === 'approved' ? 'Access granted!' : 
               status === 'expired' ? 'QR code expired' :
               status === 'error' ? 'Fout opgetreden' :
               'Inloggen met mobiele app'}
            </h2>
            
            <p className="text-theme-text-muted">
              {status === 'approved' ? 'Logging you in now...' :
               status === 'expired' ? 'The QR code has expired. Generate a new one.' :
               status === 'error' ? 'Er is een fout opgetreden.' :
               'Scan de QR code met je BLAZE Wallet mobiele app'}
            </p>
          </div>

          {status === 'generating' && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-theme-border border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {status === 'waiting' && qrCode && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-theme-bg-card p-4 rounded-xl">
                  <img src={qrCode} alt="QR Code" className="w-48 max-w-[70vw] aspect-square h-auto object-contain" />
                </div>
              </div>
              
              <div className="bg-theme-primary/20 border border-theme-border/30 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-theme-primary mb-2">
                  <QrCode className="w-5 h-5" />
                  <span className="font-medium">Steps:</span>
                </div>
                <ol className="text-sm text-theme-primary space-y-1">
                  <li>1. Open BLAZE Wallet on your phone</li>
                  <li>2. Tap on "Desktop Login"</li>
                  <li>3. Scan this QR code</li>
                  <li>4. Confirm the login on your phone</li>
                </ol>
              </div>
            </div>
          )}

          {status === 'approved' && (
            <div className="flex justify-center py-8">
              <div className="w-16 h-16 bg-theme-primary rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          )}

          {status === 'expired' && (
            <div className="space-y-4">
              <div className="bg-theme-primary/20 border border-theme-border/30 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-theme-primary">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">QR code has expired</span>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && error && (
            <div className="bg-theme-primary/20 border border-theme-border/30 rounded-xl p-4">
              <div className="flex items-center space-x-2 text-theme-primary">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          <div className="flex space-x-3 mt-6">
            {status === 'waiting' && (
              <button
                onClick={handleRefresh}
                className="flex-1 bg-slate-800 hover:bg-theme-bg-card border border-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            )}
            
            {(status === 'expired' || status === 'error') && (
              <button
                onClick={handleRefresh}
                className="flex-1 bg-gradient-to-r from-theme-primary to-theme-primary hover:from-theme-primary hover:to-theme-primary text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>New QR Code</span>
              </button>
            )}

            {status !== 'approved' && (
              <button
                onClick={handleCancel}
                className="flex-1 bg-slate-800 hover:bg-theme-bg-card border border-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="mt-4 text-center">
            <div className="flex items-center justify-center space-x-2 text-theme-text-muted text-sm">
              <Shield className="w-4 h-4" />
              <span>Veilige cross-device authenticatie</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
