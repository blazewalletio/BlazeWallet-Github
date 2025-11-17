'use client';

export default function Mail2() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '0' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', background: 'white' }}>
        
        {/* Premium Header with Gradient */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)',
          padding: '48px 48px 56px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            background: 'white',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <span style={{ fontSize: '32px' }}>🔥</span>
          </div>
          <h1 style={{ 
            margin: '0 0 12px', 
            fontSize: '36px', 
            fontWeight: 700, 
            color: 'white',
            letterSpacing: '-0.02em'
          }}>
            Welcome to BLAZE
          </h1>
          <p style={{ margin: 0, fontSize: '18px', color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}>
            Your multi-chain crypto journey starts here
          </p>
        </div>

        {/* Main Content */}
        <div style={{ padding: '56px 48px' }}>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151',
            fontWeight: 500
          }}>
            Hi there,
          </p>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            Congratulations on taking the first step toward smarter, safer, and more rewarding crypto management.
          </p>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            BLAZE isn't just another wallet—it's your personal crypto command center. We've built something truly special: a platform that combines institutional-grade security with consumer-friendly design, AI-powered insights, and real financial rewards for every transaction you make.
          </p>

          <p style={{ 
            margin: '0 0 40px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            Whether you're managing Bitcoin, trading on Ethereum, exploring Solana's ecosystem, or diving into any of the 18+ blockchains we support—BLAZE makes it effortless.
          </p>

          {/* Verification Section */}
          <div style={{
            background: 'white',
            border: '2px solid #f97316',
            borderRadius: '16px',
            padding: '40px',
            marginBottom: '48px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✉️</div>
            <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
              Let's verify your email
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: '16px', lineHeight: '1.6', color: '#6b7280' }}>
              To ensure the security of your account and enable all features, please verify your email address. This takes just one click.
            </p>
            <a href={verificationLink} style={{
              display: 'inline-block',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '17px',
              boxShadow: '0 4px 12px rgba(249,115,22,0.3)'
            }}>
              Verify My Email
            </a>
            <p style={{ margin: '24px 0 0', fontSize: '14px', color: '#9ca3af' }}>
              This verification link will expire in 24 hours
            </p>
          </div>

          {/* What Makes Us Different */}
          <h3 style={{ 
            margin: '0 0 32px', 
            fontSize: '26px', 
            fontWeight: 700, 
            color: '#111827',
            letterSpacing: '-0.01em'
          }}>
            What makes BLAZE different?
          </h3>
          
          <div style={{ marginBottom: '48px' }}>
            {[
              {
                emoji: '🌐',
                title: 'One wallet. 18+ blockchains.',
                desc: 'Manage everything from Bitcoin and Ethereum to Solana, Polygon, Arbitrum, and 13+ other networks—all in one place. No more juggling multiple wallets or tracking down different apps.'
              },
              {
                emoji: '🤖',
                title: 'AI that protects and guides you',
                desc: 'Our intelligent systems work around the clock. Get real-time scam detection, personalized portfolio advice, and smart transaction scheduling that saves you money on gas fees.'
              },
              {
                emoji: '💰',
                title: 'Earn rewards on every transaction',
                desc: 'Receive 2% cashback in BLAZE tokens automatically on every swap and send. Stake those tokens for up to 20% APY. Your wallet should pay you, not the other way around.'
              },
              {
                emoji: '🔐',
                title: 'Security that never compromises',
                desc: 'Military-grade encryption, biometric authentication, hardware wallet integration, and zero-knowledge architecture. We never see your private keys, and you never have to worry.'
              }
            ].map((item, i) => (
              <div key={i} style={{ 
                marginBottom: i < 3 ? '32px' : 0,
                paddingBottom: i < 3 ? '32px' : 0,
                borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ fontSize: '32px', flexShrink: 0 }}>{item.emoji}</div>
                  <div>
                    <h4 style={{ margin: '0 0 12px', fontSize: '19px', fontWeight: 600, color: '#111827' }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.7', color: '#6b7280' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Getting Started */}
          <div style={{
            background: '#fafafa',
            borderRadius: '16px',
            padding: '40px',
            marginBottom: '40px'
          }}>
            <h3 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700, color: '#111827' }}>
              Here's how to get started
            </h3>
            <div style={{ marginBottom: '24px' }}>
              {[
                {
                  title: 'Verify your email',
                  desc: 'Click the button above to secure your account'
                },
                {
                  title: 'Fund your wallet',
                  desc: 'Transfer crypto from an exchange, buy directly with a card, or receive from another wallet'
                },
                {
                  title: 'Explore AI features',
                  desc: 'Try our Portfolio Advisor for personalized insights and optimization tips'
                },
                {
                  title: 'Start earning',
                  desc: 'Enable staking and start receiving 2% cashback on transactions'
                }
              ].map((step, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  gap: '16px',
                  marginBottom: i < 3 ? '20px' : 0
                }}>
                  <div style={{ 
                    width: '28px',
                    height: '28px',
                    background: '#f97316',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: '15px', color: '#6b7280', lineHeight: '1.5' }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Closing */}
          <p style={{ margin: '0 0 16px', fontSize: '18px', lineHeight: '1.7', color: '#374151' }}>
            We're thrilled to have you in the BLAZE community. If you ever need assistance, our support team is standing by at <a href="mailto:support@blazewallet.io" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>support@blazewallet.io</a>
          </p>
          
          <p style={{ margin: '0 0 8px', fontSize: '18px', lineHeight: '1.7', color: '#374151' }}>
            To your success,
          </p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
            The BLAZE Team
          </p>
        </div>

        {/* Footer */}
        <div style={{ 
          background: '#111827',
          padding: '40px 48px',
          color: 'white'
        }}>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              BLAZE Wallet
            </div>
            <div style={{ fontSize: '14px', color: '#9ca3af' }}>
              Multi-chain crypto, simplified
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            justifyContent: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}>
            {['Wallet', 'About', 'Security', 'Support', 'Privacy'].map((link, i) => (
              <a key={i} href={`https://my.blazewallet.io/${link.toLowerCase()}`} style={{
                color: '#9ca3af',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {link}
              </a>
            ))}
          </div>
          
          <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', lineHeight: '1.6' }}>
            © 2025 BLAZE Wallet. All rights reserved.<br />
            You're receiving this because you signed up at my.blazewallet.io
          </div>
        </div>

      </div>
    </div>
  );
}
