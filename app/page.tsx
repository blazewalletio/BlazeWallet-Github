'use client';

import { useEffect, useState } from 'react';
import { useWalletStore } from '@/lib/wallet-store';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';
import SplashScreen from '@/components/SplashScreen';
import PasswordSetupModal from '@/components/PasswordSetupModal';
import PasswordUnlockModal from '@/components/PasswordUnlockModal';
import BiometricAuthModal from '@/components/BiometricAuthModal';
import QRLoginModal from '@/components/QRLoginModal';
import { logger } from '@/lib/logger';

export default function Home() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showPasswordUnlock, setShowPasswordUnlock] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [showBiometricAuth, setShowBiometricAuth] = useState(false);
  const [showQRLogin, setShowQRLogin] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [setupPassword, setSetupPassword] = useState<string | undefined>(undefined); // Store password temporarily for biometric setup
  const { importWallet, hasPassword, isLocked, wallet, hasBiometric, isBiometricEnabled } = useWalletStore();

  useEffect(() => {
    // Hide splash immediately - no delay
    setShowSplash(false);
    
    // Detect if device is mobile
    const checkMobile = () => {
      const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    logger.log('🔍 Device detection:', { 
      userAgent: navigator.userAgent,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    });
  }, []);

  useEffect(() => {
    // Check wallet state on load - wait for isMobile to be set
    const checkWallet = async () => {
      // ✅ Check for encrypted_wallet (not wallet_address) to detect wallet existence
      // This works for both old users (who have wallet_address) and new users (who don't)
      const hasEncryptedWallet = localStorage.getItem('encrypted_wallet');
      const storedAddress = localStorage.getItem('wallet_address'); // For backward compat / logging
      const hasPasswordStored = localStorage.getItem('has_password') === 'true';
      const biometricEnabled = localStorage.getItem('biometric_enabled') === 'true';
      
            logger.log('🔍 Checking wallet state:', { hasEncryptedWallet: !!hasEncryptedWallet, storedAddress, hasPasswordStored, biometricEnabled, isMobile });
            logger.log('🔍 LocalStorage check:', {
              encrypted_wallet: !!localStorage.getItem('encrypted_wallet'), // Don't log actual value
              wallet_address: localStorage.getItem('wallet_address'),
              wallet_mnemonic: localStorage.getItem('wallet_mnemonic'),
              has_password: localStorage.getItem('has_password'),
              biometric_enabled: localStorage.getItem('biometric_enabled'),
              wallet_just_imported: localStorage.getItem('wallet_just_imported'),
              wallet_just_created: localStorage.getItem('wallet_just_created'),
              force_password_setup: localStorage.getItem('force_password_setup')
            });
      
      // ✅ Use encrypted_wallet as source of truth for wallet existence
      if (hasEncryptedWallet || storedAddress) {
        if (hasPasswordStored) {
          // Wallet exists with password protection
          setHasWallet(true);
          
          // Check if wallet is already unlocked in this session
          const unlockedThisSession = sessionStorage.getItem('wallet_unlocked_this_session') === 'true';
          
          if (unlockedThisSession) {
            // ✅ OPTIE A+: Check session timeout (30 minutes)
            const lastActivity = sessionStorage.getItem('last_activity');
            const now = Date.now();
            const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
            
            if (lastActivity) {
              const timeSince = now - parseInt(lastActivity);
              
              if (timeSince > SESSION_TIMEOUT) {
                logger.log('⏰ Session expired (inactive for ' + Math.round(timeSince / 60000) + ' minutes) - clearing session');
                sessionStorage.clear();
                // Fall through to normal unlock flow below
              } else {
                logger.log('🔄 Session active (last activity: ' + Math.round(timeSince / 1000) + 's ago) - attempting auto-unlock');
                
                // Update activity timestamp
                sessionStorage.setItem('last_activity', now.toString());
                
                // Attempt auto-unlock based on user's preferred method
                if (biometricEnabled && isMobile) {
                  // Biometric is enabled on mobile - try direct biometric unlock
                  logger.log('👤 Biometric enabled - attempting direct Face ID/Touch ID unlock');
                  
                  try {
                    const { unlockWithBiometric } = useWalletStore.getState();
                    await unlockWithBiometric();
                    
                    logger.log('✅ Wallet unlocked with biometrics successfully');
                    setShowPasswordUnlock(false);
                    return;
                    
                  } catch (error: any) {
                    logger.log('⚠️ Biometric unlock failed, showing password modal:', error.message);
                    const stillEnabled = localStorage.getItem('biometric_enabled') === 'true';
                    logger.log('🔍 Biometric still enabled after error?', stillEnabled);
                    
                    // Fall back to password unlock modal
                    setShowPasswordUnlock(true);
                    return;
                  }
                } else {
                  // No biometric or desktop - show password unlock modal
                  logger.log('🔑 Showing password unlock modal (session active)');
                  setShowPasswordUnlock(true);
                  return;
                }
              }
            } else {
              // No last_activity timestamp - set it and continue with normal flow
              logger.log('📝 No activity timestamp found - setting initial timestamp');
              sessionStorage.setItem('last_activity', now.toString());
            }
          }
          
          // Check if biometric is enabled AND device is mobile
          logger.log('🔍 Auth flow decision:', { biometricEnabled, isMobile });
          
          if (biometricEnabled && isMobile) {
            // Biometric is enabled on mobile - try direct biometric unlock
            logger.log('👤 Biometric enabled - attempting direct Face ID/Touch ID unlock');
            
            try {
              const { unlockWithBiometric } = useWalletStore.getState();
              await unlockWithBiometric();
              
              logger.log('✅ Wallet unlocked with biometrics successfully');
              // Wallet is now unlocked, explicitly prevent password modal from showing
              setShowPasswordUnlock(false); // ✅ FIX: Explicitly prevent modal
              // No need to call setHasWallet(true) - wallet is already loaded
              return;
              
            } catch (error: any) {
              logger.log('⚠️ Biometric unlock failed, showing password modal:', error.message);
              // Check if biometric is still enabled after the error
              // (it might have been auto-cleared if data was corrupt)
              const stillEnabled = localStorage.getItem('biometric_enabled') === 'true';
              logger.log('🔍 Biometric still enabled after error?', stillEnabled);
              
              // Fall back to password unlock modal
              setShowPasswordUnlock(true);
            }
          } else {
            // No biometric or desktop - show password unlock modal
            logger.log('🔑 Showing password unlock modal');
            setShowPasswordUnlock(true);
          }
        } else {
          // Wallet exists but no password set - check for old unencrypted mnemonic
          const storedMnemonic = localStorage.getItem('wallet_mnemonic');
          const justImported = localStorage.getItem('wallet_just_imported') === 'true';
          const justCreated = localStorage.getItem('wallet_just_created') === 'true';
          const forcePasswordSetup = localStorage.getItem('force_password_setup') === 'true';
          const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
          
          // Skip password setup if wallet was created with email (password already set)
          if (createdWithEmail) {
            logger.log('✅ Wallet created with email - skipping password setup');
            setHasWallet(true);
            // Wallet is already unlocked, no need for password modal
            return;
          }
          
          if (storedMnemonic || justImported || justCreated || forcePasswordSetup) {
            try {
              if (forcePasswordSetup) {
                // Clear the flag
                localStorage.removeItem('force_password_setup');
                localStorage.removeItem('wallet_just_imported');
                logger.log('🚨 FORCE: Password setup required after wallet import');
              } else if (justImported) {
                // Clear the flag
                localStorage.removeItem('wallet_just_imported');
                logger.log('🔄 Wallet just imported - showing password setup');
              } else if (justCreated) {
                // Clear the flag
                localStorage.removeItem('wallet_just_created');
                logger.log('🔄 Wallet just created - showing password setup');
              } else if (storedMnemonic) {
                // Legacy case - re-import from stored mnemonic
                await importWallet(storedMnemonic);
                logger.log('🔄 Legacy wallet found - re-importing and showing password setup');
              }
              
              setHasWallet(true);
              logger.log('🎯 Triggering password setup modal');
              setShowPasswordSetup(true); // Prompt to set password
            } catch (error) {
              logger.error('Error importing wallet:', error);
              setHasWallet(false);
            }
          } else {
            setHasWallet(false);
          }
        }
      } else {
        setHasWallet(false);
      }
    };

    // Only check wallet after isMobile is determined
    if (isMobile !== null) {
      checkWallet();
    }
  }, [isMobile]);

  // Auto-lock check
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== 'undefined') {
        const { checkAutoLock } = useWalletStore.getState();
        checkAutoLock();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Loading state - subtle loader
  if (hasWallet === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {showSplash && <SplashScreen />}
      
      {!hasWallet ? (
        <Onboarding onComplete={() => setHasWallet(true)} />
      ) : (
        <>
          <Dashboard />
          
          {/* Password Setup Modal */}
          <PasswordSetupModal
            isOpen={showPasswordSetup}
            onComplete={(password) => {
              setShowPasswordSetup(false);
              // After password setup, offer biometric setup on mobile
              if (isMobile) {
                setSetupPassword(password); // Store password temporarily
                setShowBiometricSetup(true);
              }
            }}
          />
          
          {/* Biometric Setup Modal */}
          <BiometricAuthModal
            isOpen={showBiometricSetup}
            mode="register"
            username="BLAZE User"
            password={setupPassword} // Pass password for secure storage
            onSuccess={() => {
              setShowBiometricSetup(false);
              setSetupPassword(undefined); // Clear password from memory
            }}
            onCancel={() => {
              setShowBiometricSetup(false);
              setSetupPassword(undefined); // Clear password from memory
            }}
            onRegister={() => {
              setShowBiometricSetup(false);
              setSetupPassword(undefined); // Clear password from memory
            }}
          />
          
          {/* QR Login Modal - Only show on desktop */}
          {!isMobile && (
            <QRLoginModal
              isOpen={showQRLogin}
              onSuccess={() => {
                setShowQRLogin(false);
              }}
              onCancel={() => {
                setShowQRLogin(false);
                setShowPasswordUnlock(true);
              }}
            />
          )}
          
          {/* Password Unlock Modal */}
          <PasswordUnlockModal
            isOpen={showPasswordUnlock}
            onComplete={() => {
              setShowPasswordUnlock(false);
            }}
            onFallback={() => {
              setShowPasswordUnlock(false);
              setShowRecoveryPhrase(true);
            }}
          />
        </>
      )}
    </>
  );
}



