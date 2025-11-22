import * as bip39 from 'bip39';
import { ethers } from 'ethers';
import { encryptWallet } from './crypto-utils';
import { logger } from './logger';
import { rateLimitService } from './rate-limit-service';

export interface RecoverResult {
  success: boolean;
  error?: string;
}

/**
 * Recover wallet from mnemonic and set new password
 * This completely replaces the old password with a new one
 */
export async function recoverWallet(
  mnemonic: string,
  newPassword: string
): Promise<RecoverResult> {
  try {
    logger.log('🔄 Starting wallet recovery process...');

    // 1. Rate limiting check (max 5 attempts)
    const rateLimitKey = 'wallet_recovery_global';
    const lockStatus = rateLimitService.isLocked(rateLimitKey);
    
    if (lockStatus.isLocked) {
      logger.error('❌ Rate limit exceeded for wallet recovery');
      const minutes = Math.ceil((lockStatus.unlockInSeconds || 0) / 60);
      return {
        success: false,
        error: `Too many recovery attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`
      };
    }

    // 2. Validate mnemonic (BIP39)
    const cleanMnemonic = mnemonic.trim().toLowerCase();
    
    if (!bip39.validateMnemonic(cleanMnemonic)) {
      logger.error('❌ Invalid mnemonic provided');
      rateLimitService.recordFailedAttempt(rateLimitKey);
      return {
        success: false,
        error: 'Invalid recovery phrase. Please check your words and try again.'
      };
    }

    logger.log('✅ Mnemonic validated successfully');

    // 3. Derive wallet from mnemonic to verify it works
    let wallet: ethers.HDNodeWallet;
    try {
      wallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      logger.log('✅ Wallet derived from mnemonic:', wallet.address);
    } catch (error) {
      logger.error('❌ Failed to derive wallet:', error);
      rateLimitService.recordFailedAttempt(rateLimitKey);
      return {
        success: false,
        error: 'Failed to recover wallet from recovery phrase.'
      };
    }

    // 4. Validate new password
    if (newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters'
      };
    }

    // 5. Encrypt wallet with NEW password
    logger.log('🔐 Encrypting wallet with new password...');
    const encryptedWallet = encryptWallet(cleanMnemonic, newPassword);

    // 6. Update localStorage with new encrypted wallet
    if (typeof window !== 'undefined') {
      // Store encrypted wallet
      localStorage.setItem('encrypted_wallet', JSON.stringify(encryptedWallet));
      
      // Set password flag
      localStorage.setItem('has_password', 'true');
      
      // Clear any old password-related data
      localStorage.removeItem('wallet_just_imported'); // Old flag
      localStorage.removeItem('force_password_setup'); // Old flag
      
      // Mark wallet as unlocked for this session
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      
      logger.log('✅ Wallet encrypted and stored with new password');
    }

    // 7. Import wallet into store (so it's ready to use)
    const { useWalletStore } = await import('./wallet-store');
    await useWalletStore.getState().importWallet(cleanMnemonic);
    
    logger.log('✅ Wallet imported into store');

    // 8. Log success (for audit trail)
    logger.log('🎉 Wallet recovery completed successfully!');

    // Clear rate limit on success
    const rateLimitKey = 'wallet_recovery_global';
    rateLimitService.clearAttempts(rateLimitKey);

    return {
      success: true
    };

  } catch (error: any) {
    logger.error('❌ Wallet recovery error:', error);
    
    // Record failed attempt
    const rateLimitKey = 'wallet_recovery_global';
    rateLimitService.recordFailedAttempt(rateLimitKey);
    
    return {
      success: false,
      error: error.message || 'Failed to recover wallet. Please try again.'
    };
  }
}

/**
 * Check if recovery is currently rate limited
 */
export function isRecoveryRateLimited(): boolean {
  const rateLimitKey = 'wallet_recovery_global';
  return rateLimitService.isLocked(rateLimitKey).isLocked;
}

/**
 * Get remaining recovery attempts
 */
export function getRemainingRecoveryAttempts(): number {
  const rateLimitKey = 'wallet_recovery_global';
  return rateLimitService.getRemainingAttempts(rateLimitKey);
}

