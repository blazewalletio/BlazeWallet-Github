/**
 * Email Service for BLAZE Wallet
 * Handles sending transactional emails via Resend
 */

import { logger } from './logger';
import {
  getEmailFooter,
  getEmailHeader,
  getEmailSupportSection,
  getEmailWrapper,
  getEmailWrapperClose,
} from './email-template-helpers';

// Re-export email template functions for backwards compatibility
export { generateWalletStyleEmail as generateWelcomeVerificationEmail } from './email-template';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLocation(location: unknown): string {
  if (!location) return 'Unknown';
  if (typeof location === 'string') return location;
  if (typeof location === 'object') {
    const loc = location as Record<string, unknown>;
    const parts = [loc.city, loc.region, loc.country]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .map((part) => String(part).trim());
    if (parts.length > 0) return parts.join(', ');
  }
  return 'Unknown';
}

function getUniformHero(title: string, subtitle: string): string {
  return `
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                ${escapeHtml(title)}
              </h1>
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              <p style="margin: 0; font-size: 19px; line-height: 1.7; color: #374151;">
                ${escapeHtml(subtitle)}
              </p>
            </td>
          </tr>
  `;
}

export function generateDeviceVerificationCodeEmailTemplate(params: {
  code: string;
  deviceName: string;
  location?: unknown;
  browser?: string;
  os?: string;
  ipAddress?: string;
  expiresMinutes?: number;
}): string {
  const {
    code,
    deviceName,
    location,
    browser,
    os,
    ipAddress,
    expiresMinutes = 15,
  } = params;
  const normalizedLocation = formatLocation(location);
  const safeCode = escapeHtml(code);
  const nowText = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  return `
${getEmailWrapper('Device Verification Code - BLAZE Wallet')}
${getEmailHeader()}
${getUniformHero('Device Verification Code', 'We detected a sign-in attempt from a new device. Verify this device with the code below to continue securely.')}
          <tr>
            <td style="padding: 0 48px 48px;">
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">🔐 Security check</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px; line-height: 1.6;">This code is valid for ${expiresMinutes} minutes and can only be used once.</p>
              </div>

              <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid #f97316; border-radius: 12px; padding: 36px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #78350f; letter-spacing: 1px;">Your verification code</p>
                <div style="font-size: 46px; font-weight: 700; color: #f97316; letter-spacing: 10px; font-family: 'Courier New', monospace; margin: 20px 0;">
                  ${safeCode}
                </div>
                <p style="margin: 16px 0 0; font-size: 14px; color: #92400e;">Expires in ${expiresMinutes} minutes</p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device details</h2>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                <p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Device:</strong> ${escapeHtml(deviceName)}</p>
                <p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Location:</strong> ${escapeHtml(normalizedLocation)}</p>
                ${browser ? `<p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Browser:</strong> ${escapeHtml(browser)}</p>` : ''}
                ${os ? `<p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">OS:</strong> ${escapeHtml(os)}</p>` : ''}
                ${ipAddress ? `<p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">IP Address:</strong> ${escapeHtml(ipAddress)}</p>` : ''}
                <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Time:</strong> ${escapeHtml(nowText)}</p>
              </div>

              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px;">
                <p style="margin: 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  <strong>⚠️ Didn't request this?</strong> If this was not you, change your password immediately and contact support.
                </p>
              </div>
            </td>
          </tr>
${getEmailSupportSection()}
${getEmailFooter()}
${getEmailWrapperClose()}
  `;
}

export function generateDeviceVerificationLinkEmailTemplate(params: {
  deviceName: string;
  verificationLink: string;
  location?: unknown;
  expiresHours?: number;
}): string {
  const {
    deviceName,
    verificationLink,
    location,
    expiresHours = 24,
  } = params;
  const normalizedLocation = formatLocation(location);
  const nowText = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  return `
${getEmailWrapper('New Device Login - BLAZE Wallet')}
${getEmailHeader()}
${getUniformHero('New Device Login Detected', 'We detected a sign-in attempt from a new device. Verify this device before it can access your wallet.')}
          <tr>
            <td style="padding: 0 48px 48px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device details</h2>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                <p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Device:</strong> ${escapeHtml(deviceName)}</p>
                <p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Location:</strong> ${escapeHtml(normalizedLocation)}</p>
                <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Time:</strong> ${escapeHtml(nowText)}</p>
              </div>

              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 28px;">
                <tr>
                  <td style="background: #111827; border-radius: 10px;">
                    <a href="${verificationLink}" style="display: block; padding: 18px 48px; color: white; text-decoration: none; font-weight: 600; font-size: 17px; letter-spacing: -0.01em;">
                      Verify this device →
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 18px;">
                <p style="margin: 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  This verification link expires in <strong>${expiresHours} hours</strong>.
                </p>
              </div>

              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px;">
                <p style="margin: 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  <strong>⚠️ Didn't request this?</strong> If this was not you, change your password immediately and contact support.
                </p>
              </div>
            </td>
          </tr>
${getEmailSupportSection()}
${getEmailFooter()}
${getEmailWrapperClose()}
  `;
}

export function generateSecurityAlertEmailTemplate(params: {
  alertTitle: string;
  alertMessage: string;
  actionMessage: string;
  deviceName?: string;
  location?: unknown;
  ipAddress?: string;
  riskScore?: number;
}): string {
  const {
    alertTitle,
    alertMessage,
    actionMessage,
    deviceName,
    location,
    ipAddress,
    riskScore,
  } = params;
  const normalizedLocation = formatLocation(location);
  const nowText = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  return `
${getEmailWrapper(`${alertTitle} - BLAZE Wallet`)}
${getEmailHeader()}
${getUniformHero(alertTitle, alertMessage)}
          <tr>
            <td style="padding: 0 48px 48px;">
              <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 16px; color: #991b1b; line-height: 1.6;">
                  ${escapeHtml(actionMessage)}
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Activity details</h2>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
                ${deviceName ? `<p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Device:</strong> ${escapeHtml(deviceName)}</p>` : ''}
                <p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Location:</strong> ${escapeHtml(normalizedLocation)}</p>
                ${ipAddress ? `<p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">IP Address:</strong> ${escapeHtml(ipAddress)}</p>` : ''}
                ${typeof riskScore === 'number' ? `<p style="margin: 0 0 10px; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Risk Score:</strong> ${riskScore}/100</p>` : ''}
                <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;"><strong style="color: #111827;">Time:</strong> ${escapeHtml(nowText)}</p>
              </div>
            </td>
          </tr>
${getEmailSupportSection()}
${getEmailFooter()}
${getEmailWrapperClose()}
  `;
}

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
  const normalizedCode = code.replace(/\D/g, '').slice(0, 6) || code;
  const html = generateDeviceVerificationCodeEmailTemplate({
    code: normalizedCode,
    deviceName: deviceInfo.deviceName,
    location: deviceInfo.location,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    ipAddress: deviceInfo.ipAddress,
    expiresMinutes: 15,
  });
  
  return sendEmail({
    to: email,
    subject: '🔐 Verify Your New Device - BLAZE Wallet',
    html,
  });
}

