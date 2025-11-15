import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const RESEND_API_KEY = 're_GSrnNH5V_NDNNHf7dDeFjEqJ2xR6CZeSx';
const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from || 'BLAZE Wallet <noreply@blazewallet.io>',
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Resend API error:', error);
      return { success: false, error: `Failed to send email: ${error}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    logger.error('Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Generate welcome + verification email HTML
 * This is the MAIN email users receive when signing up
 */
export function generateWelcomeVerificationEmail(data: {
  email: string;
  verificationLink: string;
  firstName?: string;
}): string {
  const { email, verificationLink, firstName } = data;
  const greeting = firstName ? firstName : 'there';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Wallet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  
  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f97316 0%, #eab308 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <div style="font-size: 64px; margin-bottom: 16px;">🔥</div>
        <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Welcome to BLAZE!</h1>
        <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">
          The Ultimate Multi-Chain Crypto Wallet
        </p>
      </td>
    </tr>
  </table>

  <!-- MAIN CONTENT -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- VERIFICATION SECTION (TOP PRIORITY) -->
          <tr>
            <td style="padding: 32px 30px; text-align: center; background-color: #fef3c7; border-radius: 16px 16px 0 0; border-bottom: 3px solid #f59e0b;">
              <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
              <h2 style="margin: 0 0 12px 0; color: #92400e; font-size: 22px; font-weight: bold;">
                One Last Step - Verify Your Email
              </h2>
              <p style="margin: 0 0 20px 0; color: #92400e; font-size: 15px; line-height: 1.5;">
                Click below to verify your email and unlock all BLAZE features!
              </p>
              
              <!-- BIG CTA BUTTON -->
              <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);">
                ✨ Verify My Email
              </a>
              
              <p style="margin: 16px 0 0 0; color: #78716c; font-size: 13px;">
                Link expires in 24 hours
              </p>
            </td>
          </tr>

          <!-- WELCOME MESSAGE -->
          <tr>
            <td style="padding: 32px 30px;">
              <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: bold;">
                🎉 Hi ${greeting}, Your Wallet is Ready!
              </h3>
              <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 15px; line-height: 1.7;">
                You've just created your <strong>BLAZE Wallet</strong> - the fastest way to send, receive, and swap crypto across <strong>18+ blockchains</strong>!
              </p>
              <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.7;">
                Your seed phrase is already backed up securely. Now let's get you verified so you can access all features!
              </p>
            </td>
          </tr>

          <!-- FEATURES GRID -->
          <tr>
            <td style="padding: 0 30px 32px 30px;">
              <h3 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: bold; text-align: center;">
                🔥 What You Get with BLAZE
              </h3>
              
              <!-- Row 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                <tr>
                  <td width="32%" style="padding: 16px; background-color: #fef3c7; border-radius: 12px; vertical-align: top;" align="center">
                    <div style="font-size: 32px; margin-bottom: 8px;">⚡</div>
                    <div style="color: #92400e; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Lightning Fast</div>
                    <div style="color: #a16207; font-size: 12px;">Instant swaps & transfers</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="padding: 16px; background-color: #dbeafe; border-radius: 12px; vertical-align: top;" align="center">
                    <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
                    <div style="color: #1e40af; font-size: 14px; font-weight: 600; margin-bottom: 4px;">18+ Chains</div>
                    <div style="color: #1e40af; font-size: 12px;">All your crypto in one place</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="padding: 16px; background-color: #dcfce7; border-radius: 12px; vertical-align: top;" align="center">
                    <div style="font-size: 32px; margin-bottom: 8px;">🔐</div>
                    <div style="color: #166534; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Fort Knox Security</div>
                    <div style="color: #166534; font-size: 12px;">Face ID + encryption</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FEATURES LIST -->
          <tr>
            <td style="padding: 0 30px 32px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 12px; padding: 24px;">
                <tr>
                  <td>
                    <div style="margin-bottom: 16px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="24" style="color: #10b981; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                          <td>
                            <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 2px;">Smart Send Scheduler</div>
                            <div style="color: #6b7280; font-size: 13px;">Schedule transactions for optimal gas prices</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="24" style="color: #10b981; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                          <td>
                            <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 2px;">2% Cashback in BLAZE</div>
                            <div style="color: #6b7280; font-size: 13px;">Earn rewards on every transaction</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="24" style="color: #10b981; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                          <td>
                            <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 2px;">AI Transaction Assistant</div>
                            <div style="color: #6b7280; font-size: 13px;">GPT-4 powered crypto help</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <div>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="24" style="color: #10b981; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                          <td>
                            <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 2px;">Staking & Governance</div>
                            <div style="color: #6b7280; font-size: 13px;">Earn up to 20% APY on BLAZE tokens</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- GETTING STARTED -->
          <tr>
            <td style="padding: 0 30px 32px 30px;">
              <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: bold;">
                🚀 Get Started in 3 Steps
              </h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="40" style="vertical-align: top; padding-right: 16px;">
                    <div style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; text-align: center; line-height: 32px;">1</div>
                  </td>
                  <td>
                    <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Verify your email</div>
                    <div style="color: #6b7280; font-size: 13px;">Click the button above to verify</div>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="40" style="vertical-align: top; padding-right: 16px;">
                    <div style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; text-align: center; line-height: 32px;">2</div>
                  </td>
                  <td>
                    <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Add funds to your wallet</div>
                    <div style="color: #6b7280; font-size: 13px;">Buy crypto or transfer from another wallet</div>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" style="vertical-align: top; padding-right: 16px;">
                    <div style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; text-align: center; line-height: 32px;">3</div>
                  </td>
                  <td>
                    <div style="color: #111827; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Start trading!</div>
                    <div style="color: #6b7280; font-size: 13px;">Swap, send, stake - all in one place</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SECONDARY CTA -->
          <tr>
            <td style="padding: 0 30px 32px 30px;" align="center">
              <a href="https://my.blazewallet.io" style="display: inline-block; background-color: #f9fafb; border: 2px solid #f97316; color: #f97316; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
                🔥 Open BLAZE Wallet
              </a>
            </td>
          </tr>

          <!-- HELP SECTION -->
          <tr>
            <td style="padding: 0 30px 32px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; padding: 20px;">
                <tr>
                  <td>
                    <div style="color: #1e40af; font-size: 14px; font-weight: 600; margin-bottom: 8px;">📞 Need Help?</div>
                    <div style="color: #1e40af; font-size: 13px; line-height: 1.6;">
                      • <a href="https://docs.blazewallet.io" style="color: #3b82f6; text-decoration: none;">Read our docs</a><br>
                      • <a href="https://t.me/blazewallet" style="color: #3b82f6; text-decoration: none;">Join our Telegram</a><br>
                      • <a href="mailto:support@blazewallet.io" style="color: #3b82f6; text-decoration: none;">Email support</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; padding: 32px 20px;">
    <tr>
      <td align="center">
        <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
          BLAZE Wallet
        </p>
        <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 13px;">
          The Future of Multi-Chain Crypto
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          <a href="https://blazewallet.io" style="color: #f97316; text-decoration: none;">Website</a> •
          <a href="https://twitter.com/blazewallet" style="color: #f97316; text-decoration: none;">Twitter</a> •
          <a href="https://t.me/blazewallet" style="color: #f97316; text-decoration: none;">Telegram</a> •
          <a href="https://discord.gg/blazewallet" style="color: #f97316; text-decoration: none;">Discord</a>
        </p>
        <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 11px;">
          This email was sent to ${email} because you created a BLAZE Wallet account.
        </p>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

/**
 * Generate user confirmation email HTML (for Priority List)
 */
export function generateUserConfirmationEmail(data: {
  walletAddress: string;
  registeredAt: Date;
  referralCode?: string;
}): string {
  const { walletAddress, registeredAt, referralCode } = data;
  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const formattedDate = registeredAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Priority List</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔥</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Welcome to BLAZE Priority List!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: bold;">You're In! 🎉</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Congratulations! You've successfully registered for the BLAZE Token Presale Priority List.
              </p>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; font-weight: bold;">Your Priority List Benefits:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.8;">
                      <li>48-hour exclusive early access to the presale</li>
                      <li>Guaranteed allocation (first come, first served)</li>
                      <li>2.4x gain potential at launch ($0.008333 → $0.02)</li>
                      <li>Referral rewards program</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Registration Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: bold;">Registration Details</h3>
                    
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Wallet Address:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${shortAddress}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Registered:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${formattedDate}</td>
                      </tr>
                      ${referralCode ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Your Referral Code:</td>
                        <td style="color: #f97316; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${referralCode}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              ${referralCode ? `
              <!-- Referral Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border-radius: 12px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🎁</div>
                    <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 18px; font-weight: bold;">Share & Earn Rewards</h3>
                    <p style="margin: 0 0 16px 0; color: #92400e; font-size: 14px;">
                      Share your referral code with friends and earn rewards when they join!
                    </p>
                    <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                      <code style="color: #f97316; font-size: 20px; font-weight: bold; letter-spacing: 1px;">${referralCode}</code>
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Timeline -->
              <h3 style="margin: 32px 0 20px 0; color: #111827; font-size: 18px; font-weight: bold;">What's Next?</h3>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-left: 3px solid #f97316; padding-left: 16px;">
                    <div style="color: #f97316; font-size: 14px; font-weight: bold; margin-bottom: 4px;">October 30, 2025</div>
                    <div style="color: #4b5563; font-size: 14px;">Presale opens exclusively for Priority List members</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-left: 3px solid #10b981; padding-left: 16px;">
                    <div style="color: #10b981; font-size: 14px; font-weight: bold; margin-bottom: 4px;">November 1, 2025</div>
                    <div style="color: #4b5563; font-size: 14px;">Presale opens to the public</div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="https://my.blazewallet.io" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; font-size: 16px;">
                      Open BLAZE Wallet
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                We'll send you another email when the presale goes live. Keep an eye on your inbox!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                <strong style="color: #111827;">BLAZE Wallet</strong> - The Future of Crypto Payments
              </p>
              <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 12px;">
                This email was sent to confirm your Priority List registration.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <a href="https://blazewallet.io" style="color: #f97316; text-decoration: none;">Visit Website</a> •
                <a href="https://twitter.com/blazewallet" style="color: #f97316; text-decoration: none;">Twitter</a> •
                <a href="https://t.me/blazewallet" style="color: #f97316; text-decoration: none;">Telegram</a>
              </p>
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

/**
 * Generate admin notification email HTML
 */
export function generateAdminNotificationEmail(data: {
  walletAddress: string;
  email?: string;
  telegram?: string;
  twitter?: string;
  registeredAt: Date;
  referralCode?: string;
  referredBy?: string;
}): string {
  const { walletAddress, email, telegram, twitter, registeredAt, referralCode, referredBy } = data;
  const formattedDate = registeredAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Priority List Registration</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #111827; padding: 30px; text-align: center;">
              <div style="font-size: 36px; margin-bottom: 12px;">🔥</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">New Priority List Registration</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px;">
                A new user has registered for the BLAZE Priority List!
              </p>

              <!-- User Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: bold;">Registration Details</h3>
                    
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0; width: 40%;">Wallet Address:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;"><code>${walletAddress}</code></td>
                      </tr>
                      ${email ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Email:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${email}</td>
                      </tr>
                      ` : ''}
                      ${telegram ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Telegram:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${telegram}</td>
                      </tr>
                      ` : ''}
                      ${twitter ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Twitter:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${twitter}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Registered At:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${formattedDate}</td>
                      </tr>
                      ${referralCode ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Referral Code:</td>
                        <td style="color: #f97316; font-size: 14px; font-weight: 600; padding: 8px 0;">${referralCode}</td>
                      </tr>
                      ` : ''}
                      ${referredBy ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Referred By:</td>
                        <td style="color: #10b981; font-size: 14px; font-weight: 600; padding: 8px 0;"><code>${referredBy}</code></td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Required -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                      <strong>Next Steps:</strong><br>
                      • Verify the registration in your admin dashboard<br>
                      • Check wallet address validity<br>
                      • Monitor for presale participation
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                This is an automated notification from BLAZE Wallet Priority List System
              </p>
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

