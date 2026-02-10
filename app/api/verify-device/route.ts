import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

function generateDeviceVerificationEmail(deviceName: string, verificationLink: string, location?: string): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = `${ASSET_BASE_URL}/icons/icon-512x512.png`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Device Login - BLAZE Wallet</title>
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
                New Device Login Detected
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">🔐 Security Alert</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px; line-height: 1.6;">We detected a login from a new device. Please verify this device to add it to your trusted devices list.</p>
              </div>
            </td>
          </tr>

          <!-- Device Details -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device Details</h2>
              
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
              
              <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.7; color: #374151;">
                If this was you, please verify this device by clicking the button below. This will add it to your trusted devices list.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 32px;">
                <tr>
                  <td style="background: #111827; border-radius: 10px;">
                    <a href="${verificationLink}" style="display: block; padding: 18px 48px; color: white; text-decoration: none; font-weight: 600; font-size: 17px; letter-spacing: -0.01em;">
                      Verify This Device →
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Wasn't you?</p>
                <p style="margin: 0 0 12px; font-size: 16px; color: #78350f; line-height: 1.6;">
                  If you didn't attempt to log in, your account may be compromised. Please:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 16px; line-height: 1.8;">
                  <li>Change your password immediately</li>
                  <li>Enable two-factor authentication</li>
                  <li>Review your trusted devices</li>
                  <li>Contact support if needed</li>
                </ul>
              </div>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                This verification link will expire in <strong>24 hours</strong>. Unverified devices will be automatically removed.
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

