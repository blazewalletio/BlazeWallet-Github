/**
 * Strict Authentication with Device Verification (Fort Knox)
 * Blocks login for unverified devices
 * V2: Fixed localhost testing + improved logging
 */

import { supabase } from './supabase';
import { generateEnhancedFingerprint, EnhancedDeviceInfo } from './device-fingerprint-pro';
import { logger } from './logger';

// Helper to decrypt mnemonic - uses decryptWallet from crypto-utils
async function decryptMnemonic(encryptedData: string, password: string): Promise<string> {
  try {
    const encryptedWallet = JSON.parse(encryptedData);
    const { decryptWallet } = await import('./crypto-utils');
    return decryptWallet(encryptedWallet, password);
  } catch (error) {
    logger.error('Failed to decrypt mnemonic:', error);
    throw new Error('Failed to decrypt wallet');
  }
}

export interface StrictSignInResult {
  success: boolean;
  error?: string;
  requiresDeviceVerification?: boolean;
  requires2FA?: boolean;
  deviceVerificationToken?: string;
  deviceInfo?: EnhancedDeviceInfo;
  user?: any;
  mnemonic?: string;
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
    
    // 2. Generate enhanced device fingerprint
    logger.log('📱 [StrictAuth] Generating device fingerprint...');
    const deviceInfo = await generateEnhancedFingerprint();
    
    logger.log('✅ [StrictAuth] Fingerprint generated:', {
      fingerprint: deviceInfo.fingerprint?.substring(0, 8) + '...',
      device: deviceInfo.deviceName,
      location: deviceInfo.location ? `${deviceInfo.location.city}, ${deviceInfo.location.country}` : 'Unknown',
      riskScore: deviceInfo.riskScore,
    });
    
    // 3. Check risk score - block high-risk logins immediately
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
    
    // 4. Check if device is already trusted
    const { data: existingDevice, error: deviceError } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('device_fingerprint', deviceInfo.fingerprint)
      .maybeSingle();
    
    if (deviceError) {
      logger.error('❌ [StrictAuth] Error checking device:', deviceError);
    }
    
    // TRUSTED DEVICE - Allow immediate access
    if (existingDevice && existingDevice.verified_at) {
      logger.log('✅ [StrictAuth] TRUSTED device detected - allowing login');
      
      // Update last_used_at
      await supabase
        .from('trusted_devices')
        .update({ 
          last_used_at: new Date().toISOString(),
          is_current: true 
        })
        .eq('id', existingDevice.id);
      
      // Fetch and decrypt wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('encrypted_mnemonic')
        .eq('user_id', data.user.id)
        .single();
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      const decryptedMnemonic = await decryptMnemonic(
        wallet.encrypted_mnemonic,
        password
      );
      
      logger.log('✅ [StrictAuth] Wallet decrypted successfully');
      
      return {
        success: true,
        user: data.user,
        mnemonic: decryptedMnemonic,
      };
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
    
    // Delete ANY existing device with same fingerprint (verified or not)
    // In production this is fine because each real device has unique fingerprint
    // In localhost testing, fingerprints are often the same, so we clean up old records
    await supabase
      .from('trusted_devices')
      .delete()
      .eq('user_id', data.user.id)
      .eq('device_fingerprint', deviceInfo.fingerprint);
    
    // Insert new device with fresh verification token
    logger.log('💾 [StrictAuth] Inserting device record...');
    const { data: insertedDevice, error: insertError } = await supabase
      .from('trusted_devices')
      .insert({
        user_id: data.user.id,
        device_name: deviceInfo.deviceName,
        device_fingerprint: deviceInfo.fingerprint,
        ip_address: deviceInfo.ipAddress,
        user_agent: deviceInfo.userAgent,
        browser: `${deviceInfo.browser} ${deviceInfo.browserVersion}`,
        os: `${deviceInfo.os} ${deviceInfo.osVersion}`,
        is_current: false, // Not current until verified
        verification_token: deviceToken,
        verification_code: verificationCode,
        verification_expires_at: expiresAt.toISOString(),
        device_metadata: {
          location: deviceInfo.location,
          riskScore: deviceInfo.riskScore,
          isTor: deviceInfo.isTor,
          isVPN: deviceInfo.isVPN,
          timezone: deviceInfo.timezone,
          language: deviceInfo.language,
        },
        last_used_at: new Date().toISOString(),
      })
      .select(); // Get the inserted record back
    
    if (insertError) {
      logger.error('❌ [StrictAuth] Failed to store device:', insertError);
      logger.error('❌ [StrictAuth] Insert error details:', JSON.stringify(insertError, null, 2));
      throw new Error('Failed to register device for verification');
    }
    
    if (!insertedDevice || insertedDevice.length === 0) {
      logger.error('❌ [StrictAuth] Device insert succeeded but no record returned!');
      throw new Error('Failed to register device for verification');
    }
    
    logger.log('✅ [StrictAuth] Device record inserted successfully:', {
      id: insertedDevice[0]?.id,
      verification_token: insertedDevice[0]?.verification_token?.substring(0, 10) + '...',
      verification_code: insertedDevice[0]?.verification_code,
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
          email: data.user.email,
          code: verificationCode,
          deviceInfo: {
            deviceName: deviceInfo.deviceName,
            location: `${deviceInfo.location.city}, ${deviceInfo.location.country}`,
            ipAddress: deviceInfo.ipAddress,
            browser: `${deviceInfo.browser} ${deviceInfo.browserVersion}`,
            os: `${deviceInfo.os} ${deviceInfo.osVersion}`,
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
    
    // Sign out user (don't keep session for unverified device)
    await supabase.auth.signOut();
    
    logger.log('🚫 [StrictAuth] User signed out - verification required');
    
    // Return verification required response
    return {
      success: false,
      requiresDeviceVerification: true,
      deviceVerificationToken: deviceToken,
      deviceInfo,
      error: 'Device verification required',
    };
    
  } catch (error: any) {
    logger.error('❌ [StrictAuth] Sign-in error:', error);
    
    return {
      success: false,
      error: error.message || 'Authentication failed',
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
    const { error: updateError } = await supabase
      .from('trusted_devices')
      .update({
        verified_at: new Date().toISOString(),
        is_current: true,
        verification_token: null, // Clear token
        verification_code: null, // Clear code
        verification_expires_at: null,
      })
      .eq('id', device.id);
    
    if (updateError) {
      logger.error('❌ Failed to verify device:', updateError);
      return {
        success: false,
        error: 'Failed to verify device',
      };
    }
    
    logger.log('✅ [StrictAuth] Device verified and trusted');
    
    // 4. Update security score
    try {
      await supabase.rpc('update_security_score', {
        p_user_id: device.user_id,
        p_field: 'trusted_device_added',
        p_value: true,
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
      return {
        success: false,
        error: 'Failed to complete sign-in',
      };
    }
    
    // 6. Decrypt wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('encrypted_mnemonic')
      .eq('user_id', authData.user.id)
      .single();
    
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found',
      };
    }
    
    const decryptedMnemonic = await decryptMnemonic(
      wallet.encrypted_mnemonic,
      password
    );
    
    logger.log('✅ [StrictAuth] Device verification complete - wallet unlocked');
    
    return {
      success: true,
      user: authData.user,
      mnemonic: decryptedMnemonic,
    };
    
  } catch (error: any) {
    logger.error('❌ [StrictAuth] Verification error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

