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
import { supabase } from '@/lib/supabase';
import { DeviceVerificationCheckV2 } from '@/lib/device-verification-check-v2'; // ← V2!
import { persistEmailIdentity, selfHealIdentityFromSession } from '@/lib/account-identity';

const DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES = 5;
const AUTO_LOCK_TIMEOUT_KEY_PRIMARY = 'blaze_auto_lock_timeout_min';
const AUTO_LOCK_TIMEOUT_KEY_LEGACY = 'autoLockTimeout';
const SESSION_UNLOCK_FLAG_KEY = 'wallet_unlocked_this_session';
const SESSION_LAST_ACTIVITY_KEY = 'last_activity';
const SESSION_UNLOCK_EXPIRY_KEY = 'blaze_soft_unlock_expires_at';

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
  const { importWallet, hasPassword, isLocked, wallet, hasBiometric, isBiometricEnabled, setShowUnlockModal, initializeFromStorage } = useWalletStore();

  const hasValidSessionLease = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const unlockedThisSession = sessionStorage.getItem(SESSION_UNLOCK_FLAG_KEY) === 'true';
    if (!unlockedThisSession) return false;

    const rawTimeout =
      localStorage.getItem(AUTO_LOCK_TIMEOUT_KEY_PRIMARY) ??
      localStorage.getItem(AUTO_LOCK_TIMEOUT_KEY_LEGACY);
    const timeoutMinutes = Number(rawTimeout);
    const normalizedTimeout = Number.isFinite(timeoutMinutes) && timeoutMinutes >= 0
      ? timeoutMinutes
      : DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES;

    if (normalizedTimeout === 0) return true; // Never auto-lock

    const now = Date.now();
    const expiry = Number(sessionStorage.getItem(SESSION_UNLOCK_EXPIRY_KEY) || '0');
    if (Number.isFinite(expiry) && expiry > 0) {
      return now < expiry;
    }

    const lastActivity = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || '0');
    if (!Number.isFinite(lastActivity) || lastActivity <= 0) return false;
    return now - lastActivity < normalizedTimeout * 60 * 1000;
  }, [hasPassword, isLocked, wallet]);
  
  // Initialize wallet store from IndexedDB on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeFromStorage();
      } catch (error) {
        console.error('❌ Failed to initialize wallet store:', error);
      }
    };
    init();
  }, []);
  
  // Compute if unlock modal should show based on wallet store state
  const shouldShowUnlockModal = useMemo(() => {
    if (hasWallet !== true) return false;
    if (showPasswordSetup) return false;
    if (showBiometricSetup) return false;
    if (showQRLogin) return false;
    
    // Show unlock modal if wallet has password protection AND is locked
    const needsUnlock = hasPassword && (isLocked || ((!wallet || !wallet.address) && !hasValidSessionLease));
    return needsUnlock;
  }, [hasWallet, hasPassword, wallet, isLocked, showPasswordSetup, showBiometricSetup, showQRLogin, hasValidSessionLease]);
  
  // Set unlock modal state in store when needed
  useEffect(() => {
    setShowUnlockModal(shouldShowUnlockModal);
  }, [shouldShowUnlockModal, setShowUnlockModal]);

  useEffect(() => {
    setShowSplash(false);
    
    // Detect if device is mobile
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);
  }, []);

  useEffect(() => {
    const checkWallet = async () => {
      // Check IndexedDB FIRST before Supabase
      // This ensures we show unlock modal even if Supabase checks fail
      const { secureStorage } = await import('@/lib/secure-storage');
      await selfHealIdentityFromSession();
      
      let hasEncryptedWallet = await secureStorage.getItem('encrypted_wallet');
      let hasPasswordStored = await secureStorage.getItem('has_password') === 'true';
      
      // If wallet exists in IndexedDB, set hasWallet=true IMMEDIATELY
      // This ensures unlock modal shows even if subsequent checks fail
      if (hasEncryptedWallet && hasPasswordStored) {
        setHasWallet(true);
        // Continue with Supabase checks for sync, but wallet is already loaded
      }
      
      // Check for active Supabase session (email wallets)
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          // Skip device verification if IndexedDB already has wallet
          if (!hasEncryptedWallet || !hasPasswordStored) {
            const deviceCheck = await DeviceVerificationCheckV2.isDeviceVerified();
            
            if (!deviceCheck.verified) {
              logger.warn('⚠️ [DEVICE CHECK] Device not verified:', deviceCheck.reason);
              
              const { secureStorage } = await import('@/lib/secure-storage');
              
              // Check if wallet exists in database
              const { data: walletData } = await supabase
                .from('wallets')
                .select('encrypted_wallet')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (walletData && (walletData as any).encrypted_wallet) {
                // User has wallet - store it and require device verification on next login
                const preservedDeviceId = localStorage.getItem('blaze_device_id');
                const preservedFingerprint = localStorage.getItem('blaze_device_fingerprint');
                const preservedFingerprintCachedAt = localStorage.getItem('blaze_fingerprint_cached_at');
                
                await secureStorage.setItem('encrypted_wallet', (walletData as any).encrypted_wallet);
                await secureStorage.setItem('has_password', 'true');
                await persistEmailIdentity({
                  email: session.user.email || '',
                  userId: session.user.id,
                });
                
                await supabase.auth.signOut();
                
                // Restore device_id after signOut
                if (preservedDeviceId) {
                  localStorage.setItem('blaze_device_id', preservedDeviceId);
                }
                if (preservedFingerprint) {
                  localStorage.setItem('blaze_device_fingerprint', preservedFingerprint);
                }
                if (preservedFingerprintCachedAt) {
                  localStorage.setItem('blaze_fingerprint_cached_at', preservedFingerprintCachedAt);
                }
                
                setHasWallet(false);
                return;
              }
              
              // No wallet found - show onboarding
              await secureStorage.setItem('encrypted_wallet', '');
              await secureStorage.setItem('has_password', '');
              sessionStorage.clear();
              setHasWallet(false);
              return;
            }
          }
          
          // Device is verified or check skipped - load wallet from Supabase
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .select('encrypted_wallet')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (walletError) {
            logger.error('❌ Error loading wallet from Supabase:', walletError);
          } else if (walletData && (walletData as any).encrypted_wallet) {
            // Store encrypted wallet in IndexedDB
            const { secureStorage } = await import('@/lib/secure-storage');
            await secureStorage.setItem('encrypted_wallet', (walletData as any).encrypted_wallet);
            await secureStorage.setItem('has_password', 'true');
            await persistEmailIdentity({
              email: session.user.email || '',
              userId: session.user.id,
            });
            
            // Initialize account manager
            const { switchToEmailAccount } = await import('@/lib/account-manager');
            await switchToEmailAccount(
              session.user.email!,
              session.user.id,
              (walletData as any).encrypted_wallet
            );
            
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
      
      logger.log('🔄 [WALLET CHECK] Proceeding to storage check...');
      
      // ✅ Get userId for potential Supabase recovery
      let userId: string | undefined;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      } catch (err) {
        logger.warn('⚠️ Could not get user ID for recovery:', err);
      }
      
      // ✅ HYBRID RECOVERY: Re-check IndexedDB (may have been updated by Supabase flow)
      hasEncryptedWallet = await secureStorage.getItem('encrypted_wallet');
      hasPasswordStored = await secureStorage.getItem('has_password') === 'true';
      
      logger.log('╔════════════════════════════════════════════════════════════╗');
      logger.log('║ 📱 [DEBUG] RE-CHECKING INDEXEDDB (PRIMARY STORAGE)       ║');
      logger.log('╚════════════════════════════════════════════════════════════╝');
      
      logger.log('🔍 [DEBUG] IndexedDB results:', { 
        hasEncryptedWallet: !!hasEncryptedWallet,
        encryptedWalletLength: hasEncryptedWallet ? hasEncryptedWallet.length : 0,
        hasPasswordStored,
        userId: !!userId,
        isMobile,
        isPWA: typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
      });
      
      if (hasEncryptedWallet) {
        logger.log('✅ [DEBUG] Wallet found in IndexedDB! Length:', hasEncryptedWallet.length);
      } else {
        logger.warn('⚠️ [DEBUG] NO wallet found in IndexedDB!');
      }
      
      if (hasPasswordStored) {
        logger.log('✅ [DEBUG] Password flag found in IndexedDB!');
      } else {
        logger.warn('⚠️ [DEBUG] NO password flag found in IndexedDB!');
      }
      
      // ✅ FALLBACK: If IndexedDB empty, try Supabase recovery
      if (!hasEncryptedWallet && userId) {
        logger.log('╔════════════════════════════════════════════════════════════╗');
        logger.log('║ ☁️  [DEBUG] INDEXEDDB EMPTY - TRYING SUPABASE RECOVERY   ║');
        logger.log('╚════════════════════════════════════════════════════════════╝');
        logger.log('☁️  [RECOVERY] userId:', userId);
        
        const { syncWalletFromSupabase } = await import('@/lib/wallet-sync-service');
        const syncResult = await syncWalletFromSupabase(userId);
        
        logger.log('☁️  [RECOVERY] Supabase sync result:', {
          success: syncResult.success,
          synced: syncResult.synced,
          hasEncryptedWallet: !!syncResult.encryptedWallet,
          encryptedWalletLength: syncResult.encryptedWallet?.length || 0,
          error: syncResult.error
        });
        
        if (syncResult.success && syncResult.synced && syncResult.encryptedWallet) {
          logger.log('✅✅✅ [RECOVERY] WALLET RESTORED FROM SUPABASE!');
          logger.log('✅ [RECOVERY] Wallet length:', syncResult.encryptedWallet.length);
          // Wallet is now in IndexedDB, continue normal flow
          setHasWallet(true);
          return;
        } else {
          logger.warn('❌ [RECOVERY] Supabase recovery FAILED or no wallet found');
          logger.warn('❌ [RECOVERY] Reason:', syncResult.error || 'No wallet in Supabase');
        }
      } else if (!hasEncryptedWallet && !userId) {
        logger.warn('⚠️ [RECOVERY] IndexedDB empty AND no userId - cannot try Supabase recovery');
      } else {
        logger.log('✅ [RECOVERY] IndexedDB has wallet - skipping Supabase recovery');
      }
      
      // ✅ Check localStorage as final fallback (migration path)
      logger.log('╔════════════════════════════════════════════════════════════╗');
      logger.log('║ 📦 [DEBUG] CHECKING LOCALSTORAGE (LEGACY FALLBACK)       ║');
      logger.log('╚════════════════════════════════════════════════════════════╝');
      
      const localStorageEncrypted = localStorage.getItem('encrypted_wallet');
      const storedAddress = localStorage.getItem('wallet_address');
      const localStoragePassword = localStorage.getItem('has_password') === 'true';
      
      logger.log('🔍 [DEBUG] localStorage check:', {
        encrypted_wallet: !!localStorageEncrypted,
        encrypted_wallet_length: localStorageEncrypted?.length || 0,
        wallet_address: storedAddress,
        has_password: localStoragePassword
      });
      
      if (localStorageEncrypted) {
        logger.warn('⚠️ [DEBUG] Found wallet in localStorage (legacy) - length:', localStorageEncrypted.length);
      } else {
        logger.log('ℹ️  [DEBUG] No wallet in localStorage (expected on iOS PWA)');
      }
      
      // ✅ Use encrypted_wallet as source of truth for wallet existence
      logger.log('╔════════════════════════════════════════════════════════════╗');
      logger.log('║ 🎯 [DEBUG] FINAL DECISION - WALLET EXISTS?               ║');
      logger.log('╚════════════════════════════════════════════════════════════╝');
      
      logger.log('🎯 [DEBUG] Wallet existence check:', {
        hasEncryptedWallet_IndexedDB: !!hasEncryptedWallet,
        localStorageEncrypted_Legacy: !!localStorageEncrypted,
        storedAddress_Legacy: !!storedAddress,
        finalDecision: !!(hasEncryptedWallet || localStorageEncrypted || storedAddress)
      });
      
      if (hasEncryptedWallet || localStorageEncrypted || storedAddress) {
        logger.log('✅✅✅ [DEBUG] WALLET EXISTS!');
        
        if (hasPasswordStored || localStoragePassword) {
          // ✅ REACTIVE: Just set hasWallet=true
          // Unlock modal will show automatically based on wallet store state!
          logger.log('╔════════════════════════════════════════════════════════════╗');
          logger.log('║ 🔓 [DEBUG] WALLET HAS PASSWORD - SHOWING UNLOCK MODAL    ║');
          logger.log('╚════════════════════════════════════════════════════════════╝');
          logger.log('✅ [WALLET CHECK] Wallet with password found, setting hasWallet=true');
          logger.log('✅ [WALLET CHECK] Unlock modal will show automatically (reactive)');
          logger.log('✅ [DEBUG] Password source:', {
            fromIndexedDB: hasPasswordStored,
            fromLocalStorage: localStoragePassword
          });
          
          setHasWallet(true);
          
          // Check if wallet is already unlocked from fresh onboarding
          const unlockedThisSession = sessionStorage.getItem('wallet_unlocked_this_session') === 'true';
          logger.log('🔍 [DEBUG] Session check:', {
            unlockedThisSession,
            hasWallet: !!wallet,
            isLocked,
            walletAddress: wallet?.address?.substring(0, 12) || 'null'
          });
          
          if (unlockedThisSession && wallet && !isLocked) {
            logger.log('✅ [DEBUG] Wallet already unlocked in store (fresh onboarding session)');
            const now = Date.now();
            sessionStorage.setItem('last_activity', now.toString());
          } else {
            logger.log('ℹ️  [DEBUG] Wallet needs unlock (unlock modal will show)');
          }
        } else {
          // Wallet exists but no password set - check for old unencrypted mnemonic
          logger.log('╔════════════════════════════════════════════════════════════╗');
          logger.log('║ ⚠️  [DEBUG] WALLET EXISTS BUT NO PASSWORD SET            ║');
          logger.log('╚════════════════════════════════════════════════════════════╝');
          
          const storedMnemonic = localStorage.getItem('wallet_mnemonic');
          const justImported = localStorage.getItem('wallet_just_imported') === 'true';
          const justCreated = localStorage.getItem('wallet_just_created') === 'true';
          const forcePasswordSetup = localStorage.getItem('force_password_setup') === 'true';
          const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
          
          logger.log('🔍 [DEBUG] Legacy wallet check:', {
            storedMnemonic: !!storedMnemonic,
            justImported,
            justCreated,
            forcePasswordSetup,
            createdWithEmail
          });
          
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
        logger.log('╔════════════════════════════════════════════════════════════╗');
        logger.log('║ ❌ [DEBUG] NO WALLET FOUND - SHOWING ONBOARDING          ║');
        logger.log('╚════════════════════════════════════════════════════════════╝');
        logger.log('❌ [DEBUG] No wallet in:', {
          IndexedDB: !hasEncryptedWallet,
          localStorage: !localStorageEncrypted,
          wallet_address: !storedAddress
        });
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
          
          {/* ✅ REMOVED: Unlock modal now managed by Dashboard via wallet-store
              Single modal instance in Dashboard reads showUnlockModal from store */}
        </>
      )}
    </>
  );
}



