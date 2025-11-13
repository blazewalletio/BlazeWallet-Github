'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, AlertCircle, Check } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { logger } from '@/lib/logger';

interface PasswordSetupModalProps {
  isOpen: boolean;
  onComplete: (password: string) => void; // Pass password back for biometric setup
}

export default function PasswordSetupModal({ isOpen, onComplete }: PasswordSetupModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setPassword: setWalletPassword } = useWalletStore();

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password moet minimaal 8 karakters zijn';
    if (!/(?=.*[a-z])/.test(pwd)) return 'Password moet minimaal 1 kleine letter bevatten';
    if (!/(?=.*[A-Z])/.test(pwd)) return 'Password moet minimaal 1 hoofdletter bevatten';
    if (!/(?=.*\d)/.test(pwd)) return 'Password moet minimaal 1 cijfer bevatten';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passworden komen niet overeen');
      return;
    }

    setIsLoading(true);
    try {
      logger.log('🔐 Setting up password...');
      await setWalletPassword(password);
      
      // ✅ SECURITY: Do NOT store password for biometric access here
      // This will be done in BiometricAuthModal AFTER WebAuthn credential registration
      // Otherwise password is stored WITHOUT biometric protection
      
      // Clear flags
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wallet_just_imported');
        localStorage.removeItem('wallet_just_created');
        localStorage.removeItem('force_password_setup');
      }
      
      logger.log('✅ Password setup complete!');
      onComplete(password); // Pass password for biometric setup
    } catch (error: any) {
      logger.error('Password setup error:', error);
      const errorMessage = error?.message || 'Er is een fout opgetreden. Probeer opnieuw.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    if (password.length === 0) return { strength: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/(?=.*[a-z])/.test(password)) score++;
    if (/(?=.*[A-Z])/.test(password)) score++;
    if (/(?=.*\d)/.test(password)) score++;
    if (/(?=.*[!@#$%^&*])/.test(password)) score++;

    // ECHTE KLEUREN: Rood/Oranje/Groen
    if (score <= 2) return { strength: score * 20, label: 'Zwak', color: 'bg-red-500', textColor: 'text-red-600' };
    if (score <= 3) return { strength: score * 20, label: 'Matig', color: 'bg-orange-500', textColor: 'text-orange-600' };
    return { strength: score * 20, label: 'Sterk', color: 'bg-green-500', textColor: 'text-green-600' };
  };

  const strength = passwordStrength();

  // Password requirements check
  const requirements = [
    { met: password.length >= 8, label: 'Minimaal 8 karakters' },
    { met: /(?=.*[a-z])/.test(password), label: '1 kleine letter' },
    { met: /(?=.*[A-Z])/.test(password), label: '1 hoofdletter' },
    { met: /(?=.*\d)/.test(password), label: '1 cijfer' },
  ];

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
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Secure your wallet
              </h2>
              <p className="text-gray-600">
                Stel een wachtwoord in om je wallet te beschermen tegen ongeautoriseerde toegang
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="Minimaal 8 karakters"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {password && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Sterkte:</span>
                      <span className={strength.textColor || 'text-gray-600'}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.strength}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Password requirements */}
              {password && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <div className="space-y-1.5">
                    {requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${req.met ? 'bg-green-500' : 'bg-gray-200'}`}>
                          {req.met && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={req.met ? 'text-green-600 font-medium' : 'text-gray-500'}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="Herhaal je wachtwoord"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Password instellen'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Your password is encrypted and stored locally. 
                <br />
                Wij hebben geen toegang tot je wachtwoord.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
