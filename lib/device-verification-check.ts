/**
 * Device Verification Check Service
 * Checks if current device is already verified in Supabase database
 * No localStorage circus - database is source of truth
 */

import { supabase } from './supabase';
import { generateEnhancedFingerprint } from './device-fingerprint-pro';
import { logger } from './logger';

interface DeviceVerificationResult {
  verified: boolean;
  userId?: string;
  deviceId?: string;
  reason?: string;
}

// Cache fingerprint for 5 minutes to avoid regenerating constantly
let cachedFingerprint: string | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class DeviceVerificationCheck {
  
  /**
   * Check if current device is already verified for this user
   * Returns: { verified: boolean, userId?: string, deviceId?: string, reason?: string }
   */
  static async isDeviceVerified(): Promise<DeviceVerificationResult> {
    try {
      logger.log('🔍 [DeviceCheck] Starting device verification check...');
      
      // 1. Get current user from Supabase session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        logger.error('❌ [DeviceCheck] Error getting user:', userError);
        return { verified: false, reason: 'session_error' };
      }
      
      if (!user) {
        logger.log('❌ [DeviceCheck] No active Supabase session');
        return { verified: false, reason: 'no_session' };
      }
      
      logger.log('✅ [DeviceCheck] User session found:', user.id);
      
      // 2. Generate or use cached device fingerprint
      const fingerprint = await this.getCachedFingerprint();
      
      logger.log('🔍 [DeviceCheck] Device fingerprint:', fingerprint.substring(0, 16) + '...');
      
      // 3. Check if this device is verified in database
      const { data: device, error: deviceError } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();
      
      if (deviceError) {
        logger.error('❌ [DeviceCheck] Database error:', deviceError);
        return { verified: false, reason: 'database_error' };
      }
      
      if (!device) {
        logger.log('❌ [DeviceCheck] Device not found in database');
        return { verified: false, reason: 'device_not_found' };
      }
      
      logger.log('✅ [DeviceCheck] Device found in database:', device.id);
      
      // 4. Check if device has been verified (has verified_at timestamp)
      if (!device.verified_at) {
        logger.log('❌ [DeviceCheck] Device exists but not verified yet');
        return { verified: false, reason: 'device_not_verified' };
      }
      
      logger.log('✅ [DeviceCheck] Device is VERIFIED!');
      logger.log('✅ [DeviceCheck] Verified at:', device.verified_at);
      
      // 5. Update last_used_at timestamp
      try {
        await supabase
          .from('trusted_devices')
          .update({ 
            last_used_at: new Date().toISOString(),
            is_current: true 
          })
          .eq('id', device.id);
        
        logger.log('✅ [DeviceCheck] Updated last_used_at');
      } catch (updateError) {
        // Non-critical - log but continue
        logger.warn('⚠️ [DeviceCheck] Failed to update last_used_at:', updateError);
      }
      
      return {
        verified: true,
        userId: user.id,
        deviceId: device.id,
      };
      
    } catch (error: any) {
      logger.error('❌ [DeviceCheck] Unexpected error:', error);
      return { verified: false, reason: 'unexpected_error' };
    }
  }
  
  /**
   * Check if this is a seed wallet (no email, no device verification needed)
   */
  static isSeedWallet(): boolean {
    if (typeof window === 'undefined') return false;
    
    const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';
    return !createdWithEmail;
  }
  
  /**
   * Get cached fingerprint or generate new one
   * Caches for 5 minutes to avoid constant regeneration
   */
  private static async getCachedFingerprint(): Promise<string> {
    const now = Date.now();
    
    // Return cached fingerprint if still valid
    if (cachedFingerprint && (now - cacheTime) < CACHE_DURATION) {
      logger.log('✅ [DeviceCheck] Using cached fingerprint');
      return cachedFingerprint;
    }
    
    // Generate new fingerprint
    logger.log('🔄 [DeviceCheck] Generating new fingerprint...');
    const deviceInfo = await generateEnhancedFingerprint();
    
    // Cache it
    cachedFingerprint = deviceInfo.fingerprint;
    cacheTime = now;
    
    return deviceInfo.fingerprint;
  }
  
  /**
   * Clear cached fingerprint (useful for testing)
   */
  static clearCache(): void {
    cachedFingerprint = null;
    cacheTime = 0;
    logger.log('🗑️ [DeviceCheck] Cache cleared');
  }
  
  /**
   * Get detailed device verification status (for debugging)
   */
  static async getDeviceStatus(): Promise<{
    hasSession: boolean;
    userId?: string;
    fingerprint?: string;
    deviceFound?: boolean;
    deviceVerified?: boolean;
    verifiedAt?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const hasSession = !!user;
      
      if (!user) {
        return { hasSession: false };
      }
      
      const fingerprint = await this.getCachedFingerprint();
      
      const { data: device } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();
      
      return {
        hasSession: true,
        userId: user.id,
        fingerprint: fingerprint.substring(0, 16) + '...',
        deviceFound: !!device,
        deviceVerified: !!device?.verified_at,
        verifiedAt: device?.verified_at,
      };
    } catch (error) {
      logger.error('Error getting device status:', error);
      return { hasSession: false };
    }
  }
}

// Export convenience function
export const isDeviceVerified = () => DeviceVerificationCheck.isDeviceVerified();
export const isSeedWallet = () => DeviceVerificationCheck.isSeedWallet();
export const getDeviceStatus = () => DeviceVerificationCheck.getDeviceStatus();

