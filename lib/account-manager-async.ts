/**
 * Async Account Manager
 * IndexedDB-first account management (iOS PWA safe)
 */

import { logger } from '@/lib/logger';
import { secureStorage } from '@/lib/secure-storage';
import { resolveCurrentIdentity, selfHealIdentityFromSession } from '@/lib/account-identity';

export interface WalletAccount {
  id: string;
  type: 'email' | 'seed';
  displayName: string;
  email?: string;
  lastUsed: Date;
  isActive: boolean;
  encryptedData?: string;
}

/**
 * Get current active account from IndexedDB
 */
export async function getCurrentAccountAsync(): Promise<WalletAccount | null> {
  try {
    // Check IndexedDB for encrypted wallet
    const encryptedWallet = await secureStorage.getItem('encrypted_wallet');
    
    if (!encryptedWallet) {
      return null;
    }

    // Resolve identity across secure storage/local/session and self-heal mismatches.
    let identity = await resolveCurrentIdentity();
    if (!identity) {
      identity = await selfHealIdentityFromSession();
    }

    if (identity) {
      // Email wallet
      return {
        id: identity.userId,
        type: 'email',
        displayName: identity.email,
        email: identity.email,
        lastUsed: new Date(),
        isActive: true,
      };
    } else if (encryptedWallet) {
      // Seed phrase wallet
      const walletHash = generateWalletHash(encryptedWallet);
      return {
        id: walletHash,
        type: 'seed',
        displayName: `Wallet ${walletHash.substring(0, 8)}...`,
        lastUsed: new Date(),
        isActive: true,
        encryptedData: encryptedWallet,
      };
    }

    return null;
  } catch (error) {
    logger.error('Error getting current account from IndexedDB:', error);
    return null;
  }
}

/**
 * Get all available accounts (current + recent)
 */
export async function getAllAccountsAsync(): Promise<WalletAccount[]> {
  try {
    const accounts: WalletAccount[] = [];

    // Get current account from IndexedDB
    const currentAccount = await getCurrentAccountAsync();
    if (currentAccount) {
      accounts.push({ ...currentAccount, isActive: true });
    }

    // Get recent accounts from localStorage (metadata only)
    const recentAccounts = getRecentAccountsFromStorage();
    const otherAccounts = recentAccounts.filter(
      (acc) => acc.id !== currentAccount?.id
    );

    accounts.push(...otherAccounts.map((acc) => ({ ...acc, isActive: false })));

    // Sort by last used
    return accounts.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  } catch (error) {
    logger.error('Error getting all accounts:', error);
    return [];
  }
}

/**
 * Get recent accounts from localStorage (metadata only, not sensitive data)
 */
function getRecentAccountsFromStorage(): WalletAccount[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('recent_wallet_accounts');
    if (!stored) return [];

    const accounts = JSON.parse(stored);

    // Convert date strings to Date objects
    return accounts.map((acc: any) => ({
      ...acc,
      lastUsed: new Date(acc.lastUsed),
    }));
  } catch (error) {
    logger.error('Error parsing recent accounts:', error);
    return [];
  }
}

/**
 * Get accounts by type
 */
export async function getAccountsByTypeAsync(): Promise<{
  emailAccounts: WalletAccount[];
  seedAccounts: WalletAccount[];
}> {
  const allAccounts = await getAllAccountsAsync();

  return {
    emailAccounts: allAccounts.filter((acc) => acc.type === 'email'),
    seedAccounts: allAccounts.filter((acc) => acc.type === 'seed'),
  };
}

/**
 * Generate wallet hash for seed wallets
 */
function generateWalletHash(encryptedData: string): string {
  // Simple hash for display purposes (first 8 chars of encrypted data)
  let hash = 0;
  for (let i = 0; i < encryptedData.length; i++) {
    const char = encryptedData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

