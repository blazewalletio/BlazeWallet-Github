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
import { debugLogger } from './debug-logger';

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
   * ✅ NEW: Now uses Trust Anchor (device-challenge API) as primary check
   */
  static async isDeviceVerified(): Promise<DeviceVerificationResult> {
    try {
      logger.log('╔═══════════════════════════════════════════════════════════════');
      logger.log('║ 🔍 DEVICE VERIFICATION V2 - TRUST ANCHOR SYSTEM             ║');
      logger.log('╚═══════════════════════════════════════════════════════════════');
      logger.log('🔍 [DeviceCheck V2] Starting verification...');
      logger.log('🔍 [DeviceCheck V2] Timestamp:', new Date().toISOString());
      
      // 🔧 DEBUG: Start verification
      debugLogger.info('device_verification', '🚀 DEVICE VERIFICATION STARTED', {
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      });
      
      // =====================================================================
      // STEP 0: GET SUPABASE USER
      // =====================================================================
      
      const userStartTime = Date.now();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const userDuration = Date.now() - userStartTime;
      
      logger.log(`🔍 [DeviceCheck V2] getUser() took ${userDuration}ms`);
      
      // 🔧 DEBUG: User session check
      debugLogger.info('auth', `🔍 Supabase session check (${userDuration}ms)`, {
        hasUser: !!user,
        hasError: !!userError,
        userId: user?.id,
        email: user?.email,
        errorMessage: userError?.message,
      });
      
      if (userError) {
        logger.error('❌ [DeviceCheck V2] Error getting user:', userError);
        debugLogger.error('auth', '❌ Failed to get Supabase user', { error: userError });
        return { verified: false, reason: 'session_error' };
      }
      
      if (!user) {
        logger.log('❌ [DeviceCheck V2] No active Supabase session');
        debugLogger.warn('auth', '❌ No active Supabase session', {});
        return { verified: false, reason: 'no_session' };
      }
      
      logger.log('✅ [DeviceCheck V2] User session found:', user.id);
      logger.log('✅ [DeviceCheck V2] User email:', user.email);
      
      // Set user ID in debug logger
      debugLogger.setUserId(user.id);
      
      // =====================================================================
      // ✅ NEW: TRUST ANCHOR - USE DEVICE CHALLENGE API
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('🎯 [TRUST ANCHOR] DEVICE CHALLENGE API CHECK');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      debugLogger.info('device_verification', '🎯 [TRUST ANCHOR] Calling device-challenge API', {});
      
      try {
        // Get device ID (may be null if localStorage cleared)
        const { deviceId, isNew } = DeviceIdManager.getOrCreateDeviceId();
        
        // Generate fingerprint
        const fpResult = await getCachedOrGenerateFingerprint();
        const fingerprint = fpResult.fingerprint;
        
        // Generate device info
        const deviceInfo = await generateEnhancedFingerprint();
        
        // Call device-challenge API
        const csrfResponse = await fetch('/api/csrf-token');
        const { token: csrfToken } = await csrfResponse.json();
        
        const challengeResponse = await fetch('/api/device-challenge', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({
            userId: user.id,
            challenge: {
              deviceId: isNew ? null : deviceId,
              fingerprint,
              ipAddress: deviceInfo.ipAddress,
              timezone: deviceInfo.timezone,
              browser: deviceInfo.browser,
              browserVersion: deviceInfo.browserVersion,
              os: deviceInfo.os,
              osVersion: deviceInfo.osVersion,
              screenResolution: deviceInfo.screenResolution,
              language: deviceInfo.language,
            },
          }),
        });
        
        const challengeResult = await challengeResponse.json();
        
        logger.log('✅ [TRUST ANCHOR] Device challenge result:', challengeResult);
        debugLogger.info('device_verification', `[TRUST ANCHOR] Score: ${challengeResult.score}`, {
          confidence: challengeResult.confidence,
          score: challengeResult.score,
          trusted: challengeResult.trusted,
        });
        
        // HIGH CONFIDENCE (score ≥ 60) - AUTO-VERIFY
        if (challengeResult.trusted) {
          logger.log('✅ [TRUST ANCHOR] HIGH CONFIDENCE → AUTO-VERIFIED');
          
          // Restore device_id to localStorage (if it was cleared)
          if (challengeResult.deviceId && isNew) {
            DeviceIdManager.setDeviceId(challengeResult.deviceId);
            logger.log('✅ [TRUST ANCHOR] Device ID restored to localStorage');
          }
          
          // Store session token
          if (challengeResult.sessionToken) {
            sessionStorage.setItem('blaze_session_token', challengeResult.sessionToken);
            logger.log('✅ [TRUST ANCHOR] Session token stored');
          }
          
          logger.log('╔═══════════════════════════════════════════════════════════════');
          logger.log('║ ✅ TRUST ANCHOR SUCCESS - DEVICE AUTO-VERIFIED              ║');
          logger.log('╚═══════════════════════════════════════════════════════════════');
          
          return {
            verified: true,
            userId: user.id,
            deviceId: challengeResult.deviceId,
          };
        }
        
        // MEDIUM CONFIDENCE (score 40-59) - USER CONFIRMATION NEEDED
        if (challengeResult.requiresConfirmation) {
          logger.log('⚠️ [TRUST ANCHOR] MEDIUM CONFIDENCE → USER CONFIRMATION NEEDED');
          return {
            verified: false,
            reason: 'device_confirmation_needed',
            suggestedDevice: challengeResult.suggestedDevice,
            matchScore: challengeResult.score,
          };
        }
        
        // LOW CONFIDENCE (score < 40) - EMAIL VERIFICATION REQUIRED
        logger.log('❌ [TRUST ANCHOR] LOW CONFIDENCE → EMAIL VERIFICATION REQUIRED');
        return {
          verified: false,
          reason: 'device_not_found',
        };
        
      } catch (trustAnchorError) {
        logger.error('❌ [TRUST ANCHOR] Error:', trustAnchorError);
        debugLogger.error('device_verification', '❌ Trust Anchor failed, falling back to legacy', { error: trustAnchorError });
        
        // Fall through to legacy 4-layer system (backup)
      }
      
      // =====================================================================
      // LEGACY FALLBACK: 4-LAYER SYSTEM (if Trust Anchor fails)
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('⚠️ [LEGACY FALLBACK] Using 4-layer system');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // =====================================================================
      // LAYER 1: PERSISTENT DEVICE ID (Primary Check)
      // =====================================================================
      
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.log('🔍 [LAYER 1] PERSISTENT DEVICE ID CHECK');
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 🔧 DEBUG: Layer 1 start
      debugLogger.info('device_verification', '🔍 [LAYER 1] PERSISTENT DEVICE ID CHECK', {});
      
      const { deviceId, isNew } = DeviceIdManager.getOrCreateDeviceId();
      
      logger.log('🔍 [Layer 1] Device ID:', deviceId.substring(0, 12) + '...', 'isNew:', isNew);
      
      // 🔧 DEBUG: Device ID result
      debugLogger.info('device_verification', `[LAYER 1] Device ID: ${isNew ? '🆕 NEW' : '✅ EXISTING'}`, {
        deviceId: deviceId.substring(0, 12) + '...',
        deviceIdFull: deviceId,
        isNew,
        storageKey: 'blaze_device_id',
      });
      
      if (!isNew) {
        // Device ID exists in localStorage → Check database
        logger.log('✅ [Layer 1] Device ID found in localStorage:', deviceId.substring(0, 12) + '...');
        
        // 🔧 DEBUG: Querying database
        debugLogger.info('database', '[LAYER 1] Querying trusted_devices table', {
          userId: user.id,
          deviceId: deviceId.substring(0, 12) + '...',
          query: 'SELECT * FROM trusted_devices WHERE user_id = ? AND device_id = ?',
        });
        
        const layer1StartTime = Date.now();
        const { data: device, error: deviceError } = await supabase
          .from('trusted_devices')
          .select('*')
          .eq('user_id', user.id)
          .eq('device_id', deviceId)
          .maybeSingle();
        const layer1Duration = Date.now() - layer1StartTime;
        
        logger.log(`🔍 [Layer 1] Database query took ${layer1Duration}ms`);
        
        // 🔧 DEBUG: Database query result
        debugLogger.info('database', `[LAYER 1] Database query completed (${layer1Duration}ms)`, {
          hasDevice: !!device,
          hasError: !!deviceError,
          deviceName: (device as any)?.device_name,
          verifiedAt: (device as any)?.verified_at,
          lastUsedAt: (device as any)?.last_used_at,
          errorMessage: deviceError?.message,
        });
        
        if (deviceError) {
          logger.error('❌ [Layer 1] Database error:', deviceError);
          debugLogger.error('database', '[LAYER 1] Database error', { error: deviceError });
        } else if (device && (device as any).verified_at) {
          logger.log('✅ [Layer 1] Device ID MATCH! Device is trusted.');
          logger.log('✅ [Layer 1] Device name:', (device as any).device_name);
          logger.log('✅ [Layer 1] Verified at:', (device as any).verified_at);
          
          // 🔧 DEBUG: SUCCESS!
          debugLogger.info('device_verification', '✅ [LAYER 1] SUCCESS - DEVICE VERIFIED!', {
            deviceId: (device as any).id,
            deviceName: (device as any).device_name,
            verifiedAt: (device as any).verified_at,
            lastUsedAt: (device as any).last_used_at,
            result: 'VERIFIED',
          });
          
          // Update last_used_at
          await (supabase as any)
            .from('trusted_devices')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', (device as any).id);
          
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
            deviceId: (device as any).id,
          };
        } else if (device && !(device as any).verified_at) {
          logger.log('⚠️ [Layer 1] Device found but NOT verified yet');
          debugLogger.warn('device_verification', '[LAYER 1] Device found but NOT verified', {
            deviceId: (device as any).id,
            verifiedAt: (device as any).verified_at,
          });
        } else {
          logger.log('⚠️ [Layer 1] Device ID not found in database');
          logger.log('⚠️ [Layer 1] Possible reasons: localStorage cleared previously, or device not yet registered');
          debugLogger.warn('device_verification', '[LAYER 1] Device NOT found in database', {
            deviceId: deviceId.substring(0, 12) + '...',
            userId: user.id,
            reason: 'No matching device in database',
          });
        }
      } else {
        logger.log('🆕 [Layer 1] NEW device ID generated (first time on this device)');
        debugLogger.info('device_verification', '[LAYER 1] NEW device ID - skipping database check', {
          deviceId: deviceId.substring(0, 12) + '...',
        });
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
        
        if (sessionDevice && (sessionDevice as any).verified_at && (sessionDevice as any).last_verified_session_at) {
          const age = Date.now() - new Date((sessionDevice as any).last_verified_session_at).getTime();
          const GRACE_PERIOD = 60 * 60 * 1000; // 1 hour
          const ageMinutes = Math.floor(age / 1000 / 60);
          
          if (age < GRACE_PERIOD) {
            logger.log(`✅ [Layer 4] Session valid! Verified ${ageMinutes} min ago (< 60 min grace period)`);
            
            // Restore device_id to localStorage
            if ((sessionDevice as any).device_id) {
              DeviceIdManager.setDeviceId((sessionDevice as any).device_id);
              logger.log('✅ [Layer 4] Device ID restored to localStorage');
            }
            
            logger.log('╔═══════════════════════════════════════════════════════════════');
            logger.log('║ ✅ LAYER 4 SUCCESS - GRACE PERIOD ACTIVE                    ║');
            logger.log('╚═══════════════════════════════════════════════════════════════');
            
            return {
              verified: true,
              userId: user.id,
              deviceId: (sessionDevice as any).id,
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
      
      if (fpDevice && (fpDevice as any).verified_at) {
        logger.log('✅ [Layer 2] Fingerprint EXACT match! Device trusted.');
        logger.log('✅ [Layer 2] Device name:', (fpDevice as any).device_name);
        
        // Restore device_id to localStorage
        if ((fpDevice as any).device_id) {
          DeviceIdManager.setDeviceId((fpDevice as any).device_id);
          logger.log('✅ [Layer 2] Device ID restored to localStorage');
        }
        
        logger.log('╔═══════════════════════════════════════════════════════════════');
        logger.log('║ ✅ LAYER 2 SUCCESS - DEVICE VERIFIED VIA FINGERPRINT        ║');
        logger.log('╚═══════════════════════════════════════════════════════════════');
        
        return {
          verified: true,
          userId: user.id,
          deviceId: (fpDevice as any).id,
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
        logger.log('✅ [Layer 3] Device name:', (match.device as any)?.device_name);
        
        // Restore device_id to localStorage
        if (match.device.device_id) {
          DeviceIdManager.setDeviceId(match.device.device_id);
          logger.log('✅ [Layer 3] Device ID restored to localStorage');
        }
        
        // Update fingerprint (device evolved)
        await (supabase as any)
          .from('trusted_devices')
          .update({
            device_fingerprint: fingerprint,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', (match.device as any).id);
        
        logger.log('✅ [Layer 3] Device fingerprint updated (device evolved)');
        
        logger.log('╔═══════════════════════════════════════════════════════════════');
        logger.log('║ ✅ LAYER 3 SUCCESS - DEVICE AUTO-RECOVERED VIA SMART MATCH  ║');
        logger.log('╚═══════════════════════════════════════════════════════════════');
        
        return {
          verified: true,
          userId: user.id,
          deviceId: (match.device as any).id,
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
      
      // 🔧 DEBUG: ALL LAYERS FAILED
      debugLogger.error('device_verification', '❌ ALL LAYERS FAILED - VERIFICATION REQUIRED', {
        layer1: 'FAILED',
        layer2: 'FAILED',
        layer3: 'FAILED',
        layer4: 'FAILED',
        result: 'NOT_VERIFIED',
        action: 'EMAIL_VERIFICATION_REQUIRED',
      });
      
      return {
        verified: false,
        reason: 'device_not_found',
      };
      
    } catch (error: any) {
      logger.error('❌ [DeviceCheck V2] Unexpected error:', error);
      
      // 🔧 DEBUG: Unexpected error
      debugLogger.error('device_verification', '❌ UNEXPECTED ERROR in device verification', {
        error: error.message,
        stack: error.stack,
      });
      
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
      
      if ((device as any).device_fingerprint === currentFingerprint) {
        // No change
        return;
      }
      
      // Fingerprint changed - calculate similarity
      const similarity = calculateStringSimilarity(
        (device as any).device_fingerprint,
        currentFingerprint
      );
      
      const similarityPercent = (similarity * 100).toFixed(1);
      logger.log(`🔍 [Anomaly] Fingerprint change detected (similarity: ${similarityPercent}%)`);
      
      if (similarity < 0.5) {
        // Major change (< 50% similarity) → Suspicious!
        logger.warn('🚨 [Anomaly] SUSPICIOUS: Major fingerprint change detected!');
        logger.warn(`🚨 [Anomaly] Old: ${(device as any).device_fingerprint.substring(0, 20)}...`);
        logger.warn(`🚨 [Anomaly] New: ${currentFingerprint.substring(0, 20)}...`);
        
        // Log security event
        try {
          await (supabase as any).rpc('log_security_event', {
            p_user_id: userId,
            p_device_id: (device as any).id,
            p_event_type: 'fingerprint_major_change',
            p_severity: 'medium',
            p_details: {
              old_fp_preview: (device as any).device_fingerprint.substring(0, 30),
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
        await (supabase as any)
          .from('trusted_devices')
          .update({ device_fingerprint: currentFingerprint })
          .eq('id', (device as any).id);
        
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

