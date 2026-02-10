import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

function generateVerificationCodeEmail(deviceName: string, code: string, location?: string): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = `${ASSET_BASE_URL}/icons/icon-512x512.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Device Verification Code - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                Device Verification Code
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">🔐 Security Verification</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px; line-height: 1.6;">A login attempt was made from a new device. Please verify this device with the code below.</p>
              </div>
            </td>
          </tr>

          <!-- Verification Code -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid #f97316; border-radius: 12px; padding: 40px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #78350f;">Enter this code to verify:</p>
                <div style="font-size: 48px; font-weight: 700; color: #f97316; letter-spacing: 12px; font-family: 'Courier New', monospace; margin: 20px 0;">
                  ${code}
                </div>
                <p style="margin: 16px 0 0; font-size: 14px; color: #92400e;">Code expires in 10 minutes</p>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Device:</strong> ${deviceName}
                </p>
                ${location ? `<p style="margin: 0 0 12px; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Location:</strong> ${location}
                </p>` : ''}
                <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Time:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              
              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 16px; color: #92400e; line-height: 1.6;">
                  <strong>⚠️ Didn't attempt to log in?</strong> If you didn't try to access your wallet from this device, please ignore this email or contact support immediately.
                </p>
              </div>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280; text-align: center;">
                After entering this code, you'll be asked to provide your 2FA code from your authenticator app.
              </p>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © ${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
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
    
    // Send verification email
    const location = deviceInfo.location 
      ? `${deviceInfo.location.city}, ${deviceInfo.location.country}` 
      : undefined;
    
    const emailHtml = generateVerificationCodeEmail(
      deviceInfo.deviceName,
      code,
      location
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
