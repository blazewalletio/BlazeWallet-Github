import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

function generateDeviceVerificationEmail(deviceName: string, verificationLink: string, location?: string): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const CACHE_BUST = Date.now();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Device Login - BLAZE Wallet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); padding: 40px 30px; text-align: center;">
              <img src="${ASSET_BASE_URL}/email/blaze-icon-white.png?v=${CACHE_BUST}" alt="BLAZE" style="width: 80px; height: 80px; margin-bottom: 20px;" />
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">New Device Login Detected</h1>
            </td>
          </tr>
          
          <!-- Alert Section -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 30px; border-radius: 8px;">
                <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600;">🔐 Security Alert</p>
                <p style="margin: 8px 0 0 0; color: #92400E; font-size: 14px;">We detected a login from a new device.</p>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #1F2937; font-size: 20px;">Device Details:</h2>
              
              <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 14px;">
                  <strong style="color: #1F2937;">Device:</strong> ${deviceName}
                </p>
                ${location ? `
                <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 14px;">
                  <strong style="color: #1F2937;">Location:</strong> ${location}
                </p>
                ` : ''}
                <p style="margin: 0; color: #6B7280; font-size: 14px;">
                  <strong style="color: #1F2937;">Time:</strong> ${new Date().toLocaleString('en-US', { 
                    dateStyle: 'long', 
                    timeStyle: 'short' 
                  })}
                </p>
              </div>
              
              <p style="margin: 0 0 24px 0; color: #1F2937; font-size: 16px; line-height: 1.6; font-weight: 500;">
                If this was you, please verify this device by clicking the button below. This will add it to your trusted devices list.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                      Verify This Device
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 8px 0; color: #991B1B; font-size: 14px; font-weight: 600;">⚠️ Wasn't you?</p>
                <p style="margin: 0; color: #991B1B; font-size: 14px; line-height: 1.6;">
                  If you didn't attempt to log in, your account may be compromised. Please:
                </p>
                <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #991B1B; font-size: 14px;">
                  <li>Change your password immediately</li>
                  <li>Enable two-factor authentication</li>
                  <li>Review your trusted devices</li>
                  <li>Contact support if needed</li>
                </ul>
              </div>
              
              <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.6;">
                This verification link will expire in <strong>24 hours</strong>. Unverified devices will be automatically removed.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">
                Need help? Visit <a href="https://my.blazewallet.io/support" style="color: #FF6B35; text-decoration: none;">BLAZE Support</a>
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                © 2024 BLAZE Wallet. All rights reserved.
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

