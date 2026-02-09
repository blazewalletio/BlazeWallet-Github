import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId, email, code, deviceInfo } = await request.json();
    
    // Enhanced validation with detailed error messages
    if (!userId) {
      logger.error('❌ [VerifyDeviceCode] Missing userId');
      return NextResponse.json(
        { success: false, error: 'Missing required field: userId' },
        { status: 400 }
      );
    }
    
    if (!email) {
      logger.error('❌ [VerifyDeviceCode] Missing email');
      return NextResponse.json(
        { success: false, error: 'Missing required field: email' },
        { status: 400 }
      );
    }
    
    if (!code) {
      logger.error('❌ [VerifyDeviceCode] Missing code');
      return NextResponse.json(
        { success: false, error: 'Missing required field: code' },
        { status: 400 }
      );
    }
    
    if (!deviceInfo) {
      logger.error('❌ [VerifyDeviceCode] Missing deviceInfo');
      return NextResponse.json(
        { success: false, error: 'Missing required field: deviceInfo' },
        { status: 400 }
      );
    }
    
    if (!deviceInfo.fingerprint) {
      logger.error('❌ [VerifyDeviceCode] Missing deviceInfo.fingerprint');
      logger.error('❌ [VerifyDeviceCode] deviceInfo received:', JSON.stringify(deviceInfo, null, 2));
      return NextResponse.json(
        { success: false, error: 'Missing required field: deviceInfo.fingerprint' },
        { status: 400 }
      );
    }
    
    logger.log('✅ [VerifyDeviceCode] All required fields present:', {
      userId: userId.substring(0, 8) + '...',
      email,
      codeLength: code.length,
      hasFingerprint: !!deviceInfo.fingerprint,
    });
    
    // Find device with matching code
    const { data: device, error: deviceError } = await getSupabaseAdmin()
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceInfo.fingerprint)
      .eq('verification_code', code)
      .maybeSingle();
    
    if (deviceError || !device) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }
    
    // Check if code expired
    if (device.verification_code_expires_at && new Date(device.verification_code_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Verification code expired. Please request a new one.' },
        { status: 400 }
      );
    }
    
    // First, set all other devices to is_current: false (only one device can be current)
    await getSupabaseAdmin()
      .from('trusted_devices')
      .update({ is_current: false })
      .eq('user_id', userId)
      .neq('id', device.id);
    
    // Mark device as verified and set as current
    const { error: updateError } = await getSupabaseAdmin()
      .from('trusted_devices')
      .update({
        verified_at: new Date().toISOString(),
        is_current: true,
        verification_code: null, // Clear code after use
        verification_code_expires_at: null,
        last_used_at: new Date().toISOString()
      })
      .eq('id', device.id);
    
    if (updateError) {
      logger.error('Failed to verify device:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify device' },
        { status: 500 }
      );
    }
    
    logger.log('✅ Device verified with code:', userId.substring(0, 8) + '...');
    return NextResponse.json({ 
      success: true, 
      message: 'Device verified successfully'
    });
    
  } catch (error: any) {
    logger.error('Verify device code error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
