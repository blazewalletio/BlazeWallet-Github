'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle2, Copy, Check, Sparkles, Shield, Zap, Lock, AlertTriangle, Eye, EyeOff, ArrowRight, Mail, Key, Usb, FileText, Fingerprint, X, Brain, Flame, Vote, Rocket, Gift, CreditCard, Users, Palette, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { signUpWithEmail, signInWithEmail, completeSignInAfter2FA, signInWithGoogle, signInWithApple } from '@/lib/supabase-auth';
import TwoFactorLoginModal from './TwoFactorLoginModal';
import { logger } from '@/lib/logger';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const ONBOARDING_CARD_SHELL =
    'rounded-3xl border border-gray-200/80 bg-white/80 backdrop-blur-md shadow-xl';

  const [step, setStep] = useState<'carousel' | 'create-options' | 'add-wallet' | 'mnemonic' | 'verify' | 'import-seed' | 'email-auth' | 'device-verification' | 'biometric-setup'>('carousel');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [importInput, setImportInput] = useState<string>('');
  const [verifyWords, setVerifyWords] = useState<{ [key: number]: string }>({});
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [createdViaEmail, setCreatedViaEmail] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllWordsOnVerify, setShowAllWordsOnVerify] = useState(false);
  
  // Interactive security checklist state
  const [securityChecks, setSecurityChecks] = useState({
    written: false,
    stored: false,
    understand: false,
    neverShare: false,
  });
  
  // Check if all security checks are completed
  const allSecurityChecksCompleted = Object.values(securityChecks).every(Boolean);
  
  // Email authentication
  const [emailAuthMode, setEmailAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // ✅ NEW: Device verification state
  const [deviceVerificationCode, setDeviceVerificationCode] = useState('');
  const [deviceVerificationToken, setDeviceVerificationToken] = useState('');
  const [deviceResendCooldown, setDeviceResendCooldown] = useState(0);
  const [isResendingDeviceCode, setIsResendingDeviceCode] = useState(false);
  
  // ✅ NEW: 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState('');
  const [pending2FAEmail, setPending2FAEmail] = useState('');
  const [pending2FAPassword, setPending2FAPassword] = useState('');
  
  // ✅ NEW: Field refs for auto-focus and scroll
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  
  // ✅ NEW: Real-time validation states
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
  
  // 📱 SMART COMPACT: Keyboard & focus state
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [activeField, setActiveField] = useState<string | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  const { createWallet, importWallet } = useWalletStore();

  // Keep focused fields visible above the mobile keyboard.
  // Uses explicit viewport-safe calculations to avoid iOS "field behind keyboard" issues.
  const ensureFieldVisible = useCallback((ref: React.RefObject<HTMLInputElement>) => {
    if (!ref.current || typeof window === 'undefined') return;

    const input = ref.current;
    const scroller = formContainerRef.current;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    // visualViewport.height already excludes keyboard space, so do not subtract keyboardInset again.
    const reservedBottom = isKeyboardOpen ? 96 : 24; // sticky CTA/safe margin only
    const safeBottom = viewportHeight - reservedBottom;
    const safeTop = 80;
    const rect = input.getBoundingClientRect();

    if (rect.bottom > safeBottom) {
      const delta = rect.bottom - safeBottom + 14;
      if (scroller) {
        scroller.scrollBy({ top: delta, behavior: 'smooth' });
      } else {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }
      return;
    }

    if (rect.top < safeTop) {
      const delta = safeTop - rect.top + 10;
      if (scroller) {
        scroller.scrollBy({ top: -delta, behavior: 'smooth' });
      } else {
        window.scrollBy({ top: -delta, behavior: 'smooth' });
      }
    }
  }, [isKeyboardOpen]);

  // ✅ NEW: Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // ✅ NEW: Password strength calculator
  const calculatePasswordStrength = (pwd: string): 'weak' | 'medium' | 'strong' => {
    if (pwd.length < 8) return 'weak';
    
    let strength = 0;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    
    if (strength >= 3) return 'strong';
    if (strength >= 1) return 'medium';
    return 'weak';
  };

  // ✅ NEW: Real-time email validation
  useEffect(() => {
    if (email.length === 0) {
      setEmailValid(null);
    } else {
      setEmailValid(validateEmail(email));
    }
  }, [email]);

  // ✅ NEW: Real-time password strength
  useEffect(() => {
    if (password.length === 0) {
      setPasswordStrength(null);
    } else {
      setPasswordStrength(calculatePasswordStrength(password));
    }
  }, [password]);

  // ✅ NEW: Real-time password match check
  useEffect(() => {
    if (confirmPassword.length === 0) {
      setPasswordsMatch(null);
    } else {
      setPasswordsMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);
  
  // 📱 SMART COMPACT: Keyboard detection (mobile)
  useEffect(() => {
    if (typeof window === 'undefined' || !isMobileDevice) return;

    const handleResize = () => {
      const viewport = window.visualViewport;
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - visibleHeight - offsetTop);
      const keyboardVisible = inset > 120;

      setKeyboardInset(keyboardVisible ? inset : 0);
      setIsKeyboardOpen(keyboardVisible);

      if (!keyboardVisible) {
        setActiveField(null);
      }
    };

    handleResize();
    
    // Listen to visual viewport resize (more reliable for keyboard detection)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('scroll', handleResize);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      };
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isMobileDevice]);

  // Re-apply focus positioning after keyboard/viewport settles (especially iOS touch focus).
  useEffect(() => {
    if (!isMobileDevice || step !== 'email-auth' || !activeField) return;

    const targetRef =
      activeField === 'password'
          ? passwordRef
          : activeField === 'confirmPassword'
            ? confirmPasswordRef
            : null;

    if (!targetRef?.current) return;

    const timer = window.setTimeout(() => {
      ensureFieldVisible(targetRef);
    }, isKeyboardOpen ? 90 : 180);

    return () => window.clearTimeout(timer);
  }, [activeField, isKeyboardOpen, keyboardInset, isMobileDevice, step, ensureFieldVisible]);

  // Detect mobile device on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isMobile);
      logger.log('📱 Device detection:', { isMobile });
    }
  }, []);

  useEffect(() => {
    if (deviceResendCooldown <= 0) return;
    const timer = window.setTimeout(() => setDeviceResendCooldown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [deviceResendCooldown]);

  // Scroll to top on step change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Scroll the MAIN container (layout scroll), not window
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [step]);

  // Words to verify (3rd, 7th, and 11th word - indices 2, 6, 10)
  const wordsToVerify = [2, 6, 10];

  const handleCreateWallet = async () => {
    try {
      setError('');
      setIsLoading(true);
      const phrase = await createWallet();
      setMnemonic(phrase);
      setStep('mnemonic');
      
      logger.log('🔄 New wallet created successfully, setting flags for password setup');
      
      // Set flags to indicate we just created a new wallet without password
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_just_created', 'true');
        logger.log('✅ Set wallet_just_created flag');
        
        // Also set a more direct flag
        localStorage.setItem('force_password_setup', 'true');
        logger.log('✅ Set force_password_setup flag');
      }
      
    } catch (err) {
      logger.error('Error creating wallet:', err);
      setError('Something went wrong creating the wallet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    try {
      setError('');
      setIsLoading(true);
      await importWallet(importInput.trim());
      
      logger.log('🔄 Wallet imported successfully, setting flags for password setup');
      
      // Set flags to indicate we just imported a wallet without password
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_just_imported', 'true');
        logger.log('✅ Set wallet_just_imported flag');
        
        // Also set a more direct flag
        localStorage.setItem('force_password_setup', 'true');
        logger.log('✅ Set force_password_setup flag');
      }
      
      // Check if mobile - offer biometric setup
      if (isMobileDevice) {
        logger.log('📱 Mobile device detected - offering biometric setup after seed phrase import');
        setStep('biometric-setup');
      } else {
        // Desktop - complete onboarding
        onComplete();
      }
      
    } catch (err) {
      logger.error('Error importing wallet:', err);
      setError('Invalid recovery phrase. Check the words and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMnemonic = () => {
    const mnemonicWords = mnemonic.toLowerCase().split(' ');
    
    // Check if all required words are filled
    const missingWords = wordsToVerify.filter(index => !verifyWords[index]?.trim());
    if (missingWords.length > 0) {
      setError('Please fill in all required words.');
      return;
    }
    
    // Verify each word
    for (const index of wordsToVerify) {
      const userWord = verifyWords[index].trim().toLowerCase();
      const correctWord = mnemonicWords[index];
      
      if (userWord !== correctWord) {
        setError('One or more words do not match. Check your answers.');
        return;
      }
    }
    
    // All correct! Check if we should show biometric setup
    if (createdViaEmail && isMobileDevice) {
      // Email wallet on mobile - offer biometric setup first
      logger.log('📱 Email wallet on mobile - showing biometric setup');
      setStep('biometric-setup');
    } else if (isMobileDevice) {
      // Seed phrase wallet on mobile - offer biometric setup
      logger.log('📱 Seed phrase wallet on mobile - showing biometric setup');
      setStep('biometric-setup');
    } else {
      // Desktop - complete onboarding directly
      onComplete();
    }
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle email authentication
  const handleEmailAuth = async () => {
    try {
      setError('');
      setIsLoading(true);
      setEmailTouched(true);

      // Validation
      if (!email || !password) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Invalid email address');
        setIsLoading(false);
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        setIsLoading(false);
        return;
      }

      if (emailAuthMode === 'signup' && password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      if (emailAuthMode === 'signup') {
        // Sign up with Supabase
        const result = await signUpWithEmail(email, password);
        
        if (!result.success) {
          setError(result.error || 'Failed to create account');
          return;
        }

        // Initialize wallet locally with the mnemonic
        if (result.mnemonic) {
          await importWallet(result.mnemonic);
          setMnemonic(result.mnemonic);
          setCreatedViaEmail(true); // Mark as email wallet
          
          // Show mnemonic for backup
          setStep('mnemonic');
    } else {
          // Shouldn't happen, but handle gracefully
          onComplete();
        }
      } else {
        // Sign in with Supabase (existing account)
        const result = await signInWithEmail(email, password);
        
        if (!result.success) {
          setError(result.error || 'Failed to sign in');
          return;
        }

        // ✅ Check if device verification is required (success: true + requiresDeviceVerification: true)
        if (result.requiresDeviceVerification && result.deviceVerificationToken) {
          logger.log('📧 Device verification required - showing verification step');
          setDeviceVerificationToken(result.deviceVerificationToken);
          setStep('device-verification');
          return;
        }

        // ✅ Check if 2FA is required
        if (result.requires2FA && result.user) {
          logger.log('🔐 2FA required for this account');
          setPending2FAUserId(result.user.id);
          setPending2FAEmail(email);
          setPending2FAPassword(password);
          setShow2FAModal(true);
          return;
        }

        // Initialize wallet locally with the decrypted mnemonic
        if (result.mnemonic) {
          await importWallet(result.mnemonic);
        }

        // ✅ SIGN IN (existing user) → Always complete onboarding immediately!
        // Don't offer biometric setup for existing users during sign in
        // They can enable it later in settings if they want
        logger.log('✅ Sign in successful - completing onboarding');
        onComplete();
      }
    } catch (err) {
      logger.error('Error with email auth:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle 2FA verification success
  const handle2FASuccess = async () => {
    try {
      setShow2FAModal(false);
      setIsLoading(true);

      // Complete sign in after 2FA verification
      const result = await completeSignInAfter2FA(pending2FAUserId, pending2FAEmail, pending2FAPassword);

      if (!result.success) {
        setError(result.error || 'Failed to complete sign in');
        return;
      }

      // 🔥 CRITICAL: Re-initialize wallet store from IndexedDB after login
      // completeSignInAfter2FA() just saved wallet to IndexedDB, now update store state
      logger.log('🔄 [2FA] Re-initializing wallet store from IndexedDB after login...');
      const { initializeFromStorage } = useWalletStore.getState();
      await initializeFromStorage();
      logger.log('✅ [2FA] Wallet store re-initialized from IndexedDB');

      // Initialize wallet locally with the decrypted mnemonic
      if (result.mnemonic) {
        await importWallet(result.mnemonic);
      }

      // ✅ 2FA SIGN IN (existing user) → Always complete onboarding immediately!
      // Don't offer biometric setup for existing users during sign in
      logger.log('✅ 2FA verification successful - completing onboarding');
      onComplete();
    } catch (err) {
      logger.error('Error completing 2FA sign in:', err);
      setError('Failed to complete sign in after 2FA');
    } finally {
      setIsLoading(false);
      // Clear sensitive data
      setPending2FAPassword('');
    }
  };

  const handleResendDeviceCode = async () => {
    if (isResendingDeviceCode || deviceResendCooldown > 0) return;

    try {
      setError('');
      setIsResendingDeviceCode(true);

      const result = await signInWithEmail(email, password);
      if (!result.success) {
        setError(result.error || 'Failed to resend verification code. Please try again.');
        return;
      }

      if (result.requiresDeviceVerification && result.deviceVerificationToken) {
        setDeviceVerificationToken(result.deviceVerificationToken);
        setDeviceResendCooldown(60);
        setDeviceVerificationCode('');
      } else {
        setError('This session no longer requires device verification. Please continue signing in.');
      }
    } catch (err) {
      logger.error('Error resending device verification code:', err);
      setError('Failed to resend verification code. Please try again.');
    } finally {
      setIsResendingDeviceCode(false);
    }
  };

  const words = mnemonic.split(' ');

  return (
    <div className="min-h-[100dvh] bg-[#f4f6fb] relative flex items-center justify-center py-6 sm:py-10 lg:py-14">
      {/* Subtle dashboard-like backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.10),transparent_55%)] pointer-events-none" />
      
      {/* 🎯 CONTENT WRAPPER - Perfect centering for all screen sizes */}
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-2xl xl:max-w-3xl relative z-10 px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {/* Welcome screen */}
          {step === 'carousel' && (
          <motion.div
              key="carousel"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md sm:max-w-lg lg:max-w-xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-3xl shadow-xl p-5 sm:p-6 lg:p-8 mb-6">
                <div className="relative h-52 sm:h-56 lg:h-60 mb-5">
                  {/* Floating crypto circles (kept from original hero style, without carousel) */}
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
                    className="absolute top-2 left-2 sm:left-4 w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center"
                  >
                    <img src="/crypto-bitcoin.png" alt="Bitcoin" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]" />
                  </motion.div>

                  <motion.div
                    animate={{ y: [0, -12, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute top-0 right-3 sm:right-6 w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] flex items-center justify-center"
                  >
                    <img src="/crypto-eth.png" alt="Ethereum" className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]" />
                  </motion.div>

                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
                    className="absolute bottom-3 left-3 sm:left-6 w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] flex items-center justify-center"
                  >
                    <img src="/crypto-doge.png" alt="Doge" className="w-11 h-11 sm:w-12 sm:h-12 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]" />
                  </motion.div>

                  <motion.div
                    animate={{ y: [0, -11, 0] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1.25 }}
                    className="absolute bottom-1 right-1 sm:right-4 w-12 h-12 sm:w-[56px] sm:h-[56px] flex items-center justify-center"
                  >
                    <img src="/crypto-solana.png" alt="Solana" className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]" />
                  </motion.div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 shadow-2xl flex items-center justify-center p-[6px]"
                    >
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <img
                          src="/crypto-blaze.png"
                          alt="Blaze"
                          className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>

                <div className="text-center mb-5">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">Welcome to Blaze</h1>
                  <p className="text-gray-600 text-sm sm:text-base">The crypto wallet built for speed, security, and clarity.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-1">
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900">Self-custody</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">You keep full control</p>
                  </div>
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900">Multi-chain</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">All your assets in one place</p>
                  </div>
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900">Private by default</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Encrypted local security</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4 pb-3">
                <button
                  onClick={() => setStep('create-options')}
                  className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold py-4 sm:py-5 lg:py-6 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 lg:hover:scale-[1.02] text-base sm:text-lg"
                >
                  Create a new wallet
                </button>
                
                <button
                  onClick={() => setStep('add-wallet')}
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 font-bold py-4 sm:py-5 lg:py-6 px-6 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all active:scale-95 lg:hover:scale-[1.02] text-base sm:text-lg hover:shadow-lg"
                >
                  I already have a wallet
                </button>
              </div>
            </motion.div>
          )}

          {/* CREATE OPTIONS SCREEN */}
          {step === 'create-options' && (
            <motion.div
              key="create-options"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md sm:max-w-lg lg:max-w-xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              {/* Back button - CONSISTENT SPACING */}
              <div className="mb-8 sm:mb-10 lg:mb-12">
                <button
                  onClick={() => setStep('carousel')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors lg:hover:-translate-x-1"
                >
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" />
                  <span className="text-sm sm:text-base lg:text-lg">Back</span>
                </button>
              </div>

              {/* Header - CONSISTENT SPACING */}
              <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5 lg:mb-6 shadow-lg">
                  <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2 sm:mb-3">Create a wallet</h2>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Choose how you want to create your wallet</p>
              </div>

              {/* Options - CONSISTENT SPACING */}
              <div className="space-y-3 sm:space-y-4 lg:space-y-5 mb-6 sm:mb-8 lg:mb-10">
                <button
                  onClick={() => {
                    setEmailAuthMode('signup');
                    setStep('email-auth');
                  }}
                  disabled={isLoading}
                  className="w-full p-4 sm:p-5 lg:p-6 rounded-xl flex items-center justify-between bg-gradient-to-br from-orange-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 lg:hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      <Mail className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-base sm:text-lg lg:text-xl font-bold">Continue with email</div>
                      <div className="text-xs sm:text-sm lg:text-base text-white/90">Automatic cloud backup</div>
                    </div>
                  </div>
                  <div className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-md bg-white/30 backdrop-blur-sm text-white text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                    Recommended
                  </div>
                </button>

                <button
                  onClick={handleCreateWallet}
                  disabled={isLoading}
                  className="w-full p-4 sm:p-5 lg:p-6 rounded-xl flex items-center gap-3 sm:gap-4 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all active:scale-95 lg:hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                      <div className="text-left">
                        <div className="text-base sm:text-lg lg:text-xl font-bold">Creating wallet...</div>
                        <div className="text-xs sm:text-sm lg:text-base text-gray-600">Please wait</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Key className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-base sm:text-lg lg:text-xl font-bold">Create with seed phrase</div>
                        <div className="text-xs sm:text-sm lg:text-base text-gray-600">Manual backup required</div>
                      </div>
                    </>
                  )}
                </button>
              </div>

              {/* Info Note - LAUNCHPAD STYLE */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 lg:p-5">
                <div className="flex items-start gap-3 lg:gap-4">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm lg:text-base mb-1">Both methods are secure</p>
                    <p className="text-xs lg:text-sm text-gray-600">Email includes automatic cloud backup with encryption. Seed phrase requires you to manually save your 12 recovery words.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ADD A WALLET SCREEN */}
          {step === 'add-wallet' && (
            <motion.div
              key="add-wallet"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md lg:max-w-xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              {/* Back button */}
              <div className="mb-8 lg:mb-10">
                <button
                  onClick={() => setStep('carousel')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors lg:hover:-translate-x-1"
                >
                  <ArrowRight className="w-5 h-5 lg:w-6 lg:h-6 rotate-180" />
                  <span className="lg:text-lg">Back</span>
                </button>
              </div>

              {/* Header */}
              <div className="text-center mb-8 lg:mb-10">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 lg:mb-5 shadow-lg">
                  <Download className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">Add a wallet</h2>
                <p className="text-gray-600 text-sm lg:text-base">Login or import an existing wallet</p>
              </div>

              {/* Actions */}
              <div className="space-y-3 lg:space-y-4">
                <button
                  onClick={() => {
                    setEmailAuthMode('login');
                    setStep('email-auth');
                  }}
                  disabled={isLoading}
                  className="w-full py-4 lg:py-5 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 lg:gap-3 disabled:opacity-50 disabled:cursor-not-allowed lg:hover:scale-[1.02] active:scale-95 lg:text-lg"
                >
                  <Mail className="w-5 h-5 lg:w-6 lg:h-6" />
                  Continue with email
                </button>
                
                <button
                  onClick={() => setStep('import-seed')}
                  disabled={isLoading}
                  className="w-full py-4 lg:py-5 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed lg:hover:scale-[1.02] active:scale-95 lg:text-lg"
                >
                  Continue with seed phrase
                </button>
              </div>
            </motion.div>
          )}

          {/* EMAIL AUTHENTICATION SCREEN */}
          {step === 'email-auth' && (
            <motion.div
              key="email-auth"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto ${ONBOARDING_CARD_SHELL} p-4 sm:p-6 lg:p-7 ${
                isMobileDevice ? 'max-h-[calc(100dvh-0.75rem)] overflow-y-auto overscroll-contain' : ''
              }`}
              ref={formContainerRef}
            >
              <div>
                {/* Back Button */}
                <div className="mb-5">
                  <button
                    onClick={() => setStep(emailAuthMode === 'signup' ? 'create-options' : 'add-wallet')}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                    <span className="text-sm font-semibold">Back</span>
                  </button>
                </div>

                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                    {emailAuthMode === 'signup' ? 'Create with email' : 'Login with email'}
                  </h2>
                  <p className="text-gray-600 mt-2">
                    {emailAuthMode === 'signup'
                      ? 'Set up your wallet with email authentication'
                      : 'Access your existing wallet'}
                  </p>
                </div>

                {/* Social Buttons */}
                <div className="space-y-3 mb-6">
                  <button
                    disabled
                    className="w-full py-3 sm:py-4 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-500 font-semibold flex items-center gap-3 opacity-60 cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="flex-1 text-center text-sm sm:text-base pr-20 sm:pr-24">Continue with Google</span>
                    <span className="px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded-md text-[10px] sm:text-xs text-orange-600 font-semibold whitespace-nowrap flex-shrink-0">
                      Coming soon
                    </span>
                  </button>
                  <button
                    disabled
                    className="w-full py-3 sm:py-4 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-500 font-semibold flex items-center gap-3 opacity-60 cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <span className="flex-1 text-center text-sm sm:text-base pr-20 sm:pr-24">Continue with Apple</span>
                    <span className="px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded-md text-[10px] sm:text-xs text-orange-600 font-semibold whitespace-nowrap flex-shrink-0">
                      Coming soon
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-gray-300" />
                  <span className="text-sm text-gray-500">Or continue with email</span>
                  <div className="flex-1 h-px bg-gray-300" />
                </div>

              {/* ✅ IMPROVED: Form with Enter key support and auto-scroll */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleEmailAuth();
              }}
              className="space-y-4 sm:space-y-5 lg:space-y-6"
            >
                {/* EMAIL FIELD */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email address
                  </label>
                  {(() => {
                    const showEmailInvalid = emailTouched && emailValid === false && email.length > 0;
                    return (
                  <div className="relative">
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(''); // Clear error on change
                      }}
                      onFocus={() => {
                        setActiveField('email');
                      }}
                      onBlur={() => {
                        setActiveField(null);
                        setEmailTouched(true);
                      }}
                      onKeyPress={(e) => {
                        // ✅ Enter → Focus password field
                        if (e.key === 'Enter' && email && emailValid) {
                          e.preventDefault();
                          passwordRef.current?.focus();
                        }
                      }}
                      placeholder="your@email.com"
                      autoFocus
                      autoComplete="email"
                      disabled={isLoading}
                      className={`w-full px-4 py-2 sm:py-3 ${
                        showEmailInvalid ? 'pr-10' : ''
                      } bg-white border-2 ${
                        showEmailInvalid
                          ? 'border-red-300 focus:border-red-500' 
                          : emailValid === true && email.length > 0
                          ? 'border-green-300 focus:border-green-500'
                          : 'border-gray-200 focus:border-orange-500'
                      } rounded-xl focus:outline-none transition-colors text-gray-900 placeholder-gray-400 disabled:opacity-50`}
                    />
                    
                    {/* ✅ Real-time validation icon - PERFECTLY CENTERED */}
                    {emailValid === true && email.length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                    {showEmailInvalid && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        <XCircle className="w-5 h-5 text-red-500" />
                      </div>
                    )}
                  </div>
                    );
                  })()}
                  
                  {/* ✅ Inline email validation message */}
                  {emailTouched && emailValid === false && email.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-600 mt-1 ml-1"
                    >
                      Please enter a valid email address
                    </motion.p>
                  )}
                </div>

                {/* PASSWORD FIELD */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      onFocus={() => {
                        setActiveField('password');
                        if (isMobileDevice) ensureFieldVisible(passwordRef);
                      }}
                      onBlur={() => setActiveField(null)}
                      onKeyPress={(e) => {
                        // ✅ Enter → Focus confirm (signup) or submit (login)
                        if (e.key === 'Enter' && password) {
                          if (emailAuthMode === 'signup' && confirmPasswordRef.current) {
                            e.preventDefault();
                            confirmPasswordRef.current.focus();
                          }
                          // For login, let form submit naturally
                        }
                      }}
                      placeholder="Enter secure password"
                      autoComplete={emailAuthMode === 'signup' ? 'new-password' : 'current-password'}
                      disabled={isLoading}
                      className="w-full px-4 py-2 sm:py-3 pr-12 bg-white border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors text-gray-900 placeholder-gray-400 disabled:opacity-50"
                    />
              <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
                  </div>
                  
                  {/* ✅ Password strength indicator (signup only) */}
                  {emailAuthMode === 'signup' && password.length > 0 && passwordStrength && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ 
                              width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%' 
                            }}
                            className={`h-full rounded-full transition-all ${
                              passwordStrength === 'weak' 
                                ? 'bg-red-500' 
                                : passwordStrength === 'medium' 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                            }`}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          passwordStrength === 'weak' 
                            ? 'text-red-600' 
                            : passwordStrength === 'medium' 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {passwordStrength === 'weak' ? 'Weak' : passwordStrength === 'medium' ? 'Medium' : 'Strong'}
                        </span>
                      </div>
                      {password.length < 8 && (
                        <p className="text-xs text-gray-600 ml-1">
                          Password must be at least 8 characters
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* CONFIRM PASSWORD FIELD (signup only) */}
                {emailAuthMode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        ref={confirmPasswordRef}
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError('');
                        }}
                        onFocus={() => {
                          setActiveField('confirmPassword');
                          if (isMobileDevice) ensureFieldVisible(confirmPasswordRef);
                        }}
                        onBlur={() => setActiveField(null)}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        disabled={isLoading}
                        className={`w-full px-4 py-2 sm:py-3 ${
                          passwordsMatch === false ? 'pr-10' : ''
                        } bg-white border-2 ${
                          passwordsMatch === false 
                            ? 'border-red-300 focus:border-red-500' 
                            : passwordsMatch === true
                            ? 'border-green-300 focus:border-green-500'
                            : 'border-gray-200 focus:border-orange-500'
                        } rounded-xl focus:outline-none transition-colors text-gray-900 placeholder-gray-400 disabled:opacity-50`}
                      />
                      
                      {/* ✅ Password match indicator - PERFECTLY CENTERED */}
                      {passwordsMatch === true && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      )}
                      {passwordsMatch === false && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                          <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                      )}
                    </div>
                    
                    {/* ✅ Password match message */}
                    {passwordsMatch === false && confirmPassword.length > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-600 mt-1 ml-1"
                      >
                        Passwords do not match
                      </motion.p>
                    )}
                  </motion.div>
                )}

                {/* Error - LAUNCHPAD STYLE */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                  >
                    <p className="text-sm text-red-700">{error}</p>
                  </motion.div>
                )}

                {/* Stable sticky CTA: avoids iOS keyboard jump caused by fixed overlays */}
              <div 
                  className={`sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 border-t border-gray-200 bg-white/95 backdrop-blur ${
                    isMobileDevice ? 'pb-[max(env(safe-area-inset-bottom),12px)]' : 'pb-0'
                  }`}
                >
                  <button
                  type="submit"
                  disabled={!email || !password || (emailAuthMode === 'signup' && !confirmPassword) || isLoading}
                    className="w-full py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{emailAuthMode === 'signup' ? 'Creating...' : 'Logging in...'}</span>
                    </>
                  ) : (
                    <span>{emailAuthMode === 'signup' ? 'Create wallet' : 'Login'}</span>
                  )}
                </button>
                </div>

                {/* Toggle login/signup */}
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setEmailValid(null);
                    setEmailTouched(false);
                    setPasswordStrength(null);
                    setPasswordsMatch(null);
                    setEmailAuthMode(emailAuthMode === 'signup' ? 'login' : 'signup');
                  }}
                  disabled={isLoading}
                  className="w-full py-3 text-gray-600 hover:text-gray-900 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {emailAuthMode === 'signup' 
                    ? 'Already have an account? Log in' 
                    : 'Need an account? Sign up'}
              </button>
            </form>

              {/* Security Note - LAUNCHPAD INFO BOX STYLE */}
              {emailAuthMode === 'signup' && (
                <div className="mt-6 bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm mb-1">You'll still get a recovery phrase</p>
                      <p className="text-xs text-gray-600">After creating your wallet, you'll receive a 12-word recovery phrase. Save it securely - it's your backup.</p>
                    </div>
                  </div>
                </div>
              )}
              </div>
          </motion.div>
        )}

          {/* IMPORT SEED PHRASE SCREEN */}
          {step === 'import-seed' && (
            <motion.div
              key="import-seed"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md lg:max-w-xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              {/* Back button */}
              <div className="mb-8">
                <button
                  onClick={() => setStep('add-wallet')}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                  Back
                </button>
              </div>

              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Download className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">Import wallet</h2>
                <p className="text-gray-600 text-sm">Enter your 12-word recovery phrase</p>
              </div>

              {/* Textarea */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    Recovery phrase
                  </label>
                  <span className={`text-xs font-semibold ${
                    importInput.trim().split(/\s+/).filter(w => w).length === 12 
                      ? 'text-green-600' 
                      : 'text-gray-500'
                  }`}>
                    {importInput.trim().split(/\s+/).filter(w => w).length}/12 words
                  </span>
                </div>
                <textarea
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="Enter your 12-word recovery phrase (separated by spaces)..."
                  autoFocus
                  disabled={isLoading}
                  className="w-full min-h-[120px] sm:min-h-[140px] lg:min-h-[160px] p-4 sm:p-5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl resize-y focus:outline-none focus:border-orange-500 transition-all text-base sm:text-lg placeholder-gray-400 disabled:opacity-50"
                />
                
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </div>
                )}
              </div>

              {/* Info Note - LAUNCHPAD STYLE */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Enter all 12 words</p>
                    <p className="text-xs text-gray-600">Make sure they are in the correct order and separated by spaces. Recovery phrases are case-insensitive.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleImportWallet}
                disabled={!importInput.trim() || isLoading}
                className="w-full py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import wallet</span>
                )}
              </button>
            </motion.div>
          )}

          {/* MNEMONIC SCREEN */}
        {step === 'mnemonic' && (
          <motion.div
            key="mnemonic"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`max-w-2xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              {/* Critical security warning */}
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-3xl p-1 mb-6 shadow-2xl">
                <div className="bg-white rounded-[22px] p-5 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-red-900 font-bold text-base sm:text-lg mb-2 flex items-center gap-2">
                        🔒 CRITICAL: Your Recovery Phrase
                      </h3>
                      <div className="text-red-800 text-xs sm:text-sm space-y-2">
                        <p className="font-semibold">This is the ONLY way to recover your wallet. If you lose it, your funds are gone forever.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <span className="text-red-600 flex-shrink-0 mt-0.5">⛔</span>
                              <span>NEVER share with ANYONE (not even support)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-red-600 flex-shrink-0 mt-0.5">⛔</span>
                              <span>NEVER take screenshots (can be hacked)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-red-600 flex-shrink-0 mt-0.5">⛔</span>
                              <span>NEVER store digitally (no photos, emails, cloud)</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Write on PAPER and store in a SAFE place</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Make MULTIPLE physical copies</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>Store in DIFFERENT secure locations</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-red-100 border border-red-300 rounded-xl p-3 mt-3">
                          <p className="font-bold text-red-900 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            Anyone with these 12 words can STEAL ALL your crypto!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">Save your recovery phrase</h2>
                <p className="text-gray-600 text-sm sm:text-base">Write down these 12 words in order on paper. Do NOT take a screenshot!</p>
              </div>

              {/* Mnemonic Card - white background */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-gray-900">Your 12 words</span>
                    <button
                      onClick={() => setShowMnemonic(!showMnemonic)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
                    >
                      {showMnemonic ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Show
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 transition-all duration-300 ${!showMnemonic ? 'blur-md select-none' : ''}`}>
                    {words.map((word, index) => (
                  <div
                    key={index}
                        className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0"
                  >
                        <span className="text-orange-500 font-bold text-xs sm:text-sm w-6 sm:w-8 flex-shrink-0">{index + 1}</span>
                        <span className="font-mono text-xs sm:text-sm lg:text-base font-semibold text-gray-900 select-all whitespace-nowrap flex-shrink-0">{word}</span>
                  </div>
                ))}
                  </div>
              </div>

              <button
                  onClick={copyMnemonic}
                  disabled={!showMnemonic}
                  className={`w-full font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                    showMnemonic 
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {copied ? (
                  <>
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="text-green-600 text-sm">Copied! Clear clipboard after writing down</span>
                  </>
                ) : (
                  <>
                      <Copy className="w-5 h-5" />
                      <span className="text-sm">{showMnemonic ? 'Copy to clipboard (temporary only)' : 'Show words to copy'}</span>
                  </>
                )}
              </button>
            </div>

              {/* Security Checklist - LAUNCHPAD STYLE */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 sm:p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-orange-500" />
                  </div>
                  <h4 className="text-gray-900 font-bold text-base">Security checklist</h4>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'written', label: 'I have written these 12 words on paper' },
                    { key: 'stored', label: 'I will store the paper in a safe place' },
                    { key: 'understand', label: 'I understand I can NEVER recover my wallet without these words' },
                    { key: 'neverShare', label: 'I will NEVER share these words with anyone' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setSecurityChecks(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className="w-full flex items-center gap-3 text-gray-900 text-sm p-3 rounded-lg hover:bg-orange-500/10 transition-colors text-left"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        securityChecks[item.key as keyof typeof securityChecks] 
                          ? 'bg-green-500' 
                          : 'bg-gray-200 border-2 border-gray-300'
                      }`}>
                        {securityChecks[item.key as keyof typeof securityChecks] && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className={securityChecks[item.key as keyof typeof securityChecks] ? 'font-semibold' : ''}>{item.label}</span>
                    </button>
                  ))}
                </div>
            </div>

            <button
              onClick={() => setStep('verify')}
                disabled={!allSecurityChecksCompleted}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all"
            >
                {allSecurityChecksCompleted ? "I've saved my recovery phrase →" : 'Complete all checks to continue'}
            </button>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div
            key="verify"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`max-w-md lg:max-w-xl mx-auto w-full ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              {/* Header */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">Verify recovery phrase</h2>
                <p className="text-gray-600 text-sm">Enter these specific words to verify you saved them correctly</p>
            </div>

              {/* Verify Inputs - IMPROVED LAYOUT */}
              <div className="space-y-3 sm:space-y-4 lg:space-y-5 mb-6 sm:mb-8">
                {wordsToVerify.map((wordIndex, idx) => (
                  <div 
                    key={wordIndex}
                    className="flex items-center gap-4 sm:gap-5"
                  >
                    <div className="flex items-center gap-2 w-24 sm:w-28 lg:w-32 flex-shrink-0">
                      <span className="text-orange-500 font-bold text-base sm:text-lg">
                        {wordIndex + 1}.
                      </span>
                      <span className="text-gray-500 text-sm sm:text-base">word</span>
                    </div>
                  <input
                    type="text"
                      value={verifyWords[wordIndex] || ''}
                      onChange={(e) => setVerifyWords(prev => ({ ...prev, [wordIndex]: e.target.value }))}
                      onPaste={(e) => e.preventDefault()}
                    autoComplete="off"
                      className="flex-1 min-w-0 px-4 sm:px-5 py-3 sm:py-4 bg-white border-2 border-gray-200 rounded-xl text-base sm:text-lg focus:outline-none focus:border-orange-500 transition-all placeholder-gray-400"
                      placeholder="Enter word"
                      autoFocus={idx === 0}
                  />
                </div>
              ))}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 mb-6">
                  <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                  <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

              {/* Info box - LAUNCHPAD STYLE */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Quick verification</p>
                    <p className="text-xs text-gray-600">You only need to verify 3 words to confirm you saved your recovery phrase correctly.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
            <button
                  onClick={() => setStep('mnemonic')}
                  className="flex-1 py-3 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 border-2 border-gray-200 transition-colors"
            >
                  Back
            </button>
                <button
                  onClick={handleVerifyMnemonic}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg transition-all"
                >
                  Verify and continue →
                </button>
              </div>
          </motion.div>
        )}

          {/* DEVICE VERIFICATION SCREEN */}
          {step === 'device-verification' && (
          <motion.div
              key="device-verification"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md lg:max-w-xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              <div className="w-full">
                {/* Icon & Header */}
            <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Mail className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">
                    Verify your device
                  </h2>
                  <p className="text-gray-600 text-sm">
                    We sent a 6-digit code to {email}. Enter it below to verify this device.
              </p>
            </div>

                {/* Info box */}
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Security first</p>
                      <p className="text-xs text-gray-600">This helps protect your account from unauthorized access</p>
                    </div>
                  </div>
            </div>

                {/* Verification Code Input */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={deviceVerificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setDeviceVerificationCode(value);
                      setError('');
                    }}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-orange-500 transition-all"
                    autoFocus
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enter the 6-digit code from your email
                  </p>
            </div>

                {/* Error */}
            {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

                {/* Action Button */}
            <button
                  onClick={async () => {
                    try {
                      if (deviceVerificationCode.length !== 6) {
                        setError('Please enter a 6-digit code');
                        return;
                      }

                      setIsLoading(true);
                      setError('');
                      
                      // Import verifyDeviceAndSignIn from strict auth
                      const { verifyDeviceAndSignIn } = await import('@/lib/supabase-auth-strict');
                      
                      // Verify device with code
                      const result = await verifyDeviceAndSignIn(
                        deviceVerificationToken,
                        deviceVerificationCode,
                        '', // No 2FA code (not implemented yet)
                        email,
                        password
                      );
                      
                      if (!result.success) {
                        setError(result.error || 'Verification failed');
                        setIsLoading(false);
                        return;
                      }
                      
                      // Initialize wallet locally with the decrypted mnemonic
                      if (result.mnemonic) {
                        await importWallet(result.mnemonic);
                      }
                      
                      // Check if mobile AND biometrics not already enabled
                      const biometricEnabled = typeof window !== 'undefined'
                        ? localStorage.getItem('biometric_enabled') === 'true'
                        : false;
                      
                      if (isMobileDevice && !biometricEnabled) {
                        // Offer biometric setup after device verification
                        logger.log('📱 Mobile device detected - offering biometric setup');
                        // Store password temporarily for biometric setup
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('pending_biometric_password', password);
                        }
                        setStep('biometric-setup');
                      } else {
                        // Desktop or biometrics already enabled - complete onboarding
                        onComplete();
                      }
                    } catch (err: any) {
                      logger.error('Device verification error:', err);
                      setError(err.message || 'Verification failed');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading || deviceVerificationCode.length !== 6}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Verify device
                    </>
                  )}
              </button>

                {/* Resend action */}
                <div className="mt-4 text-center">
                  <button
                    onClick={handleResendDeviceCode}
                    disabled={isResendingDeviceCode || deviceResendCooldown > 0}
                    className="text-sm text-orange-500 hover:text-orange-600 disabled:text-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    {isResendingDeviceCode
                      ? 'Resending...'
                      : deviceResendCooldown > 0
                        ? `Resend available in ${deviceResendCooldown}s`
                        : "Didn't receive the code? Resend"}
                  </button>
                </div>
              </div>
          </motion.div>
        )}

          {/* BIOMETRIC SETUP SCREEN */}
          {step === 'biometric-setup' && (
          <motion.div
              key="biometric-setup"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className={`w-full max-w-md lg:max-w-xl mx-auto ${ONBOARDING_CARD_SHELL} p-5 sm:p-6 lg:p-7`}
            >
              <div className="w-full">
                {/* Icon & Header - NO CARD */}
            <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Fingerprint className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-2">
                    Enable biometric security
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Use Face ID or Touch ID to unlock your wallet quickly and securely.
              </p>
            </div>

                {/* Benefits - LAUNCHPAD INFO BOX STYLE */}
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Extra secure</p>
                        <p className="text-xs text-gray-600">Your password is encrypted and stored locally</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Super fast</p>
                        <p className="text-xs text-gray-600">Unlock with one tap or glance</p>
                      </div>
                    </div>
                  </div>
            </div>

                {/* Error - LAUNCHPAD STYLE */}
            {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                    <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

                {/* Action Buttons */}
            <div className="space-y-3">
              <button
                    onClick={async () => {
                      try {
                        setError('');
                        
                        // Get password from session storage (set during email login)
                        const storedPassword = typeof window !== 'undefined'
                          ? sessionStorage.getItem('pending_biometric_password') || password
                          : password;
                        
                        if (!storedPassword) {
                          throw new Error('No password available for biometric setup');
                        }
                        
                        // Register WebAuthn credential
                        const { WebAuthnService } = await import('@/lib/webauthn-service');
                        const { BiometricStore } = await import('@/lib/biometric-store');
                        const { resolveCurrentIdentity, selfHealIdentityFromSession } = await import('@/lib/account-identity');
                        
                        const webauthnService = WebAuthnService.getInstance();
                        const biometricStore = BiometricStore.getInstance();
                        
                        // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
                        const { useWalletStore } = await import('@/lib/wallet-store');
                        const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
                        if (!walletIdentifier) {
                          throw new Error('Cannot determine wallet identifier for biometric setup');
                        }
                        
                        // ✅ WALLET-SPECIFIC: Detect wallet type from identity resolver (not fragile local flags)
                        const identity = await resolveCurrentIdentity() || await selfHealIdentityFromSession();
                        const walletType: 'email' | 'seed' = identity ? 'email' : 'seed';
                        
                        // Create display name
                        const displayName = walletType === 'email' 
                          ? (identity?.email || 'BLAZE User')
                          : `Wallet ${walletIdentifier.substring(0, 8)}...`;
                        
                        logger.log(`🔐 Registering biometric credential for ${walletType} wallet...`);
                        const result = await webauthnService.register(walletIdentifier, displayName, walletType);
                        
                        if (!result.success || !result.credential) {
                          throw new Error(result.error || 'Biometric registration failed');
                        }
                        
                        // ✅ WALLET-SPECIFIC: Store credential indexed by wallet identifier
                        webauthnService.storeCredential(result.credential, walletIdentifier);
                        
                        // ✅ WALLET-SPECIFIC: Store password for THIS wallet only
                        logger.log('💾 Storing password for biometric access...');
                        const stored = await biometricStore.storePassword(storedPassword, walletIdentifier);
                        
                        if (!stored) {
                          throw new Error('Failed to store password for biometric access');
                        }
                        
                        // Mark biometric as enabled
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('biometric_enabled', 'true');
                          sessionStorage.removeItem('pending_biometric_password'); // Clear password
                        }
                        
                        logger.log('✅ Biometric enabled successfully');
                        
                        // Complete onboarding
                        onComplete();
                      } catch (err: any) {
                        logger.error('Biometric setup error:', err);
                        setError(err.message || 'Biometric setup failed');
                      }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Fingerprint className="w-5 h-5" />
                    Enable Face ID / Touch ID
              </button>

              <button
                    onClick={() => {
                      logger.log('Biometric setup skipped');
                      // Clear password from session storage
                      if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('pending_biometric_password');
                      }
                      // Complete onboarding
                      onComplete();
                    }}
                    className="w-full py-3 text-gray-600 hover:text-gray-900 text-sm font-semibold transition-colors"
                  >
                    Skip for now
              </button>
                </div>

                {/* Footer Note */}
                <p className="text-center text-xs text-gray-500 mt-6">
                  You can set this up later in settings
                </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* ✅ NEW: 2FA Login Modal */}
      <TwoFactorLoginModal
        isOpen={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setPending2FAPassword(''); // Clear sensitive data
        }}
        onSuccess={handle2FASuccess}
        userId={pending2FAUserId}
        email={pending2FAEmail}
      />
    </div>
  );
}