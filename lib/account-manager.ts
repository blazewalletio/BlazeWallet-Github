/**
 * Account Manager
 * Manages multiple wallet accounts (email + seed phrase wallets)
 * Supports account switching with Supabase integration
 */

export interface WalletAccount {
  id: string;                    // supabase_user_id or wallet hash
  type: 'email' | 'seed';
  displayName: string;           // email or "Wallet abc..."
  lastUsed: number;              // Timestamp
  encryptedData?: string;        // For seed wallets only
}

interface StoredAccounts {
  accounts: WalletAccount[];
  version: number;
}

const STORAGE_KEY = 'blaze_wallet_accounts';
const STORAGE_VERSION = 1;

/**
 * Get all stored accounts
 */
export function getAllAccounts(): WalletAccount[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const data: StoredAccounts = JSON.parse(stored);
    if (data.version !== STORAGE_VERSION) {
      // Version mismatch, reset
      return [];
    }

    return data.accounts.sort((a, b) => b.lastUsed - a.lastUsed);
  } catch (error) {
    console.error('Failed to load accounts:', error);
    return [];
  }
}

/**
 * Get currently active account
 */
export function getCurrentAccount(): WalletAccount | null {
  if (typeof window === 'undefined') return null;

  const isEmail = localStorage.getItem('wallet_created_with_email') === 'true';
  const email = localStorage.getItem('wallet_email');
  const userId = localStorage.getItem('supabase_user_id');
  const encryptedWallet = localStorage.getItem('encrypted_wallet');

  if (isEmail && email && userId) {
    return {
      id: userId,
      type: 'email',
      displayName: email,
      lastUsed: Date.now(),
    };
  }

  if (!isEmail && encryptedWallet) {
    // Generate consistent ID for seed wallet
    const walletHash = generateWalletHash(encryptedWallet);
    return {
      id: walletHash,
      type: 'seed',
      displayName: `Wallet ${walletHash.substring(0, 8)}...`,
      lastUsed: Date.now(),
      encryptedData: encryptedWallet,
    };
  }

  return null;
}

/**
 * Save account to recent accounts list
 */
export function saveAccountToRecent(account: WalletAccount): void {
  if (typeof window === 'undefined') return;

  try {
    const accounts = getAllAccounts();
    
    // Remove if already exists
    const filtered = accounts.filter(a => a.id !== account.id);
    
    // Add to front
    filtered.unshift({
      ...account,
      lastUsed: Date.now(),
    });

    // Keep only last 10 accounts
    const limited = filtered.slice(0, 10);

    const data: StoredAccounts = {
      accounts: limited,
      version: STORAGE_VERSION,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log(`✅ Saved account to recent: ${account.displayName}`);
  } catch (error) {
    console.error('Failed to save account:', error);
  }
}

/**
 * Switch to a different account
 */
export function switchToAccount(account: WalletAccount): void {
  if (typeof window === 'undefined') return;

  console.log(`🔄 Switching to account: ${account.displayName}`);

  // Save current account to recent
  const current = getCurrentAccount();
  if (current) {
    saveAccountToRecent(current);
  }

  // Clear current session
  sessionStorage.removeItem('wallet_unlocked_this_session');

  if (account.type === 'email') {
    // Switch to email wallet
    localStorage.setItem('wallet_created_with_email', 'true');
    localStorage.setItem('wallet_email', account.displayName);
    localStorage.setItem('supabase_user_id', account.id);
    // Remove encrypted_wallet (will be fetched from Supabase on unlock)
    localStorage.removeItem('encrypted_wallet');
  } else {
    // Switch to seed wallet
    localStorage.setItem('wallet_created_with_email', 'false');
    localStorage.removeItem('wallet_email');
    localStorage.removeItem('supabase_user_id');
    if (account.encryptedData) {
      localStorage.setItem('encrypted_wallet', account.encryptedData);
    }
  }

  console.log(`✅ Switched to ${account.type} wallet: ${account.displayName}`);
}

/**
 * Remove an account from recent list
 */
export function removeAccount(accountId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const accounts = getAllAccounts();
    const filtered = accounts.filter(a => a.id !== accountId);

    const data: StoredAccounts = {
      accounts: filtered,
      version: STORAGE_VERSION,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log(`✅ Removed account: ${accountId}`);
  } catch (error) {
    console.error('Failed to remove account:', error);
  }
}

/**
 * Generate consistent hash for wallet identification
 */
function generateWalletHash(data: string): string {
  // Simple hash function for wallet identification
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if account exists in recent list
 */
export function accountExists(accountId: string): boolean {
  const accounts = getAllAccounts();
  return accounts.some(a => a.id === accountId);
}

/**
 * Update last used timestamp for an account
 */
export function updateAccountLastUsed(accountId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const accounts = getAllAccounts();
    const account = accounts.find(a => a.id === accountId);
    
    if (account) {
      account.lastUsed = Date.now();
      
      const data: StoredAccounts = {
        accounts,
        version: STORAGE_VERSION,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Failed to update account timestamp:', error);
  }
}

