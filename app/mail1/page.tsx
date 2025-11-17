'use client';

export default function Mail1() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', padding: '0' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white' }}>
        
        {/* Clean Professional Header */}
        <div style={{ 
          background: 'white',
          padding: '40px 40px 32px',
          borderBottom: '1px solid #f1f1f1'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '24px' }}>🔥</span>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>BLAZE</div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Wallet</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ padding: '48px 40px' }}>
          
          {/* Welcome Message */}
          <h1 style={{ 
            margin: '0 0 16px', 
            fontSize: '32px', 
            fontWeight: 700, 
            color: '#111827',
            lineHeight: '1.2',
            letterSpacing: '-0.02em'
          }}>
            Welcome to the future of crypto
          </h1>
          
          <p style={{ 
            margin: '0 0 24px', 
            fontSize: '17px', 
            lineHeight: '1.6', 
            color: '#4b5563'
          }}>
            Hi there,
          </p>
          
          <p style={{ 
            margin: '0 0 16px', 
            fontSize: '17px', 
            lineHeight: '1.6', 
            color: '#4b5563'
          }}>
            Thanks for creating your BLAZE Wallet account. You're now part of a new generation of crypto users who refuse to compromise on security, speed, or simplicity.
          </p>
          
          <p style={{ 
            margin: '0 0 32px', 
            fontSize: '17px', 
            lineHeight: '1.6', 
            color: '#4b5563'
          }}>
            BLAZE is built different. We've combined enterprise-grade security with the kind of user experience you'd expect from the world's best fintech apps. No more confusing interfaces. No more worrying about scams. Just pure, powerful crypto management.
          </p>

          {/* Verification Box */}
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fbbf24',
            borderRadius: '12px',
            padding: '32px',
            marginBottom: '40px'
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700, color: '#92400e' }}>
              Verify your email to get started
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: '1.6', color: '#78350f' }}>
              Click the button below to verify your email address and unlock all features. This link expires in 24 hours for your security.
            </p>
            <a href={verificationLink} style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(249,115,22,0.25)'
            }}>
              Verify Email Address
            </a>
          </div>

          {/* Why BLAZE */}
          <h3 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
            Why BLAZE is different
          </h3>
          
          <div style={{ marginBottom: '40px' }}>
            {[
              {
                title: 'True multi-chain support',
                desc: 'Manage assets across 18+ blockchains including Ethereum, Solana, Bitcoin, and all major networks—all from one beautiful interface.'
              },
              {
                title: 'AI-powered protection',
                desc: 'Our intelligent scam detector analyzes every transaction in real-time, protecting you from malicious contracts and phishing attempts before you even click.'
              },
              {
                title: 'Earn while you hold',
                desc: 'Get 2% cashback in BLAZE tokens on every transaction. Stake your tokens for up to 20% APY. Your crypto should work for you.'
              },
              {
                title: 'Bank-level security',
                desc: 'Face ID, hardware encryption, and WebAuthn support. Your private keys never leave your device, and we never have access to your funds.'
              }
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: i < 3 ? '24px' : 0 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                  {item.title}
                </h4>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#6b7280' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Get Started */}
          <div style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '32px',
            marginBottom: '32px'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#111827' }}>
              Your first steps with BLAZE
            </h3>
            {[
              'Verify your email (you're already here!)',
              'Add your first assets by connecting an exchange or buying crypto directly',
              'Explore our AI Portfolio Advisor for personalized insights',
              'Enable staking to start earning passive income immediately'
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: i < 3 ? '12px' : 0 }}>
                <div style={{ 
                  color: '#f97316', 
                  fontWeight: 700, 
                  fontSize: '15px',
                  minWidth: '24px'
                }}>
                  {i + 1}.
                </div>
                <p style={{ margin: 0, fontSize: '15px', color: '#4b5563', lineHeight: '1.6' }}>
                  {step}
                </p>
              </div>
            ))}
          </div>

          {/* Closing */}
          <p style={{ margin: '0 0 16px', fontSize: '17px', lineHeight: '1.6', color: '#4b5563' }}>
            We're excited to have you on board. If you have any questions or need help getting started, our support team is available 24/7 at support@blazewallet.io
          </p>
          
          <p style={{ margin: '0 0 32px', fontSize: '17px', lineHeight: '1.6', color: '#4b5563' }}>
            Welcome to BLAZE,<br />
            <span style={{ fontWeight: 600, color: '#111827' }}>The BLAZE Team</span>
          </p>

          <div style={{ paddingTop: '32px', borderTop: '1px solid #f1f1f1' }}>
            <a href="https://my.blazewallet.io" style={{
              display: 'inline-block',
              padding: '12px 24px',
              color: '#f97316',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              border: '1px solid #f97316'
            }}>
              Open Wallet
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          background: '#f9fafb',
          padding: '32px 40px',
          borderTop: '1px solid #f1f1f1'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
              BLAZE Wallet
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
              The most advanced multi-chain crypto wallet
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['Wallet', 'Security', 'Support', 'Privacy'].map((link, i) => (
              <a key={i} href={`https://my.blazewallet.io/${link.toLowerCase()}`} style={{
                color: '#6b7280',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 500
              }}>
                {link}
              </a>
            ))}
          </div>
          
          <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>
            © 2025 BLAZE Wallet. All rights reserved.<br />
            You received this email because you created an account at my.blazewallet.io
          </div>
        </div>

      </div>
    </div>
  );
}
