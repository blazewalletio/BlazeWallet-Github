import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, generateDeviceVerificationCodeEmailTemplate } from '@/lib/email-service';
import { logger } from '@/lib/logger';

function generateDeviceCodeEmail(deviceName: string, verificationCode: string, location?: unknown): string {
  return generateDeviceVerificationCodeEmailTemplate({
    code: verificationCode,
    deviceName,
    location,
    expiresMinutes: 15,
  }).trim();
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [send-device-code] API called');
    const { email, deviceName, verificationCode, location } = await request.json();
    
    console.log('📧 [send-device-code] Request data:', { email, deviceName, verificationCode, location });
    
    if (!email || !deviceName || !verificationCode) {
      console.error('❌ [send-device-code] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Send verification code email
    const emailHtml = generateDeviceCodeEmail(deviceName, verificationCode, location);
    
    console.log('📨 [send-device-code] Attempting to send email to:', email);
    console.log('🔑 [send-device-code] RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('🌍 [send-device-code] NODE_ENV:', process.env.NODE_ENV);
    
    try {
      const result = await sendEmail({
        to: email,
        subject: '🔐 Device Verification Code - BLAZE Wallet',
        html: emailHtml
      });
      
      console.log('✅ [send-device-code] Email send result:', result);
    } catch (error: any) {
      console.error('❌ [send-device-code] Email send error:', error);
      logger.error('Failed to send device verification code email:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email' },
        { status: 500 }
      );
    }
    
    logger.log('✅ Device verification code email sent to:', email);
    console.log('🎉 [send-device-code] Success response sent');
    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent'
    });
    
  } catch (error: any) {
    console.error('💥 [send-device-code] Fatal error:', error);
    logger.error('Device code email error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

