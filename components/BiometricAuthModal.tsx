'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Shield, AlertCircle, CheckCircle, X } from 'lucide-react';
import { WebAuthnService } from '@/lib/webauthn-service';
import { BiometricStore } from '@/lib/biometric-store';
import { useWalletStore } from '@/lib/wallet-store';
import { logger } from '@/lib/logger';

interface BiometricAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  onRegister?: () => void;
  mode: 'authenticate' | 'register';
  username?: string;
  password?: string; // Password to store for biometric unlock
}

export default function BiometricAuthModal({ 
  isOpen, 
  onSuccess, 
  onCancel, 
  onRegister,
  mode,
  username = 'BLAZE User',
  password
}: BiometricAuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [webauthnService] = useState(() => WebAuthnService.getInstance());
  const [biometricStore] = useState(() => BiometricStore.getInstance());
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const { unlockWithBiometric } = useWalletStore();

  useEffect(() => {
    const checkSupport = async () => {
      const supported = webauthnService.isSupported();
      const available = await webauthnService.isPlatformAuthenticatorAvailable();
      
      setIsSupported(supported);
      setIsAvailable(available);
    };

    if (isOpen) {
      checkSupport();
    }
  }, [isOpen, webauthnService]);

  const handleBiometricAuth = async () => {
    if (!isSupported || !isAvailable) {
      setError('Biometric authentication is not available on this device');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (mode === 'register') {
        // Register new biometric credential
        // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
        const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
        if (!walletIdentifier) {
          throw new Error('Cannot determine wallet identifier for biometric setup');
        }
        
        // ✅ WALLET-SPECIFIC: Detect wallet type
        const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
        const walletType: 'email' | 'seed' = createdWithEmail ? 'email' : 'seed';
        
        const result = await webauthnService.register(walletIdentifier, username, walletType);
        
        if (result.success && result.credential) {
          // ✅ WALLET-SPECIFIC: Store credential indexed by wallet identifier
          webauthnService.storeCredential(result.credential, walletIdentifier);
          
          // ✅ SECURITY: Store password for biometric unlock AFTER credential registration
          // This ensures password can only be retrieved with biometric authentication
          if (password) {
            logger.log('💾 Storing password for biometric access...');
            const stored = await biometricStore.storePassword(password, walletIdentifier);
            if (!stored) {
              logger.warn('⚠️ Failed to store password for biometric access');
            } else {
              logger.log('✅ Password stored securely for biometric unlock');
            }
          }
          
          setSuccess(true);
          setTimeout(() => {
            onSuccess();
          }, 1000);
        } else {
          setError(result.error || 'Registratie mislukt');
        }
      } else {
        // Authenticate with existing credential
        // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
        const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
        if (!walletIdentifier) {
          throw new Error('Cannot determine wallet identifier');
        }
        
        const credential = webauthnService.getStoredCredential(walletIdentifier);
        
        if (!credential) {
          setError('Geen biometrische credentials gevonden. Registreer eerst je biometrie.');
          return;
        }

        const result = await webauthnService.authenticate(credential.id);
        
        if (result.success) {
          // Unlock wallet with biometric authentication
          try {
            await unlockWithBiometric();
            setSuccess(true);
            setTimeout(() => {
              onSuccess();
            }, 1000);
          } catch (unlockError: any) {
            setError(unlockError.message || 'Wallet unlock mislukt');
          }
        } else {
          setError(result.error || 'Authenticatie mislukt');
        }
      }
    } catch (error: any) {
      logger.error('Biometric auth error:', error);
      setError(error.message || 'Er is een fout opgetreden');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    if (mode === 'register' && onRegister) {
      onRegister();
    } else {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                {success ? (
                  <CheckCircle className="w-10 h-10 text-white" />
                ) : (
                  <Fingerprint className="w-10 h-10 text-white" />
                )}
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {mode === 'register' ? 'Biometrie instellen' : 'Biometrische toegang'}
              </h2>
              
              <p className="text-gray-600">
                {mode === 'register' 
                  ? 'Stel vingerafdruk of Face ID in voor snelle toegang'
                  : 'Gebruik je vingerafdruk of Face ID om toegang te krijgen'
                }
              </p>
            </div>

            {!isSupported && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">WebAuthn not supported</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Biometric authentication is not available in this browser.
                </p>
              </div>
            )}

            {isSupported && !isAvailable && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">Biometrics not available</span>
                </div>
                <p className="text-sm text-orange-600 mt-1">
                  Dit apparaat ondersteunt geen vingerafdruk of Face ID authenticatie.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">
                    {mode === 'register' ? 'Biometrics successfully set up!' : 'Access granted!'}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleBiometricAuth}
                disabled={isLoading || !isSupported || !isAvailable}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    <span>
                      {mode === 'register' 
                        ? 'Biometrie instellen' 
                        : 'Vingerafdruk / Face ID'
                      }
                    </span>
                  </>
                )}
              </button>

              <button
                onClick={handleSkip}
                className="w-full bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                <X className="w-4 h-4" />
                <span>
                  {mode === 'register' ? 'Overslaan' : 'Annuleren'}
                </span>
              </button>
            </div>

            <div className="mt-6 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <Shield className="w-4 h-4" />
                <span>Your biometric data stays secure on this device</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
