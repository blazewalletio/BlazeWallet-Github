/**
 * 🔐 2FA VERIFICATION SERVICE
 * Real TOTP verification using otplib
 */

import { authenticator } from 'otplib';
import { logger } from './logger';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, resetRateLimit } from './rate-limiter';
import crypto from 'crypto';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for 2FA service');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for 2FA service');
}

// Admin client for database operations
const supabaseAdmin = createClient(
  supabaseUrl.trim(),
  supabaseServiceKey.trim(),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Verify 2FA TOTP code
 * @param userId Supabase user ID
 * @param code 6-digit TOTP code from authenticator
 * @returns true if valid, false otherwise
 */
export async function verify2FACode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check rate limiting first (5 attempts per 15 minutes)
    const rateLimit = checkRateLimit(`2fa:${userId}`, 5, 15 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      logger.warn(`⚠️ 2FA rate limit exceeded for user: ${userId}`);
      return { 
        success: false, 
        error: `Too many attempts. Please try again in ${Math.ceil(rateLimit.resetIn / 60)} minutes`,
      };
    }
    
    // Validate input
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return { success: false, error: 'Invalid code format' };
    }

    // Get user's 2FA secret
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('two_factor_secret, two_factor_enabled')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('❌ Failed to get user profile:', profileError);
      return { success: false, error: 'User profile not found' };
    }

    if (!profile.two_factor_enabled) {
      return { success: false, error: '2FA is not enabled for this user' };
    }

    if (!profile.two_factor_secret) {
      return { success: false, error: '2FA secret not found' };
    }

    // Verify TOTP code with time window tolerance
    const isValid = authenticator.verify({
      token: code,
      secret: profile.two_factor_secret,
    });

    if (isValid) {
      logger.log('✅ 2FA code verified successfully');
      
      // Reset rate limit on successful verification
      resetRateLimit(`2fa:${userId}`);
      
      // Log successful 2FA verification
      try {
        await supabaseAdmin.rpc('log_user_activity', {
          p_user_id: userId,
          p_activity_type: 'security_success',
          p_description: '2FA verification successful',
        });
      } catch (logError) {
        logger.warn('Failed to log 2FA activity:', logError);
      }
      
      return { success: true };
    } else {
      logger.warn('❌ Invalid 2FA code attempt');
      
      // Log failed attempt
      try {
        await supabaseAdmin.rpc('log_user_activity', {
          p_user_id: userId,
          p_activity_type: 'security_alert',
          p_description: 'Failed 2FA verification attempt',
        });
      } catch (logError) {
        logger.warn('Failed to log 2FA activity:', logError);
      }
      
      return { success: false, error: 'Invalid 2FA code' };
    }
  } catch (error: any) {
    logger.error('❌ 2FA verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Verify backup code
 * @param userId Supabase user ID
 * @param code Backup code (8 characters)
 * @returns true if valid, false otherwise
 */
export async function verifyBackupCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    if (!code || code.length < 8) {
      return { success: false, error: 'Invalid backup code format' };
    }

    // Normalize code (remove dashes, uppercase)
    const normalizedCode = code.replace(/-/g, '').toUpperCase();

    // Get user's backup codes
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('two_factor_backup_codes')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'User profile not found' };
    }

    const backupCodes = profile.two_factor_backup_codes || [];

    if (backupCodes.length === 0) {
      return { success: false, error: 'No backup codes available' };
    }

    // Hash the provided code
    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

    // Check if hash matches any stored backup code
    const matchIndex = backupCodes.findIndex((hash: string) => hash === codeHash);

    if (matchIndex === -1) {
      logger.warn('❌ Invalid backup code attempt');
      return { success: false, error: 'Invalid backup code' };
    }

    // Remove used backup code (one-time use)
    const updatedCodes = backupCodes.filter((_: string, i: number) => i !== matchIndex);

    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ two_factor_backup_codes: updatedCodes })
      .eq('user_id', userId);

    if (updateError) {
      logger.error('Failed to update backup codes:', updateError);
      return { success: false, error: 'Failed to verify backup code' };
    }

    logger.log('✅ Backup code verified and removed');

    // Log backup code usage
    try {
      await supabaseAdmin.rpc('log_user_activity', {
        p_user_id: userId,
        p_activity_type: 'security_alert',
        p_description: 'Backup code used for 2FA verification',
        p_metadata: JSON.stringify({ remaining_codes: updatedCodes.length }),
      });
    } catch (logError) {
      logger.warn('Failed to log backup code activity:', logError);
    }

    return { success: true };
  } catch (error: any) {
    logger.error('❌ Backup code verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Generate backup codes for 2FA recovery
 * @param count Number of codes to generate (default 8 - optimized for crypto wallets)
 * @returns Array of backup codes (not hashed)
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character hex code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    const formatted = code.match(/.{1,4}/g)!.join('-');
    codes.push(formatted);
  }

  return codes;
}

/**
 * Hash backup codes for storage
 * @param codes Array of plaintext backup codes
 * @returns Array of SHA-256 hashes
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => {
    const normalized = code.replace(/-/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  });
}

/**
 * Check if user has 2FA enabled
 * @param userId Supabase user ID
 * @returns true if 2FA is enabled
 */
export async function has2FAEnabled(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('two_factor_enabled')
      .eq('user_id', userId)
      .single();

    return profile?.two_factor_enabled === true;
  } catch (error) {
    logger.error('Failed to check 2FA status:', error);
    return false;
  }
}

