export default function Mail4() {
  return (
    <iframe
      srcDoc={`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Wallet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: white;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
          
          <!-- Minimalist Header -->
          <tr>
            <td style="padding: 64px 56px 48px; border-bottom: 1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 40px;">
                    <img src="https://my.blazewallet.io/icons/icon-512x512.png" alt="BLAZE" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 28px; font-size: 44px; font-weight: 700; color: #111827; line-height: 1.1; letter-spacing: -0.03em;">
                You've made a<br />smart choice
              </h1>
              
              <p style="margin: 0; font-size: 20px; line-height: 1.6; color: #6b7280; max-width: 480px;">
                Welcome to BLAZE—where security, simplicity, and rewards come together in one powerful wallet.
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 56px;">
              
              <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.8; color: #4b5563;">
                Most crypto wallets force you to choose: either maximum security with terrible UX, or great design with questionable safety. BLAZE refuses to compromise.
              </p>
              
              <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.8; color: #4b5563;">
                We've built something different—a wallet that's as secure as a hardware wallet, as easy as a fintech app, and actually rewards you for using it.
              </p>

              <p style="margin: 0 0 48px; font-size: 17px; line-height: 1.8; color: #4b5563;">
                Here's what you can expect:
              </p>

              <!-- Features List -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 56px;">
                <tr>
                  <td style="padding-bottom: 32px;">
                    <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #111827; letter-spacing: -0.01em;">
                      Every blockchain. One wallet.
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Manage Bitcoin, Ethereum, Solana, and 15+ other chains without switching apps. Your entire portfolio in one beautiful interface.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 32px;">
                    <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #111827; letter-spacing: -0.01em;">
                      AI that works for you, not against you.
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Real-time scam detection stops threats before they reach you. Portfolio insights help you optimize. Transaction scheduling saves you money on fees.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 32px;">
                    <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #111827; letter-spacing: -0.01em;">
                      Get paid to use your wallet.
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Earn 2% cashback in BLAZE tokens on every transaction. Stake for 20% APY. Other wallets charge you—we pay you.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td>
                    <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #111827; letter-spacing: -0.01em;">
                      Security that never sleeps.
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Biometric authentication. End-to-end encryption. Zero-knowledge architecture. Your keys stay on your device. Always.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Verification -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fafafa; border-radius: 12px; border: 1px solid #f3f4f6; margin-bottom: 48px;">
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                      Let's verify your account
                    </h2>
                    <p style="margin: 0 0 28px; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Click below to verify your email and unlock full access to BLAZE. This link will expire in 24 hours for security.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background: #111827; border-radius: 8px;">
                          <a href="https://my.blazewallet.io/verify?token=demo" style="display: block; padding: 16px 36px; color: white; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: -0.01em;">
                            Verify Email
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 48px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 24px; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                      What to do next
                    </h3>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 12px;" valign="top">
                          <div style="width: 6px; height: 6px; background: #f97316; border-radius: 50%; margin-top: 8px;"></div>
                        </td>
                        <td>
                          <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                            Verify your email (one click above)
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 12px;" valign="top">
                          <div style="width: 6px; height: 6px; background: #f97316; border-radius: 50%; margin-top: 8px;"></div>
                        </td>
                        <td>
                          <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                            Add crypto by transferring from an exchange or buying directly
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 12px;" valign="top">
                          <div style="width: 6px; height: 6px; background: #f97316; border-radius: 50%; margin-top: 8px;"></div>
                        </td>
                        <td>
                          <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                            Try our AI Portfolio Advisor for personalized recommendations
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 12px;" valign="top">
                          <div style="width: 6px; height: 6px; background: #f97316; border-radius: 50%; margin-top: 8px;"></div>
                        </td>
                        <td>
                          <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                            Enable staking to start earning rewards immediately
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top: 32px; border-top: 1px solid #f3f4f6;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.7; color: #4b5563;">
                      Need help? We're here 24/7 at <a href="mailto:support@blazewallet.io" style="color: #f97316; text-decoration: none; font-weight: 600;">support@blazewallet.io</a>
                    </p>
                    
                    <p style="margin: 0 0 4px; font-size: 17px; color: #4b5563;">
                      Best,
                    </p>
                    <p style="margin: 0; font-size: 17px; font-weight: 600; color: #111827;">
                      The BLAZE Team
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #fafafa; padding: 40px 56px; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px;">
                    <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                      BLAZE Wallet
                    </div>
                    <div style="font-size: 14px; color: #6b7280;">
                      Multi-chain crypto wallet
                    </div>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 20px;"><a href="https://my.blazewallet.io/wallet" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">Wallet</a></td>
                        <td style="padding-right: 20px;"><a href="https://my.blazewallet.io/security" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">Security</a></td>
                        <td style="padding-right: 20px;"><a href="https://my.blazewallet.io/support" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">Support</a></td>
                        <td><a href="https://my.blazewallet.io/privacy" style="color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500;">Privacy</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td>
                    <div style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
                      © 2025 BLAZE Wallet. All rights reserved.<br />
                      You're receiving this because you signed up at my.blazewallet.io
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

</body>
</html>
      `}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title="Email Preview - Design 4"
    />
  );
}
