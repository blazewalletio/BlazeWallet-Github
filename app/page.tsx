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
  
  // 🔥 CRITICAL: Initialize wallet store from IndexedDB on mount
  useEffect(() => {
    const init = async () => {
      logger.log('🔄 [App] Initializing wallet store from IndexedDB...');
      const result = await initializeFromStorage();
      logger.log('✅ [App] Wallet store initialized:', result);
    };
    init();
  }, [initializeFromStorage]);
  
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
    
    // ✅ FIX: Check hasPassword from wallet store (derived from IndexedDB)
    // Don't fall back to localStorage as it's unreliable on iOS
    
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
  
  // ✅ Set unlock modal state in store when needed
  useEffect(() => {
    if (shouldShowUnlockModal) {
      setShowUnlockModal(true);
    }
  }, [shouldShowUnlockModal, setShowUnlockModal]);

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
    const checkWallet = async () => {
      logger.log('╔════════════════════════════════════════════════════════════╗');
      logger.log('║ 🔄 [WALLET CHECK] STARTING WALLET CHECK ON MOUNT         ║');
      logger.log('╚════════════════════════════════════════════════════════════╝');
      logger.log('🔄 [WALLET CHECK] Timestamp:', new Date().toISOString());
      
      // 🔥 CRITICAL FIX: Check IndexedDB FIRST before Supabase!
      // This ensures we show unlock modal even if Supabase checks fail
      const { secureStorage } = await import('@/lib/secure-storage');
      let hasEncryptedWallet = await secureStorage.getItem('encrypted_wallet');
      let hasPasswordStored = await secureStorage.getItem('has_password') === 'true';
      
      logger.log('🔍 [WALLET CHECK] IndexedDB quick check:', {
        hasEncryptedWallet: !!hasEncryptedWallet,
        hasPasswordStored
      });
      
      // 🔥 FIX: If wallet exists in IndexedDB, set hasWallet=true IMMEDIATELY
      // This ensures unlock modal shows even if subsequent checks fail
      if (hasEncryptedWallet && hasPasswordStored) {
        logger.log('✅ [WALLET CHECK] Wallet found in IndexedDB - setting hasWallet=true IMMEDIATELY');
        setHasWallet(true);
        // Continue with Supabase checks for sync, but wallet is already loaded
      }
      
      // ✅ FIRST: Check for active Supabase session (email wallets)
      try {
        logger.log('📦 [WALLET CHECK] Importing Supabase client...');
        
        const { supabase } = await import('@/lib/supabase');
        
        logger.log('✅ [WALLET CHECK] Supabase client imported successfully');
        
        logger.log('🔄 [WALLET CHECK] Calling supabase.auth.getSession()...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        logger.log('🔄 [WALLET CHECK] Session check result:', {
          hasSession: !!session,
          hasError: !!error,
          userId: session?.user?.id,
          email: session?.user?.email,
          errorMessage: error?.message || 'none'
        });
        
        if (session && !error) {
          logger.log('✅ Active Supabase session found:', {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: new Date(session.expires_at! * 1000).toISOString()
          });
          
          // ✅ NEW: Check if device is verified for email wallets (V2!)
          logger.log('🔍 [DEVICE CHECK V2] Checking device verification for email wallet...');
          
          // 🔥 FIX: If IndexedDB has wallet + password, SKIP device check!
          // User just logged in successfully, device is implicitly trusted
          if (hasEncryptedWallet && hasPasswordStored) {
            logger.log('✅ [DEVICE CHECK V2] SKIPPED - IndexedDB has wallet (user just logged in)');
          } else {
            const deviceCheck = await DeviceVerificationCheckV2.isDeviceVerified();
            
            logger.log('🔍 [DEVICE CHECK V2] Result:', deviceCheck);
            
            if (!deviceCheck.verified) {
              logger.warn('⚠️ [DEVICE CHECK] Device not verified:', deviceCheck.reason);
              logger.warn('⚠️ [DEVICE CHECK] User has session + wallet, but device not verified');
              
              // ✅ Import secureStorage FIRST (before using it in if/else blocks)
              const { secureStorage } = await import('./secure-storage');
              
              // Check if wallet exists in database
              const { data: walletData } = await supabase
                .from('wallets')
                .select('encrypted_wallet')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (walletData && walletData.encrypted_wallet) {
                // ✅ User has account + wallet → Just need device verification!
                // Don't clear localStorage, don't show onboarding
                // The user will get device verification email via signInWithEmail
                logger.log('✅ [DEVICE CHECK] User has wallet - will require device verification on next login');
                
                // ⚠️ CRITICAL: Preserve device_id before signOut (Supabase clears localStorage!)
                const preservedDeviceId = localStorage.getItem('blaze_device_id');
                const preservedFingerprint = localStorage.getItem('blaze_device_fingerprint');
                const preservedFingerprintCachedAt = localStorage.getItem('blaze_fingerprint_cached_at');
                
                // 📱 FIX: Use secureStorage (IndexedDB) instead of localStorage!
                await secureStorage.setItem('encrypted_wallet', walletData.encrypted_wallet);
                await secureStorage.setItem('has_password', 'true');
                await secureStorage.setItem('wallet_email', session.user.email || '');
                await secureStorage.setItem('wallet_created_with_email', 'true');
                await secureStorage.setItem('supabase_user_id', session.user.id);
                
                // ✅ Sign out to force fresh login with device verification
                await supabase.auth.signOut();
                
                // ⚠️ CRITICAL: Restore device_id after signOut!
                if (preservedDeviceId) {
                  localStorage.setItem('blaze_device_id', preservedDeviceId);
                  logger.log('✅ [DEVICE CHECK] Device ID preserved after signOut:', preservedDeviceId.substring(0, 12) + '...');
                }
                if (preservedFingerprint) {
                  localStorage.setItem('blaze_device_fingerprint', preservedFingerprint);
                }
                if (preservedFingerprintCachedAt) {
                  localStorage.setItem('blaze_fingerprint_cached_at', preservedFingerprintCachedAt);
                }
                
                // Show onboarding (which will show login screen)
                setHasWallet(false);
                return;
              }
              
              // No wallet found → Truly new user → Show onboarding
              logger.warn('⚠️ [DEVICE CHECK] No wallet found - showing onboarding');
              await secureStorage.setItem('encrypted_wallet', '');
              await secureStorage.setItem('has_password', '');
              sessionStorage.clear();
              setHasWallet(false);
              return;
            }
          }
          
          logger.log('✅ [DEVICE CHECK] Device is verified - allowing password unlock');
          
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
            
            // 📱 FIX: Store encrypted wallet in IndexedDB (NOT localStorage!)
            const { secureStorage } = await import('@/lib/secure-storage');
            await secureStorage.setItem('encrypted_wallet', walletData.encrypted_wallet);
            await secureStorage.setItem('has_password', 'true');
            await secureStorage.setItem('wallet_email', session.user.email || '');
            await secureStorage.setItem('wallet_created_with_email', 'true');
            logger.log('✅ [WALLET CHECK] Data stored in IndexedDB (NOT localStorage!)');
            
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



