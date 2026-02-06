import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

function generateVerificationCodeEmail(deviceName: string, code: string, location?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Device Verification Code - BLAZE Wallet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); min-height: 100vh;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: bold;">Device Verification Code</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 30px; border-radius: 8px;">
                <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600;">🔐 Security Verification</p>
                <p style="margin: 8px 0 0 0; color: #92400E; font-size: 14px;">A login attempt was made from a new device.</p>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #1F2937; font-size: 20px;">Enter this code to verify:</h2>
              
              <div style="background: #F9FAFB; border: 2px solid #E5E7EB; border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                <div style="font-size: 48px; font-weight: bold; color: #FF6B35; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${code}
                </div>
              </div>
              
              <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 14px;">
                  <strong style="color: #1F2937;">Device:</strong> ${deviceName}
                </p>
                ${location ? `<p style="margin: 0 0 12px 0; color: #6B7280; font-size: 14px;">
                  <strong style="color: #1F2937;">Location:</strong> ${location}
                </p>` : ''}
                <p style="margin: 0; color: #6B7280; font-size: 14px;">
                  <strong style="color: #1F2937;">Code expires in:</strong> 10 minutes
                </p>
              </div>
              
              <p style="margin: 0; color: #6B7280; font-size: 14px; text-align: center;">
                If you didn't attempt to log in, please ignore this email or contact support immediately.
              </p>
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
    
    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry
    
    // Store code in database (update existing device or create new)
    const { error: deviceError } = await supabaseAdmin
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
