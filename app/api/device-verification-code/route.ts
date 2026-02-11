import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateDeviceVerificationCodeEmailTemplate } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function generateVerificationCodeEmail(deviceName: string, code: string, location?: unknown): string {
  return generateDeviceVerificationCodeEmailTemplate({
    code,
    deviceName,
    location,
    expiresMinutes: 10,
  }).trim();
}

export async function POST(request: NextRequest) {
  try {
    const { userId, email, deviceInfo } = await request.json();
    
    if (!userId || !email || !deviceInfo) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if device already exists with a valid verification code
    const { data: existingDevice, error: checkError } = await getSupabaseAdmin()
      .from('trusted_devices')
      .select('verification_code, verification_code_expires_at')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceInfo.fingerprint)
      .maybeSingle();
    
    let code: string;
    let expiresAt: Date;
    
    // If device exists with valid (non-expired) code, reuse it
    if (existingDevice?.verification_code && 
        existingDevice.verification_code_expires_at && 
        new Date(existingDevice.verification_code_expires_at) > new Date()) {
      logger.log('✅ Reusing existing verification code');
      code = existingDevice.verification_code;
      expiresAt = new Date(existingDevice.verification_code_expires_at);
    } else {
      // Generate new 6-digit verification code
      code = Math.floor(100000 + Math.random() * 900000).toString();
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry
    }
    
    // Store/update code in database
    const { error: deviceError } = await getSupabaseAdmin()
      .from('trusted_devices')
      .upsert({
        user_id: userId,
        device_name: deviceInfo.deviceName,
        device_fingerprint: deviceInfo.fingerprint,
        ip_address: deviceInfo.ipAddress,
        user_agent: deviceInfo.userAgent,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        verification_code: code,
        verification_code_expires_at: expiresAt.toISOString(),
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_fingerprint'
      });
    
    if (deviceError) {
      logger.error('Failed to store verification code:', deviceError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate verification code' },
        { status: 500 }
      );
    }
    
    const emailHtml = generateVerificationCodeEmail(
      deviceInfo.deviceName,
      code,
      deviceInfo.location
    );
    
    try {
      await sendEmail({
        to: email,
        subject: '🔐 Device Verification Code - BLAZE Wallet',
        html: emailHtml
      });
    } catch (error: any) {
      logger.error('Failed to send verification code email:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email' },
        { status: 500 }
      );
    }
    
    logger.log('✅ Device verification code sent to:', email);
    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent',
      expiresAt: expiresAt.toISOString()
    });
    
  } catch (error: any) {
    logger.error('Device verification code error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
