import { create } from 'zustand';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { Token, Chain } from './types';
import { CHAINS, DEFAULT_CHAIN } from './chains';
import { encryptWallet, decryptWallet, hashPassword, verifyPassword, EncryptedWallet } from './crypto-utils';
import { WebAuthnService } from './webauthn-service';
import { BiometricStore } from './biometric-store';
import { secureLog } from './secure-log';
import { SolanaService } from './solana-service';
import { logger } from '@/lib/logger';
import { secureStorage } from './secure-storage';
import { rateLimitService } from './rate-limit-service';

const DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES = 5;
const AUTO_LOCK_TIMEOUT_KEY_PRIMARY = 'blaze_auto_lock_timeout_min';
const AUTO_LOCK_TIMEOUT_KEY_LEGACY = 'autoLockTimeout';
const SESSION_UNLOCK_FLAG_KEY = 'wallet_unlocked_this_session';
const SESSION_LAST_ACTIVITY_KEY = 'last_activity';
const SESSION_UNLOCK_EXPIRY_KEY = 'blaze_soft_unlock_expires_at';
const SESSION_ADDRESS_SNAPSHOT_KEY = 'blaze_session_addresses';
const SESSION_MNEMONIC_KEY = 'blaze_session_mnemonic';
const AUTO_LOCK_WARNING_SHOWN_KEY = 'auto_lock_warning_shown';

type SessionAddressSnapshot = {
  address: string | null;
  solanaAddress: string | null;
  bitcoinAddress: string | null;
  litecoinAddress: string | null;
  dogecoinAddress: string | null;
  bitcoincashAddress: string | null;
};

const normalizeTimeoutMinutes = (raw: string | null): number | null => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  // Accept 0 (never) and positive values. Negative values are invalid.
  if (parsed < 0) return null;
  return parsed;
};

const getConfiguredAutoLockTimeoutMinutes = (): number => {
  if (typeof window === 'undefined') return DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES;
  const primary = normalizeTimeoutMinutes(localStorage.getItem(AUTO_LOCK_TIMEOUT_KEY_PRIMARY));
  if (primary !== null) return primary;
  const legacy = normalizeTimeoutMinutes(localStorage.getItem(AUTO_LOCK_TIMEOUT_KEY_LEGACY));
  if (legacy !== null) return legacy;
  return DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES;
};

const getConfiguredAutoLockTimeoutMs = (): number | null => {
  const minutes = getConfiguredAutoLockTimeoutMinutes();
  if (minutes === 0) return null; // Never auto-lock
  return Math.max(1, minutes * 60 * 1000);
};

const persistTimeoutToLocalStorage = (minutes: number) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_LOCK_TIMEOUT_KEY_PRIMARY, String(minutes));
  // Keep legacy key in sync for backward compatibility.
  localStorage.setItem(AUTO_LOCK_TIMEOUT_KEY_LEGACY, String(minutes));
};

const persistSessionAddressSnapshot = (snapshot: SessionAddressSnapshot) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_ADDRESS_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

const readSessionAddressSnapshot = (): SessionAddressSnapshot | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_ADDRESS_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionAddressSnapshot;
    return {
      address: parsed.address || null,
      solanaAddress: parsed.solanaAddress || null,
      bitcoinAddress: parsed.bitcoinAddress || null,
      litecoinAddress: parsed.litecoinAddress || null,
      dogecoinAddress: parsed.dogecoinAddress || null,
      bitcoincashAddress: parsed.bitcoincashAddress || null,
    };
  } catch {
    return null;
  }
};

const clearSessionLease = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_UNLOCK_FLAG_KEY);
  sessionStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
  sessionStorage.removeItem(SESSION_UNLOCK_EXPIRY_KEY);
  sessionStorage.removeItem(SESSION_ADDRESS_SNAPSHOT_KEY);
  sessionStorage.removeItem(SESSION_MNEMONIC_KEY);
  sessionStorage.removeItem(AUTO_LOCK_WARNING_SHOWN_KEY);
};

const persistSessionMnemonic = (mnemonic: string) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_MNEMONIC_KEY, mnemonic);
};

const readSessionMnemonic = (): string | null => {
  if (typeof window === 'undefined') return null;
  const mnemonic = sessionStorage.getItem(SESSION_MNEMONIC_KEY);
  return mnemonic && mnemonic.trim().length > 0 ? mnemonic : null;
};

const isSessionLeaseValid = (): boolean => {
  if (typeof window === 'undefined') return false;
  const unlockedThisSession = sessionStorage.getItem(SESSION_UNLOCK_FLAG_KEY) === 'true';
  if (!unlockedThisSession) return false;

  const timeoutMs = getConfiguredAutoLockTimeoutMs();
  if (timeoutMs === null) return true; // Never auto-lock

  const now = Date.now();
  const expiry = Number(sessionStorage.getItem(SESSION_UNLOCK_EXPIRY_KEY) || '0');
  if (Number.isFinite(expiry) && expiry > 0) {
    return now < expiry;
  }

  // Backward-compatible fallback when old sessions don't have expiry key yet.
  const lastActivity = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || '0');
  if (!Number.isFinite(lastActivity) || lastActivity <= 0) return false;
  return now - lastActivity < timeoutMs;
};

const refreshSessionLease = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  sessionStorage.setItem(SESSION_UNLOCK_FLAG_KEY, 'true');
  sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now));
  sessionStorage.removeItem(AUTO_LOCK_WARNING_SHOWN_KEY);

  const timeoutMs = getConfiguredAutoLockTimeoutMs();
  if (timeoutMs === null) {
    sessionStorage.removeItem(SESSION_UNLOCK_EXPIRY_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_UNLOCK_EXPIRY_KEY, String(now + timeoutMs));
};

export interface WalletState {
  wallet: ethers.HDNodeWallet | null;
  address: string | null; // EVM address (for backward compatibility)
  solanaAddress: string | null; // Solana-specific address
  bitcoinAddress: string | null; // ✅ Bitcoin Native SegWit address (bc1...)
  litecoinAddress: string | null; // ✅ Litecoin address (L/M... or ltc1...)
  dogecoinAddress: string | null; // ✅ Dogecoin address (D...)
  bitcoincashAddress: string | null; // ✅ Bitcoin Cash address (q/p... or 1/3...)
  balance: string;
  isLocked: boolean;
  mnemonic: string | null;
  currentChain: string;
  
  // ✅ PHASE 3: Chain-specific token storage
  chainTokens: Map<string, Token[]>; // Per-chain token storage
  tokens: Token[]; // Deprecated, kept for backward compatibility
  
  // ✅ NEW: Hidden tokens (soft hide - can be shown again)
  hiddenTokens: Map<string, Set<string>>; // chain -> Set<tokenAddress>
  // ✅ NEW: Deleted tokens (hard remove - stays removed until re-added)
  deletedTokens: Map<string, Set<string>>; // chain -> Set<tokenAddress>
  
  hasPassword: boolean;
  lastActivity: number;
  hasBiometric: boolean;
  isBiometricEnabled: boolean;
  
  // ✅ NEW: Unlock modal state (single source of truth)
  showUnlockModal: boolean;
  setShowUnlockModal: (show: boolean) => void;
  
  // Actions
  createWallet: () => Promise<string>;
  importWallet: (mnemonic: string) => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithBiometric: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  lockWallet: () => void;
  unlockWallet: (mnemonic: string) => Promise<void>;
  updateBalance: (balance: string) => void;
  resetWallet: () => void;
  switchChain: (chainKey: string) => void;
  addToken: (token: Token) => void;
  
  // ✅ PHASE 3: New chain-specific methods
  updateTokens: (chain: string, tokens: Token[]) => void; // Now requires chain parameter
  getChainTokens: (chain: string) => Token[]; // Get tokens for specific chain
  
  removeToken: (tokenAddress: string) => void;
  
  // ✅ NEW: Hide/Show token functions (soft hide)
  hideToken: (chain: string, tokenAddress: string) => void;
  showToken: (chain: string, tokenAddress: string) => void;
  isTokenHidden: (chain: string, tokenAddress: string) => boolean;
  deleteToken: (chain: string, tokenAddress: string) => void;
  restoreDeletedToken: (chain: string, tokenAddress: string) => void;
  isTokenDeleted: (chain: string, tokenAddress: string) => boolean;
  
  updateActivity: () => void;
  checkAutoLock: () => void;
  getCurrentAddress: () => string | null; // Helper to get current chain address
  getWalletIdentifier: () => string | null; // ✅ NEW: Get identifier for biometric binding
  initializeFromStorage: () => Promise<{ hasEncryptedWallet: boolean; hasPassword: boolean }>; // 🔥 NEW: Init from IndexedDB
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  address: null,
  solanaAddress: null, // Initialize Solana address
  bitcoinAddress: null, // ✅ Initialize Bitcoin address
  litecoinAddress: null, // ✅ Initialize Litecoin address
  dogecoinAddress: null, // ✅ Initialize Dogecoin address
  bitcoincashAddress: null, // ✅ Initialize Bitcoin Cash address
  balance: '0',
  isLocked: false,
  mnemonic: null,
  currentChain: DEFAULT_CHAIN,
  
  // ✅ PHASE 3: Initialize chain-specific token storage
  chainTokens: new Map(),
  tokens: [], // Deprecated, kept for backward compatibility
  
  // ✅ NEW: Initialize hidden tokens from localStorage
  hiddenTokens: (() => {
    const hidden = new Map<string, Set<string>>();
    if (typeof window !== 'undefined') {
      try {
        // Load hidden tokens for all chains from localStorage
        const chains = Object.keys(CHAINS);
        chains.forEach(chain => {
          const stored = localStorage.getItem(`hidden_tokens_${chain}`);
          if (stored) {
            const addresses = JSON.parse(stored) as string[];
            hidden.set(chain, new Set(addresses.map(addr => addr.toLowerCase())));
            logger.log(`📦 Loaded ${addresses.length} hidden tokens for chain ${chain}`);
          }
        });
      } catch (err) {
        logger.error('Failed to load hidden tokens:', err);
      }
    }
    return hidden;
  })(),
  deletedTokens: (() => {
    const deleted = new Map<string, Set<string>>();
    if (typeof window !== 'undefined') {
      try {
        const chains = Object.keys(CHAINS);
        chains.forEach(chain => {
          const stored = localStorage.getItem(`deleted_tokens_${chain}`);
          if (stored) {
            const addresses = JSON.parse(stored) as string[];
            deleted.set(chain, new Set(addresses.map(addr => addr.toLowerCase())));
            logger.log(`📦 Loaded ${addresses.length} deleted tokens for chain ${chain}`);
          }
        });
      } catch (err) {
        logger.error('Failed to load deleted tokens:', err);
      }
    }
    return deleted;
  })(),
  
  hasPassword: false,
  lastActivity: Date.now(),
  hasBiometric: false,
  isBiometricEnabled: false,
  
  // ✅ NEW: Unlock modal state
  showUnlockModal: false,
  setShowUnlockModal: (show: boolean) => set({ showUnlockModal: show }),
  
  // 🔥 CRITICAL: Initialize from IndexedDB on mount
  initializeFromStorage: async () => {
    try {
      // Check IndexedDB for encrypted wallet and password flag
      const encryptedWallet = await secureStorage.getItem('encrypted_wallet');
      const hasPasswordStored = await secureStorage.getItem('has_password') === 'true';
      persistTimeoutToLocalStorage(getConfiguredAutoLockTimeoutMinutes());
      
      if (hasPasswordStored) {
        const sessionValid = isSessionLeaseValid();
        const savedChain = localStorage.getItem('current_chain') || DEFAULT_CHAIN;
        const sessionMnemonic = readSessionMnemonic();

        // Restore unlocked state on refresh when session lease is still valid.
        if (sessionValid && sessionMnemonic && bip39.validateMnemonic(sessionMnemonic.trim().toLowerCase())) {
          const cleanMnemonic = sessionMnemonic.trim().toLowerCase();
          const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);

          const solanaService = new SolanaService();
          const solanaAddress = solanaService.getAddressFromMnemonic(cleanMnemonic);

          const { BitcoinService } = await import('./bitcoin-service');
          const bitcoinService = new BitcoinService('mainnet');
          const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(cleanMnemonic, 'native-segwit');

          const { BitcoinForkService } = await import('./bitcoin-fork-service');
          const litecoinService = new BitcoinForkService('litecoin');
          const dogecoinService = new BitcoinForkService('dogecoin');
          const bitcoincashService = new BitcoinForkService('bitcoincash');
          const { address: litecoinAddress } = litecoinService.deriveAddress(cleanMnemonic, 'legacy');
          const { address: dogecoinAddress } = dogecoinService.deriveAddress(cleanMnemonic, 'legacy');
          const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(cleanMnemonic, 'legacy');

          const lastActivity = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || `${Date.now()}`);
          set({
            hasPassword: true,
            isLocked: false,
            showUnlockModal: false,
            wallet,
            mnemonic: cleanMnemonic,
            currentChain: savedChain,
            address: wallet.address,
            solanaAddress,
            bitcoinAddress,
            litecoinAddress,
            dogecoinAddress,
            bitcoincashAddress,
            lastActivity: Number.isFinite(lastActivity) ? lastActivity : Date.now(),
          });

          persistSessionAddressSnapshot({
            address: wallet.address,
            solanaAddress,
            bitcoinAddress,
            litecoinAddress,
            dogecoinAddress,
            bitcoincashAddress,
          });
        } else {
          // Update state to reflect that password exists and unlock is required.
          set({ hasPassword: true, isLocked: true });
        }
      }
      
      return { hasEncryptedWallet: !!encryptedWallet, hasPassword: hasPasswordStored };
    } catch (error) {
      console.error('❌ [wallet-store] Failed to initialize from IndexedDB:', error);
      return { hasEncryptedWallet: false, hasPassword: false };
    }
  },

  createWallet: async () => {
    // Generate a new random wallet with 12-word mnemonic
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || '';
    
    // Generate Solana address from the same mnemonic
    const solanaService = new SolanaService();
    const solanaAddress = solanaService.getAddressFromMnemonic(mnemonic);
    
    // ✅ Generate Bitcoin address from the same mnemonic
    const { BitcoinService } = await import('./bitcoin-service');
    const bitcoinService = new BitcoinService('mainnet');
    const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(mnemonic, 'native-segwit');
    
    // ✅ Generate Bitcoin-fork addresses from the same mnemonic
    const { BitcoinForkService } = await import('./bitcoin-fork-service');
    const litecoinService = new BitcoinForkService('litecoin');
    const dogecoinService = new BitcoinForkService('dogecoin');
    const bitcoincashService = new BitcoinForkService('bitcoincash');
    
    const { address: litecoinAddress } = litecoinService.deriveAddress(mnemonic, 'legacy');
    const { address: dogecoinAddress } = dogecoinService.deriveAddress(mnemonic, 'legacy');
    const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(mnemonic, 'legacy');
    
    set({
      wallet,
      address: wallet.address, // EVM address (derived from mnemonic)
      solanaAddress, // Solana address (derived from mnemonic)
      bitcoinAddress, // ✅ Bitcoin address (derived from mnemonic)
      litecoinAddress, // ✅ Litecoin address (derived from mnemonic)
      dogecoinAddress, // ✅ Dogecoin address (derived from mnemonic)
      bitcoincashAddress, // ✅ Bitcoin Cash address (derived from mnemonic)
      mnemonic, // Only in memory, never persisted
      isLocked: false,
      showUnlockModal: false, // ✅ Close modal after wallet creation
      lastActivity: Date.now(),
    });

    if (typeof window !== 'undefined') {
      persistSessionAddressSnapshot({
        address: wallet.address,
        solanaAddress,
        bitcoinAddress,
        litecoinAddress,
        dogecoinAddress,
        bitcoincashAddress,
      });
      refreshSessionLease();
      persistSessionMnemonic(mnemonic);
    }

    // ✅ SECURITY: DO NOT store addresses in localStorage
    // ✅ Addresses are ALWAYS derived from mnemonic on unlock
    // ✅ Only store encrypted mnemonic (happens in setPassword)
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_chain', DEFAULT_CHAIN);
    }

    return mnemonic; // Return once for user to backup
  },

  importWallet: async (mnemonic: string) => {
    try {
      // ⚠️ CRITICAL: Validate BIP39 mnemonic BEFORE creating wallet
      const cleanMnemonic = mnemonic.trim().toLowerCase();
      
      if (!bip39.validateMnemonic(cleanMnemonic)) {
        throw new Error('Invalid recovery phrase. Please check your words and checksum.');
      }
      
      // Create wallet from validated mnemonic
      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      // Generate Solana address from the same mnemonic
      const solanaService = new SolanaService();
      const solanaAddress = solanaService.getAddressFromMnemonic(cleanMnemonic);
      
      // ✅ Generate Bitcoin address from the same mnemonic
      const { BitcoinService } = await import('./bitcoin-service');
      const bitcoinService = new BitcoinService('mainnet');
      const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(cleanMnemonic, 'native-segwit');
      
      // ✅ Generate Bitcoin-fork addresses from the same mnemonic
      const { BitcoinForkService } = await import('./bitcoin-fork-service');
      const litecoinService = new BitcoinForkService('litecoin');
      const dogecoinService = new BitcoinForkService('dogecoin');
      const bitcoincashService = new BitcoinForkService('bitcoincash');
      
      const { address: litecoinAddress } = litecoinService.deriveAddress(cleanMnemonic, 'legacy');
      const { address: dogecoinAddress } = dogecoinService.deriveAddress(cleanMnemonic, 'legacy');
      const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(cleanMnemonic, 'legacy');
      
      // Restore chain preference
      const savedChain = typeof window !== 'undefined' 
        ? localStorage.getItem('current_chain') || DEFAULT_CHAIN
        : DEFAULT_CHAIN;
      
      set({
        wallet,
        address: wallet.address, // EVM address (derived from mnemonic)
        solanaAddress, // Solana address (derived from mnemonic)
        bitcoinAddress, // ✅ Bitcoin address (derived from mnemonic)
        litecoinAddress, // ✅ Litecoin address (derived from mnemonic)
        dogecoinAddress, // ✅ Dogecoin address (derived from mnemonic)
        bitcoincashAddress, // ✅ Bitcoin Cash address (derived from mnemonic)
        mnemonic: cleanMnemonic, // Only in memory, never persisted
        isLocked: false,
        showUnlockModal: false, // ✅ Close modal after import
        currentChain: savedChain,
      });

      if (typeof window !== 'undefined') {
        persistSessionAddressSnapshot({
          address: wallet.address,
          solanaAddress,
          bitcoinAddress,
          litecoinAddress,
          dogecoinAddress,
          bitcoincashAddress,
        });
        refreshSessionLease();
        persistSessionMnemonic(cleanMnemonic);
      }

      // ✅ SECURITY: DO NOT store addresses in localStorage
      // ✅ Addresses are ALWAYS derived from mnemonic on unlock
      // ✅ Only store encrypted mnemonic (happens in setPassword)
      if (typeof window !== 'undefined') {
        // DO NOT store addresses - they will be derived on unlock
      }
    } catch (error) {
      throw new Error('Invalid recovery phrase. Please check your words and checksum.');
    }
  },

  setPassword: async (password: string) => {
    const { mnemonic, address, wallet } = get();
    
    // ✅ SECURITY: Mnemonic should ONLY be in memory at this point
    if (!mnemonic || !address || !wallet) {
      throw new Error('No wallet found. Create a wallet first or import an existing one.');
    }
    
    // Encrypt the mnemonic with the password IMMEDIATELY
    const encryptedWallet = encryptWallet(mnemonic, password);
    const passwordHash = hashPassword(password);

    // ✅ SECURITY: Store ONLY encrypted data in IndexedDB
    if (typeof window !== 'undefined') {
      await secureStorage.setItem('encrypted_wallet', JSON.stringify(encryptedWallet));
      await secureStorage.setItem('password_hash', passwordHash);
      await secureStorage.setItem('has_password', 'true');
      
      // ✅ SECURITY: Clean up any old unencrypted storage (migration safety)
      localStorage.removeItem('wallet_mnemonic');
      logger.log('✅ Wallet encrypted and stored in IndexedDB');
      
      // ✅ HYBRID SYNC: Backup to Supabase for seed phrase wallets
      // Check if this is a seed phrase wallet (not email-created)
      const isEmailWallet = localStorage.getItem('wallet_created_with_email') === 'true';
      const userId = localStorage.getItem('supabase_user_id');
      
      if (!isEmailWallet && userId) {
        // This is a seed phrase wallet with Supabase account - sync it!
        logger.log('☁️ Syncing seed phrase wallet to Supabase...');
        const { syncWalletToSupabase } = await import('./wallet-sync-service');
        const syncResult = await syncWalletToSupabase(
          userId,
          JSON.stringify(encryptedWallet),
          address
        );
        
        if (syncResult.success) {
          logger.log('✅ Seed phrase wallet synced to Supabase');
        } else {
          logger.warn('⚠️ Failed to sync wallet to Supabase (non-critical):', syncResult.error);
        }
      }
    }

    set({
      hasPassword: true,
      lastActivity: Date.now(),
    });

    // ✅ SECURITY: Clear mnemonic from memory after encryption
    set({ mnemonic: null });
  },

  unlockWithPassword: async (password: string) => {
    try {
      if (typeof window === 'undefined') {
        throw new Error('Not available op server');
      }

      // ✅ SECURITY: Check rate limiting first
      const userIdentifier = 'local_wallet'; // For seed phrase wallets
      const lockStatus = rateLimitService.isLocked(userIdentifier);
      
      if (lockStatus.isLocked) {
        const minutes = Math.ceil(lockStatus.unlockInSeconds! / 60);
        throw new Error(`Too many failed attempts. Please try again in ${minutes} minutes.`);
      }

      // ✅ SECURITY FIX: Migrate to IndexedDB if needed (one-time, automatic)
      const needsMigration = await secureStorage.needsMigration();
      if (needsMigration) {
        logger.log('🔄 Migrating sensitive data to IndexedDB...');
        await secureStorage.migrateFromLocalStorage();
      }

      // Check if password is correct (try IndexedDB first, fallback to localStorage)
      const storedHash = await secureStorage.getItem('password_hash') || localStorage.getItem('password_hash');
      if (!storedHash || !verifyPassword(password, storedHash)) {
        // ✅ SECURITY: Record failed attempt
        const result = rateLimitService.recordFailedAttempt(userIdentifier);
        
        if (result.isLocked) {
          throw new Error(`Too many failed attempts. Account locked for 15 minutes.`);
        }
        
        throw new Error(`Invalid password. ${result.remainingAttempts} attempts remaining.`);
      }

      // ✅ SECURITY: Clear failed attempts on successful login
      rateLimitService.clearAttempts(userIdentifier);

      // Decrypt wallet (try IndexedDB first, fallback to localStorage)
      const encryptedWalletData = await secureStorage.getItem('encrypted_wallet') || localStorage.getItem('encrypted_wallet');
      if (!encryptedWalletData) {
        throw new Error('Geen versleutelde wallet gevonden');
      }

      const encryptedWallet: EncryptedWallet = JSON.parse(encryptedWalletData);
      const mnemonic = decryptWallet(encryptedWallet, password);
      
      // Validate and create wallet
      const cleanMnemonic = mnemonic.trim().toLowerCase();
      if (!bip39.validateMnemonic(cleanMnemonic)) {
        throw new Error('Beschadigde wallet data');
      }

      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      // ✅ ALWAYS derive Solana address from mnemonic
      const solanaService = new SolanaService();
      const solanaAddress = solanaService.getAddressFromMnemonic(cleanMnemonic);
      
      // ✅ ALWAYS derive Bitcoin address from mnemonic
      const { BitcoinService } = await import('./bitcoin-service');
      const bitcoinService = new BitcoinService('mainnet');
      const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(cleanMnemonic, 'native-segwit');
      
      // ✅ ALWAYS derive Bitcoin-fork addresses from mnemonic
      const { BitcoinForkService } = await import('./bitcoin-fork-service');
      const litecoinService = new BitcoinForkService('litecoin');
      const dogecoinService = new BitcoinForkService('dogecoin');
      const bitcoincashService = new BitcoinForkService('bitcoincash');
      
      const { address: litecoinAddress } = litecoinService.deriveAddress(cleanMnemonic, 'legacy');
      const { address: dogecoinAddress } = dogecoinService.deriveAddress(cleanMnemonic, 'legacy');
      const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(cleanMnemonic, 'legacy');
      
      const savedChain = localStorage.getItem('current_chain') || DEFAULT_CHAIN;

      set({
        wallet,
        address: wallet.address, // EVM address (derived from mnemonic)
        solanaAddress, // Solana address (derived from mnemonic)
        bitcoinAddress, // ✅ Bitcoin address (derived from mnemonic)
        litecoinAddress, // ✅ Litecoin address (derived from mnemonic)
        dogecoinAddress, // ✅ Dogecoin address (derived from mnemonic)
        bitcoincashAddress, // ✅ Bitcoin Cash address (derived from mnemonic)
        mnemonic: cleanMnemonic,
        isLocked: false,
        showUnlockModal: false, // ✅ Close modal after password unlock
        currentChain: savedChain,
        lastActivity: Date.now(),
      });

      // Set session flag + activity timestamp
      if (typeof window !== 'undefined') {
        persistSessionAddressSnapshot({
          address: wallet.address,
          solanaAddress,
          bitcoinAddress,
          litecoinAddress,
          dogecoinAddress,
          bitcoincashAddress,
        });
        refreshSessionLease();
        persistSessionMnemonic(cleanMnemonic);
      }

    } catch (error) {
      console.error('❌ [wallet-store] unlockWithPassword ERROR:', error);
      throw new Error('Invalid password or corrupted data');
    }
  },

  unlockWithBiometric: async () => {
    try {
      const biometricStore = BiometricStore.getInstance();
      
      // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
      const walletIdentifier = get().getWalletIdentifier();
      logger.log('🔐 [wallet-store] unlockWithBiometric - walletIdentifier:', walletIdentifier);
      
      if (!walletIdentifier) {
        throw new Error('Cannot determine wallet identifier for biometric unlock');
      }
      
      // Check if biometric password is stored for THIS wallet
      const hasPassword = biometricStore.hasStoredPassword(walletIdentifier);
      logger.log('🔍 [wallet-store] hasStoredPassword check:', hasPassword);
      
      if (!hasPassword) {
        throw new Error('Face ID is not set up for this wallet. Go to Settings to enable it.');
      }

      // Retrieve password using biometric authentication (Face ID / Touch ID) FOR THIS WALLET
      logger.log('🔐 [wallet-store] Calling retrievePassword...');
      const password = await biometricStore.retrievePassword(walletIdentifier);
      logger.log('✅ [wallet-store] Password retrieved successfully');
      
      if (!password) {
        throw new Error('Could not retrieve password');
      }

      // Check if wallet was created with email
      const createdWithEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('wallet_created_with_email') === 'true'
        : false;
      const email = typeof window !== 'undefined'
        ? localStorage.getItem('wallet_email')
        : null;

      logger.log('🔍 [wallet-store] Wallet type:', { createdWithEmail, email });

      if (createdWithEmail && email) {
        // Email wallet: use Supabase auth to decrypt
        secureLog.sensitive('Unlocking email wallet with biometric password');
        
        const { signInWithEmail } = await import('./supabase-auth-strict');
        const result = await signInWithEmail(email, password);
        
        if (!result.success || !result.mnemonic) {
          throw new Error('Failed to decrypt wallet from Supabase');
        }

        // Import wallet with decrypted mnemonic
        const wallet = ethers.Wallet.fromPhrase(result.mnemonic);
        
        // ✅ ALWAYS derive Solana address from mnemonic
        const solanaService = new SolanaService();
        const solanaAddress = solanaService.getAddressFromMnemonic(result.mnemonic);
        
        // ✅ ALWAYS derive Bitcoin address from mnemonic
        const { BitcoinService } = await import('./bitcoin-service');
        const bitcoinService = new BitcoinService('mainnet');
        const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(result.mnemonic, 'native-segwit');
        
        // ✅ ALWAYS derive Bitcoin-fork addresses from mnemonic
        const { BitcoinForkService } = await import('./bitcoin-fork-service');
        const litecoinService = new BitcoinForkService('litecoin');
        const dogecoinService = new BitcoinForkService('dogecoin');
        const bitcoincashService = new BitcoinForkService('bitcoincash');
        
        const { address: litecoinAddress } = litecoinService.deriveAddress(result.mnemonic, 'legacy');
        const { address: dogecoinAddress } = dogecoinService.deriveAddress(result.mnemonic, 'legacy');
        const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(result.mnemonic, 'legacy');
        
        const savedChain = typeof window !== 'undefined'
          ? localStorage.getItem('current_chain') || DEFAULT_CHAIN
          : DEFAULT_CHAIN;

        set({
          wallet,
          address: wallet.address, // EVM address (derived from mnemonic)
          solanaAddress, // Solana address (derived from mnemonic)
          bitcoinAddress, // ✅ Bitcoin address (derived from mnemonic)
          litecoinAddress, // ✅ Litecoin address (derived from mnemonic)
          dogecoinAddress, // ✅ Dogecoin address (derived from mnemonic)
          bitcoincashAddress, // ✅ Bitcoin Cash address (derived from mnemonic)
          mnemonic: result.mnemonic,
          isLocked: false,
          showUnlockModal: false, // ✅ Close modal after strict email login
          currentChain: savedChain,
          lastActivity: Date.now(),
        });

        // Set session flag + activity timestamp
        if (typeof window !== 'undefined') {
          persistSessionAddressSnapshot({
            address: wallet.address,
            solanaAddress,
            bitcoinAddress,
            litecoinAddress,
            dogecoinAddress,
            bitcoincashAddress,
          });
          refreshSessionLease();
          persistSessionMnemonic(result.mnemonic);
        }

        secureLog.info('Email wallet unlocked with biometrics');
        
      } else {
        // Seed phrase wallet: use local encryption
        secureLog.sensitive('Unlocking seed phrase wallet with biometric password');
        
        // Try IndexedDB first, fallback to localStorage
        const encryptedWalletData = await secureStorage.getItem('encrypted_wallet') || localStorage.getItem('encrypted_wallet');
        if (!encryptedWalletData) {
          throw new Error('No encrypted wallet found');
        }

        const storedHash = await secureStorage.getItem('password_hash') || localStorage.getItem('password_hash');
        if (!storedHash) {
          throw new Error('No password hash found');
        }

        // Verify password
        if (!verifyPassword(password, storedHash)) {
          throw new Error('Invalid password');
        }

        // Decrypt wallet with crypto-utils
        const encryptedWallet: EncryptedWallet = JSON.parse(encryptedWalletData);
        const mnemonic = decryptWallet(encryptedWallet, password);

        // Import wallet
        const wallet = ethers.Wallet.fromPhrase(mnemonic);
        
        // ✅ ALWAYS derive Solana address from mnemonic
        const solanaService = new SolanaService();
        const solanaAddress = solanaService.getAddressFromMnemonic(mnemonic);
        
        // ✅ ALWAYS derive Bitcoin address from mnemonic
        const { BitcoinService } = await import('./bitcoin-service');
        const bitcoinService = new BitcoinService('mainnet');
        const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(mnemonic, 'native-segwit');
        
        // ✅ ALWAYS derive Bitcoin-fork addresses from mnemonic
        const { BitcoinForkService } = await import('./bitcoin-fork-service');
        const litecoinService = new BitcoinForkService('litecoin');
        const dogecoinService = new BitcoinForkService('dogecoin');
        const bitcoincashService = new BitcoinForkService('bitcoincash');
        
        const { address: litecoinAddress } = litecoinService.deriveAddress(mnemonic, 'legacy');
        const { address: dogecoinAddress } = dogecoinService.deriveAddress(mnemonic, 'legacy');
        const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(mnemonic, 'legacy');
        
        const savedChain = typeof window !== 'undefined'
          ? localStorage.getItem('current_chain') || DEFAULT_CHAIN
          : DEFAULT_CHAIN;

        set({
          wallet,
          address: wallet.address, // EVM address (derived from mnemonic)
          solanaAddress, // Solana address (derived from mnemonic)
          bitcoinAddress, // ✅ Bitcoin address (derived from mnemonic)
          litecoinAddress, // ✅ Litecoin address (derived from mnemonic)
          dogecoinAddress, // ✅ Dogecoin address (derived from mnemonic)
          bitcoincashAddress, // ✅ Bitcoin Cash address (derived from mnemonic)
          mnemonic,
          isLocked: false,
          showUnlockModal: false, // ✅ Close modal after biometric unlock
          currentChain: savedChain,
          lastActivity: Date.now(),
        });

        // Set session flag + activity timestamp
        if (typeof window !== 'undefined') {
          persistSessionAddressSnapshot({
            address: wallet.address,
            solanaAddress,
            bitcoinAddress,
            litecoinAddress,
            dogecoinAddress,
            bitcoincashAddress,
          });
          refreshSessionLease();
          persistSessionMnemonic(mnemonic);
        }

        secureLog.info('Seed phrase wallet unlocked with biometrics');
      }

    } catch (error: any) {
      secureLog.error('Biometric unlock error:', error);
      throw new Error(error.message || 'Biometric authentication failed');
    }
  },

  enableBiometric: async () => {
    try {
      const webauthnService = WebAuthnService.getInstance();
      
      // ✅ WALLET-SPECIFIC: Get identifier for THIS wallet
      const walletIdentifier = get().getWalletIdentifier();
      if (!walletIdentifier) {
        throw new Error('Cannot determine wallet identifier for biometric setup');
      }
      
      // ✅ WALLET-SPECIFIC: Detect wallet type
      const createdWithEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('wallet_created_with_email') === 'true'
        : false;
      const walletType: 'email' | 'seed' = createdWithEmail ? 'email' : 'seed';
      
      // Create display name
      const displayName = walletType === 'email' 
        ? (localStorage.getItem('wallet_email') || 'BLAZE User')
        : `Wallet ${walletIdentifier.substring(0, 8)}...`;

      const result = await webauthnService.register(walletIdentifier, displayName, walletType);
      
      if (result.success && result.credential) {
        // ✅ WALLET-SPECIFIC: Store credential indexed by wallet identifier
        webauthnService.storeCredential(result.credential, walletIdentifier);
        
        set({
          hasBiometric: true,
          isBiometricEnabled: true,
          lastActivity: Date.now(),
        });
      } else {
        throw new Error(result.error || 'Biometric setup failed');
      }

    } catch (error: any) {
      throw new Error(error.message || 'Biometric setup failed');
    }
  },

  lockWallet: () => {
    set({
      wallet: null,
      mnemonic: null,
      isLocked: true,
      showUnlockModal: true, // ✅ Show unlock modal when locking
    });
    
    // ✅ Clean up session state to ensure unlock modal appears
    if (typeof window !== 'undefined') {
      clearSessionLease();
      sessionStorage.removeItem('pending_biometric_password');
      secureLog.info('🔒 Wallet locked - session state cleaned');
    }
  },

  unlockWallet: async (mnemonic: string) => {
    try {
      // ⚠️ CRITICAL: Validate BIP39 mnemonic
      const cleanMnemonic = mnemonic.trim().toLowerCase();
      
      if (!bip39.validateMnemonic(cleanMnemonic)) {
        throw new Error('Invalid recovery phrase. Please check your words and checksum.');
      }
      
      const wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      // Generate Solana address from the same mnemonic
      const solanaService = new SolanaService();
      const solanaAddress = solanaService.getAddressFromMnemonic(cleanMnemonic);
      
      // ✅ Generate Bitcoin address from the same mnemonic
      const { BitcoinService } = await import('./bitcoin-service');
      const bitcoinService = new BitcoinService('mainnet');
      const { address: bitcoinAddress } = bitcoinService.deriveBitcoinAddress(cleanMnemonic, 'native-segwit');
      
      // ✅ Generate Bitcoin-fork addresses from the same mnemonic
      const { BitcoinForkService } = await import('./bitcoin-fork-service');
      const litecoinService = new BitcoinForkService('litecoin');
      const dogecoinService = new BitcoinForkService('dogecoin');
      const bitcoincashService = new BitcoinForkService('bitcoincash');
      
      const { address: litecoinAddress } = litecoinService.deriveAddress(cleanMnemonic, 'legacy');
      const { address: dogecoinAddress } = dogecoinService.deriveAddress(cleanMnemonic, 'legacy');
      const { address: bitcoincashAddress } = bitcoincashService.deriveAddress(cleanMnemonic, 'legacy');
      
      set({
        wallet,
        address: wallet.address, // EVM address
        solanaAddress, // Solana address
        bitcoinAddress, // ✅ Bitcoin address
        litecoinAddress, // ✅ Litecoin address
        dogecoinAddress, // ✅ Dogecoin address
        bitcoincashAddress, // ✅ Bitcoin Cash address
        mnemonic: cleanMnemonic,
        isLocked: false,
        showUnlockModal: false, // ✅ Close modal after successful unlock
      });

      if (typeof window !== 'undefined') {
        persistSessionAddressSnapshot({
          address: wallet.address,
          solanaAddress,
          bitcoinAddress,
          litecoinAddress,
          dogecoinAddress,
          bitcoincashAddress,
        });
        refreshSessionLease();
        persistSessionMnemonic(cleanMnemonic);
      }
    } catch (error) {
      throw new Error('Invalid recovery phrase. Please check your words and checksum.');
    }
  },

  updateBalance: (balance: string) => {
    set({ balance });
  },

  resetWallet: () => {
    if (typeof window !== 'undefined') {
      // Clean up all wallet-related data
      // ✅ NOTE: We don't store addresses in localStorage anymore (they're derived)
      localStorage.removeItem('wallet_mnemonic'); // Remove if exists (old data)
      localStorage.removeItem('current_chain');
      localStorage.removeItem('custom_tokens');
      localStorage.removeItem('encrypted_wallet');
      localStorage.removeItem('password_hash');
      localStorage.removeItem('has_password');
      localStorage.removeItem('wallet_created_with_email');
      localStorage.removeItem('wallet_email');
      localStorage.removeItem('supabase_user_id'); // ✅ NEW: Remove Supabase user ID
      localStorage.removeItem('wallet_just_created');
      localStorage.removeItem('wallet_just_imported');
      localStorage.removeItem('force_password_setup');
      
      // ✅ NEW: Clean up hidden tokens for all chains
      const chains = Object.keys(CHAINS);
      chains.forEach(chain => {
        localStorage.removeItem(`hidden_tokens_${chain}`);
        localStorage.removeItem(`deleted_tokens_${chain}`);
      });
      
      // ✅ NEW: Clean up old biometric format
      localStorage.removeItem('biometric_enabled');
      localStorage.removeItem('biometric_protected_password');
      
      // Clear session storage
      clearSessionLease();
      sessionStorage.removeItem('pending_biometric_password');
      
      // ✅ NEW: Remove ALL biometric credentials (new wallet-indexed format)
      const webauthnService = WebAuthnService.getInstance();
      webauthnService.removeAllCredentials();
      
      // ✅ NEW: Remove ALL biometric data (new wallet-indexed format)
      const biometricStore = BiometricStore.getInstance();
      biometricStore.removeAllData();

      
      secureLog.info('Wallet reset - all data cleared');
    }
    
    // Clear all state
    set({
      wallet: null,
      address: null,
      solanaAddress: null, // ✅ NEW: Clear Solana address
      bitcoinAddress: null, // ✅ NEW: Clear Bitcoin address
      litecoinAddress: null, // ✅ NEW: Clear Litecoin address
      dogecoinAddress: null, // ✅ NEW: Clear Dogecoin address
      bitcoincashAddress: null, // ✅ NEW: Clear Bitcoin Cash address
      balance: '0',
      isLocked: false,
      hiddenTokens: new Map(), // ✅ NEW: Clear hidden tokens,
      deletedTokens: new Map(), // ✅ NEW: Clear deleted tokens
      mnemonic: null,
      currentChain: DEFAULT_CHAIN,
      
      // ✅ PHASE 3: Clear chain-specific tokens
      chainTokens: new Map(),
      tokens: [],
      
      hasPassword: false,
      lastActivity: Date.now(),
      hasBiometric: false,
      isBiometricEnabled: false,
    });
  },

  switchChain: (chainKey: string) => {
    set({ currentChain: chainKey, balance: '0' });
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_chain', chainKey);
    }
  },

  addToken: (token: Token) => {
    const { currentChain, deletedTokens } = get();
    
    // Load existing custom tokens for this chain
    let customTokens: Token[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`custom_tokens_${currentChain}`);
        if (stored) {
          customTokens = JSON.parse(stored);
        }
      } catch (err) {
        logger.error('Failed to load custom tokens:', err);
      }
    }
    
    // Check if token already exists
    const exists = customTokens.find(t => t.address.toLowerCase() === token.address.toLowerCase());
    
    if (!exists) {
      const newCustomTokens = [...customTokens, token];
      
      // Save to localStorage for this specific chain
      if (typeof window !== 'undefined') {
        localStorage.setItem(`custom_tokens_${currentChain}`, JSON.stringify(newCustomTokens));
        logger.log(`✅ Saved custom token ${token.symbol} for chain ${currentChain}`);
      }
      
      // Update both backward-compatible `tokens` and chain-scoped `chainTokens`
      // so UI sections (including Hidden Tokens) react immediately without refresh.
      const { tokens, chainTokens } = get();
      const normalizedAddress = token.address.toLowerCase();

      const updatedTokens = tokens.some(t => t.address.toLowerCase() === normalizedAddress)
        ? tokens
        : [...tokens, token];

      const updatedChainTokens = new Map(chainTokens);
      const currentChainTokens = updatedChainTokens.get(currentChain) || [];
      const mergedChainTokens = currentChainTokens.some(t => t.address.toLowerCase() === normalizedAddress)
        ? currentChainTokens
        : [...currentChainTokens, token];
      updatedChainTokens.set(currentChain, mergedChainTokens);

      set({
        tokens: updatedTokens,
        chainTokens: updatedChainTokens,
      });

      // Re-adding a token should remove it from deleted list.
      const updatedDeleted = new Map(deletedTokens);
      const chainDeleted = updatedDeleted.get(currentChain);
      if (chainDeleted) {
        chainDeleted.delete(token.address.toLowerCase());
        if (chainDeleted.size === 0) {
          updatedDeleted.delete(currentChain);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(`deleted_tokens_${currentChain}`);
          }
        } else if (typeof window !== 'undefined') {
          localStorage.setItem(`deleted_tokens_${currentChain}`, JSON.stringify(Array.from(chainDeleted)));
        }
        set({ deletedTokens: updatedDeleted });
      }
    }
  },

  // ✅ PHASE 3: Chain-specific token update
  updateTokens: (chain: string, tokens: Token[]) => {
    const { chainTokens, currentChain, deletedTokens } = get();
    
    // Load custom tokens for this chain
    let customTokens: Token[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`custom_tokens_${chain}`);
        if (stored) {
          customTokens = JSON.parse(stored);
          logger.log(`📦 Loaded ${customTokens.length} custom tokens for chain ${chain}`);
        }
      } catch (err) {
        logger.error('Failed to load custom tokens:', err);
      }
    }
    
    // Merge custom tokens with fetched tokens (avoid duplicates)
    const mergedTokens = [...tokens];
    customTokens.forEach(customToken => {
      const exists = mergedTokens.find(t => 
        t.address.toLowerCase() === customToken.address.toLowerCase()
      );
      if (!exists) {
        mergedTokens.push(customToken);
        logger.log(`✅ Added custom token ${customToken.symbol} to ${chain} token list`);
      }
    });
    
    // Filter out hard-deleted tokens for this chain.
    const chainDeleted = deletedTokens.get(chain);
    const finalTokens = chainDeleted
      ? mergedTokens.filter(t => !chainDeleted.has(t.address.toLowerCase()))
      : mergedTokens;
    
    const updated = new Map(chainTokens);
    updated.set(chain, finalTokens);
    
    // Update chain-specific storage
    set({ chainTokens: updated });
    
    // Also update deprecated tokens array for backward compatibility (use current chain)
    if (chain === currentChain) {
      set({ tokens: finalTokens });
    }
  },

  // ✅ PHASE 3: Get tokens for specific chain
  getChainTokens: (chain: string): Token[] => {
    const { chainTokens } = get();
    return chainTokens.get(chain) || [];
  },

  updateActivity: () => {
    const now = Date.now();
    set({ lastActivity: now });

    // Keep activity lease alive only for unlocked sessions.
    if (typeof window !== 'undefined' && !get().isLocked) {
      refreshSessionLease();
    }
  },

  checkAutoLock: () => {
    const { lastActivity, isLocked, hasPassword } = get();

    const timeoutMs = getConfiguredAutoLockTimeoutMs();
    if (timeoutMs === null) return; // Auto-lock disabled ("Never")

    // Only lock if wallet session is currently unlocked.
    if (!isLocked && hasPassword) {
      const sessionLastActivity = typeof window !== 'undefined'
        ? Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || '0')
        : 0;
      const effectiveLastActivity = Math.max(lastActivity, Number.isFinite(sessionLastActivity) ? sessionLastActivity : 0);
      const inactiveTime = Date.now() - effectiveLastActivity;

      const warningWindow = Math.min(2 * 60 * 1000, Math.max(15 * 1000, Math.floor(timeoutMs * 0.2)));
      const warningThreshold = timeoutMs - warningWindow;

      if (inactiveTime > warningThreshold && inactiveTime < timeoutMs) {
        const secondsRemaining = Math.floor((timeoutMs - inactiveTime) / 1000);
        if (typeof window !== 'undefined' && !sessionStorage.getItem('auto_lock_warning_shown')) {
          // Only show warning once
          sessionStorage.setItem('auto_lock_warning_shown', 'true');
          logger.log(`⚠️ [Security] Wallet will auto-lock in ${secondsRemaining} seconds due to inactivity`);
          
          // Dispatch custom event for UI to show warning toast
          window.dispatchEvent(new CustomEvent('wallet-auto-lock-warning', { 
            detail: { secondsRemaining } 
          }));
        }
      }
      
      if (inactiveTime > timeoutMs) {
        logger.log('🔒 [Security] Auto-locking wallet after configured inactivity timeout');
        
        // Clear warning flag
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('auto_lock_warning_shown');
        }
        
        get().lockWallet(); // Use existing lockWallet method
      }
    }
  },

  removeToken: (tokenAddress: string) => {
    // Backward-compatible wrapper: treat as hard delete on current chain.
    const { currentChain } = get();
    get().deleteToken(currentChain, tokenAddress);
  },

  // ✅ NEW: Hide token (soft hide - can be shown again)
  hideToken: (chain: string, tokenAddress: string) => {
    const { hiddenTokens } = get();
    const updated = new Map(hiddenTokens);
    
    // Get or create Set for this chain
    const chainHidden = updated.get(chain) || new Set<string>();
    chainHidden.add(tokenAddress.toLowerCase());
    updated.set(chain, chainHidden);
    
    set({ hiddenTokens: updated });
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      const addresses = Array.from(chainHidden);
      localStorage.setItem(`hidden_tokens_${chain}`, JSON.stringify(addresses));
      logger.log(`✅ Hidden token ${tokenAddress.substring(0, 8)}... on chain ${chain}`);
    }
  },

  // ✅ NEW: Show token (unhide)
  showToken: (chain: string, tokenAddress: string) => {
    const { hiddenTokens } = get();
    const updated = new Map(hiddenTokens);
    
    const chainHidden = updated.get(chain);
    if (chainHidden) {
      chainHidden.delete(tokenAddress.toLowerCase());
      if (chainHidden.size === 0) {
        updated.delete(chain);
      } else {
        updated.set(chain, chainHidden);
      }
    }
    
    set({ hiddenTokens: updated });
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      const chainHidden = updated.get(chain);
      if (chainHidden && chainHidden.size > 0) {
        const addresses = Array.from(chainHidden);
        localStorage.setItem(`hidden_tokens_${chain}`, JSON.stringify(addresses));
      } else {
        localStorage.removeItem(`hidden_tokens_${chain}`);
      }
      logger.log(`✅ Shown token ${tokenAddress.substring(0, 8)}... on chain ${chain}`);
    }
  },

  // ✅ NEW: Check if token is hidden
  isTokenHidden: (chain: string, tokenAddress: string): boolean => {
    const { hiddenTokens } = get();
    const chainHidden = hiddenTokens.get(chain);
    if (!chainHidden) return false;
    return chainHidden.has(tokenAddress.toLowerCase());
  },

  deleteToken: (chain: string, tokenAddress: string) => {
    const normalized = tokenAddress.toLowerCase();
    const { deletedTokens, hiddenTokens, chainTokens, currentChain, tokens } = get();

    // Mark as deleted for this chain.
    const updatedDeleted = new Map(deletedTokens);
    const chainDeleted = updatedDeleted.get(chain) || new Set<string>();
    chainDeleted.add(normalized);
    updatedDeleted.set(chain, chainDeleted);

    // Remove from hidden list too (delete supersedes hide).
    const updatedHidden = new Map(hiddenTokens);
    const chainHidden = updatedHidden.get(chain);
    if (chainHidden) {
      chainHidden.delete(normalized);
      if (chainHidden.size === 0) {
        updatedHidden.delete(chain);
      } else {
        updatedHidden.set(chain, chainHidden);
      }
    }

    // Remove from chain token state immediately.
    const updatedChainTokens = new Map(chainTokens);
    const currentChainTokens = updatedChainTokens.get(chain) || [];
    updatedChainTokens.set(
      chain,
      currentChainTokens.filter(t => t.address.toLowerCase() !== normalized)
    );

    const patch: Partial<WalletState> = {
      deletedTokens: updatedDeleted,
      hiddenTokens: updatedHidden,
      chainTokens: updatedChainTokens,
    };

    if (chain === currentChain) {
      patch.tokens = tokens.filter(t => t.address.toLowerCase() !== normalized);
    }

    set(patch);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`deleted_tokens_${chain}`, JSON.stringify(Array.from(chainDeleted)));
      const remainingHidden = updatedHidden.get(chain);
      if (remainingHidden && remainingHidden.size > 0) {
        localStorage.setItem(`hidden_tokens_${chain}`, JSON.stringify(Array.from(remainingHidden)));
      } else {
        localStorage.removeItem(`hidden_tokens_${chain}`);
      }

      // Also remove from persisted custom list for this chain.
      try {
        const stored = localStorage.getItem(`custom_tokens_${chain}`);
        if (stored) {
          const parsed = JSON.parse(stored) as Token[];
          const filtered = parsed.filter(t => t.address.toLowerCase() !== normalized);
          localStorage.setItem(`custom_tokens_${chain}`, JSON.stringify(filtered));
        }
      } catch (err) {
        logger.error('Failed to update custom token storage after delete:', err);
      }
      logger.log(`🗑️ Deleted token ${tokenAddress.substring(0, 8)}... on chain ${chain}`);
    }
  },

  restoreDeletedToken: (chain: string, tokenAddress: string) => {
    const normalized = tokenAddress.toLowerCase();
    const { deletedTokens } = get();
    const updated = new Map(deletedTokens);
    const chainDeleted = updated.get(chain);
    if (chainDeleted) {
      chainDeleted.delete(normalized);
      if (chainDeleted.size === 0) {
        updated.delete(chain);
      } else {
        updated.set(chain, chainDeleted);
      }
      set({ deletedTokens: updated });
      if (typeof window !== 'undefined') {
        if (chainDeleted.size > 0) {
          localStorage.setItem(`deleted_tokens_${chain}`, JSON.stringify(Array.from(chainDeleted)));
        } else {
          localStorage.removeItem(`deleted_tokens_${chain}`);
        }
      }
    }
  },

  isTokenDeleted: (chain: string, tokenAddress: string): boolean => {
    const { deletedTokens } = get();
    const chainDeleted = deletedTokens.get(chain);
    if (!chainDeleted) return false;
    return chainDeleted.has(tokenAddress.toLowerCase());
  },

  getCurrentAddress: () => {
    const { currentChain, address, solanaAddress, bitcoinAddress, litecoinAddress, dogecoinAddress, bitcoincashAddress } = get();
    // Return chain-specific address
    if (currentChain === 'solana') return solanaAddress;
    if (currentChain === 'bitcoin') return bitcoinAddress;
    if (currentChain === 'litecoin') return litecoinAddress;
    if (currentChain === 'dogecoin') return dogecoinAddress;
    if (currentChain === 'bitcoincash') return bitcoincashAddress;
    return address; // EVM chains
  },

  /**
   * Get wallet identifier for biometric binding
   * ✅ EMAIL WALLETS: Returns Supabase user_id (priority) or email (fallback)
   * ✅ SEED WALLETS: Returns EVM address
   * 
   * 🔧 FIXED: Priority order ensures consistency during onboarding and unlock
   * - Priority 1: supabase_user_id (most reliable, always set for email wallets)
   * - Priority 2: email (fallback for email wallets)
   * - Priority 3: EVM address (for seed phrase wallets)
   */
  getWalletIdentifier: () => {
    if (typeof window === 'undefined') return null;
    
    // ✅ PRIORITY 1: Supabase user_id (most reliable for email wallets)
    // This is ALWAYS set by signUpWithEmail() / signInWithEmail()
    // Ensures consistency during onboarding AND after refresh
    const supabaseUserId = localStorage.getItem('supabase_user_id');
    if (supabaseUserId) {
      return supabaseUserId;
    }
    
    // ✅ PRIORITY 2: Email (fallback for email wallets if user_id missing)
    // Backward compatible with older setups
    const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
    if (createdWithEmail) {
      const email = localStorage.getItem('wallet_email');
      if (email) {
        return email;
      }
    }
    
    // ✅ PRIORITY 3: EVM address (for seed phrase wallets)
    // Only used if no email wallet data exists
    const { address } = get();
    return address;
  },
}));




