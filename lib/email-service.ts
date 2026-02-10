/**
 * Email Service for BLAZE Wallet
 * Handles sending transactional emails via Resend
 */

import { logger } from './logger';

// Re-export email template functions for backwards compatibility
export { generateWalletStyleEmail as generateWelcomeVerificationEmail } from './email-template';

// Stub functions for priority list (these were never implemented)
export function generateUserConfirmationEmail(params: any): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = `${ASSET_BASE_URL}/icons/icon-512x512.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Priority List - BLAZE Wallet</title>
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
                Welcome to BLAZE Priority List
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 20px; font-size: 19px; line-height: 1.7; color: #374151;">
                Thank you for registering for the BLAZE Priority List! We're excited to have you on board.
              </p>
              
              <p style="margin: 0; font-size: 19px; line-height: 1.7; color: #374151;">
                Your wallet address: <strong style="color: #111827;">${params.walletAddress || 'N/A'}</strong>
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
  `;
}

export function generateAdminNotificationEmail(params: any): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = `${ASSET_BASE_URL}/icons/icon-512x512.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Priority List Registration - BLAZE Wallet</title>
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
                New Priority List Registration
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 20px; font-size: 19px; line-height: 1.7; color: #374151;">
                A new user has registered for the BLAZE Priority List.
              </p>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 17px; line-height: 1.7; color: #374151;">
                  <strong style="color: #111827;">Wallet Address:</strong> ${params.walletAddress || 'N/A'}
                </p>
              </div>
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
  `;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  // Development mode: just log the email
  if (!RESEND_API_KEY || process.env.NODE_ENV === 'development') {
    logger.log('📧 [DEV MODE] Email would be sent:', {
      to: options.to,
      subject: options.subject,
      from: options.from || 'BLAZE Wallet <noreply@blazewallet.io>',
    });
    logger.log('Email HTML length:', options.html.length, 'characters');
    return true;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: options.from || 'BLAZE Wallet <noreply@blazewallet.io>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Resend API error: ${data.message || response.statusText}`);
    }

    logger.log('✅ Email sent successfully via Resend:', {
      id: data.id,
      to: options.to,
    });

    return true;
  } catch (error: any) {
    logger.error('❌ Failed to send email via Resend:', error);
    
    // In production, you might want to:
    // 1. Log to error monitoring service (Sentry, etc.)
    // 2. Queue for retry
    // 3. Send alert to ops team
    
    throw error;
  }
}

/**
 * Send device verification email
 */
export async function sendDeviceVerificationEmail(
  email: string,
  code: string,
  deviceInfo: {
    deviceName: string;
    location: string;
    ipAddress: string;
    browser: string;
    os: string;
  }
): Promise<boolean> {
  const formattedCode = `${code.slice(0, 3)}-${code.slice(3)}`;
  
  const html = getDeviceVerificationEmailHTML(formattedCode, deviceInfo);
  
  return sendEmail({
    to: email,
    subject: '🔐 Verify Your New Device - BLAZE Wallet',
    html,
  });
}

/**
 * HTML template for device verification email
 */
function getDeviceVerificationEmailHTML(
  code: string,
  deviceInfo: {
    deviceName: string;
    location: string;
    ipAddress: string;
    browser: string;
    os: string;
  }
): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = `${ASSET_BASE_URL}/icons/icon-512x512.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Device - BLAZE Wallet</title>
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
                Verify Your Device
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 32px; font-size: 19px; line-height: 1.7; color: #374151;">
                We detected a login attempt from a new device. To keep your wallet secure, please verify this device with the code below.
              </p>
            </td>
          </tr>

          <!-- Verification Code -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid #f97316; border-radius: 12px; padding: 40px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #78350f;">Your Verification Code</p>
                <div style="font-size: 48px; font-weight: 700; color: #f97316; letter-spacing: 12px; font-family: 'Courier New', monospace; margin: 20px 0;">
                  ${code}
                </div>
                <p style="margin: 16px 0 0; font-size: 14px; color: #92400e;">Valid for 15 minutes</p>
              </div>
              
              <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.7; color: #374151;">
                After entering this code, you'll be asked to provide your 2FA code from your authenticator app.
              </p>
              
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device Details</h2>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Device:</td>
                          <td style="color: #111827; font-size: 16px;">${deviceInfo.deviceName}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Browser:</td>
                          <td style="color: #111827; font-size: 16px;">${deviceInfo.browser}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">OS:</td>
                          <td style="color: #111827; font-size: 16px;">${deviceInfo.os}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Location:</td>
                          <td style="color: #111827; font-size: 16px;">${deviceInfo.location}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">IP Address:</td>
                          <td style="color: #111827; font-size: 16px;">${deviceInfo.ipAddress}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Didn't try to log in?</p>
                <p style="margin: 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  If you didn't attempt to access your wallet from this device, someone may be trying to access your account. Please change your password immediately and enable additional security measures.
                </p>
              </div>
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
  `;
}
