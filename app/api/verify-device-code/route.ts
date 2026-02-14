import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId as string | undefined;
    const email = body.email as string | undefined;
    const code = (body.code || body.verificationCode) as string | undefined;
    const deviceInfo = body.deviceInfo as any;
    const deviceToken = body.deviceToken as string | undefined;
    
    // Enhanced validation with detailed error messages
    if (!code) {
      logger.error('❌ [VerifyDeviceCode] Missing code');
      return NextResponse.json(
        { success: false, error: 'Missing required field: code' },
        { status: 400 }
      );
    }

    const hasTokenFlow = !!deviceToken;
    const hasUserFlow = !!userId && !!deviceInfo?.fingerprint;
    if (!hasTokenFlow && !hasUserFlow) {
      logger.error('❌ [VerifyDeviceCode] Missing verification identity');
      return NextResponse.json(
        { success: false, error: 'Missing required verification identity (deviceToken or userId+fingerprint)' },
        { status: 400 }
      );
    }

    if (hasUserFlow && !email) {
      logger.error('❌ [VerifyDeviceCode] Missing email for user flow');
      return NextResponse.json(
        { success: false, error: 'Missing required field: email' },
        { status: 400 }
      );
    }

    if (hasUserFlow && !userId) {
      logger.error('❌ [VerifyDeviceCode] Missing userId');
      return NextResponse.json(
        { success: false, error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    if (hasUserFlow && !deviceInfo) {
      logger.error('❌ [VerifyDeviceCode] Missing deviceInfo');
      return NextResponse.json(
        { success: false, error: 'Missing required field: deviceInfo' },
        { status: 400 }
      );
    }

    if (hasUserFlow && !deviceInfo.fingerprint) {
      logger.error('❌ [VerifyDeviceCode] Missing deviceInfo.fingerprint');
      logger.error('❌ [VerifyDeviceCode] deviceInfo received:', JSON.stringify(deviceInfo, null, 2));
      return NextResponse.json(
        { success: false, error: 'Missing required field: deviceInfo.fingerprint' },
        { status: 400 }
      );
    }
    
    logger.log('✅ [VerifyDeviceCode] All required fields present:', {
      mode: hasTokenFlow ? 'token' : 'user',
      userId: userId ? userId.substring(0, 8) + '...' : undefined,
      email: email || undefined,
      codeLength: code.length,
      hasFingerprint: !!deviceInfo?.fingerprint,
      hasDeviceToken: !!deviceToken,
    });

    // Find device with matching verification identity + code
    let query = getSupabaseAdmin()
      .from('trusted_devices')
      .select('*')
      .eq('verification_code', code);

    if (hasTokenFlow && deviceToken) {
      query = query.eq('verification_token', deviceToken);
    } else if (userId && deviceInfo?.fingerprint) {
      query = query.eq('user_id', userId).eq('device_fingerprint', deviceInfo.fingerprint);
    }

    const { data: device, error: deviceError } = await query.maybeSingle();
    
    if (deviceError || !device) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }
    
    // Check if code expired
    const codeExpiry = device.verification_code_expires_at || (device as any).verification_expires_at;
    if (codeExpiry && new Date(codeExpiry) < new Date()) {
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
        verification_token: null,
        verification_code: null, // Clear code after use
        verification_code_expires_at: null,
        verification_expires_at: null, // Legacy compatibility
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
    
    logger.log('✅ Device verified with code:', (device.user_id || userId || 'unknown').substring(0, 8) + '...');
    return NextResponse.json({ 
      success: true, 
      message: 'Device verified successfully',
      deviceId: device.device_id || null,
    });
    
  } catch (error: any) {
    logger.error('Verify device code error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
