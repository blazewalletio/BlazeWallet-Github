import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

function generateDeviceCodeEmail(deviceName: string, verificationCode: string, location?: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <!--[if mso]>
  <style>
    table {border-collapse:collapse;border:0;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>Device Verification Code - BLAZE Wallet</title>
  <style>
    @media (max-width: 600px) {
      .mobile-padding { padding: 20px 15px !important; }
      .mobile-text { font-size: 14px !important; }
      .code-text { font-size: 36px !important; letter-spacing: 4px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:#f3f4f6;">
  <div role="article" aria-roledescription="email" lang="en" style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:#f3f4f6;">
    <table role="presentation" style="width:100%;border:0;border-spacing:0;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <!--[if mso]>
          <table role="presentation" align="center" style="width:600px;">
          <tr>
          <td>
          <![endif]-->
          <table role="presentation" style="width:100%;max-width:600px;border:0;border-spacing:0;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:24px;color:#111827;">
            
            <!-- Header -->
            <tr>
              <td style="padding:0;border-radius:16px 16px 0 0;background-color:#FF6B35;background-image:linear-gradient(135deg,#FF6B35 0%,#F7931E 100%);">
                <table role="presentation" style="width:100%;border:0;border-spacing:0;">
                  <tr>
                    <td style="padding:40px 30px;text-align:center;">
                      <div style="font-size:48px;line-height:48px;margin-bottom:20px;">🔥</div>
                      <h1 style="margin:0;font-size:28px;line-height:36px;font-weight:700;color:#ffffff;">Verify Your Device</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- Main Content -->
            <tr>
              <td style="padding:40px 30px;background-color:#ffffff;" class="mobile-padding">
                
                <!-- Security Alert -->
                <table role="presentation" style="width:100%;border:0;border-spacing:0;margin-bottom:30px;">
                  <tr>
                    <td style="padding:16px;background-color:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;">
                      <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#92400E;">🔐 Security Check</p>
                      <p style="margin:0;font-size:14px;line-height:20px;color:#92400E;">We detected a login from a new device.</p>
                    </td>
                  </tr>
                </table>
                
                <!-- Device Details -->
                <h2 style="margin:0 0 20px 0;font-size:20px;line-height:28px;font-weight:600;color:#1F2937;">Device Details:</h2>
                
                <table role="presentation" style="width:100%;border:0;border-spacing:0;margin-bottom:30px;background-color:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
                  <tr>
                    <td style="padding:20px;">
                      <p style="margin:0 0 12px 0;font-size:14px;line-height:20px;color:#6B7280;">
                        <strong style="color:#1F2937;">Device:</strong> ${deviceName}
                      </p>
                      ${location ? `
                      <p style="margin:0 0 12px 0;font-size:14px;line-height:20px;color:#6B7280;">
                        <strong style="color:#1F2937;">Location:</strong> ${location}
                      </p>
                      ` : ''}
                      <p style="margin:0;font-size:14px;line-height:20px;color:#6B7280;">
                        <strong style="color:#1F2937;">Time:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                      </p>
                    </td>
                  </tr>
                </table>
                
                <!-- Instruction Text -->
                <p style="margin:0 0 24px 0;font-size:16px;line-height:24px;font-weight:500;color:#1F2937;">
                  Enter this 6-digit code in the BLAZE Wallet app to verify this device:
                </p>
                
                <!-- Verification Code Box -->
                <table role="presentation" style="width:100%;border:0;border-spacing:0;margin-bottom:30px;">
                  <tr>
                    <td style="padding:30px;text-align:center;background-color:#FF6B35;background-image:linear-gradient(135deg,#FF6B35 0%,#F7931E 100%);border-radius:16px;">
                      <p style="margin:0 0 12px 0;font-size:12px;line-height:16px;font-weight:600;color:#ffffff;text-transform:uppercase;letter-spacing:2px;">Your Verification Code</p>
                      <div style="display:inline-block;padding:15px 20px;background-color:rgba(0,0,0,0.15);border-radius:12px;">
                        <p style="margin:0;font-size:42px;line-height:48px;font-weight:700;color:#ffffff;letter-spacing:8px;font-family:'Courier New',Courier,monospace;" class="code-text">${verificationCode}</p>
                      </div>
                    </td>
                  </tr>
                </table>
                
                <!-- Important Info -->
                <table role="presentation" style="width:100%;border:0;border-spacing:0;margin-bottom:30px;">
                  <tr>
                    <td style="padding:20px;background-color:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;">
                      <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#1E40AF;">ℹ️ Important</p>
                      <table role="presentation" style="width:100%;border:0;border-spacing:0;">
                        <tr>
                          <td style="padding:0 0 8px 0;font-size:14px;line-height:20px;color:#1E40AF;">• This code expires in <strong>15 minutes</strong></td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 8px 0;font-size:14px;line-height:20px;color:#1E40AF;">• Never share this code with anyone</td>
                        </tr>
                        <tr>
                          <td style="padding:0;font-size:14px;line-height:20px;color:#1E40AF;">• BLAZE support will never ask for this code</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                
                <!-- Security Warning -->
                <table role="presentation" style="width:100%;border:0;border-spacing:0;">
                  <tr>
                    <td style="padding:20px;background-color:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;">
                      <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#991B1B;">⚠️ Didn't request this?</p>
                      <p style="margin:0;font-size:14px;line-height:20px;color:#991B1B;">
                        If you didn't attempt to log in, please change your password immediately and enable two-factor authentication.
                      </p>
                    </td>
                  </tr>
                </table>
                
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding:30px;text-align:center;background-color:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 16px 16px;">
                <p style="margin:0 0 8px 0;font-size:14px;line-height:20px;color:#6B7280;">
                  Need help? Visit <a href="https://my.blazewallet.io/support" style="color:#FF6B35;text-decoration:none;">BLAZE Support</a>
                </p>
                <p style="margin:0;font-size:12px;line-height:16px;color:#9CA3AF;">
                  © 2026 BLAZE Wallet. All rights reserved.
                </p>
              </td>
            </tr>
            
          </table>
          <!--[if mso]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </div>
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

