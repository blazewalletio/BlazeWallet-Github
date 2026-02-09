/**
 * API Route: Store Device for Verification
 * Uses admin client to bypass RLS issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { 
      userId, 
      deviceId, 
      deviceInfo, 
      verificationToken, 
      verificationCode, 
      verificationExpiresAt,
      existingDeviceId 
    } = await request.json();
    
    logger.log('📥 [store-device] Request received:', { 
      userId: userId?.substring(0, 8) + '...', 
      deviceId: deviceId?.substring(0, 12) + '...',
      existingDeviceId: existingDeviceId || 'none',
    });
    
    if (!userId || !deviceId || !deviceInfo || !verificationToken || !verificationCode || !verificationExpiresAt) {
      logger.error('❌ [store-device] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    let result;
    
    if (existingDeviceId) {
      // Update existing device
      logger.log('🔄 [store-device] Updating existing device:', existingDeviceId);
      const { data, error } = await getSupabaseAdmin()
        .from('trusted_devices')
        .update({
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          verification_token: verificationToken,
          verification_code: verificationCode,
          verification_expires_at: verificationExpiresAt,
        })
        .eq('id', existingDeviceId)
        .select();
      
      if (error) {
        logger.error('❌ [store-device] Update error:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      
      result = data;
      logger.log('✅ [store-device] Device updated successfully');
    } else {
      // Insert new device
      logger.log('➕ [store-device] Inserting new device');
      // First, set all other devices to is_current: false (only one device can be current)
      await getSupabaseAdmin()
        .from('trusted_devices')
        .update({ is_current: false })
        .eq('user_id', userId);
      
      const { data, error } = await getSupabaseAdmin()
        .from('trusted_devices')
        .insert({
          user_id: userId,
          device_id: deviceId,
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          verification_token: verificationToken,
          verification_code: verificationCode,
          verification_expires_at: verificationExpiresAt,
          is_current: true,
        })
        .select();
      
      if (error) {
        logger.error('❌ [store-device] Insert error:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      
      result = data;
      logger.log('✅ [store-device] Device inserted successfully');
    }
    
    return NextResponse.json({ 
      success: true,
      device: result?.[0]
    });
    
  } catch (error: any) {
    logger.error('💥 [store-device] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

