'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle2, Copy, Check, Sparkles, Shield, Zap, Lock, AlertTriangle, Eye, EyeOff, ArrowRight, Mail, Key, Usb, FileText, Fingerprint, X, Brain, Flame, Vote, Rocket, Gift, CreditCard, Users, Palette, CheckCircle, XCircle } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple } from '@/lib/supabase-auth-strict';
import BlazeLogoImage from './BlazeLogoImage';
import { logger } from '@/lib/logger';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'carousel' | 'create-options' | 'add-wallet' | 'import-options' | 'mnemonic' | 'verify' | 'import-seed' | 'email-auth' | 'device-verification' | 'biometric-setup'>('carousel');
  const [carouselPage, setCarouselPage] = useState(0);
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
  
  // ✅ NEW: Field refs for auto-focus and scroll
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  
  // ✅ NEW: Real-time validation states
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);

  const { createWallet, importWallet } = useWalletStore();

  // ✅ NEW: Smooth scroll to field (only within onboarding, no impact on rest of app!)
  const scrollToField = (ref: React.RefObject<HTMLInputElement>) => {
    if (!ref.current) return;
    
    ref.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
    
    // Small delay for smooth UX, then focus
    setTimeout(() => ref.current?.focus(), 400);
  };

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

  // Detect mobile device on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isMobile);
      logger.log('📱 Device detection:', { isMobile });
    }
  }, []);

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
          // ✅ FIXED: Check if device verification is required
          if (result.requiresDeviceVerification && result.deviceVerificationToken) {
            setDeviceVerificationToken(result.deviceVerificationToken);
            setStep('device-verification');
            return;
          }
          
          setError(result.error || 'Failed to sign in');
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
          // Offer biometric setup after email login
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
      }
    } catch (err) {
      logger.error('Error with email auth:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const words = mnemonic.split(' ');

    // Simplified floating animation - CSS only for better performance
    const FloatingIcon = ({ children, delay = 0, className = '' }: { children: React.ReactNode, delay?: number, className?: string }) => (
      <div 
        className={`absolute ${className}`}
        style={{
          animation: `float 4s ease-in-out infinite`,
          animationDelay: `${delay}s`,
        }}
      >
        {children}
      </div>
    );

  // Real crypto logos
  const cryptoLogos = [
    { name: 'Bitcoin', image: '/crypto-bitcoin.png', gradient: 'from-orange-400 to-orange-600' },
    { name: 'Ethereum', image: '/crypto-eth.png', gradient: 'from-blue-400 to-blue-600' },
    { name: 'Doge', image: '/crypto-doge.png', gradient: 'from-yellow-400 to-yellow-600' },
    { name: 'Solana', image: '/crypto-solana.png', gradient: 'from-purple-400 to-purple-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative flex items-center justify-center py-8 sm:py-12 lg:py-16">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none" />
      
      {/* 🎯 CONTENT WRAPPER - Perfect centering for all screen sizes */}
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-2xl xl:max-w-3xl relative z-10 px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {/* CAROUSEL WELCOME SCREEN - SWIPEABLE SECTIONS */}
          {step === 'carousel' && (
          <motion.div
              key="carousel"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg lg:max-w-2xl mx-auto"
            >
              {/* Swipeable Content Container - AUTO HEIGHT, NO SCROLL */}
              <div 
                className="mb-6 lg:mb-8"
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  e.currentTarget.setAttribute('data-touch-start', touch.clientX.toString());
                  e.currentTarget.setAttribute('data-touch-start-y', touch.clientY.toString());
                }}
                onTouchMove={(e) => {
                  const touchStartX = parseFloat(e.currentTarget.getAttribute('data-touch-start') || '0');
                  const touchStartY = parseFloat(e.currentTarget.getAttribute('data-touch-start-y') || '0');
                  const touchCurrentX = e.touches[0].clientX;
                  const touchCurrentY = e.touches[0].clientY;
                  
                  const diffX = Math.abs(touchStartX - touchCurrentX);
                  const diffY = Math.abs(touchStartY - touchCurrentY);
                  
                  // Only allow horizontal swipe if horizontal movement is greater than vertical
                  if (diffX > diffY && diffX > 10) {
                    e.preventDefault();
                  }
                }}
                onTouchEnd={(e) => {
                  const touchStart = parseFloat(e.currentTarget.getAttribute('data-touch-start') || '0');
                  const touchEnd = e.changedTouches[0].clientX;
                  const diff = touchStart - touchEnd;
                  
                  if (Math.abs(diff) > 50) {
                    if (diff > 0 && carouselPage < 3) {
                      setCarouselPage(prev => prev + 1);
                    } else if (diff < 0 && carouselPage > 0) {
                      setCarouselPage(prev => prev - 1);
                    }
                  }
                }}
              >
                <AnimatePresence mode="wait">
              <motion.div
                    key={carouselPage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[450px] lg:min-h-[500px] gpu-accelerated"
                  >
                    {carouselPage === 0 && (
                      <div className="flex flex-col items-center w-full px-4 py-4">
                        {/* Floating Crypto Icons - RESPONSIVE CONTAINER */}
                        <div className="relative h-48 sm:h-56 lg:h-64 xl:h-72 w-full max-w-sm lg:max-w-md mx-auto mb-6 lg:mb-8">
                          <FloatingIcon delay={0} className="top-0 left-0 sm:top-2 sm:left-2 lg:top-4 lg:left-4">
                            <img src={cryptoLogos[0].image} alt={cryptoLogos[0].name} className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 object-contain" />
                          </FloatingIcon>
                          
                          <FloatingIcon delay={0.5} className="top-0 right-0 sm:top-2 sm:right-2 lg:top-4 lg:right-4">
                            <img src={cryptoLogos[1].image} alt={cryptoLogos[1].name} className="w-11 h-11 sm:w-13 sm:h-13 lg:w-15 lg:h-15 xl:w-18 xl:h-18 object-contain" />
                          </FloatingIcon>
                          
                          <FloatingIcon delay={1} className="bottom-0 left-0 sm:bottom-2 sm:left-2 lg:bottom-4 lg:left-4">
                            <img src={cryptoLogos[2].image} alt={cryptoLogos[2].name} className="w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 xl:w-22 xl:h-22 object-contain" />
                          </FloatingIcon>
                          
                          <FloatingIcon delay={1.5} className="bottom-0 right-0 sm:bottom-2 sm:right-2 lg:bottom-4 lg:right-4">
                            <img src={cryptoLogos[3].image} alt={cryptoLogos[3].name} className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 object-contain" />
                          </FloatingIcon>

                          {/* Center Logo - BLAZE LOGO (RESPONSIVE SIZING) */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <div 
                              className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 xl:w-40 xl:h-40 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-orange-500/20 gpu-accelerated p-3 sm:p-4 lg:p-5 xl:p-6"
                              style={{
                                animation: 'pulse-subtle 3s ease-in-out infinite'
                              }}
                            >
                              <img src="/crypto-blaze.png" alt="Blaze Wallet" className="w-full h-full object-contain" />
                            </div>
                          </div>
                        </div>

                        {/* Title - RESPONSIVE TYPOGRAPHY */}
                        <div className="text-center px-4">
                          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-3 sm:mb-4 lg:mb-5 leading-tight">
                            Welcome to Blaze
                          </h1>
                          <p className="text-gray-600 text-sm sm:text-base lg:text-lg xl:text-xl font-medium">
                            Your secure gateway to Web3
                          </p>
                        </div>
                      </div>
                    )}

                    {carouselPage === 1 && (
                      <div className="w-full max-w-md lg:max-w-4xl mx-auto">
                        {/* Header - Direct op achtergrond */}
                        <div className="text-center mb-6 lg:mb-8">
                          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-3 lg:mb-4 shadow-lg">
                            <Brain className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                          </div>
                          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">AI-Powered Tools</h2>
                          <p className="text-gray-600 text-sm lg:text-base">Smart features that work for you</p>
                        </div>
                        
                        {/* Features - Direct op achtergrond - GRID OP DESKTOP */}
                        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 px-2">
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Shield className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Risk Scanner</p>
                              <p className="text-xs lg:text-sm text-gray-600">Detect scams before you transact</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Portfolio Advisor</p>
                              <p className="text-xs lg:text-sm text-gray-600">Get personalized investment insights</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Gas Optimizer</p>
                              <p className="text-xs lg:text-sm text-gray-600">Save on transaction fees automatically</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {carouselPage === 2 && (
                      <div className="w-full max-w-md lg:max-w-4xl mx-auto">
                        {/* Header - Direct op achtergrond */}
                        <div className="text-center mb-6 lg:mb-8">
                          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-3 lg:mb-4 shadow-lg">
                            <Flame className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                          </div>
                          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">DeFi Features</h2>
                          <p className="text-gray-600 text-sm lg:text-base">Earn, govern, and invest</p>
                        </div>
                        
                        {/* Features - Direct op achtergrond - GRID OP DESKTOP */}
                        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 px-2">
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Staking</p>
                              <p className="text-xs lg:text-sm text-gray-600">Earn passive rewards on your crypto</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Vote className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Governance</p>
                              <p className="text-xs lg:text-sm text-gray-600">Vote on protocol decisions</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Rocket className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Launchpad</p>
                              <p className="text-xs lg:text-sm text-gray-600">Early access to new projects</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {carouselPage === 3 && (
                      <div className="w-full max-w-md lg:max-w-4xl mx-auto">
                        {/* Header - Direct op achtergrond */}
                        <div className="text-center mb-6 lg:mb-8">
                          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl mb-3 lg:mb-4 shadow-lg">
                            <Gift className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                          </div>
                          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Exclusive Perks</h2>
                          <p className="text-gray-600 text-sm lg:text-base">More benefits, more rewards</p>
                        </div>
                        
                        {/* Features - Direct op achtergrond - GRID OP DESKTOP */}
                        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 px-2">
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Cashback</p>
                              <p className="text-xs lg:text-sm text-gray-600">Get crypto back on every transaction</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">Referrals</p>
                              <p className="text-xs lg:text-sm text-gray-600">Earn rewards by inviting friends</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 lg:p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Palette className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm lg:text-base mb-0.5 lg:mb-1">NFT Skins</p>
                              <p className="text-xs lg:text-sm text-gray-600">Customize your wallet with exclusive NFTs</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Page Indicators - ALWAYS VISIBLE */}
              <div className="flex justify-center gap-2 mb-6 lg:mb-8">
                {[0, 1, 2, 3].map((page) => (
                  <button
                    key={page}
                    onClick={() => setCarouselPage(page)}
                    className={`h-2 lg:h-2.5 rounded-full transition-all ${
                      page === carouselPage ? 'w-6 lg:w-8 bg-orange-500' : 'w-2 lg:w-2.5 bg-gray-300'
                    }`}
                    aria-label={`Go to page ${page + 1}`}
                  />
                ))}
              </div>

              {/* Action Buttons - CONSISTENT STYLING */}
              <div className="space-y-3 sm:space-y-4 lg:space-y-5 pb-4">
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
              className="w-full max-w-md sm:max-w-lg lg:max-w-xl mx-auto"
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
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3 lg:mb-4">Create a wallet</h2>
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
              className="w-full max-w-md lg:max-w-xl mx-auto"
            >
              {/* Back button - UNIFORM POSITION */}
              <div className="mb-8 lg:mb-10">
                <button
                  onClick={() => setStep('carousel')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors lg:hover:-translate-x-1"
                >
                  <ArrowRight className="w-5 h-5 lg:w-6 lg:h-6 rotate-180" />
                  <span className="lg:text-lg">Back</span>
                </button>
              </div>

              {/* Header - centered, geen card */}
              <div className="text-center mb-8 lg:mb-10">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 lg:mb-5 shadow-lg">
                  <Download className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2 lg:mb-3">Add a wallet</h2>
                <p className="text-gray-600 text-sm lg:text-base">Login or import an existing wallet</p>
              </div>

              {/* Buttons - direct, geen card */}
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
              className="w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto"
            >
              {/* Back Button - CONSISTENT SPACING */}
              <div className="mb-8 sm:mb-10 lg:mb-12">
                <button
                  onClick={() => setStep(emailAuthMode === 'signup' ? 'create-options' : 'add-wallet')}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" />
                  <span className="text-sm sm:text-base lg:text-lg">Back</span>
                </button>
              </div>

              {/* Header - CONSISTENT SPACING */}
              <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5 lg:mb-6 shadow-lg">
                  <Mail className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3 lg:mb-4">
                  {emailAuthMode === 'signup' ? 'Create with email' : 'Login with email'}
                </h2>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
                  {emailAuthMode === 'signup' ? 'Set up your wallet with email authentication' : 'Access your existing wallet'}
                </p>
              </div>

              {/* Social Buttons - FIXED LAYOUT - Badge doesn't overlap text */}
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <button
                  disabled
                  className="w-full py-3 sm:py-4 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-500 font-semibold flex items-center gap-3 opacity-60 cursor-not-allowed"
                >
                  {/* Google Icon SVG */}
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
                  {/* Apple Icon SVG */}
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span className="flex-1 text-center text-sm sm:text-base pr-20 sm:pr-24">Continue with Apple</span>
                  <span className="px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded-md text-[10px] sm:text-xs text-orange-600 font-semibold whitespace-nowrap flex-shrink-0">
                    Coming soon
                </span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-sm text-gray-500">Or continue with email</span>
                <div className="flex-1 h-px bg-gray-300"></div>
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
                  <div className="relative">
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(''); // Clear error on change
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
                        emailValid === false ? 'pr-10' : ''
                      } bg-white border-2 ${
                        emailValid === false 
                          ? 'border-red-300 focus:border-red-500' 
                          : emailValid === true
                          ? 'border-green-300 focus:border-green-500'
                          : 'border-gray-200 focus:border-orange-500'
                      } rounded-xl focus:outline-none transition-colors text-gray-900 placeholder-gray-400 disabled:opacity-50`}
                    />
                    
                    {/* ✅ Real-time validation icon - PERFECTLY CENTERED */}
                    {emailValid === true && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                    {emailValid === false && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        <XCircle className="w-5 h-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  
                  {/* ✅ Inline email validation message */}
                  {emailValid === false && email.length > 0 && (
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

                {/* ✅ Submit Button (now inside form!) */}
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

                {/* Toggle login/signup */}
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setEmailValid(null);
                    setPasswordStrength(null);
                    setPasswordsMatch(null);
                    setEmailAuthMode(emailAuthMode === 'signup' ? 'login' : 'signup');
                  }}
                  disabled={isLoading}
                  className="w-full py-3 text-gray-600 hover:text-gray-900 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {emailAuthMode === 'signup' 
                    ? 'Already have an account? Login' 
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
              className="w-full max-w-md lg:max-w-xl mx-auto"
            >
              {/* Back button - UNIFORM POSITION */}
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

              {/* Header - centered, geen card */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Download className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Import wallet</h2>
                <p className="text-gray-600 text-sm">Enter your 12-word recovery phrase</p>
              </div>

              {/* Textarea - direct, geen card */}
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
              className="max-w-2xl mx-auto"
            >
              {/* 🔒 CRITICAL SECURITY WARNING - BLIJFT ZOALS HET IS */}
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

              {/* Header - geen card, direct */}
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Save your recovery phrase</h2>
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
              className="max-w-md lg:max-w-xl mx-auto w-full"
            >
              {/* Header - geen card, direct */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Verify recovery phrase</h2>
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
              className="w-full max-w-md lg:max-w-xl mx-auto"
            >
              <div className="w-full">
                {/* Icon & Header */}
            <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Mail className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
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
                        deviceVerificationCode
                      );
                      
                      if (!result.success) {
                        setError(result.error || 'Verification failed');
                        setIsLoading(false);
                        return;
                      }
                      
                      // Initialize wallet locally with the decrypted mnemonic
                      if (result.mnemonic) {
                        const { importWallet } = await import('@/lib/wallet');
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
                      Verify Device
                    </>
                  )}
              </button>

                {/* Resend link */}
                <div className="mt-4 text-center">
                  <button
                    onClick={async () => {
                      // TODO: Implement resend verification code
                      setError('Resend feature coming soon. Please check your email for the code.');
                    }}
                    className="text-sm text-orange-500 hover:text-orange-600 font-semibold transition-colors"
                  >
                    Didn't receive the code? Resend
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
              className="w-full max-w-md lg:max-w-xl mx-auto"
            >
              <div className="w-full">
                {/* Icon & Header - NO CARD */}
            <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Fingerprint className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
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
                        
                        const webauthnService = WebAuthnService.getInstance();
                        const biometricStore = BiometricStore.getInstance();
                        
                        // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
                        const { useWalletStore } = await import('@/lib/wallet-store');
                        const walletIdentifier = useWalletStore.getState().getWalletIdentifier();
                        if (!walletIdentifier) {
                          throw new Error('Cannot determine wallet identifier for biometric setup');
                        }
                        
                        // ✅ WALLET-SPECIFIC: Detect wallet type
                        const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
                        const walletType: 'email' | 'seed' = createdWithEmail ? 'email' : 'seed';
                        
                        // Create display name
                        const displayName = walletType === 'email' 
                          ? (localStorage.getItem('wallet_email') || 'BLAZE User')
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
                    Skip
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
    </div>
  );
}