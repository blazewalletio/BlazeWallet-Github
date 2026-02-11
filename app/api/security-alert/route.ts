/**
 * API Route: Security Alert
 * Sends security alert emails for suspicious activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { EnhancedDeviceInfo } from '@/lib/device-fingerprint-pro';
import { generateSecurityAlertEmailTemplate, sendEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, deviceInfo, alertType } = body as {
      userId: string;
      email: string;
      deviceInfo: EnhancedDeviceInfo;
      alertType: 'suspicious_login_blocked' | 'new_device_login' | 'password_changed';
    };
    
    if (!userId || !email || !deviceInfo || !alertType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    logger.log(`🚨 Sending ${alertType} alert to:`, email);
    
    // Send security alert email
    await sendSecurityAlertEmail(email, deviceInfo, alertType);
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    logger.error('❌ Security alert error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Send security alert email
 */
async function sendSecurityAlertEmail(
  email: string,
  deviceInfo: EnhancedDeviceInfo,
  alertType: string
) {
  try {
    // Format alert message based on type
    let subject = '';
    let title = '';
    let message = '';
    let action = '';
    
    switch (alertType) {
      case 'suspicious_login_blocked':
        subject = '🚨 Suspicious Login Blocked - BLAZE Wallet';
        title = 'Suspicious Login Blocked';
        message = `We blocked a suspicious login attempt to your BLAZE Wallet account from a high-risk device (Risk Score: ${deviceInfo.riskScore}/100).`;
        action = 'If this was you, please contact support. If not, your account is safe.';
        break;
      case 'new_device_login':
        subject = '🔔 New Device Login - BLAZE Wallet';
        title = 'New Device Detected';
        message = 'A new device was used to access your BLAZE Wallet account.';
        action = 'If this wasn\'t you, change your password immediately and contact support.';
        break;
      case 'password_changed':
        subject = '✅ Password Changed - BLAZE Wallet';
        title = 'Password Changed';
        message = 'Your BLAZE Wallet password was successfully changed.';
        action = 'If you didn\'t make this change, contact support immediately.';
        break;
    }

    const emailHtml = generateSecurityAlertEmailTemplate({
      alertTitle: title,
      alertMessage: message,
      actionMessage: action,
      deviceName: deviceInfo.deviceName,
      location: deviceInfo.location,
      ipAddress: deviceInfo.ipAddress,
      riskScore: deviceInfo.riskScore,
    });

    await sendEmail({
      to: email,
      subject,
      html: emailHtml,
    });

    logger.log('✅ Security alert email sent');
    return true;
    
  } catch (error) {
    logger.error('❌ Failed to send security alert:', error);
    throw error;
  }
}

