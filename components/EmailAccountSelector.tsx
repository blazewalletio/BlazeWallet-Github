'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Key, ChevronDown, Check, PlusCircle, KeyRound, Clock } from 'lucide-react';
import { WalletAccount, getCurrentAccountAsync, getAccountsByTypeAsync } from '@/lib/account-manager-async';

interface EmailAccountSelectorProps {
  onSelectAccount: (account: WalletAccount) => void;
  onAddNewEmail: () => void;
  onImportSeed: () => void;
  disabled?: boolean;
}

export default function EmailAccountSelector({
  onSelectAccount,
  onAddNewEmail,
  onImportSeed,
  disabled = false,
}: EmailAccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<WalletAccount[]>([]);
  const [seedAccounts, setSeedAccounts] = useState<WalletAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load accounts from IndexedDB on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      
      // ✅ OPTIMIZATION: Load current account first (most important)
      // This allows us to show the email immediately while other accounts load in background
      const account = await getCurrentAccountAsync();
      if (account) {
        setCurrentAccount(account);
        setIsLoading(false); // ✅ Show content immediately after current account loads
      } else {
        // No account found - stop loading
        setIsLoading(false);
        return;
      }

      // Load all accounts in background (for dropdown) - don't block UI
      // This happens after we've already shown the current account
      const { emailAccounts: emails, seedAccounts: seeds } = await getAccountsByTypeAsync();
      setEmailAccounts(emails);
      setSeedAccounts(seeds);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setIsLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectAccount = (account: WalletAccount) => {
    setIsOpen(false);
    onSelectAccount(account);
  };

  // Format last used date
  const formatLastUsed = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  // ✅ FIX: Don't show loading skeleton if we have currentAccount
  // This prevents the gray flash when modal opens
  if (isLoading && !currentAccount) {
    return (
      <div className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl animate-pulse">
        <div className="h-12 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!currentAccount) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Account Selector Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full 
          flex items-center justify-between 
          px-4 py-3 
          bg-gradient-to-r from-orange-50 to-yellow-50 
          border-2 border-orange-200 
          rounded-xl 
          transition-all 
          group
          ${!disabled ? 'hover:border-orange-300 hover:shadow-md cursor-pointer' : 'cursor-default'}
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            {currentAccount.type === 'email' ? (
              <Mail className="w-5 h-5 text-white" />
            ) : (
              <Key className="w-5 h-5 text-white" />
            )}
          </div>

          {/* Account Info */}
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">Signing in as</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {currentAccount.displayName}
            </p>
          </div>
        </div>

        {/* Chevron */}
        {!disabled && (
          <ChevronDown
            className={`w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-all flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="
              absolute top-full mt-2 
              w-full max-h-[400px] overflow-y-auto
              bg-white 
              border-2 border-gray-200 
              rounded-xl 
              shadow-2xl
              z-50
            "
          >
            {/* Email Accounts */}
            {emailAccounts.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                  Email Accounts
                </p>
                <div className="space-y-1">
                  {emailAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleSelectAccount(account)}
                      className="
                        w-full flex items-center gap-3 p-3 
                        hover:bg-orange-50 rounded-lg 
                        transition-all duration-150
                        group
                      "
                    >
                      <Mail className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {account.email}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatLastUsed(account.lastUsed)}
                        </p>
                      </div>
                      {account.isActive && (
                        <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seed Wallets */}
            {seedAccounts.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                  Seed Phrase Wallets
                </p>
                <div className="space-y-1">
                  {seedAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleSelectAccount(account)}
                      className="
                        w-full flex items-center gap-3 p-3 
                        hover:bg-gray-50 rounded-lg 
                        transition-all duration-150
                        group
                      "
                    >
                      <Key className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {account.displayName}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatLastUsed(account.lastUsed)}
                        </p>
                      </div>
                      {account.isActive && (
                        <Check className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-3 space-y-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddNewEmail();
                }}
                className="
                  w-full flex items-center gap-3 p-3 
                  hover:bg-blue-50 rounded-lg 
                  text-blue-600 font-medium text-sm
                  transition-all duration-150
                "
              >
                <PlusCircle className="w-5 h-5 flex-shrink-0" />
                <span>Sign in with different email</span>
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onImportSeed();
                }}
                className="
                  w-full flex items-center gap-3 p-3 
                  hover:bg-blue-50 rounded-lg 
                  text-blue-600 font-medium text-sm
                  transition-all duration-150
                "
              >
                <KeyRound className="w-5 h-5 flex-shrink-0" />
                <span>Import with recovery phrase</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

