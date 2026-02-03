/**
 * 🔐 2FA SESSION SERVICE
 * "SESSION SHIELD" Implementation
 * 
 * Strategy:
 * - 2FA required at login
 * - After 2FA: 30-minute secure session
 * - Within session: most actions don't need 2FA
 * - After 30 min: 2FA required again
 * - Critical actions: ALWAYS require 2FA
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface Session2FAStatus {
  required: boolean; // Does user need to verify 2FA now?
  sessionToken?: string; // Current session token (if valid)
  expiresAt?: Date; // When session expires
  secondsRemaining?: number; // Seconds until expiry
  isNearExpiry?: boolean; // Less than 5 minutes remaining?
}

export interface CriticalActionConfig {
  action: 'send' | 'swap' | 'wallet_export' | '2fa_disable' | 'password_change';
  amountUSD?: number; // For send/swap - check if > threshold
}

// Threshold for "large amount" that always requires 2FA
const LARGE_AMOUNT_THRESHOLD_USD = 1000;

// Critical actions that ALWAYS require 2FA (regardless of session)
const ALWAYS_REQUIRE_2FA_ACTIONS = [
  'wallet_export',
  '2fa_disable',
  'password_change',
];

class TwoFactorSessionService {
  /**
   * Create new 2FA session after successful verification
   * Called after: Login 2FA, or sensitive action 2FA
   */
  async createSession(
    userId: string,
    deviceFingerprint?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; sessionToken?: string; expiresAt?: Date; error?: string }> {
    try {
      logger.log('🔐 Creating new 2FA session for user:', userId.substring(0, 8));

      const { data, error } = await supabase.rpc('create_2fa_session', {
        p_user_id: userId,
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      });

      if (error) throw error;

      const sessionToken = data as string;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      logger.log('✅ 2FA session created, expires at:', expiresAt.toLocaleTimeString());

      // Store in localStorage for client-side checks
      if (typeof window !== 'undefined') {
        localStorage.setItem('2fa_session_token', sessionToken);
        localStorage.setItem('2fa_session_expires', expiresAt.toISOString());
      }

      return {
        success: true,
        sessionToken,
        expiresAt,
      };
    } catch (error: any) {
      logger.error('❌ Failed to create 2FA session:', error);
      return {
        success: false,
        error: error.message || 'Failed to create session',
      };
    }
  }

  /**
   * Check if 2FA is required for current user
   * Returns session status
   */
  async checkSession(userId: string): Promise<Session2FAStatus> {
    try {
      // Quick check: Does user have 2FA enabled?
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('two_factor_enabled')
        .eq('user_id', userId)
        .single();

      if (!profile?.two_factor_enabled) {
        // 2FA not enabled for this user - no session needed
        return { required: false };
      }

      // Get session token from localStorage
      const sessionToken = typeof window !== 'undefined' 
        ? localStorage.getItem('2fa_session_token') 
        : null;

      if (!sessionToken) {
        // No session token - 2FA required
        logger.log('⚠️ No 2FA session token found - verification required');
        return { required: true };
      }

      // Check session in database
      const { data, error } = await supabase.rpc('check_2fa_session', {
        p_user_id: userId,
        p_session_token: sessionToken,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (!result || !result.is_valid) {
        // Invalid/expired session - 2FA required
        logger.log('⚠️ 2FA session invalid or expired - verification required');
        this.clearSessionFromStorage();
        return { required: true };
      }

      // Valid session!
      const expiresAt = new Date(result.expires_at);
      const secondsRemaining = result.seconds_remaining;
      const isNearExpiry = secondsRemaining < 300; // Less than 5 minutes

      if (isNearExpiry) {
        logger.log('⚠️ 2FA session expiring soon:', Math.floor(secondsRemaining / 60), 'minutes');
      }

      return {
        required: false,
        sessionToken,
        expiresAt,
        secondsRemaining,
        isNearExpiry,
      };
    } catch (error: any) {
      logger.error('❌ Failed to check 2FA session:', error);
      // On error, require 2FA to be safe
      return { required: true };
    }
  }

  /**
   * Check if 2FA is required for a specific action
   * Some actions ALWAYS require 2FA (critical actions or large amounts)
   */
  async checkActionRequires2FA(
    userId: string,
    config: CriticalActionConfig
  ): Promise<Session2FAStatus> {
    // Check if this is a critical action that ALWAYS requires 2FA
    if (ALWAYS_REQUIRE_2FA_ACTIONS.includes(config.action)) {
      logger.log('🔒 Critical action detected - 2FA REQUIRED:', config.action);
      return { required: true };
    }

    // Check if amount is above threshold (for send/swap)
    if (config.amountUSD && config.amountUSD > LARGE_AMOUNT_THRESHOLD_USD) {
      logger.log('🔒 Large amount detected ($', config.amountUSD, ') - 2FA REQUIRED');
      return { required: true };
    }

    // For regular actions, check normal session
    return await this.checkSession(userId);
  }

  /**
   * Extend current session by 30 more minutes
   * Called when user performs an action and wants to stay logged in
   */
  async extendSession(userId: string): Promise<{ success: boolean; expiresAt?: Date; error?: string }> {
    try {
      const sessionToken = typeof window !== 'undefined' 
        ? localStorage.getItem('2fa_session_token') 
        : null;

      if (!sessionToken) {
        return { success: false, error: 'No active session' };
      }

      logger.log('🔄 Extending 2FA session...');

      const { data, error } = await supabase.rpc('extend_2fa_session', {
        p_user_id: userId,
        p_session_token: sessionToken,
      });

      if (error) throw error;

      if (!data) {
        return { success: false, error: 'Session not found or expired' };
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Update localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('2fa_session_expires', expiresAt.toISOString());
      }

      logger.log('✅ 2FA session extended to:', expiresAt.toLocaleTimeString());

      return { success: true, expiresAt };
    } catch (error: any) {
      logger.error('❌ Failed to extend 2FA session:', error);
      return { success: false, error: error.message || 'Failed to extend session' };
    }
  }

  /**
   * Revoke current 2FA session (logout, security)
   * Forces user to verify 2FA again on next sensitive action
   */
  async revokeSession(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sessionToken = typeof window !== 'undefined' 
        ? localStorage.getItem('2fa_session_token') 
        : null;

      logger.log('🔒 Revoking 2FA session...');

      const { error } = await supabase.rpc('revoke_2fa_session', {
        p_user_id: userId,
        p_session_token: sessionToken,
      });

      if (error) throw error;

      this.clearSessionFromStorage();

      logger.log('✅ 2FA session revoked');

      return { success: true };
    } catch (error: any) {
      logger.error('❌ Failed to revoke 2FA session:', error);
      return { success: false, error: error.message || 'Failed to revoke session' };
    }
  }

  /**
   * Clear session data from localStorage
   */
  private clearSessionFromStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('2fa_session_token');
      localStorage.removeItem('2fa_session_expires');
    }
  }

  /**
   * Get session expiry warning message
   */
  getExpiryWarningMessage(secondsRemaining: number): string {
    const minutesRemaining = Math.floor(secondsRemaining / 60);
    
    if (minutesRemaining === 0) {
      return 'Secure session expires in less than 1 minute';
    } else if (minutesRemaining === 1) {
      return 'Secure session expires in 1 minute';
    } else {
      return `Secure session expires in ${minutesRemaining} minutes`;
    }
  }
}

export const twoFactorSessionService = new TwoFactorSessionService();

