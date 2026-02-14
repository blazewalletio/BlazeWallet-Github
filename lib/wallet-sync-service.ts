/**
 * 🔄 WALLET SYNC SERVICE
 * 
 * Handles syncing encrypted wallet between IndexedDB (local) and Supabase (cloud)
 * 
 * HYBRID STORAGE STRATEGY:
 * - Primary: IndexedDB (fast, persistent on iOS PWA)
 * - Backup: Supabase (cloud, recovery, multi-device)
 * 
 * WHY?
 * - iOS Safari PWA clears localStorage on app close
 * - IndexedDB is more persistent but can still be cleared
 * - Supabase backup ensures wallet is never lost
 * - Enables multi-device sync in future
 */

import { supabase } from './supabase';
import { secureStorage } from './secure-storage';
import { logger } from './logger';

export interface WalletSyncResult {
  success: boolean;
  error?: string;
  synced?: boolean;
}

/**
 * Sync wallet TO Supabase (backup)
 * Call this after: signup, signin, password change, wallet import
 */
export async function syncWalletToSupabase(
  userId: string,
  encryptedWallet: string,
  walletAddress?: string
): Promise<WalletSyncResult> {
  try {
    logger.log('☁️ [WalletSync] Syncing wallet to Supabase...');
    
    // Check if wallet already exists
    const { data: existing, error: checkError } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) {
      throw checkError;
    }
    
    const now = new Date().toISOString();
    
    if (existing) {
      // Update existing wallet
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          encrypted_wallet: encryptedWallet,
          wallet_address: walletAddress,
          last_synced_at: now,
          updated_at: now,
        })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
      
      logger.log('✅ [WalletSync] Wallet updated in Supabase');
    } else {
      // Insert new wallet
      const { error: insertError } = await supabase
        .from('wallets')
        .insert({
          user_id: userId,
          encrypted_wallet: encryptedWallet,
          wallet_address: walletAddress,
          last_synced_at: now,
          created_at: now,
          updated_at: now,
        });
      
      if (insertError) throw insertError;
      
      logger.log('✅ [WalletSync] Wallet created in Supabase');
    }
    
    return { success: true, synced: true };
    
  } catch (error: any) {
    logger.error('❌ [WalletSync] Failed to sync to Supabase:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to sync wallet',
      synced: false 
    };
  }
}

/**
 * Sync wallet FROM Supabase (recovery)
 * Call this when: IndexedDB is empty, app restart, device change
 */
export async function syncWalletFromSupabase(
  userId: string
): Promise<WalletSyncResult & { encryptedWallet?: string }> {
  try {
    logger.log('☁️ [WalletSync] Fetching wallet from Supabase...');
    
    // Fetch wallet from Supabase
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('encrypted_wallet, last_synced_at')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      throw error;
    }
    
    if (!wallet) {
      // Wallet not found in Supabase
      logger.log('ℹ️  [WalletSync] No wallet found in Supabase');
      return { success: true, synced: false };
    }
    
    if (!wallet || !wallet.encrypted_wallet) {
      logger.log('ℹ️  [WalletSync] Wallet exists but no encrypted data');
      return { success: true, synced: false };
    }
    
    // Save to IndexedDB (restore local copy)
    await secureStorage.setItem('encrypted_wallet', wallet.encrypted_wallet);
    await secureStorage.setItem('has_password', 'true');
    
    logger.log('✅ [WalletSync] Wallet restored to IndexedDB from Supabase');
    logger.log(`   Last synced: ${wallet.last_synced_at}`);
    
    return { 
      success: true, 
      synced: true,
      encryptedWallet: wallet.encrypted_wallet
    };
    
  } catch (error: any) {
    logger.error('❌ [WalletSync] Failed to sync from Supabase:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch wallet',
      synced: false
    };
  }
}

/**
 * Check if wallet needs sync (IndexedDB vs Supabase)
 * Returns true if IndexedDB is empty but Supabase has wallet
 */
export async function needsWalletSync(userId: string): Promise<boolean> {
  try {
    // Check IndexedDB
    const localWallet = await secureStorage.getItem('encrypted_wallet');
    
    if (localWallet) {
      // IndexedDB has wallet, no sync needed
      return false;
    }
    
    // IndexedDB empty, check Supabase
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error || !wallet) {
      // Supabase also empty, no sync needed
      return false;
    }
    
    // Supabase has wallet, IndexedDB doesn't → needs sync!
    logger.log('⚠️  [WalletSync] IndexedDB empty but Supabase has wallet → sync needed');
    return true;
    
  } catch (error: any) {
    logger.error('❌ [WalletSync] Error checking sync status:', error);
    return false;
  }
}

/**
 * Delete wallet from Supabase (for account deletion)
 */
export async function deleteWalletFromSupabase(userId: string): Promise<WalletSyncResult> {
  try {
    logger.log('🗑️  [WalletSync] Deleting wallet from Supabase...');
    
    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
    
    logger.log('✅ [WalletSync] Wallet deleted from Supabase');
    return { success: true };
    
  } catch (error: any) {
    logger.error('❌ [WalletSync] Failed to delete wallet:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete wallet'
    };
  }
}

