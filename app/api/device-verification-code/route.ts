/**
 * API Route: Device Verification Code Email
 * Sends verification code via email for device verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sendDeviceVerificationEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, deviceInfo } = body;
    
    logger.log('📧 [DeviceVerificationCode] Sending verification email:', {
      email,
      code,
      device: deviceInfo?.deviceName,
    });
    
    // Send email via Resend
    await sendDeviceVerificationEmail(email, code, {
      deviceName: deviceInfo.deviceName,
      location: deviceInfo.location,
      ipAddress: deviceInfo.ipAddress,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
    });
    
    // In development, also log the code for easy testing
    if (process.env.NODE_ENV === 'development') {
      logger.log('🔐 [DEV ONLY] VERIFICATION CODE:', code);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      // In dev, include code for testing
      ...(process.env.NODE_ENV === 'development' && { code }),
    });
    
  } catch (error: any) {
    logger.error('❌ [DeviceVerificationCode] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}

