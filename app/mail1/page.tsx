export default function Mail1() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    
    <!-- Header -->
    <div style="background: white; padding: 40px 40px 32px; border-bottom: 1px solid #f1f1f1;">
      <img src="https://my.blazewallet.io/icons/icon-512x512.png" alt="BLAZE Wallet" width="56" height="56" style="display: block; margin-bottom: 16px; border-radius: 12px;" />
    </div>

    <!-- Main Content -->
    <div style="padding: 48px 40px;">
      
      <h1 style="margin: 0 0 16px; font-size: 32px; font-weight: 700; color: #111827; line-height: 1.2;">
        Welcome to the future of crypto
      </h1>
      
      <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.6; color: #4b5563; font-weight: 500;">
        Hi there,
      </p>
      
      <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.6; color: #4b5563;">
        Thanks for creating your BLAZE Wallet account. You're now part of a new generation of crypto users who refuse to compromise on security, speed, or simplicity.
      </p>
      
      <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.6; color: #4b5563;">
        BLAZE is built different. We've combined enterprise-grade security with the kind of user experience you'd expect from the world's best fintech apps. No more confusing interfaces. No more worrying about scams. Just pure, powerful crypto management.
      </p>

      <!-- Verification Box -->
      <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fbbf24; border-radius: 12px; padding: 32px; margin-bottom: 40px;">
        <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #92400e;">
          Verify your email to get started
        </h2>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #78350f;">
          Click the button below to verify your email address and unlock all features. This link expires in 24 hours for your security.
        </p>
        <a href="${verificationLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Verify Email Address
        </a>
      </div>

      <!-- Why BLAZE -->
      <h3 style="margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #111827;">
        Why BLAZE is different
      </h3>
      
      <div style="margin-bottom: 40px;">
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #111827;">
            True multi-chain support
          </h4>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #6b7280;">
            Manage assets across 18+ blockchains including Ethereum, Solana, Bitcoin, and all major networks—all from one beautiful interface.
          </p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #111827;">
            AI-powered protection
          </h4>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #6b7280;">
            Our intelligent scam detector analyzes every transaction in real-time, protecting you from malicious contracts and phishing attempts before you even click.
          </p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #111827;">
            Earn while you hold
          </h4>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #6b7280;">
            Get 2% cashback in BLAZE tokens on every transaction. Stake your tokens for up to 20% APY. Your crypto should work for you.
          </p>
        </div>
        
        <div>
          <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #111827;">
            Bank-level security
          </h4>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #6b7280;">
            Face ID, hardware encryption, and WebAuthn support. Your private keys never leave your device, and we never have access to your funds.
          </p>
        </div>
      </div>

      <!-- Get Started -->
      <div style="background: #f9fafb; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 20px; font-weight: 700; color: #111827;">
          Your first steps with BLAZE
        </h3>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="color: #f97316; font-weight: 700; font-size: 15px; min-width: 24px;">1.</div>
          <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Verify your email (you're already here!)</p>
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="color: #f97316; font-weight: 700; font-size: 15px; min-width: 24px;">2.</div>
          <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Add your first assets by connecting an exchange or buying crypto directly</p>
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="color: #f97316; font-weight: 700; font-size: 15px; min-width: 24px;">3.</div>
          <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Explore our AI Portfolio Advisor for personalized insights</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <div style="color: #f97316; font-weight: 700; font-size: 15px; min-width: 24px;">4.</div>
          <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Enable staking to start earning passive income immediately</p>
        </div>
      </div>

      <!-- Closing -->
      <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.6; color: #4b5563;">
        We're excited to have you on board. If you have any questions or need help getting started, our support team is available 24/7 at support@blazewallet.io
      </p>
      
      <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.6; color: #4b5563;">
        Welcome to BLAZE,<br />
        <span style="font-weight: 600; color: #111827;">The BLAZE Team</span>
      </p>

      <div style="padding-top: 32px; border-top: 1px solid #f1f1f1;">
        <a href="https://my.blazewallet.io" style="display: inline-block; padding: 12px 24px; color: #f97316; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; border: 1px solid #f97316;">
          Open Wallet
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 32px 40px; border-top: 1px solid #f1f1f1;">
      <div style="margin-bottom: 20px;">
        <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 8px;">
          BLAZE Wallet
        </div>
        <div style="font-size: 13px; color: #6b7280; line-height: 1.5;">
          The most advanced multi-chain crypto wallet
        </div>
      </div>
      
      <div style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
        <a href="https://my.blazewallet.io/wallet" style="color: #6b7280; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a>
        <a href="https://my.blazewallet.io/security" style="color: #6b7280; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a>
        <a href="https://my.blazewallet.io/support" style="color: #6b7280; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a>
        <a href="https://my.blazewallet.io/privacy" style="color: #6b7280; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy</a>
      </div>
      
      <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
        © 2025 BLAZE Wallet. All rights reserved.<br />
        You received this email because you created an account at my.blazewallet.io
      </div>
    </div>

  </div>
</body>
</html>
  `;

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
