'use client';

export default function Mail3() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '40px 20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', background: 'white', boxShadow: '0 2px 24px rgba(0,0,0,0.08)' }}>
        
        {/* Elegant Header */}
        <div style={{ padding: '48px 48px 40px' }}>
          <div style={{ 
            display: 'inline-block',
            background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
            padding: '12px 24px',
            borderRadius: '8px',
            marginBottom: '32px'
          }}>
            <span style={{ 
              fontSize: '16px', 
              fontWeight: 700, 
              color: 'white',
              letterSpacing: '0.5px'
            }}>
              BLAZE WALLET
            </span>
          </div>

          <h1 style={{ 
            margin: '0 0 24px', 
            fontSize: '42px', 
            fontWeight: 700, 
            color: '#111827',
            lineHeight: '1.1',
            letterSpacing: '-0.02em'
          }}>
            Welcome to the<br />new era of crypto
          </h1>
          
          <div style={{ 
            width: '60px',
            height: '4px',
            background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
            borderRadius: '2px',
            marginBottom: '32px'
          }} />
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '19px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            Thank you for choosing BLAZE—the most advanced multi-chain wallet built for serious crypto users who demand more.
          </p>
          
          <p style={{ 
            margin: '0 0 20px', 
            fontSize: '19px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            You're joining thousands of users who've discovered that managing crypto doesn't have to be complicated, insecure, or unrewarding. With BLAZE, you get the perfect balance: enterprise-level security meets consumer-grade simplicity.
          </p>

          <p style={{ 
            margin: '0', 
            fontSize: '19px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            Here's what sets us apart from every other wallet on the market:
          </p>
        </div>

        {/* Key Benefits */}
        <div style={{ padding: '0 48px 48px' }}>
          {[
            {
              number: '01',
              title: 'True Multi-Chain Freedom',
              desc: 'Stop juggling multiple wallets. BLAZE natively supports 18+ blockchains including Ethereum, Bitcoin, Solana, Polygon, Arbitrum, Optimism, and more. One seed phrase. One interface. Total control.',
              color: '#3b82f6'
            },
            {
              number: '02',
              title: 'AI-Powered Intelligence',
              desc: 'Our AI doesn't just sit there—it actively protects you from scams, suggests portfolio optimizations, schedules transactions during low-gas periods, and provides insights that help you make smarter decisions.',
              color: '#8b5cf6'
            },
            {
              number: '03',
              title: 'Rewards That Actually Matter',
              desc: 'Earn 2% cashback in BLAZE tokens on every transaction. Stake your tokens for up to 20% APY. Participate in governance. Most wallets take from you—BLAZE gives back.',
              color: '#10b981'
            },
            {
              number: '04',
              title: 'Security Without Compromise',
              desc: 'Face ID, hardware encryption, WebAuthn, optional hardware wallet integration. Your private keys never leave your device. We have zero access to your funds. Ever.',
              color: '#f59e0b'
            }
          ].map((item, i) => (
            <div key={i} style={{ 
              marginBottom: i < 3 ? '36px' : 0,
              paddingBottom: i < 3 ? '36px' : 0,
              borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none'
            }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ 
                  fontSize: '32px', 
                  fontWeight: 800, 
                  color: item.color,
                  flexShrink: 0,
                  opacity: 0.3,
                  fontFamily: 'monospace'
                }}>
                  {item.number}
                </div>
                <div>
                  <h3 style={{ 
                    margin: '0 0 12px', 
                    fontSize: '21px', 
                    fontWeight: 700, 
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
            </div>
          ))}
        </div>

        {/* Verification CTA */}
        <div style={{ 
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          padding: '48px',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            margin: '0 0 16px', 
            fontSize: '28px', 
            fontWeight: 700, 
            color: '#111827',
            letterSpacing: '-0.01em'
          }}>
            Ready to get started?
          </h2>
          <p style={{ 
            margin: '0 0 32px', 
            fontSize: '17px', 
            lineHeight: '1.6', 
            color: '#78350f',
            maxWidth: '480px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            First, let's verify your email address to ensure your account is secure and you can access all features.
          </p>
          <a href={verificationLink} style={{
            display: 'inline-block',
            padding: '18px 48px',
            background: '#111827',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '17px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            letterSpacing: '-0.01em'
          }}>
            Verify Email Address →
          </a>
          <p style={{ 
            margin: '24px 0 0', 
            fontSize: '14px', 
            color: '#92400e'
          }}>
            Verification link expires in 24 hours
          </p>
        </div>

        {/* Quick Start Guide */}
        <div style={{ padding: '48px' }}>
          <h3 style={{ 
            margin: '0 0 28px', 
            fontSize: '24px', 
            fontWeight: 700, 
            color: '#111827',
            letterSpacing: '-0.01em'
          }}>
            Your BLAZE journey in 4 steps
          </h3>
          
          <div>
            {[
              {
                title: 'Verify your email',
                desc: 'Click the button above to activate your account'
              },
              {
                title: 'Add your first assets',
                desc: 'Transfer from an exchange, buy with a card, or receive from another wallet'
              },
              {
                title: 'Explore AI features',
                desc: 'Let our Portfolio Advisor analyze your holdings and suggest optimizations'
              },
              {
                title: 'Activate rewards',
                desc: 'Enable staking to start earning up to 20% APY on BLAZE tokens'
              }
            ].map((step, i) => (
              <div key={i} style={{ 
                display: 'flex',
                gap: '20px',
                marginBottom: i < 3 ? '24px' : 0,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  {i + 1}
                </div>
                <div style={{ paddingTop: '2px' }}>
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

        {/* Support Section */}
        <div style={{ 
          background: '#fafafa',
          padding: '40px 48px',
          textAlign: 'center'
        }}>
          <p style={{ 
            margin: '0 0 8px', 
            fontSize: '17px', 
            lineHeight: '1.7', 
            color: '#374151'
          }}>
            Questions? Our support team is available 24/7
          </p>
          <a href="mailto:support@blazewallet.io" style={{
            fontSize: '17px',
            fontWeight: 600,
            color: '#f97316',
            textDecoration: 'none'
          }}>
            support@blazewallet.io
          </a>
        </div>

        {/* Signature */}
        <div style={{ padding: '40px 48px' }}>
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
          padding: '32px 48px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'white',
              marginBottom: '6px',
              letterSpacing: '0.5px'
            }}>
              BLAZE WALLET
            </div>
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>
              The future of multi-chain crypto management
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            justifyContent: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            {['Wallet', 'About', 'Security', 'Support', 'Privacy Policy'].map((link, i) => (
              <a key={i} href={`https://my.blazewallet.io/${link.toLowerCase().replace(' ', '-')}`} style={{
                color: '#9ca3af',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 500
              }}>
                {link}
              </a>
            ))}
          </div>
          
          <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }}>
            © 2025 BLAZE Wallet. All rights reserved.<br />
            This email was sent because you created an account at my.blazewallet.io
          </div>
        </div>

      </div>
    </div>
  );
}
