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
      logger.log('🔍 [DeviceCheck] ═══════════════════════════════════════');
      logger.log('🔍 [DeviceCheck] Starting device verification check...');
      logger.log('🔍 [DeviceCheck] Timestamp:', new Date().toISOString());
      
      // 1. Get current user from Supabase session
      const userStartTime = Date.now();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const userDuration = Date.now() - userStartTime;
      
      logger.log(`🔍 [DeviceCheck] getUser() took ${userDuration}ms`);
      
      if (userError) {
        logger.error('❌ [DeviceCheck] Error getting user:', userError);
        return { verified: false, reason: 'session_error' };
      }
      
      if (!user) {
        logger.log('❌ [DeviceCheck] No active Supabase session');
        return { verified: false, reason: 'no_session' };
      }
      
      logger.log('✅ [DeviceCheck] User session found:', user.id);
      logger.log('✅ [DeviceCheck] User email:', user.email);
      
      // 2. Generate or use cached device fingerprint
      const fpStartTime = Date.now();
      const fingerprint = await this.getCachedFingerprint();
      const fpDuration = Date.now() - fpStartTime;
      
      logger.log(`🔍 [DeviceCheck] Fingerprint generation took ${fpDuration}ms`);
      logger.log('🔍 [DeviceCheck] Device fingerprint:', fingerprint.substring(0, 16) + '...');
      logger.log('🔍 [DeviceCheck] Full fingerprint:', fingerprint);
      
      // 3. Check if this device is verified in database
      const dbStartTime = Date.now();
      const { data: device, error: deviceError } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();
      const dbDuration = Date.now() - dbStartTime;
      
      logger.log(`🔍 [DeviceCheck] Database query took ${dbDuration}ms`);
      
      if (deviceError) {
        logger.error('❌ [DeviceCheck] Database error:', deviceError);
        logger.error('❌ [DeviceCheck] Error code:', deviceError.code);
        logger.error('❌ [DeviceCheck] Error message:', deviceError.message);
        return { verified: false, reason: 'database_error' };
      }
      
      if (!device) {
        logger.log('❌ [DeviceCheck] Device not found in database');
        logger.log('❌ [DeviceCheck] Searched for user_id:', user.id);
        logger.log('❌ [DeviceCheck] Searched for fingerprint:', fingerprint);
        
        // 🔍 DEBUG: Query ALL devices for this user to see what's in DB
        const { data: allDevices } = await supabase
          .from('trusted_devices')
          .select('id, device_fingerprint, verified_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        logger.log('🔍 [DeviceCheck] Total devices in DB for this user:', allDevices?.length || 0);
        if (allDevices && allDevices.length > 0) {
          logger.log('🔍 [DeviceCheck] Recent devices:');
          allDevices.forEach((d, i) => {
            logger.log(`  Device ${i + 1}:`, {
              id: (d as any).id,
              fingerprint_preview: (d as any).device_fingerprint?.substring(0, 20) + '...',
              verified: !!(d as any).verified_at,
              created: (d as any).created_at,
            });
            
            // Compare fingerprints character by character
            if ((d as any).device_fingerprint && fingerprint) {
              let matches = 0;
              const minLen = Math.min((d as any).device_fingerprint.length, fingerprint.length);
              for (let j = 0; j < minLen; j++) {
                if ((d as any).device_fingerprint[j] === fingerprint[j]) matches++;
              }
              const matchPercentage = (matches / minLen * 100).toFixed(1);
              logger.log(`    → Fingerprint match: ${matchPercentage}% (${matches}/${minLen} chars)`);
            }
          });
        }
        
        return { verified: false, reason: 'device_not_found' };
      }
      
      logger.log('✅ [DeviceCheck] Device found in database:', (device as any).id);
      logger.log('✅ [DeviceCheck] Device name:', (device as any).device_name);
      logger.log('✅ [DeviceCheck] Device created:', (device as any).created_at);
      logger.log('✅ [DeviceCheck] Device last used:', (device as any).last_used_at);
      
      // 4. Check if device has been verified (has verified_at timestamp)
      if (!(device as any).verified_at) {
        logger.log('❌ [DeviceCheck] Device exists but not verified yet');
        logger.log('❌ [DeviceCheck] verification_expires_at:', (device as any).verification_expires_at);
        return { verified: false, reason: 'device_not_verified' };
      }
      
      logger.log('✅ [DeviceCheck] Device is VERIFIED!');
      logger.log('✅ [DeviceCheck] Verified at:', (device as any).verified_at);
      logger.log('✅ [DeviceCheck] Time since verification:', 
        Math.round((Date.now() - new Date((device as any).verified_at).getTime()) / 1000 / 60), 'minutes ago');
      logger.log('🔍 [DeviceCheck] ═══════════════════════════════════════');
      
      // 5. Update last_used_at timestamp
      try {
        await (supabase as any)
          .from('trusted_devices')
          .update({ 
            last_used_at: new Date().toISOString(),
            is_current: true 
          })
          .eq('id', (device as any).id);
        
        logger.log('✅ [DeviceCheck] Updated last_used_at');
      } catch (updateError) {
        // Non-critical - log but continue
        logger.warn('⚠️ [DeviceCheck] Failed to update last_used_at:', updateError);
      }
      
      return {
        verified: true,
        userId: user.id,
        deviceId: (device as any).id,
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
        deviceVerified: !!(device as any)?.verified_at,
        verifiedAt: (device as any)?.verified_at,
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

