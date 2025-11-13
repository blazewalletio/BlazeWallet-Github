'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Key, ChevronDown, Check, PlusCircle, KeyRound } from 'lucide-react';
import { WalletAccount, getAccountsByType } from '@/lib/account-manager';
import { logger } from '@/lib/logger';

interface AccountSelectorDropdownProps {
  currentAccount: WalletAccount | null;
  onSelectAccount: (account: WalletAccount) => void;
  onAddNewEmail: () => void;
  onImportSeed: () => void;
  disabled?: boolean;
}

export default function AccountSelectorDropdown({
  currentAccount,
  onSelectAccount,
  onAddNewEmail,
  onImportSeed,
  disabled = false,
}: AccountSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { emailAccounts, seedAccounts } = getAccountsByType();

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

  if (!currentAccount) {
    return null;
  }

  const totalAccounts = emailAccounts.length + seedAccounts.length;
  // ✅ ALWAYS show dropdown - users should always be able to add new accounts
  const showDropdown = true;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Account Selector Button */}
      <button
        type="button"
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        disabled={disabled || !showDropdown}
        className={`
          w-full 
          flex items-center justify-between 
          px-4 py-3 
          bg-gradient-to-r from-orange-50 to-yellow-50 
          border-2 border-orange-200 
          rounded-xl 
          transition-all 
          group
          ${showDropdown && !disabled ? 'hover:border-orange-300 cursor-pointer' : 'cursor-default'}
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
            {currentAccount.type === 'email' ? (
              <Mail className="w-5 h-5 text-white" />
            ) : (
              <Key className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-500 font-medium">Signing in as</p>
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-[300px]">
              {currentAccount.displayName}
            </p>
          </div>
        </div>
        {showDropdown && !disabled && (
          <ChevronDown 
            className={`w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-all flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && showDropdown && (
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
            {/* Recent Email Accounts */}
            {emailAccounts.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
                  Email accounts
                </p>
                <div className="space-y-1">
                  {emailAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleSelectAccount(account)}
                      className="
                        w-full flex items-center gap-3 p-3 
                        hover:bg-orange-50 rounded-lg 
                        transition-colors
                        group
                      "
                    >
                      <Mail className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                      <span className="flex-1 text-left text-sm text-gray-900 truncate">
                        {account.email}
                      </span>
                      {account.isActive && (
                        <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seed Phrase Wallets */}
            {seedAccounts.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
                  Seed phrase wallets
                </p>
                <div className="space-y-1">
                  {seedAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleSelectAccount(account)}
                      className="
                        w-full flex items-center gap-3 p-3 
                        hover:bg-gray-50 rounded-lg 
                        transition-colors
                        group
                      "
                    >
                      <Key className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                      <span className="flex-1 text-left text-sm text-gray-900 truncate">
                        {account.displayName}
                      </span>
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
                  transition-colors
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
                  transition-colors
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

