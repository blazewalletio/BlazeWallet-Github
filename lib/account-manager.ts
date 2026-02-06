/**
 * Account Manager Service
 * Manages multiple wallet accounts (email + seed phrase wallets)
 * Perfect integration with Supabase
 */

import { logger } from '@/lib/logger';

export interface WalletAccount {
  id: string;                    // supabase_user_id or wallet hash
  type: 'email' | 'seed';
  displayName: string;           // email or "Wallet abc..."
  email?: string;                // For email accounts
  lastUsed: Date;
  isActive: boolean;             // Currently loaded
  encryptedData?: string;        // For seed wallets (stored encrypted)
}

const RECENT_ACCOUNTS_KEY = 'recent_wallet_accounts';
const MAX_RECENT_ACCOUNTS = 10;

/**
 * Get all available wallet accounts (ASYNC - reads from IndexedDB)
 */
export async function getAllAccounts(): Promise<WalletAccount[]> {
  if (typeof window === 'undefined') return [];
  
  const accounts: WalletAccount[] = [];
  
  // 1. Get current active account
  const currentAccount = await getCurrentAccount();
  if (currentAccount) {
    accounts.push({ ...currentAccount, isActive: true });
  }
  
  // 2. Get recent accounts (excluding current)
  const recentAccounts = getRecentAccounts();
  const otherAccounts = recentAccounts.filter(
    acc => acc.id !== currentAccount?.id
  );
  
  accounts.push(...otherAccounts.map(acc => ({ ...acc, isActive: false })));
  
  // 3. Sort by last used (most recent first)
  return accounts.sort((a, b) => 
    new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
  );
}

/**
 * Get current active account
 */
/**
 * Get current active wallet account (ASYNC - reads from IndexedDB)
 */
export async function getCurrentAccount(): Promise<WalletAccount | null> {
  if (typeof window === 'undefined') return null;
  
  // Import secureStorage for IndexedDB access
  const { secureStorage } = await import('@/lib/secure-storage');
  
  // Read from IndexedDB (primary and only storage)
  const isEmail = await secureStorage.getItem('wallet_created_with_email') === 'true';
  const email = await secureStorage.getItem('wallet_email');
  const userId = await secureStorage.getItem('supabase_user_id');
  const encryptedWallet = await secureStorage.getItem('encrypted_wallet');
  
  if (!encryptedWallet) return null;
  
  if (isEmail && email && userId) {
    // Email wallet
    return {
      id: userId,
      type: 'email',
      displayName: email,
      email: email,
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
}

/**
 * Get recent accounts from storage
 */
export function getRecentAccounts(): WalletAccount[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    if (!stored) return [];
    
    const accounts = JSON.parse(stored);
    
    // Convert date strings back to Date objects
    return accounts.map((acc: any) => ({
      ...acc,
      lastUsed: new Date(acc.lastUsed),
      isActive: false,
    }));
  } catch (error) {
    logger.error('Failed to parse recent accounts:', error);
    return [];
  }
}

/**
 * Save current account to recent accounts before switching
 */
export async function saveCurrentAccountToRecent(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const currentAccount = await getCurrentAccount();
  if (!currentAccount) return;
  
  const recentAccounts = getRecentAccounts();
  
  // Remove if already exists (to update lastUsed)
  const filtered = recentAccounts.filter(acc => acc.id !== currentAccount.id);
  
  // Add current account to front
  const updated = [
    { ...currentAccount, isActive: false, lastUsed: new Date() },
    ...filtered,
  ].slice(0, MAX_RECENT_ACCOUNTS);
  
  localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
  
  logger.log('✅ Saved current account to recent:', currentAccount.displayName);
}

/**
 * Switch to an email account
 */
export async function switchToEmailAccount(
  email: string,
  userId: string,
  encryptedWallet: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  logger.log('🔄 Switching to email account:', email);
  
  // Save current account before switching
  saveCurrentAccountToRecent();
  
  // Update storage (✅ HYBRID: IndexedDB + localStorage)
  const { secureStorage } = await import('./secure-storage');
  
  // ✅ CRITICAL: Store encrypted wallet in IndexedDB (persistent on iOS PWA)
  await secureStorage.setItem('encrypted_wallet', encryptedWallet);
  await secureStorage.setItem('has_password', 'true');
  
  // ✅ Non-sensitive metadata can stay in localStorage
  localStorage.setItem('wallet_email', email);
  localStorage.setItem('supabase_user_id', userId);
  localStorage.setItem('wallet_created_with_email', 'true');
  
  // Clear session flag to require unlock
  sessionStorage.removeItem('wallet_unlocked_this_session');
  
  logger.log('✅ Switched to email account:', email);
}

/**
 * Switch to a seed phrase wallet
 */
export async function switchToSeedWallet(walletId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  logger.log('🔄 Switching to seed wallet:', walletId);
  
  // Save current account before switching
  saveCurrentAccountToRecent();
  
  // Find wallet in recent accounts
  const recentAccounts = getRecentAccounts();
  const wallet = recentAccounts.find(acc => acc.id === walletId && acc.type === 'seed');
  
  if (!wallet || !wallet.encryptedData) {
    throw new Error('Wallet not found in recent accounts');
  }
  
  // Update storage (✅ HYBRID: IndexedDB + localStorage)
  const { secureStorage } = await import('./secure-storage');
  
  // ✅ CRITICAL: Store encrypted wallet in IndexedDB (persistent on iOS PWA)
  await secureStorage.setItem('encrypted_wallet', wallet.encryptedData);
  await secureStorage.setItem('has_password', 'true');
  
  // ✅ Clean up email wallet metadata from localStorage
  localStorage.removeItem('wallet_created_with_email');
  localStorage.removeItem('wallet_email');
  localStorage.removeItem('supabase_user_id');
  localStorage.setItem('has_password', 'true');
  
  // Clear session flag to require unlock
  sessionStorage.removeItem('wallet_unlocked_this_session');
  
  logger.log('✅ Switched to seed wallet:', walletId);
}

/**
 * Remove an account from recent accounts
 */
export function removeAccount(accountId: string): void {
  if (typeof window === 'undefined') return;
  
  const recentAccounts = getRecentAccounts();
  const filtered = recentAccounts.filter(acc => acc.id !== accountId);
  
  localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(filtered));
  
  logger.log('✅ Removed account from recent:', accountId);
}

/**
 * Upgrade current seed wallet to email account
 * Updates account type and metadata after successful Supabase signup
 */
export async function markAccountAsUpgraded(
  email: string,
  userId: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  logger.log('🔄 Marking account as upgraded to email:', email);
  
  // Get current account
  const currentAccount = await getCurrentAccount();
  
  if (!currentAccount || currentAccount.type !== 'seed') {
    logger.error('Cannot upgrade: Current account is not a seed wallet');
    return;
  }
  
  // Remove old seed wallet from recent accounts (will be replaced by email account)
  removeAccount(currentAccount.id);
  
  // Update localStorage flags (already done in upgradeToEmailAccount, but ensure consistency)
  localStorage.setItem('wallet_email', email);
  localStorage.setItem('supabase_user_id', userId);
  localStorage.setItem('wallet_created_with_email', 'true');
  
  logger.log('✅ Account upgraded: seed wallet → email account');
  
  // Save new email account to recent
  saveCurrentAccountToRecent();
}

/**
 * Get wallet identifier for the current account
 * Used for biometric authentication binding
 */
export function getCurrentWalletIdentifier(): string | null {
  const account = getCurrentAccount();
  if (!account) return null;
  
  // Email wallets use Supabase user_id, seed wallets use wallet hash
  return account.id;
}

/**
 * Clear all recent accounts (for testing/debugging)
 */
export function clearRecentAccounts(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(RECENT_ACCOUNTS_KEY);
  logger.log('✅ Cleared all recent accounts');
}

/**
 * Generate a consistent hash for a wallet
 */
function generateWalletHash(encryptedData: string): string {
  // Simple hash function for wallet identification
  let hash = 0;
  for (let i = 0; i < encryptedData.length; i++) {
    const char = encryptedData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get account type icon
 */
export function getAccountIcon(type: 'email' | 'seed'): string {
  return type === 'email' ? '📧' : '🔐';
}

/**
 * Get accounts grouped by type (ASYNC)
 */
export async function getAccountsByType(): Promise<{
  emailAccounts: WalletAccount[];
  seedAccounts: WalletAccount[];
}> {
  const allAccounts = await getAllAccounts();
  
  return {
    emailAccounts: allAccounts.filter(acc => acc.type === 'email'),
    seedAccounts: allAccounts.filter(acc => acc.type === 'seed'),
  };
}

