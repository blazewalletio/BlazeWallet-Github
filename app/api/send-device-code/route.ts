import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

function generateDeviceCodeEmail(deviceName: string, verificationCode: string, location?: string): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const CACHE_BUST = Date.now();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Device Verification Code - BLAZE Wallet</title>
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
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Verify Your Device</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 30px; border-radius: 8px;">
                <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600;">🔐 Security Check</p>
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
                Enter this 6-digit code in the BLAZE Wallet app to verify this device:
              </p>
              
              <!-- Verification Code - HIGHLY VISIBLE -->
              <div style="background: #FFFFFF; border: 4px solid #FF6B35; border-radius: 16px; padding: 40px 30px; text-align: center; margin-bottom: 30px; box-shadow: 0 8px 24px rgba(255, 107, 53, 0.2);">
                <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                <p style="margin: 0; color: #FF6B35; font-size: 56px; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', monospace; text-shadow: none; line-height: 1.2;">
                  ${verificationCode}
                </p>
                <p style="margin: 16px 0 0 0; color: #6B7280; font-size: 13px; font-weight: 500;">Valid for 15 minutes</p>
              </div>
              
              <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 8px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">ℹ️ Important</p>
                <ul style="margin: 0; padding-left: 20px; color: #1E40AF; font-size: 14px; line-height: 1.6;">
                  <li>This code expires in <strong>15 minutes</strong></li>
                  <li>Never share this code with anyone</li>
                  <li>BLAZE support will never ask for this code</li>
                </ul>
              </div>
              
              <div style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 8px 0; color: #991B1B; font-size: 14px; font-weight: 600;">⚠️ Didn't request this?</p>
                <p style="margin: 0; color: #991B1B; font-size: 14px; line-height: 1.6;">
                  If you didn't attempt to log in, please change your password immediately and enable two-factor authentication.
                </p>
              </div>
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

