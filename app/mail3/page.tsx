export default function Mail3() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Minimalist Clean Design */}
        <div style={{ 
          background: 'white',
          borderRadius: '32px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(249,115,22,0.15), 0 0 0 1px rgba(249,115,22,0.1)'
        }}>
          
          {/* Hero - Minimalist */}
          <div style={{ padding: '64px 48px 48px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(249,115,22,0.25)'
            }}>
              <span style={{ fontSize: '36px' }}>🔥</span>
            </div>
            
            <h1 style={{ 
              margin: '0 0 16px', 
              color: '#111827', 
              fontSize: '40px', 
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: '1.1'
            }}>
              Welcome to<br />BLAZE Wallet
            </h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '18px', fontWeight: 400, lineHeight: '1.6' }}>
              The most powerful multi-chain wallet.<br />
              Simple. Secure. Rewarding.
            </p>
          </div>

          {/* Verification - Clean Minimal */}
          <div style={{ padding: '48px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '2px solid #fbbf24',
              borderRadius: '24px',
              padding: '40px',
              marginBottom: '40px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '56px', marginBottom: '20px' }}>✨</div>
              <h2 style={{ margin: '0 0 12px', fontSize: '26px', fontWeight: 700, color: '#78350f' }}>
                One More Step
              </h2>
              <p style={{ margin: '0 0 28px', color: '#92400e', fontSize: '16px', lineHeight: '1.6' }}>
                Verify your email to activate all features
              </p>
              <a href={verificationLink} style={{
                display: 'inline-block',
                padding: '18px 48px',
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '17px',
                boxShadow: '0 6px 20px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                letterSpacing: '-0.01em'
              }}>
                Verify Email
              </a>
              <p style={{ margin: '20px 0 0', color: '#a16207', fontSize: '14px' }}>
                Link expires in 24 hours
              </p>
            </div>

            {/* Features - Minimalist Icons */}
            <div style={{ marginBottom: '40px' }}>
              <h3 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700, color: '#111827', textAlign: 'center' }}>
                Everything You Need
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {[
                  { icon: '⚡', title: '18 Chains', desc: 'All networks, one wallet' },
                  { icon: '🔒', title: 'Ultra Secure', desc: 'Your keys stay yours' },
                  { icon: '🤖', title: 'AI Assistant', desc: 'Smart recommendations' },
                  { icon: '💰', title: '2% Rewards', desc: 'Cashback on every tx' }
                ].map((feature, i) => (
                  <div key={i} style={{
                    background: '#fafafa',
                    borderRadius: '20px',
                    padding: '28px 24px',
                    textAlign: 'center',
                    border: '1px solid #f3f4f6'
                  }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>{feature.icon}</div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                      {feature.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Start */}
            <div style={{
              background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
              borderRadius: '20px',
              padding: '32px',
              marginBottom: '32px'
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                Quick Start Guide
              </h3>
              {[
                'Add funds from an exchange or buy crypto',
                'Explore AI tools and portfolio insights',
                'Stake BLAZE for up to 20% APY',
                'Earn 2% cashback on every transaction'
              ].map((step, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: i < 3 ? '16px' : 0
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ margin: 0, fontSize: '15px', color: '#374151', fontWeight: 500 }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center' }}>
              <a href="https://my.blazewallet.io" style={{
                display: 'inline-block',
                padding: '16px 40px',
                background: 'white',
                color: '#f97316',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '16px',
                border: '2px solid #f97316',
                transition: 'all 0.2s'
              }}>
                Open Wallet →
              </a>
            </div>
          </div>

          {/* Footer - Minimal */}
          <div style={{ 
            background: '#fafafa', 
            padding: '32px', 
            textAlign: 'center',
            borderTop: '1px solid #f3f4f6'
          }}>
            <p style={{ margin: '0 0 8px', color: '#111827', fontSize: '15px', fontWeight: 700 }}>
              BLAZE Wallet
            </p>
            <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '13px' }}>
              Multi-Chain · Secure · Rewarding
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
              {['Wallet', 'About', 'Security', 'Support'].map((link, i) => (
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
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>
              © 2025 BLAZE. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

