/**
 * Strict Authentication with Device Verification (Fort Knox)
 * Blocks login for unverified devices
 * V2: Fixed localhost testing + improved logging
 */

import { supabase } from './supabase';
import { generateEnhancedFingerprint, EnhancedDeviceInfo } from './device-fingerprint-pro';
import { logger } from './logger';
import { persistEmailIdentity } from './account-identity';

// =============================================================================
// ENCRYPTION UTILITIES
// =============================================================================

/**
 * Encrypt wallet mnemonic with user's password
 * Uses AES-256-GCM for encryption
 */
async function encryptMnemonic(mnemonic: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Derive key from password using PBKDF2
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Salt for key derivation
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive AES key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // IV for encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(mnemonic)
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

// Helper to decrypt mnemonic - supports BOTH old (WebCrypto) and new (crypto-utils) formats
async function decryptMnemonic(encryptedData: string, password: string): Promise<string> {
  try {
    // Try to parse as JSON (new format with {encryptedData, salt, iv})
    const encryptedWallet = JSON.parse(encryptedData);
    const { decryptWallet } = await import('./crypto-utils');
    return decryptWallet(encryptedWallet, password);
  } catch (jsonError) {
    // Not JSON - must be old format (plain base64 WebCrypto)
    // Use the same decryption as supabase-auth.ts
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // Decode base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);
      
      // Derive key from password
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encrypted
      );
      
      const mnemonic = decoder.decode(decrypted);
      
      if (!mnemonic) {
        throw new Error('Decryption resulted in empty mnemonic');
      }
      
      logger.log('✅ Decrypted using legacy WebCrypto format');
      return mnemonic;
    } catch (decryptError) {
      logger.error('Failed to decrypt mnemonic:', decryptError);
    throw new Error('Failed to decrypt wallet');
    }
  }
}

export interface StrictSignInResult {
  success: boolean;
  error?: string;
  requiresDeviceVerification?: boolean;
  suggestedDevice?: any; // ✅ NEW: Suggested device for confirmation modal
  matchScore?: number; // ✅ NEW: Match score for display
  requires2FA?: boolean;
  deviceVerificationToken?: string;
  deviceInfo?: EnhancedDeviceInfo;
  user?: any;
  mnemonic?: string;
  userId?: string; // User ID before sign out (needed for device verification)
}

/**
 * Strict sign-in with mandatory device verification for new devices
 */
export async function strictSignInWithEmail(
  email: string,
  password: string
): Promise<StrictSignInResult> {
  try {
    logger.log('🔐 [StrictAuth] Starting strict sign-in for:', email);
    
    // 1. Basic authentication with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      logger.error('❌ [StrictAuth] Auth failed:', error.message);
      throw error;
    }
    
    if (!data.user) {
      throw new Error('No user returned from authentication');
    }
    
    logger.log('✅ [StrictAuth] Basic auth successful for user:', data.user.id);
    
    // 2. Get or create persistent device ID (PRIMARY identifier)
    logger.log('📱 [StrictAuth] Getting device ID...');
    const { DeviceIdManager } = await import('./device-id-manager');
    const { deviceId, isNew: isNewDeviceId } = DeviceIdManager.getOrCreateDeviceId();
    
    logger.log(`✅ [StrictAuth] Device ID: ${deviceId.substring(0, 12)}... (${isNewDeviceId ? 'NEW' : 'EXISTING'})`);
    
    // 3. Generate enhanced device fingerprint (for metadata/risk analysis)
    logger.log('📱 [StrictAuth] Generating device fingerprint...');
    const deviceInfo = await generateEnhancedFingerprint();
    
    logger.log('✅ [StrictAuth] Fingerprint generated:', {
      fingerprint: deviceInfo.fingerprint?.substring(0, 8) + '...',
      device: deviceInfo.deviceName,
      location: deviceInfo.location ? `${deviceInfo.location.city}, ${deviceInfo.location.country}` : 'Unknown',
      riskScore: deviceInfo.riskScore,
    });
    
    // 4. Check risk score - block high-risk logins immediately
    if (deviceInfo.riskScore >= 70) {
      logger.warn('🚨 [StrictAuth] HIGH RISK login blocked! Score:', deviceInfo.riskScore);
      
      // Send security alert email
      try {
        await fetch('/api/security-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            email: data.user.email,
            deviceInfo,
            alertType: 'suspicious_login_blocked',
          }),
        });
      } catch (emailError) {
        logger.error('Failed to send security alert:', emailError);
      }
      
      // Sign out immediately
      await supabase.auth.signOut();
      
      return {
        success: false,
        error: `Suspicious activity detected (Risk: ${deviceInfo.riskScore}/100). We've sent a security alert to your email. If this was you, please contact support.`,
      };
    }
    
    // 5. ✅ NEW: USE DEVICE CHALLENGE API (Trust Anchor System)
    // Server-side scoring with auto-recovery, 1-click confirm, or email verification
    logger.log('🎯 [StrictAuth] Calling device-challenge API...');
    
    try {
      // Get CSRF token for device-challenge request
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const challengeResponse = await fetch('/api/device-challenge', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          userId: data.user.id,
          challenge: {
            deviceId: isNewDeviceId ? null : deviceId, // null if localStorage cleared
            fingerprint: deviceInfo.fingerprint,
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
      
      logger.log('✅ [StrictAuth] Device challenge result:', challengeResult);
      
      // CASE 1: TRUSTED (score ≥ 60) - Auto-login
      if (challengeResult.trusted) {
        logger.log('✅ [StrictAuth] Device TRUSTED via challenge (auto-login)');
        
        // Restore device_id to localStorage (if it was cleared)
        if (challengeResult.deviceId && isNewDeviceId) {
          const { DeviceIdManager } = await import('./device-id-manager');
          DeviceIdManager.setDeviceId(challengeResult.deviceId);
          logger.log('✅ [StrictAuth] Device ID restored to localStorage');
        }
        
        // Store session token (grace period)
        if (challengeResult.sessionToken) {
          sessionStorage.setItem('blaze_session_token', challengeResult.sessionToken);
          logger.log('✅ [StrictAuth] Session token stored');
        }
        
        // Decrypt wallet
        const csrfResponse2 = await fetch('/api/csrf-token');
        const { token: csrfToken2 } = await csrfResponse2.json();
        
        const walletResponse = await fetch('/api/get-wallet', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken2,
          },
          body: JSON.stringify({ userId: data.user.id }),
        });
        
        const walletData = await walletResponse.json();
        
        if (!walletData.success || !walletData.encrypted_mnemonic) {
          throw new Error('Wallet not found');
        }
        
        const decryptedMnemonic = await decryptMnemonic(
          walletData.encrypted_mnemonic,
          password
        );
        
        logger.log('✅ [StrictAuth] Wallet decrypted successfully (Trust Anchor)');
        
        return {
          success: true,
          user: data.user,
          mnemonic: decryptedMnemonic,
        };
      }
      
      // CASE 2: BELOW THRESHOLD (score < 60) - Email verification required
      // Fall through to existing email verification flow below
      logger.log('❌ [StrictAuth] Below threshold - email verification required');
      
    } catch (challengeError) {
      logger.error('❌ [StrictAuth] Device challenge error:', challengeError);
      // Fall through to existing email verification flow
    }
    
    // NEW OR UNVERIFIED DEVICE - BLOCK LOGIN AND REQUIRE VERIFICATION
    logger.warn('🚫 [StrictAuth] NEW/UNVERIFIED device - blocking login');
    logger.log('📧 [StrictAuth] Initiating device verification flow...');
    
    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate device verification token (for API validation)
    const crypto = await import('crypto');
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry
    
    // ✅ PERFECT FIX: Check if device_id already exists (prevent duplicate key error)
    logger.log('🔍 [StrictAuth] Checking if device_id already exists in database...');
    
    const { data: existingDeviceById, error: deviceCheckError } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (deviceCheckError) {
      logger.error('❌ [StrictAuth] Error checking device by ID:', deviceCheckError);
    }
    
    let insertedDevice;
    
    if (existingDeviceById) {
      // ✅ Device exists in DB (but not verified yet or verification expired)
      logger.log('🔄 [StrictAuth] Device exists in DB - upserting with new verification code...');
      
      // Use upsert to handle any conflicts gracefully
      const { data: upsertedDevice, error: upsertError } = await supabase
        .from('trusted_devices')
        .upsert({
          id: existingDeviceById.id, // Use existing ID
          user_id: data.user.id,
          device_id: deviceId, // Ensure device_id is set
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint, // Update fingerprint (can change)
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: `${deviceInfo.browser}`,
          browser_version: deviceInfo.browserVersion,
          os: `${deviceInfo.os}`,
          os_version: deviceInfo.osVersion,
          is_current: false, // Not current until verified
          verification_token: deviceToken, // New verification token
          verification_code: verificationCode, // New verification code
          verification_code_expires_at: expiresAt.toISOString(),
          device_metadata: {
            location: deviceInfo.location,
            riskScore: deviceInfo.riskScore,
            isTor: deviceInfo.isTor,
            isVPN: deviceInfo.isVPN,
            timezone: deviceInfo.timezone,
            language: deviceInfo.language,
            screenResolution: deviceInfo.screenResolution,
          },
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'id' // Use ID as conflict resolution
        })
        .select();
      
      if (upsertError) {
        logger.error('❌ [StrictAuth] Failed to upsert device:', upsertError);
        logger.error('❌ [StrictAuth] Upsert error details:', JSON.stringify(upsertError, null, 2));
        throw new Error('Failed to update device for verification');
      }
      
      insertedDevice = upsertedDevice;
      logger.log('✅ [StrictAuth] Device upserted with new verification code');
      
    } else {
      // ✅ Device does NOT exist - INSERT new record
      logger.log('➕ [StrictAuth] Device NOT in DB - inserting new record...');
      
      const { data: newDevice, error: insertError } = await supabase
        .from('trusted_devices')
        .insert({
          user_id: data.user.id,
          device_id: deviceId, // ← Persistent device ID!
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: `${deviceInfo.browser}`,
          browser_version: deviceInfo.browserVersion,
          os: `${deviceInfo.os}`,
          os_version: deviceInfo.osVersion,
          is_current: false, // Not current until verified
          verification_token: deviceToken,
          verification_code: verificationCode,
          verification_code_expires_at: expiresAt.toISOString(),
          device_metadata: {
            location: deviceInfo.location,
            riskScore: deviceInfo.riskScore,
            isTor: deviceInfo.isTor,
            isVPN: deviceInfo.isVPN,
            timezone: deviceInfo.timezone,
            language: deviceInfo.language,
            screenResolution: deviceInfo.screenResolution,
          },
          last_used_at: new Date().toISOString(),
        })
        .select();
      
      if (insertError) {
        logger.error('❌ [StrictAuth] Failed to insert device:', insertError);
        logger.error('❌ [StrictAuth] Insert error details:', JSON.stringify(insertError, null, 2));
        throw new Error('Failed to register device for verification');
      }
      
      insertedDevice = newDevice;
      logger.log('✅ [StrictAuth] New device inserted successfully');
    }
    
    if (!insertedDevice || insertedDevice.length === 0) {
      logger.error('❌ [StrictAuth] Device operation succeeded but no record returned!');
      throw new Error('Failed to register device for verification');
    }
    
    logger.log('✅ [StrictAuth] Device record ready:', {
      id: insertedDevice[0]?.id,
      verification_code: insertedDevice[0]?.verification_code,
      device_id: deviceId.substring(0, 12) + '...',
    });
    
    logger.log('✅ [StrictAuth] Device stored, sending verification email...');
    
    // Send verification code email
    try {
      // Get CSRF token first (production-safe)
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const emailResponse = await fetch('/api/device-verification-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken, // CSRF protection
        },
        body: JSON.stringify({
          userId: data.user.id, // ✅ Required by API
          email: data.user.email,
          deviceInfo: {
            deviceName: deviceInfo.deviceName,
            fingerprint: deviceInfo.fingerprint, // ✅ Required by API
            ipAddress: deviceInfo.ipAddress,
            userAgent: deviceInfo.userAgent,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            location: deviceInfo.location, // Full location object
          },
        }),
      });
      
      if (!emailResponse.ok) {
        throw new Error('Failed to send verification email');
      }
      
      logger.log('✅ [StrictAuth] Verification email sent');
      
    } catch (emailError: any) {
      logger.error('❌ [StrictAuth] Email send failed:', emailError.message);
      // Continue anyway - user can retry
    }
    
    // Log security event
    try {
      await supabase.rpc('log_user_activity', {
        p_user_id: data.user.id,
        p_activity_type: 'device_verification_required',
        p_description: `New device login blocked: ${deviceInfo.deviceName}`,
        p_ip_address: deviceInfo.ipAddress,
        p_device_info: JSON.stringify(deviceInfo),
      });
    } catch (logError) {
      logger.error('Failed to log activity:', logError);
    }
    
    // Return verification required response
    // Ensure deviceInfo has all required fields, especially fingerprint
    // IMPORTANT: Save userId BEFORE signing out
    const userIdToReturn = data.user.id;
    
    // Sign out user (don't keep session for unverified device)
    await supabase.auth.signOut();
    
    logger.log('🚫 [StrictAuth] User signed out - verification required');
    
    return {
      success: false,
      requiresDeviceVerification: true,
      deviceVerificationToken: deviceToken,
      userId: userIdToReturn, // Return userId so it can be used for verification
      deviceInfo: {
        ...deviceInfo,
        fingerprint: deviceInfo.fingerprint || '', // Ensure fingerprint exists
      },
      error: 'Device verification required',
    };
    
  } catch (error: any) {
    logger.error('❌ [StrictAuth] Sign-in error:', error);
    
    // If error is about device update/verification, return device verification required
    if (error.message && error.message.includes('Failed to update device')) {
      logger.log('🔄 [StrictAuth] Device update failed, requiring verification');
      
      // Try to get device info for verification
      try {
        const { generateEnhancedFingerprint } = await import('./device-fingerprint-pro');
        const deviceInfo = await generateEnhancedFingerprint();
        
        // Try to get userId from Supabase session before it's lost
        let userId: string | undefined;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        } catch (userError) {
          logger.warn('Could not get userId from session:', userError);
        }
        
        return {
          success: false,
          requiresDeviceVerification: true,
          deviceVerificationToken: '', // Will be generated by verification flow
          userId, // Include userId if available
          deviceInfo: {
            ...deviceInfo,
            fingerprint: deviceInfo.fingerprint || '',
          },
          error: 'Device verification required',
        };
      } catch (fingerprintError) {
        logger.error('❌ [StrictAuth] Failed to generate fingerprint:', fingerprintError);
      }
    }
    
    return {
      success: false,
      error: error.message || 'Authentication failed',
    };
  }
}

/**
 * ✅ NEW: Confirm device (1-click verification for medium confidence)
 * Used when device-challenge returns requiresConfirmation: true
 */
export async function confirmDeviceAndSignIn(
  userId: string,
  deviceId: string,
  email: string,
  password: string
): Promise<StrictSignInResult> {
  try {
    logger.log('🔐 [StrictAuth] Confirming device for user:', userId.substring(0, 8) + '...');
    logger.log('📱 [StrictAuth] Device ID:', deviceId.substring(0, 12) + '...');
    
    // 1. Get current device info
    const { generateEnhancedFingerprint } = await import('./device-fingerprint-pro');
    const { DeviceIdManager } = await import('./device-id-manager');
    const currentDeviceInfo = await generateEnhancedFingerprint();
    const { deviceId: currentDeviceId } = DeviceIdManager.getOrCreateDeviceId();
    
    // 2. Find or create device in database
    let device;
    const { data: existingDevice, error: findError } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', currentDeviceInfo.fingerprint)
      .maybeSingle();
    
    if (findError && findError.code !== 'PGRST116') {
      logger.error('❌ [StrictAuth] Error finding device:', findError);
      return {
        success: false,
        error: 'Failed to find device',
      };
    }
    
    const crypto = await import('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    if (existingDevice) {
      // First, set all other devices to is_current: false (only one device can be current)
      await supabase
        .from('trusted_devices')
        .update({ is_current: false })
        .eq('user_id', userId)
        .neq('id', existingDevice.id);
      
      // Update existing device
      const { data: updatedDevice, error: updateError } = await supabase
        .from('trusted_devices')
        .update({
          verified_at: new Date().toISOString(),
          is_current: true,
          session_token: sessionToken,
          last_verified_session_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          device_id: currentDeviceId,
          device_name: currentDeviceInfo.deviceName,
          ip_address: currentDeviceInfo.ipAddress,
          user_agent: currentDeviceInfo.userAgent,
          browser: `${currentDeviceInfo.browser}`,
          os: `${currentDeviceInfo.os}`,
        })
        .eq('id', existingDevice.id)
        .select()
        .single();
      
      if (updateError || !updatedDevice) {
        logger.error('❌ [StrictAuth] Failed to verify device:', updateError);
        return {
          success: false,
          error: 'Failed to verify device',
        };
      }
      
      device = updatedDevice;
    } else {
      // First, set all other devices to is_current: false (only one device can be current)
      await supabase
        .from('trusted_devices')
        .update({ is_current: false })
        .eq('user_id', userId);
      
      // Create new device
      const { data: newDevice, error: insertError } = await supabase
        .from('trusted_devices')
        .insert({
          user_id: userId,
          device_id: currentDeviceId,
          device_name: currentDeviceInfo.deviceName,
          device_fingerprint: currentDeviceInfo.fingerprint,
          ip_address: currentDeviceInfo.ipAddress,
          user_agent: currentDeviceInfo.userAgent,
          browser: `${currentDeviceInfo.browser}`,
          os: `${currentDeviceInfo.os}`,
          verified_at: new Date().toISOString(),
          is_current: true,
          session_token: sessionToken,
          last_verified_session_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (insertError || !newDevice) {
        logger.error('❌ [StrictAuth] Failed to create device:', insertError);
        return {
          success: false,
          error: 'Failed to create device',
        };
      }
      
      device = newDevice;
    }
    
    logger.log('✅ [StrictAuth] Device confirmed and verified');
    
    // 3. Restore device_id to localStorage
    DeviceIdManager.setDeviceId(device.device_id || currentDeviceId);
    logger.log('✅ [StrictAuth] Device ID restored to localStorage');
    
    // 4. Store session token
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('blaze_session_token', sessionToken);
      logger.log('✅ [StrictAuth] Session token stored');
    }
    
    // 5. Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError || !authData.user) {
      logger.error('❌ [StrictAuth] Sign in failed:', authError);
      return {
        success: false,
        error: 'Failed to complete sign-in',
      };
    }
    
    logger.log('✅ [StrictAuth] User signed in:', authData.user.id);
    
    // 6. Decrypt wallet
    try {
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const walletResponse = await fetch('/api/get-wallet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ userId: authData.user.id }),
      });
      
      const walletData = await walletResponse.json();
      
      if (!walletData.success) {
        logger.error('❌ [StrictAuth] Wallet fetch failed:', walletData.error);
        return {
          success: false,
          error: walletData.error || 'Failed to fetch wallet',
        };
      }
      
      const decryptedMnemonic = await decryptMnemonic(
        walletData.encrypted_mnemonic,
        password
      );
      
      logger.log('✅ [StrictAuth] Device confirmation complete - wallet unlocked');
      
      return {
        success: true,
        user: authData.user,
        mnemonic: decryptedMnemonic,
      };
      
    } catch (fetchError: any) {
      logger.error('❌ [StrictAuth] Wallet fetch exception:', fetchError);
      return {
        success: false,
        error: `Wallet fetch failed: ${fetchError.message}`,
      };
    }
    
  } catch (error: any) {
    logger.error('❌ [StrictAuth] Confirmation error:', error);
    return {
      success: false,
      error: error.message || 'Confirmation failed',
    };
  }
}

/**
 * Verify device with code and complete sign-in
 */
export async function verifyDeviceAndSignIn(
  deviceToken: string,
  verificationCode: string,
  twoFactorCode: string,
  email: string,
  password: string
): Promise<StrictSignInResult> {
  try {
    logger.log('🔐 [StrictAuth] Verifying device with code...');
    
    // 1. Validate verification code
    const { data: device, error: deviceError } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('verification_token', deviceToken)
      .eq('verification_code', verificationCode)
      .maybeSingle();
    
    if (deviceError || !device) {
      logger.error('❌ Invalid verification code or token');
      return {
        success: false,
        error: 'Invalid or expired verification code',
      };
    }
    
    // Check expiry
    if (new Date(device.verification_expires_at) < new Date()) {
      logger.error('❌ Verification code expired');
      return {
        success: false,
        error: 'Verification code has expired. Please try logging in again.',
      };
    }
    
    logger.log('✅ [StrictAuth] Verification code valid');
    
    // 2. Verify 2FA code if provided
    if (twoFactorCode) {
      const { verify2FACode } = await import('./2fa-service');
      const result = await verify2FACode(device.user_id, twoFactorCode);
      
      if (!result.success) {
        logger.error('❌ [StrictAuth] 2FA verification failed:', result.error);
        return {
          success: false,
          error: result.error || 'Invalid 2FA code',
        };
      }
      
      logger.log('✅ [StrictAuth] 2FA verified successfully');
    }
    
    // 3. Mark device as verified
    // ✅ NEW: Generate session token for grace period
    const crypto = await import('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // First, set all other devices to is_current: false (only one device can be current)
    await supabase
      .from('trusted_devices')
      .update({ is_current: false })
      .eq('user_id', device.user_id)
      .neq('device_fingerprint', device.device_fingerprint);
    
    const { error: updateError } = await supabase
      .from('trusted_devices')
      .update({
        verified_at: new Date().toISOString(),
        is_current: true,
        verification_token: null, // Clear token
        verification_code: null, // Clear code
        verification_expires_at: null,
        session_token: sessionToken, // ← NEW: For grace period
        last_verified_session_at: new Date().toISOString(), // ← NEW
      })
      .eq('id', device.id);
    
    if (updateError) {
      logger.error('❌ Failed to verify device:', updateError);
      return {
        success: false,
        error: 'Failed to verify device',
      };
    }
    
    // Store session token in sessionStorage (for grace period)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('blaze_session_token', sessionToken);
      logger.log('✅ [StrictAuth] Session token stored');
    }
    
    logger.log('✅ [StrictAuth] Device verified and trusted');
    
    // 4. Update security score
    try {
      await supabase.rpc('calculate_security_score', {
        p_user_id: device.user_id,
      });
    } catch (scoreError) {
      logger.warn('Failed to update security score:', scoreError);
    }
    
    // 5. Sign in again with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError || !authData.user) {
      logger.error('❌ [StrictAuth] Sign in failed:', authError);
      return {
        success: false,
        error: 'Failed to complete sign-in',
      };
    }
    
    logger.log('✅ [StrictAuth] User signed in:', authData.user.id);
    
    // 6. Decrypt wallet (using server-side endpoint to bypass RLS issues)
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const walletResponse = await fetch('/api/get-wallet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ userId: authData.user.id }),
      });
      
      const walletData = await walletResponse.json();
      
      if (!walletData.success) {
        logger.error('❌ [StrictAuth] Wallet fetch failed:', walletData.error, walletData.details);
        return {
          success: false,
          error: walletData.error || 'Failed to fetch wallet',
        };
      }
      
      const decryptedMnemonic = await decryptMnemonic(
        walletData.encrypted_mnemonic,
        password
      );
      
      logger.log('✅ [StrictAuth] Device verification complete - wallet unlocked');
      
      return {
        success: true,
        user: authData.user,
        mnemonic: decryptedMnemonic,
      };
      
    } catch (fetchError: any) {
      logger.error('❌ [StrictAuth] Wallet fetch exception:', fetchError);
      return {
        success: false,
        error: `Wallet fetch failed: ${fetchError.message}`,
      };
    }
    
  } catch (error: any) {
    logger.error('❌ [StrictAuth] Verification error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

// ✅ Export with standard names for compatibility
export const signInWithEmail = strictSignInWithEmail;

/**
 * Sign up with email - creates new wallet (no device verification needed for signup)
 * Device will be verified on first sign-in
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<any> {
  try {
    const bip39 = (await import('bip39')).default;
    const ethers = await import('ethers');
    const { trackAuth } = await import('./analytics');

    // ✅ 0. Check if email already exists before attempting signup
    try {
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const checkResult = await checkResponse.json();

      if (checkResult.success && checkResult.exists) {
        logger.warn('⚠️ [StrictAuth] Email already exists:', email);
        return { 
          success: false, 
          error: checkResult.message || 'An account with this email address already exists. Please sign in instead or use a different email address.' 
        };
      }
    } catch (checkErr: any) {
      // If check fails, log but continue (better to try signup than block user)
      logger.warn('⚠️ [StrictAuth] Could not check if email exists:', checkErr.message);
    }

    // 1. Create Supabase user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'https://my.blazewallet.io'}/auth/verify`,
        data: {
          email_confirm: false,
        }
      }
    });

    if (authError) {
      // Check if error is due to existing email
      if (authError.message.includes('already registered') || 
          authError.message.includes('already exists') ||
          authError.message.includes('User already registered')) {
        return { 
          success: false, 
          error: 'An account with this email address already exists. Please sign in instead or use a different email address.' 
        };
      }
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    logger.log('✅ [StrictAuth] User created:', authData.user.id);

    // 2. Generate new wallet mnemonic
    const mnemonic = bip39.generateMnemonic();

    // 3. Encrypt mnemonic with user's password
    const encryptedWallet = await encryptMnemonic(mnemonic, password);

    // 4. Get wallet address
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const walletAddress = hdNode.address;

    // ✅ 4.5. AUTO-TRUST FIRST DEVICE (NEW!)
    // Register signup device as automatically trusted (no verification needed)
    try {
      logger.log('📱 [StrictAuth] Registering first device as auto-trusted...');
      
      const { DeviceIdManager } = await import('./device-id-manager');
      const { generateEnhancedFingerprint } = await import('./device-fingerprint-pro');
      
      const { deviceId } = DeviceIdManager.getOrCreateDeviceId();
      const deviceInfo = await generateEnhancedFingerprint();
      
      // First, set all other devices to is_current: false (only one device can be current)
      // (This is the first device, but good practice for consistency)
      await supabase
        .from('trusted_devices')
        .update({ is_current: false })
        .eq('user_id', authData.user.id)
        .neq('device_fingerprint', deviceInfo.fingerprint);
      
      const { error: deviceError } = await supabase
        .from('trusted_devices')
        .insert({
          user_id: authData.user.id,
          device_id: deviceId, // ← NEW: Persistent device ID!
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: `${deviceInfo.browser}`,
          browser_version: deviceInfo.browserVersion,
          os: `${deviceInfo.os}`,
          os_version: deviceInfo.osVersion,
          verified_at: new Date().toISOString(), // ← AUTO-VERIFIED on signup!
          is_current: true,
          device_metadata: {
            location: deviceInfo.location,
            riskScore: deviceInfo.riskScore,
            timezone: deviceInfo.timezone,
            screenResolution: deviceInfo.screenResolution,
            language: deviceInfo.language,
          },
          last_used_at: new Date().toISOString(),
        });
      
      if (deviceError) {
        logger.warn('⚠️ [StrictAuth] Failed to register first device:', deviceError);
        // Non-critical - user can verify later if needed
      } else {
        logger.log('✅ [StrictAuth] First device auto-trusted successfully!');
        logger.log('✅ [StrictAuth] Device ID:', deviceId.substring(0, 12) + '...');
        logger.log('✅ [StrictAuth] Device Name:', deviceInfo.deviceName);
      }
    } catch (deviceRegError) {
      logger.warn('⚠️ [StrictAuth] Device registration error:', deviceRegError);
      // Non-critical - continue with signup
    }

    // 5. Upload encrypted wallet to Supabase
    try {
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const walletResponse = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          userId: authData.user.id,
          encryptedMnemonic: encryptedWallet,
          walletAddress,
        }),
      });
      
      const walletData = await walletResponse.json();
      
      if (!walletData.success) {
        logger.error('Failed to save encrypted wallet:', walletData.error);
      }
    } catch (walletError: any) {
      logger.error('Failed to save encrypted wallet:', walletError);
    }

    // 6. Store wallet flags locally (✅ HYBRID: IndexedDB + localStorage)
    if (typeof window !== 'undefined') {
      const { secureStorage } = await import('./secure-storage');
      
      // ✅ CRITICAL: Store encrypted wallet in IndexedDB (persistent on iOS PWA)
      await secureStorage.setItem('encrypted_wallet', encryptedWallet);
      await secureStorage.setItem('has_password', 'true');
      
      await persistEmailIdentity({
        email,
        userId: authData.user!.id,
      });
      localStorage.setItem('email_verified', 'false');
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
    }

    // Track successful signup
    if (typeof window !== 'undefined') {
      await trackAuth(authData.user.id, 'signup', {
        success: true,
        method: 'email',
        hasWallet: true
      });
    }

    // 7. Send welcome email
    try {
      const response = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          userId: authData.user.id,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        logger.log('✅ Welcome email sent to:', email);
      } else {
        logger.error('Failed to send welcome email:', result.error);
      }
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
    }

    return {
      success: true,
      user: authData.user,
      mnemonic,
    };
  } catch (error: any) {
    logger.error('Sign up error:', error);
    return { success: false, error: error.message || 'Failed to sign up' };
  }
}

// ✅ OAuth exports (these will redirect to OAuth providers)
export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Google sign in error:', error);
    return { success: false, error: error.message || 'Failed to sign in with Google' };
  }
}

export async function signInWithApple(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Apple sign in error:', error);
    return { success: false, error: error.message || 'Failed to sign in with Apple' };
  }
}

