'use client';

export default function Mail5() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '0' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        
        {/* Professional Header */}
        <div style={{ padding: '48px 48px 0' }}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: '40px' }}>
            <tr>
              <td style={{ paddingBottom: '24px', borderBottom: '2px solid #f97316' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '22px' }}>🔥</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>BLAZE</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Wallet</div>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        {/* Hero Message */}
        <div style={{ padding: '0 48px 40px' }}>
          <h1 style={{ 
            margin: '0 0 24px', 
            fontSize: '38px', 
            fontWeight: 700, 
            color: '#111827',
            lineHeight: '1.2',
            letterSpacing: '-0.02em'
          }}>
            Welcome to BLAZE
          </h1>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151',
            fontWeight: 500
          }}>
            Hello,
          </p>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            Thank you for creating your BLAZE Wallet account. You've just taken a major step toward better crypto management—and we're excited to have you here.
          </p>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            BLAZE was built by crypto users, for crypto users. We got tired of wallets that were either too complicated to use or too simple to be useful. We wanted something that could handle serious portfolios across multiple chains while still being effortless to use every day.
          </p>

          <p style={{ 
            margin: '0 0 40px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            So we built it ourselves. Here's what you're getting:
          </p>

          {/* Value Props */}
          <div style={{ marginBottom: '48px' }}>
            {[
              {
                icon: '🌐',
                title: '18+ blockchains in one wallet',
                desc: 'Stop switching between apps. Manage Bitcoin, Ethereum, Solana, Polygon, Arbitrum, Optimism, Base, and 12+ other networks from a single interface. One seed phrase protects everything.',
                color: '#3b82f6'
              },
              {
                icon: '🤖',
                title: 'AI that actually helps',
                desc: 'Our AI Assistant doesn't just answer questions—it actively protects you from scams, analyzes your portfolio for optimization opportunities, and schedules transactions during low-fee periods to save you money.',
                color: '#8b5cf6'
              },
              {
                icon: '💰',
                title: 'Rewards on every transaction',
                desc: 'Earn 2% cashback in BLAZE tokens automatically on every swap, send, or purchase. Stake those tokens for up to 20% annual returns. Your wallet should be earning you money, not costing you.',
                color: '#10b981'
              },
              {
                icon: '🔐',
                title: 'Security you can trust',
                desc: 'Biometric authentication, end-to-end encryption, hardware wallet support, and zero-knowledge architecture. Your private keys never leave your device, and we have absolutely no access to your funds.',
                color: '#f59e0b'
              }
            ].map((item, i) => (
              <div key={i} style={{ 
                display: 'flex',
                gap: '20px',
                marginBottom: i < 3 ? '32px' : 0,
                paddingBottom: i < 3 ? '32px' : 0,
                borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none'
              }}>
                <div style={{ 
                  width: '48px',
                  height: '48px',
                  flexShrink: 0,
                  fontSize: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {item.icon}
                </div>
                <div>
                  <h3 style={{ 
                    margin: '0 0 10px', 
                    fontSize: '19px', 
                    fontWeight: 600, 
                    color: '#111827',
                    letterSpacing: '-0.01em'
                  }}>
                    {item.title}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    lineHeight: '1.7', 
                    color: '#6b7280'
                  }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Verification Section */}
          <div style={{
            background: 'white',
            border: '2px solid #f3f4f6',
            borderRadius: '12px',
            padding: '40px',
            marginBottom: '48px'
          }}>
            <h2 style={{ 
              margin: '0 0 16px', 
              fontSize: '24px', 
              fontWeight: 700, 
              color: '#111827',
              letterSpacing: '-0.01em'
            }}>
              First step: Verify your email
            </h2>
            <p style={{ 
              margin: '0 0 28px', 
              fontSize: '16px', 
              lineHeight: '1.7', 
              color: '#6b7280'
            }}>
              To ensure your account is secure and you can access all features, please verify your email address by clicking the button below. This verification link will expire in 24 hours.
            </p>
            <a href={verificationLink} style={{
              display: 'inline-block',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '17px',
              boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
              letterSpacing: '-0.01em'
            }}>
              Verify Email Address
            </a>
          </div>

          {/* Getting Started */}
          <div style={{ 
            background: '#fafafa',
            borderRadius: '12px',
            padding: '40px',
            marginBottom: '48px'
          }}>
            <h3 style={{ 
              margin: '0 0 24px', 
              fontSize: '22px', 
              fontWeight: 700, 
              color: '#111827',
              letterSpacing: '-0.01em'
            }}>
              Getting started with BLAZE
            </h3>
            <div>
              {[
                {
                  num: '1',
                  title: 'Verify your email',
                  desc: 'Click the button above to secure your account'
                },
                {
                  num: '2',
                  title: 'Add your assets',
                  desc: 'Transfer crypto from an exchange, buy directly with a card, or receive from another wallet'
                },
                {
                  num: '3',
                  title: 'Explore AI tools',
                  desc: 'Check out our Portfolio Advisor for personalized insights and optimization recommendations'
                },
                {
                  num: '4',
                  title: 'Start earning',
                  desc: 'Enable staking to earn up to 20% APY and receive 2% cashback on all transactions'
                }
              ].map((step, i) => (
                <div key={i} style={{ 
                  display: 'flex',
                  gap: '16px',
                  marginBottom: i < 3 ? '20px' : 0,
                  alignItems: 'flex-start'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: 'white',
                    border: '2px solid #f97316',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f97316',
                    fontWeight: 700,
                    fontSize: '15px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    {step.num}
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: '17px', 
                      fontWeight: 600, 
                      color: '#111827',
                      marginBottom: '6px'
                    }}>
                      {step.title}
                    </div>
                    <div style={{ 
                      fontSize: '16px', 
                      color: '#6b7280',
                      lineHeight: '1.6'
                    }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Closing Message */}
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '18px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            We're genuinely excited to have you as part of the BLAZE community. If you have any questions, run into any issues, or just want to share feedback, our support team is available 24/7 at <a href="mailto:support@blazewallet.io" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>support@blazewallet.io</a>
          </p>
          
          <p style={{ margin: '0 0 8px', fontSize: '18px', color: '#374151' }}>
            Welcome aboard,
          </p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
            The BLAZE Team
          </p>
        </div>

        {/* Footer */}
        <div style={{ 
          background: '#111827',
          padding: '40px 48px'
        }}>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ 
              fontSize: '15px', 
              fontWeight: 600, 
              color: 'white',
              marginBottom: '8px',
              letterSpacing: '0.3px'
            }}>
              BLAZE WALLET
            </div>
            <div style={{ fontSize: '14px', color: '#9ca3af' }}>
              The most advanced multi-chain crypto wallet
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            justifyContent: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}>
            {['Wallet', 'About', 'Security', 'Support', 'Privacy Policy'].map((link, i) => (
              <a key={i} href={`https://my.blazewallet.io/${link.toLowerCase().replace(' ', '-')}`} style={{
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
            You're receiving this email because you created an account at my.blazewallet.io
          </div>
        </div>

      </div>
    </div>
  );
}
