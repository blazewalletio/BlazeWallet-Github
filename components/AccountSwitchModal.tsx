'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Key, Clock, ChevronRight, Plus, FileText, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { getAllAccounts, switchToAccount, saveAccountToRecent, type WalletAccount } from '@/lib/account-manager';
import { useWalletStore } from '@/lib/wallet-store';

interface AccountSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: () => void;
  currentAccountId: string | null;
}

type ViewMode = 'list' | 'email-login' | 'seed-import';

export default function AccountSwitchModal({
  isOpen,
  onClose,
  onSwitch,
  currentAccountId,
}: AccountSwitchModalProps) {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Email login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Seed import state
  const [seedPhrase, setSeedPhrase] = useState('');

  useEffect(() => {
    if (isOpen) {
      const allAccounts = getAllAccounts();
      setAccounts(allAccounts);
      setViewMode('list');
      // Reset forms
      setEmail('');
      setPassword('');
      setSeedPhrase('');
      setError('');
    }
  }, [isOpen]);

  const handleSwitchAccount = (account: WalletAccount) => {
    if (account.id === currentAccountId) {
      onClose();
      return;
    }

    switchToAccount(account);
    onSwitch();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { signInWithEmail } = await import('@/lib/supabase-auth');
      const result = await signInWithEmail(email, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Invalid email or password');
      }

      // Import wallet
      if (result.mnemonic) {
        const { importWallet } = useWalletStore.getState();
        await importWallet(result.mnemonic);
      }

      // Save to recent accounts
      const account: WalletAccount = {
        id: localStorage.getItem('supabase_user_id') || email,
        type: 'email',
        displayName: email,
        lastUsed: Date.now(),
      };
      saveAccountToRecent(account);

      // Success!
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      onSwitch();
      onClose();
      
    } catch (err: any) {
      console.error('Email login error:', err);
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { importWallet } = useWalletStore.getState();
      await importWallet(seedPhrase.trim());

      // Generate account info
      const walletHash = Math.random().toString(36).substring(2, 10);
      const account: WalletAccount = {
        id: walletHash,
        type: 'seed',
        displayName: `Wallet ${walletHash}`,
        lastUsed: Date.now(),
        encryptedData: localStorage.getItem('encrypted_wallet') || undefined,
      };
      saveAccountToRecent(account);

      // Success!
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      onSwitch();
      onClose();
      
    } catch (err: any) {
      console.error('Seed import error:', err);
      setError('Invalid recovery phrase. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastUsed = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
      />
      
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden"
      >
        <div className="glass-card rounded-t-3xl p-6 overflow-y-auto max-h-[85vh]">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              {viewMode !== 'list' && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setViewMode('list')}
                  className="glass p-2 rounded-lg hover:bg-theme-bg-secondary"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              )}
              <h2 className="text-2xl font-bold text-gray-900">
                {viewMode === 'list' && 'Switch account'}
                {viewMode === 'email-login' && 'Login with email'}
                {viewMode === 'seed-import' && 'Import wallet'}
              </h2>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="glass p-2 rounded-lg hover:bg-theme-bg-secondary"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <>
              {/* Add New Account Buttons */}
              <div className="space-y-3 mb-6">
                <p className="text-sm font-semibold text-gray-600 mb-3">Add new account</p>
                
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setViewMode('email-login')}
                  className="w-full glass p-4 rounded-xl flex items-center gap-4 hover:bg-theme-bg-secondary transition-colors border-2 border-blue-200 bg-blue-50"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-900">Login with email</div>
                    <div className="text-sm text-gray-600">Use your email and password</div>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setViewMode('seed-import')}
                  className="w-full glass p-4 rounded-xl flex items-center gap-4 hover:bg-theme-bg-secondary transition-colors border-2 border-orange-200 bg-orange-50"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-900">Import with recovery phrase</div>
                    <div className="text-sm text-gray-600">Use your 12-word phrase</div>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </motion.button>
              </div>

              {/* Existing Accounts */}
              {accounts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-600 mb-3">Recent accounts</p>
                  
                  {accounts.map((account) => {
                    const isActive = account.id === currentAccountId;
                    
                    return (
                      <motion.button
                        key={account.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSwitchAccount(account)}
                        className={`w-full glass p-4 rounded-xl flex items-center justify-between hover:bg-theme-bg-secondary transition-colors ${
                          isActive ? 'ring-2 ring-orange-500 bg-orange-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            account.type === 'email'
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              : 'bg-gradient-to-br from-orange-500 to-yellow-500'
                          }`}>
                            {account.type === 'email' ? (
                              <Mail className="w-6 h-6 text-white" />
                            ) : (
                              <Key className="w-6 h-6 text-white" />
                            )}
                          </div>
                          
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              {account.displayName}
                              {isActive && (
                                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatLastUsed(account.lastUsed)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Info Card */}
              <div className="mt-6 glass-card bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-1">Secure account switching</p>
                    <p className="text-xs text-gray-600">
                      Your wallet data remains encrypted. Enter your password after switching to unlock.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* EMAIL LOGIN VIEW */}
          {viewMode === 'email-login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-field"
                  required
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field pr-12"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card bg-red-500/10 border border-red-500/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || !email || !password}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Logging in...</span>
                  </div>
                ) : (
                  'Login'
                )}
              </motion.button>
            </form>
          )}

          {/* SEED IMPORT VIEW */}
          {viewMode === 'seed-import' && (
            <form onSubmit={handleSeedImport} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Recovery phrase
                </label>
                <textarea
                  value={seedPhrase}
                  onChange={(e) => setSeedPhrase(e.target.value)}
                  placeholder="Enter your 12-word recovery phrase..."
                  className="input-field min-h-[120px] font-mono text-sm"
                  required
                  autoFocus
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Separate each word with a space
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card bg-red-500/10 border border-red-500/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || !seedPhrase.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Importing...</span>
                  </div>
                ) : (
                  'Import wallet'
                )}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

