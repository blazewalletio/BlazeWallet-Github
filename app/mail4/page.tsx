export default function Mail4() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '0' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white' }}>
        
        {/* Minimalist Header */}
        <div style={{ 
          padding: '64px 56px 48px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '40px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '20px' }}>🔥</span>
            </div>
            <span style={{ 
              fontSize: '18px', 
              fontWeight: 700, 
              color: '#111827',
              letterSpacing: '-0.01em'
            }}>
              BLAZE
            </span>
          </div>

          <h1 style={{ 
            margin: '0 0 28px', 
            fontSize: '44px', 
            fontWeight: 700, 
            color: '#111827',
            lineHeight: '1.1',
            letterSpacing: '-0.03em'
          }}>
            You've made a<br />smart choice
          </h1>
          
          <p style={{ 
            margin: '0', 
            fontSize: '20px', 
            lineHeight: '1.6', 
            color: '#6b7280',
            maxWidth: '480px'
          }}>
            Welcome to BLAZE—where security, simplicity, and rewards come together in one powerful wallet.
          </p>
        </div>

        {/* Main Content */}
        <div style={{ padding: '56px' }}>
          
          <p style={{ 
            margin: '0 0 24px', 
            fontSize: '17px', 
            lineHeight: '1.8', 
            color: '#4b5563'
          }}>
            Most crypto wallets force you to choose: either maximum security with terrible UX, or great design with questionable safety. BLAZE refuses to compromise.
          </p>
          
          <p style={{ 
            margin: '0 0 24px', 
            fontSize: '17px', 
            lineHeight: '1.8', 
            color: '#4b5563'
          }}>
            We've built something different—a wallet that's as secure as a hardware wallet, as easy as a fintech app, and actually rewards you for using it.
          </p>

          <p style={{ 
            margin: '0 0 48px', 
            fontSize: '17px', 
            lineHeight: '1.8', 
            color: '#4b5563'
          }}>
            Here's what you can expect:
          </p>

          {/* Features List */}
          <div style={{ marginBottom: '56px' }}>
            {[
              {
                title: 'Every blockchain. One wallet.',
                desc: 'Manage Bitcoin, Ethereum, Solana, and 15+ other chains without switching apps. Your entire portfolio in one beautiful interface.'
              },
              {
                title: 'AI that works for you, not against you.',
                desc: 'Real-time scam detection stops threats before they reach you. Portfolio insights help you optimize. Transaction scheduling saves you money on fees.'
              },
              {
                title: 'Get paid to use your wallet.',
                desc: 'Earn 2% cashback in BLAZE tokens on every transaction. Stake for 20% APY. Other wallets charge you—we pay you.'
              },
              {
                title: 'Security that never sleeps.',
                desc: 'Biometric authentication. End-to-end encryption. Zero-knowledge architecture. Your keys stay on your device. Always.'
              }
            ].map((item, i) => (
              <div key={i} style={{ 
                marginBottom: i < 3 ? '32px' : 0
              }}>
                <h3 style={{ 
                  margin: '0 0 10px', 
                  fontSize: '18px', 
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
            ))}
          </div>

          {/* Verification */}
          <div style={{
            background: '#fafafa',
            borderRadius: '12px',
            padding: '40px',
            marginBottom: '48px',
            border: '1px solid #f3f4f6'
          }}>
            <h2 style={{ 
              margin: '0 0 12px', 
              fontSize: '22px', 
              fontWeight: 700, 
              color: '#111827',
              letterSpacing: '-0.01em'
            }}>
              Let's verify your account
            </h2>
            <p style={{ 
              margin: '0 0 28px', 
              fontSize: '16px', 
              lineHeight: '1.7', 
              color: '#6b7280'
            }}>
              Click below to verify your email and unlock full access to BLAZE. This link will expire in 24 hours for security.
            </p>
            <a href={verificationLink} style={{
              display: 'inline-block',
              padding: '16px 36px',
              background: '#111827',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '16px',
              letterSpacing: '-0.01em'
            }}>
              Verify Email
            </a>
          </div>

          {/* Next Steps */}
          <div style={{ marginBottom: '48px' }}>
            <h3 style={{ 
              margin: '0 0 24px', 
              fontSize: '20px', 
              fontWeight: 700, 
              color: '#111827',
              letterSpacing: '-0.01em'
            }}>
              What to do next
            </h3>
            {[
              'Verify your email (one click above)',
              'Add crypto by transferring from an exchange or buying directly',
              'Try our AI Portfolio Advisor for personalized recommendations',
              'Enable staking to start earning rewards immediately'
            ].map((step, i) => (
              <div key={i} style={{ 
                display: 'flex',
                gap: '12px',
                marginBottom: i < 3 ? '12px' : 0,
                alignItems: 'center'
              }}>
                <div style={{ 
                  width: '6px',
                  height: '6px',
                  background: '#f97316',
                  borderRadius: '50%',
                  flexShrink: 0
                }} />
                <p style={{ 
                  margin: 0, 
                  fontSize: '16px', 
                  color: '#4b5563',
                  lineHeight: '1.6'
                }}>
                  {step}
                </p>
              </div>
            ))}
          </div>

          {/* Support */}
          <div style={{ 
            paddingTop: '32px',
            borderTop: '1px solid #f3f4f6'
          }}>
            <p style={{ 
              margin: '0 0 16px', 
              fontSize: '17px', 
              lineHeight: '1.7', 
              color: '#4b5563'
            }}>
              Need help? We're here 24/7 at <a href="mailto:support@blazewallet.io" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>support@blazewallet.io</a>
            </p>
            
            <p style={{ margin: '0 0 4px', fontSize: '17px', color: '#4b5563' }}>
              Best,
            </p>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#111827' }}>
              The BLAZE Team
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          background: '#fafafa',
          padding: '40px 56px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: '#111827',
              marginBottom: '6px'
            }}>
              BLAZE Wallet
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Multi-chain crypto wallet
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '20px',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}>
            {['Wallet', 'Security', 'Support', 'Privacy'].map((link, i) => (
              <a key={i} href={`https://my.blazewallet.io/${link.toLowerCase()}`} style={{
                color: '#6b7280',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {link}
              </a>
            ))}
          </div>
          
          <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.6' }}>
            © 2025 BLAZE Wallet. All rights reserved.<br />
            You're receiving this because you signed up at my.blazewallet.io
          </div>
        </div>

      </div>
    </div>
  );
}
