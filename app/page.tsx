'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWalletStore } from '@/lib/wallet-store';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';
import SplashScreen from '@/components/SplashScreen';
import PasswordSetupModal from '@/components/PasswordSetupModal';
import PasswordUnlockModal from '@/components/PasswordUnlockModal';
import BiometricAuthModal from '@/components/BiometricAuthModal';
import QRLoginModal from '@/components/QRLoginModal';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { logger } from '@/lib/logger';

export default function Home() {
  // ✅ REACTIVE APPROACH: Minimal local state, derive everything from wallet store
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [showQRLogin, setShowQRLogin] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [setupPassword, setSetupPassword] = useState<string | undefined>(undefined);
  
  // ✅ Read wallet store state (single source of truth)
  const { importWallet, hasPassword, isLocked, wallet, hasBiometric, isBiometricEnabled } = useWalletStore();
  
  // ✅ REACTIVE: Compute if unlock modal should show based on wallet store state
  const shouldShowUnlockModal = useMemo(() => {
    // Don't show if no wallet exists yet
    if (hasWallet !== true) return false;
    
    // Don't show if password setup is showing
    if (showPasswordSetup) return false;
    
    // Don't show if biometric setup is showing
    if (showBiometricSetup) return false;
    
    // Don't show if QR login is showing
    if (showQRLogin) return false;
    
    // Show unlock modal if:
    // 1. Wallet has password protection AND
    // 2. Wallet is not unlocked (no address or isLocked)
    const needsUnlock = hasPassword && (!wallet || !wallet.address || isLocked);
    
    logger.log('🔍 [REACTIVE] shouldShowUnlockModal computed:', {
      hasWallet,
      hasPassword,
      walletAddress: wallet?.address?.substring(0, 12) || 'null',
      isLocked,
      needsUnlock,
      showPasswordSetup,
      showBiometricSetup,
      showQRLogin
    });
    
    return needsUnlock;
  }, [hasWallet, hasPassword, wallet, isLocked, showPasswordSetup, showBiometricSetup, showQRLogin]);

  useEffect(() => {
    // Hide splash immediately - no delay
    setShowSplash(false);
    
    // Detect if device is mobile
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
    
    logger.log('🔍 Device detection:', { 
      userAgent: navigator.userAgent,
      isMobile: isMobileDevice
    });
  }, []);

  useEffect(() => {
    // ✅ SOLUTION 3: Always check wallet on mount (no dependencies blocking it!)
    // This runs immediately, independent of isMobile
    const checkWallet = async () => {
      logger.log('🔄 [WALLET CHECK] Starting wallet check...');
      
      // ✅ FIRST: Check for active Supabase session (email wallets)
      try {
        const { supabase } = await import('@/lib/supabase');
        logger.log('🔄 [WALLET CHECK] Supabase imported, checking session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        logger.log('🔄 [WALLET CHECK] Session check result:', {
          hasSession: !!session,
          hasError: !!error,
          userId: session?.user?.id,
          email: session?.user?.email
        });
        
        if (session && !error) {
          logger.log('✅ Active Supabase session found:', {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: new Date(session.expires_at! * 1000).toISOString()
          });
          
          // ✅ Load encrypted wallet from Supabase
          logger.log('🔄 [WALLET CHECK] Loading encrypted wallet from Supabase...');
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .select('encrypted_wallet')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          logger.log('🔄 [WALLET CHECK] Wallet data result:', {
            hasData: !!walletData,
            hasError: !!walletError,
            hasEncryptedWallet: !!walletData?.encrypted_wallet
          });
          
          if (walletError) {
            logger.error('❌ Error loading wallet from Supabase:', walletError);
          } else if (walletData && walletData.encrypted_wallet) {
            logger.log('✅ Found encrypted wallet in Supabase for user');
            
            // Store encrypted wallet in localStorage (for unlock modal)
            localStorage.setItem('encrypted_wallet', walletData.encrypted_wallet);
            localStorage.setItem('has_password', 'true');
            localStorage.setItem('wallet_email', session.user.email || '');
            logger.log('✅ [WALLET CHECK] Data stored in localStorage');
            
            // Initialize account in account manager
            logger.log('🔄 [WALLET CHECK] Initializing account manager...');
            const { switchToEmailAccount } = await import('@/lib/account-manager');
            await switchToEmailAccount(
              session.user.email!,
              session.user.id,
              walletData.encrypted_wallet
            );
            logger.log('✅ [WALLET CHECK] Account manager initialized');
            
            // ✅ REACTIVE: Just set hasWallet=true, unlock modal shows automatically!
            logger.log('✅ [WALLET CHECK] Setting hasWallet=true, unlock modal will show automatically');
            setHasWallet(true);
            return;
          } else {
            logger.warn('⚠️ User has Supabase session but no encrypted wallet found');
          }
        } else if (error) {
          logger.warn('⚠️ Error checking Supabase session:', error.message);
        } else {
          logger.log('ℹ️ No active Supabase session found');
        }
      } catch (err) {
        logger.error('❌ Failed to check Supabase session:', err);
      }
      
      logger.log('🔄 [WALLET CHECK] Proceeding to localStorage check...');
      
      // ✅ SECOND: Check for encrypted_wallet to detect wallet existence
      const hasEncryptedWallet = localStorage.getItem('encrypted_wallet');
      const storedAddress = localStorage.getItem('wallet_address');
      const hasPasswordStored = localStorage.getItem('has_password') === 'true';
      const biometricEnabled = localStorage.getItem('biometric_enabled') === 'true';
      
      logger.log('🔍 Checking wallet state:', { 
        hasEncryptedWallet: !!hasEncryptedWallet, 
        storedAddress, 
        hasPasswordStored, 
        biometricEnabled, 
        isMobile 
      });
      
      logger.log('🔍 LocalStorage check:', {
        encrypted_wallet: !!localStorage.getItem('encrypted_wallet'),
        wallet_address: localStorage.getItem('wallet_address'),
        wallet_mnemonic: !!localStorage.getItem('wallet_mnemonic'),
        has_password: localStorage.getItem('has_password'),
        biometric_enabled: localStorage.getItem('biometric_enabled'),
        wallet_just_imported: localStorage.getItem('wallet_just_imported'),
        wallet_just_created: localStorage.getItem('wallet_just_created'),
        force_password_setup: localStorage.getItem('force_password_setup')
      });
      
      // ✅ Use encrypted_wallet as source of truth for wallet existence
      if (hasEncryptedWallet || storedAddress) {
        if (hasPasswordStored) {
          // ✅ REACTIVE: Just set hasWallet=true
          // Unlock modal will show automatically based on wallet store state!
          logger.log('✅ [WALLET CHECK] Wallet with password found, setting hasWallet=true');
          logger.log('✅ [WALLET CHECK] Unlock modal will show automatically (reactive)');
          setHasWallet(true);
          
          // Check if wallet is already unlocked from fresh onboarding
          const unlockedThisSession = sessionStorage.getItem('wallet_unlocked_this_session') === 'true';
          if (unlockedThisSession && wallet && !isLocked) {
            logger.log('✅ Wallet already unlocked in store (fresh onboarding session)');
            const now = Date.now();
            sessionStorage.setItem('last_activity', now.toString());
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
            return;
          }
          
          if (storedMnemonic || justImported || justCreated || forcePasswordSetup) {
            try {
              if (forcePasswordSetup) {
                localStorage.removeItem('force_password_setup');
                localStorage.removeItem('wallet_just_imported');
                logger.log('🚨 FORCE: Password setup required after wallet import');
              } else if (justImported) {
                localStorage.removeItem('wallet_just_imported');
                logger.log('🔄 Wallet just imported - showing password setup');
              } else if (justCreated) {
                localStorage.removeItem('wallet_just_created');
                logger.log('🔄 Wallet just created - showing password setup');
              } else if (storedMnemonic) {
                // Legacy case - re-import from stored mnemonic
                await importWallet(storedMnemonic);
                logger.log('🔄 Legacy wallet found - re-importing and showing password setup');
              }
              
              setHasWallet(true);
              logger.log('🎯 Triggering password setup modal');
              setShowPasswordSetup(true);
            } catch (error) {
              logger.error('Error importing wallet:', error);
              setHasWallet(false);
            }
          } else {
            setHasWallet(false);
          }
        }
      } else {
        logger.log('ℹ️ No wallet found in localStorage');
        setHasWallet(false);
      }
    };

    // ✅ Always run checkWallet on mount (no blocking dependencies!)
    checkWallet();
  }, []); // Empty deps - runs once on mount

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
          
          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
          
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
              }}
            />
          )}
          
          {/* ✅ REACTIVE UNLOCK MODAL: Shows automatically based on wallet store state! */}
          <PasswordUnlockModal
            isOpen={shouldShowUnlockModal}
            onComplete={() => {
              // Wallet unlocked - store will update automatically
              logger.log('✅ Wallet unlocked via modal');
              sessionStorage.setItem('wallet_unlocked_this_session', 'true');
              sessionStorage.setItem('last_activity', Date.now().toString());
            }}
            onFallback={() => {
              setShowRecoveryPhrase(true);
            }}
          />
        </>
      )}
    </>
  );
}



