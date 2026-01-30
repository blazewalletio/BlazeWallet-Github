/**
 * Device Verification Check V2
 * Multi-layered device identification system (4 layers)
 * Much more stable and user-friendly than fingerprint-only approach
 */

import { supabase } from './supabase';
import { DeviceIdManager } from './device-id-manager';
import { getCachedOrGenerateFingerprint, generateEnhancedFingerprint } from './device-fingerprint-pro';
import { findBestDeviceMatch, calculateStringSimilarity } from './device-matcher';
import { logger } from './logger';

export interface DeviceVerificationResult {
  verified: boolean;
  userId?: string;
  deviceId?: string;
  reason?: string;
  recoveredViaSmartMatching?: boolean;
  suggestedDevice?: any;
  matchScore?: number;
}

interface TrustedDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  device_fingerprint: string;
  verified_at: string | null;
  last_used_at: string;
  session_token?: string | null;
  last_verified_session_at?: string | null;
}

export class DeviceVerificationCheckV2 {
  
  /**
   * Check if current device is verified using 4-layer approach
   */
  static async isDeviceVerified(): Promise<DeviceVerificationResult> {
    try {
      logger.log('╔═══════════════════════════════════════════════════════════════');
      logger.log('║ 🔍 DEVICE VERIFICATION V2 - 4 LAYER SYSTEM                  ║');
      logger.log('╚═══════════════════════════════════════════════════════════════');
      logger.log('🔍 [DeviceCheck V2] Starting verification...');
      logger.log('🔍 [DeviceCheck V2] Timestamp:', new Date().toISOString());
      
      // =====================================================================
      // STEP 0: GET SUPABASE USER
      // =====================================================================
      
      const userStartTime = Date.now();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const userDuration = Date.now() - userStartTime;
      
      logger.log(`🔍 [DeviceCheck V2] getUser() took ${userDuration}ms`);
      
      if (userError) {
        logger.error('❌ [DeviceCheck V2] Error getting user:', userError);
        return { verified: false, reason: 'session_error' };
      }
      
      if (!user) {
        logger.log('❌ [DeviceCheck V2] No active Supabase session');
        return { verified: false, reason: 'no_session' };
      }
      
      logger.log('✅ [DeviceCheck V2] User session found:', user.id);
      logger.log('✅ [DeviceCheck V2] User email:', user.email);
      
      // =====================================================================
      // LAYER 1: PERSISTENT DEVICE ID (Primary Check)
      // =====================================================================
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [LAYER 1] PERSISTENT DEVICE ID CHECK');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('🔍 [LAYER 1] PERSISTENT DEVICE ID CHECK');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const { deviceId, isNew } = DeviceIdManager.getOrCreateDeviceId();
      
      console.log('🔍 [Layer 1] Device ID:', deviceId.substring(0, 12) + '...', 'isNew:', isNew);
      logger.log('🔍 [Layer 1] Device ID:', deviceId.substring(0, 12) + '...', 'isNew:', isNew);
      
      if (!isNew) {
        // Device ID exists in localStorage → Check database
        console.log('✅ [Layer 1] Device ID found in localStorage:', deviceId.substring(0, 12) + '...');
        logger.log('✅ [Layer 1] Device ID found in localStorage:', deviceId.substring(0, 12) + '...');
        
        const layer1StartTime = Date.now();
        const { data: device, error: deviceError } = await supabase
          .from('trusted_devices')
          .select('*')
          .eq('user_id', user.id)
          .eq('device_id', deviceId)
          .maybeSingle();
        const layer1Duration = Date.now() - layer1StartTime;
        
        console.log(`🔍 [Layer 1] Database query took ${layer1Duration}ms`);
        console.log('🔍 [Layer 1] Query result - device found:', !!device, 'has verified_at:', !!device?.verified_at);
        
        logger.log(`🔍 [Layer 1] Database query took ${layer1Duration}ms`);
        
        if (deviceError) {
          logger.error('❌ [Layer 1] Database error:', deviceError);
        } else if (device && device.verified_at) {
          logger.log('✅ [Layer 1] Device ID MATCH! Device is trusted.');
          logger.log('✅ [Layer 1] Device name:', device.device_name);
          logger.log('✅ [Layer 1] Verified at:', device.verified_at);
          
          // Update last_used_at
          await supabase
            .from('trusted_devices')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', device.id);
          
          logger.log('✅ [Layer 1] Updated last_used_at');
          
          // ✅ LAYER 1 SUCCESS!
          logger.log('╔═══════════════════════════════════════════════════════════════');
          logger.log('║ ✅ LAYER 1 SUCCESS - DEVICE VERIFIED VIA DEVICE ID          ║');
          logger.log('╚═══════════════════════════════════════════════════════════════');
          
          // Fingerprint anomaly check (non-blocking, background)
          this.checkFingerprintAnomaly(device, user.id).catch(err => 
            logger.warn('⚠️ Fingerprint anomaly check failed:', err)
          );
          
          return {
            verified: true,
            userId: user.id,
            deviceId: device.id,
          };
        } else if (device && !device.verified_at) {
          logger.log('⚠️ [Layer 1] Device found but NOT verified yet');
        } else {
          console.log('⚠️ [Layer 1] Device ID not found in database');
          console.log('⚠️ [Layer 1] Queried for user_id:', user.id, 'device_id:', deviceId.substring(0, 12) + '...');
          
          logger.log('⚠️ [Layer 1] Device ID not found in database');
          logger.log('⚠️ [Layer 1] Possible reasons: localStorage cleared previously, or device not yet registered');
        }
      } else {
        console.log('🆕 [Layer 1] NEW device ID generated (first time on this device)');
        logger.log('🆕 [Layer 1] NEW device ID generated (first time on this device)');
      }
      
      // =====================================================================
      // LAYER 4: TRUSTED SESSION (Grace Period Check)
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('🔍 [LAYER 4] TRUSTED SESSION (GRACE PERIOD)');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const sessionToken = sessionStorage.getItem('blaze_session_token');
      if (sessionToken) {
        logger.log('✅ [Layer 4] Session token found in sessionStorage');
        
        const { data: sessionDevice } = await supabase
          .from('trusted_devices')
          .select('*')
          .eq('user_id', user.id)
          .eq('session_token', sessionToken)
          .maybeSingle();
        
        if (sessionDevice && sessionDevice.verified_at && sessionDevice.last_verified_session_at) {
          const age = Date.now() - new Date(sessionDevice.last_verified_session_at).getTime();
          const GRACE_PERIOD = 60 * 60 * 1000; // 1 hour
          const ageMinutes = Math.floor(age / 1000 / 60);
          
          if (age < GRACE_PERIOD) {
            logger.log(`✅ [Layer 4] Session valid! Verified ${ageMinutes} min ago (< 60 min grace period)`);
            
            // Restore device_id to localStorage
            if (sessionDevice.device_id) {
              DeviceIdManager.setDeviceId(sessionDevice.device_id);
              logger.log('✅ [Layer 4] Device ID restored to localStorage');
            }
            
            logger.log('╔═══════════════════════════════════════════════════════════════');
            logger.log('║ ✅ LAYER 4 SUCCESS - GRACE PERIOD ACTIVE                    ║');
            logger.log('╚═══════════════════════════════════════════════════════════════');
            
            return {
              verified: true,
              userId: user.id,
              deviceId: sessionDevice.id,
            };
          } else {
            logger.log(`⏰ [Layer 4] Session expired (age: ${ageMinutes} min > 60 min)`);
          }
        } else {
          logger.log('❌ [Layer 4] Session token invalid or device not verified');
        }
      } else {
        logger.log('ℹ️ [Layer 4] No session token in sessionStorage');
      }
      
      // =====================================================================
      // LAYER 2: FINGERPRINT (Fallback Check)
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('🔍 [LAYER 2] FINGERPRINT FALLBACK CHECK');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const fpStartTime = Date.now();
      const fpResult = await getCachedOrGenerateFingerprint();
      const fingerprint = fpResult.fingerprint;
      const fpDuration = Date.now() - fpStartTime;
      
      logger.log(`🔍 [Layer 2] Fingerprint generation took ${fpDuration}ms`);
      logger.log(`🔍 [Layer 2] Fingerprint (from ${fpResult.isFromCache ? 'cache' : 'fresh'}):`, fingerprint.substring(0, 16) + '...');
      
      // Try exact fingerprint match
      const { data: fpDevice } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();
      
      if (fpDevice && fpDevice.verified_at) {
        logger.log('✅ [Layer 2] Fingerprint EXACT match! Device trusted.');
        logger.log('✅ [Layer 2] Device name:', fpDevice.device_name);
        
        // Restore device_id to localStorage
        if (fpDevice.device_id) {
          DeviceIdManager.setDeviceId(fpDevice.device_id);
          logger.log('✅ [Layer 2] Device ID restored to localStorage');
        }
        
        logger.log('╔═══════════════════════════════════════════════════════════════');
        logger.log('║ ✅ LAYER 2 SUCCESS - DEVICE VERIFIED VIA FINGERPRINT        ║');
        logger.log('╚═══════════════════════════════════════════════════════════════');
        
        return {
          verified: true,
          userId: user.id,
          deviceId: fpDevice.id,
        };
      } else {
        logger.log('⚠️ [Layer 2] No exact fingerprint match found');
      }
      
      // =====================================================================
      // LAYER 3: SMART HEURISTIC MATCHING (Last Resort)
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('🔍 [LAYER 3] SMART HEURISTIC MATCHING');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const layer3StartTime = Date.now();
      const deviceInfo = await generateEnhancedFingerprint();
      const match = await findBestDeviceMatch(user.id, fingerprint, deviceInfo);
      const layer3Duration = Date.now() - layer3StartTime;
      
      logger.log(`🔍 [Layer 3] Smart matching took ${layer3Duration}ms`);
      
      if (match.canAutoRecover && match.device) {
        logger.log('✅ [Layer 3] HIGH CONFIDENCE match! Auto-recovering device...');
        logger.log(`✅ [Layer 3] Match score: ${match.score}/170 points (≥120 required)`);
        logger.log('✅ [Layer 3] Device name:', match.device.device_name);
        
        // Restore device_id to localStorage
        if (match.device.device_id) {
          DeviceIdManager.setDeviceId(match.device.device_id);
          logger.log('✅ [Layer 3] Device ID restored to localStorage');
        }
        
        // Update fingerprint (device evolved)
        await supabase
          .from('trusted_devices')
          .update({
            device_fingerprint: fingerprint,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', match.device.id);
        
        logger.log('✅ [Layer 3] Device fingerprint updated (device evolved)');
        
        logger.log('╔═══════════════════════════════════════════════════════════════');
        logger.log('║ ✅ LAYER 3 SUCCESS - DEVICE AUTO-RECOVERED VIA SMART MATCH  ║');
        logger.log('╚═══════════════════════════════════════════════════════════════');
        
        return {
          verified: true,
          userId: user.id,
          deviceId: match.device.id,
          recoveredViaSmartMatching: true,
        };
      }
      
      if (match.confidence === 'medium' && match.device) {
        logger.log('⚠️ [Layer 3] MEDIUM confidence match - user confirmation needed');
        logger.log(`⚠️ [Layer 3] Match score: ${match.score}/170 points (80-119 range)`);
        return {
          verified: false,
          reason: 'device_confirmation_needed',
          suggestedDevice: match.device,
          matchScore: match.score,
        };
      }
      
      logger.log('❌ [Layer 3] LOW confidence or no match (score < 80)');
      
      // =====================================================================
      // ALL LAYERS FAILED → REQUIRE VERIFICATION
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('╔═══════════════════════════════════════════════════════════════');
      logger.log('║ ❌ ALL LAYERS FAILED - DEVICE VERIFICATION REQUIRED         ║');
      logger.log('╚═══════════════════════════════════════════════════════════════');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return {
        verified: false,
        reason: 'device_not_found',
      };
      
    } catch (error: any) {
      logger.error('❌ [DeviceCheck V2] Unexpected error:', error);
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
   * Fingerprint anomaly detection (non-blocking, background)
   */
  private static async checkFingerprintAnomaly(
    device: TrustedDevice,
    userId: string
  ): Promise<void> {
    try {
      const fpResult = await getCachedOrGenerateFingerprint();
      const currentFingerprint = fpResult.fingerprint;
      
      if (device.device_fingerprint === currentFingerprint) {
        // No change
        return;
      }
      
      // Fingerprint changed - calculate similarity
      const similarity = calculateStringSimilarity(
        device.device_fingerprint,
        currentFingerprint
      );
      
      const similarityPercent = (similarity * 100).toFixed(1);
      logger.log(`🔍 [Anomaly] Fingerprint change detected (similarity: ${similarityPercent}%)`);
      
      if (similarity < 0.5) {
        // Major change (< 50% similarity) → Suspicious!
        logger.warn('🚨 [Anomaly] SUSPICIOUS: Major fingerprint change detected!');
        logger.warn(`🚨 [Anomaly] Old: ${device.device_fingerprint.substring(0, 20)}...`);
        logger.warn(`🚨 [Anomaly] New: ${currentFingerprint.substring(0, 20)}...`);
        
        // Log security event
        try {
          await supabase.rpc('log_security_event', {
            p_user_id: userId,
            p_device_id: device.id,
            p_event_type: 'fingerprint_major_change',
            p_severity: 'medium',
            p_details: {
              old_fp_preview: device.device_fingerprint.substring(0, 30),
              new_fp_preview: currentFingerprint.substring(0, 30),
              similarity: similarity,
              similarity_percent: similarityPercent,
            },
          });
          logger.log('✅ [Anomaly] Security event logged');
        } catch (logError) {
          logger.warn('⚠️ [Anomaly] Failed to log security event:', logError);
        }
      } else {
        // Minor change (browser update, settings, etc.) → Update silently
        await supabase
          .from('trusted_devices')
          .update({ device_fingerprint: currentFingerprint })
          .eq('id', device.id);
        
        logger.log(`✅ [Anomaly] Fingerprint updated (minor change, ${similarityPercent}% similarity)`);
      }
    } catch (error) {
      logger.error('❌ [Anomaly] Error in fingerprint anomaly check:', error);
    }
  }
}

// Convenience exports
export const isDeviceVerified = () => DeviceVerificationCheckV2.isDeviceVerified();
export const isSeedWallet = () => DeviceVerificationCheckV2.isSeedWallet();

