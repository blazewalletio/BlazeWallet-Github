/**
 * Email Service for BLAZE Wallet
 * Handles sending transactional emails via Resend
 */

import { logger } from './logger';

// Re-export email template functions for backwards compatibility
export { generateWalletStyleEmail as generateWelcomeVerificationEmail } from './email-template';

// Stub functions for priority list (these were never implemented)
export function generateUserConfirmationEmail(params: any): string {
  return `<html><body><h1>Thank you for registering!</h1><p>Wallet: ${params.walletAddress}</p></body></html>`;
}

export function generateAdminNotificationEmail(params: any): string {
  return `<html><body><h1>New Registration</h1><p>Wallet: ${params.walletAddress}</p></body></html>`;
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
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Device - BLAZE Wallet</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: white;
      border-radius: 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #eab308 100%);
      padding: 40px 30px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .code-box {
      background: linear-gradient(135deg, #f97316 0%, #eab308 100%);
      color: white;
      padding: 30px;
      border-radius: 16px;
      text-align: center;
      margin: 30px 0;
    }
    .code {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: 8px;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    .device-info {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .device-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .device-row:last-child {
      border-bottom: none;
    }
    .device-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 100px;
    }
    .device-value {
      color: #111827;
    }
    .warning {
      background: #fef3c7;
      border: 2px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .warning-title {
      font-weight: 700;
      color: #92400e;
      margin: 0 0 10px 0;
    }
    .warning-text {
      color: #92400e;
      margin: 0;
    }
    .footer {
      text-align: center;
      padding: 30px;
      color: #6b7280;
      font-size: 14px;
    }
    @media (max-width: 600px) {
      .code {
        font-size: 36px;
        letter-spacing: 4px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🔐 Verify Your Device</h1>
      </div>
      
      <div class="content">
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          We detected a login attempt from a new device. To keep your wallet secure, please verify this device with the code below:
        </p>
        
        <div class="code-box">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">Your Verification Code</div>
          <div class="code">${code}</div>
          <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">Valid for 15 minutes</div>
        </div>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          After entering this code, you'll be asked to provide your 2FA code from your authenticator app.
        </p>
        
        <div class="device-info">
          <div style="font-weight: 700; color: #111827; margin-bottom: 12px;">📱 Device Details</div>
          <div class="device-row">
            <div class="device-label">Device:</div>
            <div class="device-value">${deviceInfo.deviceName}</div>
          </div>
          <div class="device-row">
            <div class="device-label">Browser:</div>
            <div class="device-value">${deviceInfo.browser}</div>
          </div>
          <div class="device-row">
            <div class="device-label">OS:</div>
            <div class="device-value">${deviceInfo.os}</div>
          </div>
          <div class="device-row">
            <div class="device-label">Location:</div>
            <div class="device-value">${deviceInfo.location}</div>
          </div>
          <div class="device-row">
            <div class="device-label">IP Address:</div>
            <div class="device-value">${deviceInfo.ipAddress}</div>
          </div>
        </div>
        
        <div class="warning">
          <div class="warning-title">⚠️ Didn't try to log in?</div>
          <p class="warning-text">
            If you didn't attempt to access your wallet from this device, someone may be trying to access your account. Please change your password immediately and enable additional security measures.
          </p>
        </div>
      </div>
      
      <div class="footer">
        <p style="margin: 0 0 10px 0;">
          This is an automated security email from BLAZE Wallet.
        </p>
        <p style="margin: 0;">
          © ${new Date().getFullYear()} BLAZE Wallet. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
