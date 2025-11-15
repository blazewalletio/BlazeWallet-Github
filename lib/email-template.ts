const ASSET_BASE_URL = 'https://my.blazewallet.io';
const CACHE_BUST = Date.now(); // Force image reload

export interface WalletWelcomeEmailParams {
  email: string;
  verificationLink?: string;
  firstName?: string;
}

export function generateWalletStyleEmail(data: WalletWelcomeEmailParams): string {
  const { verificationLink, firstName } = data;
  const greeting = firstName?.trim() ? firstName.trim() : 'there';
  const heroIcon = `${ASSET_BASE_URL}/email/blaze-icon-white.png?v=${CACHE_BUST}`;
  const featureIcons = {
    layers: `${ASSET_BASE_URL}/email/icons/layers.png?v=${CACHE_BUST}`,
    shield: `${ASSET_BASE_URL}/email/icons/shield.png?v=${CACHE_BUST}`,
    brain: `${ASSET_BASE_URL}/email/icons/brain.png?v=${CACHE_BUST}`,
    zap: `${ASSET_BASE_URL}/email/icons/zap.png?v=${CACHE_BUST}`,
    check: `${ASSET_BASE_URL}/email/icons/check.png?v=${CACHE_BUST}`,
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.1); overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%); padding:48px 32px; text-align:center;">
              <img src="${heroIcon}" width="64" height="64" alt="BLAZE icon" style="display:block; width:64px; height:64px; margin:0 auto 16px auto; border-radius:18px;" />
              <h1 style="margin:0; color:#ffffff; font-size:32px; font-weight:800; text-shadow:0 2px 8px rgba(0,0,0,0.15);">BLAZE Wallet</h1>
              <p style="margin:12px 0 0 0; color:rgba(255,255,255,0.95); font-size:16px; font-weight:500;">Multi-Chain Crypto Wallet</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px 32px 32px;">
              <h2 style="margin:0 0 12px 0; color:#111827; font-size:28px; font-weight:700; text-align:center;">Welcome, ${greeting}!</h2>
              <p style="margin:0; color:#6b7280; font-size:16px; line-height:1.6; text-align:center;">
                Your BLAZE Wallet is ready. Start managing crypto across 18+ blockchains.
              </p>
            </td>
          </tr>
          ${verificationLink ? `
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%); border:1px solid #f59e0b; border-radius:12px; padding:24px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:12px;">
                          <img src="${featureIcons.shield}" width="32" height="32" alt="Shield" style="display:block; width:32px; height:32px;" />
                        </td>
                        <td align="left">
                          <p style="margin:0 0 4px 0; color:#92400e; font-size:15px; font-weight:600;">Verify your email to unlock all features</p>
                          <p style="margin:0; color:#a16207; font-size:13px;">Click below to complete setup</p>
                        </td>
                      </tr>
                    </table>
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                      <tr>
                        <td style="border-radius:12px; background:linear-gradient(135deg,#f97316 0%,#ef4444 100%); box-shadow:0 4px 12px rgba(249,115,22,0.3);">
                          <a href="${verificationLink}" style="display:inline-block; padding:16px 40px; color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; border-radius:12px;">Verify Email</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:12px 0 0 0; color:#78716c; font-size:12px;">Link expires in 24 hours</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <h3 style="margin:0 0 20px 0; color:#111827; font-size:20px; font-weight:700;">Key Features</h3>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="48%" valign="top" style="padding:0 2% 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%); border-radius:12px;">
                      <tr>
                        <td style="padding:20px; height:180px;">
                          <div style="width:48px; height:48px; background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%); border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
                            <img src="${featureIcons.layers}" width="32" height="32" alt="18 chains" style="display:block; width:32px; height:32px;" />
                          </div>
                          <h4 style="margin:0 0 6px 0; color:#111827; font-size:15px; font-weight:700;">18 Blockchains</h4>
                          <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.4;">Full EVM, Solana & Bitcoin support</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="48%" valign="top" style="padding:0 0 12px 2%;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%); border-radius:12px;">
                      <tr>
                        <td style="padding:20px; height:180px;">
                          <div style="width:48px; height:48px; background:linear-gradient(135deg,#10b981 0%,#059669 100%); border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
                            <img src="${featureIcons.shield}" width="32" height="32" alt="Security" style="display:block; width:32px; height:32px;" />
                          </div>
                          <h4 style="margin:0 0 6px 0; color:#111827; font-size:15px; font-weight:700;">Bank-Grade Security</h4>
                          <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.4;">Face ID, encryption & WebAuthn</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="48%" valign="top" style="padding:12px 2% 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%); border-radius:12px;">
                      <tr>
                        <td style="padding:20px; height:180px;">
                          <div style="width:48px; height:48px; background:linear-gradient(135deg,#a855f7 0%,#9333ea 100%); border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
                            <img src="${featureIcons.brain}" width="32" height="32" alt="AI" style="display:block; width:32px; height:32px;" />
                          </div>
                          <h4 style="margin:0 0 6px 0; color:#111827; font-size:15px; font-weight:700;">AI-Powered</h4>
                          <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.4;">Smart assistant & scam detector</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="48%" valign="top" style="padding:12px 0 0 2%;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%); border-radius:12px;">
                      <tr>
                        <td style="padding:20px; height:180px;">
                          <div style="width:48px; height:48px; background:linear-gradient(135deg,#f97316 0%,#fb923c 100%); border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
                            <img src="${featureIcons.zap}" width="32" height="32" alt="Ecosystem" style="display:block; width:32px; height:32px;" />
                          </div>
                          <h4 style="margin:0 0 6px 0; color:#111827; font-size:15px; font-weight:700;">BLAZE Ecosystem</h4>
                          <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.4;">Stake, earn cashback & govern</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(249,115,22,0.05) 0%,rgba(251,146,60,0.05) 100%); border:1px solid rgba(249,115,22,0.2); border-radius:12px; padding:24px;">
                <tr>
                  <td>
                    ${[
                      {
                        title: '2% Cashback in BLAZE',
                        body: 'Earn rewards automatically on every transaction',
                      },
                      {
                        title: 'Smart Transaction Scheduler',
                        body: 'Schedule transfers for optimal gas prices and timing',
                      },
                      {
                        title: 'AI Risk Scanner',
                        body: 'Real-time protection against scams and malicious contracts',
                      },
                      {
                        title: 'Stake & Earn up to 20% APY',
                        body: 'Lock BLAZE tokens for rewards and governance rights',
                      },
                    ].map(item => `
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                        <tr>
                          <td width="24" valign="top" style="padding-right:12px;">
                            <img src="${featureIcons.check}" width="18" height="18" alt="Check" style="display:block; width:18px; height:18px;" />
                          </td>
                          <td>
                            <h4 style="margin:0 0 4px 0; color:#111827; font-size:14px; font-weight:700;">${item.title}</h4>
                            <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">${item.body}</p>
                          </td>
                        </tr>
                      </table>
                    `).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <h3 style="margin:0 0 20px 0; color:#111827; font-size:20px; font-weight:700;">Getting Started</h3>
              ${[
                { step: '1', title: 'Add Funds', body: 'Transfer crypto from an exchange or buy directly in the wallet.' },
                { step: '2', title: 'Explore AI Tools', body: 'Try AI Assistant, Scam Detector, and Portfolio Advisor.' },
                { step: '3', title: 'Stake BLAZE', body: 'Lock tokens for up to 20% APY and governance rights.' },
                { step: '4', title: 'Earn Cashback', body: 'Get 2% back in BLAZE on every swap, send, or purchase.' },
              ].map(item => `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                  <tr>
                    <td width="40" valign="top" style="padding-right:16px;">
                      <div style="width:32px; height:32px; background:linear-gradient(135deg,#f97316 0%,#ef4444 100%); border-radius:50%; color:#ffffff; font-weight:700; font-size:14px; line-height:32px; text-align:center;">${item.step}</div>
                    </td>
                    <td>
                      <h4 style="margin:0 0 4px 0; color:#111827; font-size:14px; font-weight:700;">${item.title}</h4>
                      <p style="margin:0; color:#6b7280; font-size:13px;">${item.body}</p>
                    </td>
                  </tr>
                </table>
              `).join('')}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:12px; background:linear-gradient(135deg,#f97316 0%,#fb923c 100%); box-shadow:0 4px 12px rgba(249,115,22,0.3);">
                    <a href="https://my.blazewallet.io" style="display:inline-block; padding:16px 48px; color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; border-radius:12px;">Open Wallet</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:12px; padding:20px; text-align:center;">
                <tr>
                  <td>
                    <h4 style="margin:0 0 8px 0; color:#111827; font-size:16px; font-weight:700;">Need Help?</h4>
                    <p style="margin:0 0 12px 0; color:#6b7280; font-size:13px; line-height:1.6;">Our support team is ready 24/7 for any questions.</p>
                    <a href="mailto:support@blazewallet.io" style="color:#f97316; text-decoration:none; font-weight:600; font-size:14px;">support@blazewallet.io</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px; background:#111827; text-align:center; border-radius:0 0 16px 16px;">
              <p style="margin:0 0 8px 0; color:#d1d5db; font-size:14px; font-weight:600;">BLAZE Wallet</p>
              <p style="margin:0 0 16px 0; color:#9ca3af; font-size:12px;">The Most Advanced Multi-Chain Web3 Wallet</p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                <tr>
                  <td><a href="https://my.blazewallet.io" style="color:#d1d5db; text-decoration:none; font-size:13px; padding:0 10px; font-weight:500;">Wallet</a></td>
                  <td style="color:#6b7280;">|</td>
                  <td><a href="https://my.blazewallet.io/about" style="color:#d1d5db; text-decoration:none; font-size:13px; padding:0 10px; font-weight:500;">About</a></td>
                  <td style="color:#6b7280;">|</td>
                  <td><a href="https://my.blazewallet.io/security" style="color:#d1d5db; text-decoration:none; font-size:13px; padding:0 10px; font-weight:500;">Security</a></td>
                  <td style="color:#6b7280;">|</td>
                  <td><a href="https://my.blazewallet.io/docs" style="color:#d1d5db; text-decoration:none; font-size:13px; padding:0 10px; font-weight:500;">Docs</a></td>
                </tr>
              </table>
              <p style="margin:0; color:#6b7280; font-size:11px; line-height:1.6;">
                You're receiving this because you created an account at my.blazewallet.io<br />
                © 2025 BLAZE Wallet. All rights reserved.
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
