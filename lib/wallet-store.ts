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
  
  hasPassword: boolean;
  lastActivity: number;
  hasBiometric: boolean;
  isBiometricEnabled: boolean;
  
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
  updateActivity: () => void;
  checkAutoLock: () => void;
  getCurrentAddress: () => string | null; // Helper to get current chain address
  getWalletIdentifier: () => string | null; // ✅ NEW: Get identifier for biometric binding
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
  
  hasPassword: false,
  lastActivity: Date.now(),
  hasBiometric: false,
  isBiometricEnabled: false,

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
      lastActivity: Date.now(),
    });

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
        currentChain: savedChain,
      });

      // ✅ SECURITY: DO NOT store addresses in localStorage
      // ✅ Addresses are ALWAYS derived from mnemonic on unlock
      // ✅ Only store encrypted mnemonic (happens in setPassword)
      if (typeof window !== 'undefined') {
        // DO NOT store addresses - they will be derived on unlock
      }
    } catch (error) {
      throw new Error('Ongeldige recovery phrase. Controleer je woorden en checksum.');
    }
  },

  setPassword: async (password: string) => {
    const { mnemonic, address, wallet } = get();
    
    // ✅ SECURITY: Mnemonic should ONLY be in memory at this point
    if (!mnemonic || !address || !wallet) {
      throw new Error('Geen wallet gevonden. Maak eerst een wallet aan of importeer een bestaande.');
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

      // ✅ SECURITY FIX: Migrate to IndexedDB if needed (one-time, automatic)
      const needsMigration = await secureStorage.needsMigration();
      if (needsMigration) {
        logger.log('🔄 Migrating sensitive data to IndexedDB...');
        await secureStorage.migrateFromLocalStorage();
      }

      // Check if password is correct (try IndexedDB first, fallback to localStorage)
      const storedHash = await secureStorage.getItem('password_hash') || localStorage.getItem('password_hash');
      if (!storedHash || !verifyPassword(password, storedHash)) {
        throw new Error('Invalid password');
      }

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
        currentChain: savedChain,
        lastActivity: Date.now(),
      });

      // Set session flag + activity timestamp
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        sessionStorage.setItem('last_activity', Date.now().toString());
      }

    } catch (error) {
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
        
        const { signInWithEmail } = await import('./supabase-auth');
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
          currentChain: savedChain,
          lastActivity: Date.now(),
        });

        // Set session flag + activity timestamp
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('wallet_unlocked_this_session', 'true');
          sessionStorage.setItem('last_activity', Date.now().toString());
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
          currentChain: savedChain,
          lastActivity: Date.now(),
        });

        // Set session flag + activity timestamp
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('wallet_unlocked_this_session', 'true');
          sessionStorage.setItem('last_activity', Date.now().toString());
        }

        secureLog.info('Seed phrase wallet unlocked with biometrics');
      }

    } catch (error: any) {
      secureLog.error('Biometric unlock error:', error);
      throw new Error(error.message || 'Biometrische authenticatie mislukt');
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
        throw new Error(result.error || 'Biometrie setup mislukt');
      }

    } catch (error: any) {
      throw new Error(error.message || 'Biometrie setup mislukt');
    }
  },

  lockWallet: () => {
    set({
      wallet: null,
      mnemonic: null,
      isLocked: true,
    });
    
    // ✅ Clean up session state to ensure unlock modal appears
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('wallet_unlocked_this_session');
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
      });
    } catch (error) {
      throw new Error('Ongeldige recovery phrase. Controleer je woorden en checksum.');
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
      
      // ✅ NEW: Clean up old biometric format
      localStorage.removeItem('biometric_enabled');
      localStorage.removeItem('biometric_protected_password');
      
      // Clear session storage
      sessionStorage.removeItem('wallet_unlocked_this_session');
      sessionStorage.removeItem('pending_biometric_password');
      sessionStorage.removeItem('last_activity'); // ✅ NEW: Clear activity timestamp
      
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
    const { tokens } = get();
    const exists = tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase());
    
    if (!exists) {
      const newTokens = [...tokens, token];
      set({ tokens: newTokens });
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('custom_tokens', JSON.stringify(newTokens));
      }
    }
  },

  // ✅ PHASE 3: Chain-specific token update
  updateTokens: (chain: string, tokens: Token[]) => {
    const { chainTokens } = get();
    const updated = new Map(chainTokens);
    updated.set(chain, tokens);
    
    // Update chain-specific storage
    set({ chainTokens: updated });
    
    // Also update deprecated tokens array for backward compatibility (use current chain)
    if (chain === get().currentChain) {
      set({ tokens });
    }
  },

  // ✅ PHASE 3: Get tokens for specific chain
  getChainTokens: (chain: string): Token[] => {
    const { chainTokens } = get();
    return chainTokens.get(chain) || [];
  },

  updateActivity: () => {
    set({ lastActivity: Date.now() });
    
    // ✅ SECURITY FIX: Store activity in sessionStorage for cross-tab sync
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('last_activity', Date.now().toString());
    }
  },

  checkAutoLock: () => {
    const { lastActivity, wallet, isLocked } = get();
    
    // ✅ SECURITY FIX: Reduced from 30min to 15min for better security
    const AUTO_LOCK_TIME = 15 * 60 * 1000; // 15 minutes
    
    // Only lock if wallet is unlocked
    if (wallet && !isLocked && Date.now() - lastActivity > AUTO_LOCK_TIME) {
      logger.log('🔒 [Security] Auto-locking wallet after 15 minutes of inactivity');
      
      get().lockWallet(); // Use existing lockWallet method
    }
  },

  removeToken: (tokenAddress: string) => {
    const { tokens } = get();
    const newTokens = tokens.filter(
      t => t.address.toLowerCase() !== tokenAddress.toLowerCase()
    );
    set({ tokens: newTokens });
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('custom_tokens', JSON.stringify(newTokens));
    }
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




