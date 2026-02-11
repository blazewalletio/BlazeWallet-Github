import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateDeviceVerificationLinkEmailTemplate } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

function generateDeviceVerificationEmail(deviceName: string, verificationLink: string, location?: unknown): string {
  return generateDeviceVerificationLinkEmailTemplate({
    deviceName,
    verificationLink,
    location,
    expiresHours: 24,
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
    
    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
    
    // First, set all other devices to is_current: false (only one device can be current)
    await getSupabaseAdmin()
      .from('trusted_devices')
      .update({ is_current: false })
      .eq('user_id', userId)
      .neq('device_fingerprint', deviceInfo.fingerprint);
    
    // Store or update device with verification token
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
        is_current: true,
        verification_token: token,
        verification_expires_at: expiresAt.toISOString(),
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_fingerprint'
      });
    
    if (deviceError) {
      logger.error('Failed to store device:', deviceError);
      return NextResponse.json(
        { success: false, error: 'Failed to register device' },
        { status: 500 }
      );
    }
    
    // Generate verification link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://my.blazewallet.io';
    const verificationLink = `${baseUrl}/auth/verify-device?token=${token}`;
    
    // Send verification email
    const emailHtml = generateDeviceVerificationEmail(
      deviceInfo.deviceName,
      verificationLink,
      deviceInfo.location
    );
    
    try {
      await sendEmail({
        to: email,
        subject: '🔐 New Device Login - BLAZE Wallet',
        html: emailHtml
      });
    } catch (error: any) {
      logger.error('Failed to send device verification email:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email' },
        { status: 500 }
      );
    }
    
    // Log security alert
    await getSupabaseAdmin().rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: 'security_alert',
      p_description: `New device login: ${deviceInfo.deviceName}`,
      p_ip_address: deviceInfo.ipAddress,
      p_device_info: JSON.stringify(deviceInfo),
      p_metadata: JSON.stringify({
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        location: deviceInfo.location
      })
    });
    
    logger.log('✅ Device verification email sent to:', email);
    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent',
      requiresVerification: true
    });
    
  } catch (error: any) {
    logger.error('Device verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

