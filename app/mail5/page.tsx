export default function Mail5() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: 'white', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Ultra Modern Brutalist Design */}
        <div style={{ 
          background: 'white',
          borderRadius: '0',
          overflow: 'hidden',
          border: '4px solid #111827',
          boxShadow: '12px 12px 0 #f97316'
        }}>
          
          {/* Hero - Bold & Brutalist */}
          <div style={{ 
            background: '#111827',
            padding: '56px 48px',
            borderBottom: '4px solid #f97316'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '96px',
                height: '96px',
                margin: '0 auto 24px',
                background: '#f97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '4px solid white',
                transform: 'rotate(-3deg)'
              }}>
                <span style={{ fontSize: '56px', transform: 'rotate(3deg)', display: 'block' }}>🔥</span>
              </div>
              
              <h1 style={{ 
                margin: '0 0 16px', 
                color: 'white', 
                fontSize: '56px', 
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: '0.95',
                textTransform: 'uppercase'
              }}>
                BLAZE<br />WALLET
              </h1>
              <div style={{
                display: 'inline-block',
                background: '#f97316',
                color: 'white',
                padding: '8px 20px',
                fontWeight: 800,
                fontSize: '14px',
                letterSpacing: '0.1em',
                border: '3px solid white',
                transform: 'rotate(-1deg)'
              }}>
                MULTI-CHAIN BEAST
              </div>
            </div>
          </div>

          {/* Verification - Bold Statement */}
          <div style={{ padding: '48px' }}>
            <div style={{
              background: '#fef3c7',
              border: '4px solid #fbbf24',
              padding: '40px',
              marginBottom: '40px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#f97316',
                color: 'white',
                padding: '8px 16px',
                fontWeight: 800,
                fontSize: '12px',
                letterSpacing: '0.1em',
                border: '3px solid #111827'
              }}>
                ACTION REQUIRED
              </div>
              
              <div style={{ textAlign: 'center', paddingTop: '20px' }}>
                <h2 style={{ 
                  margin: '0 0 16px', 
                  fontSize: '32px', 
                  fontWeight: 900, 
                  color: '#111827',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em'
                }}>
                  VERIFY EMAIL
                </h2>
                <p style={{ margin: '0 0 32px', color: '#78350f', fontSize: '16px', fontWeight: 600, lineHeight: '1.6' }}>
                  Complete setup to unlock<br />all premium features
                </p>
                <a href={verificationLink} style={{
                  display: 'inline-block',
                  padding: '20px 48px',
                  background: '#111827',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: '18px',
                  letterSpacing: '0.05em',
                  border: '4px solid #111827',
                  boxShadow: '6px 6px 0 #f97316',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s'
                }}>
                  VERIFY NOW →
                </a>
                <p style={{ margin: '24px 0 0', color: '#92400e', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚡ 24 HOURS ONLY
                </p>
              </div>
            </div>

            {/* Features - Bold Grid */}
            <h3 style={{ 
              margin: '0 0 24px', 
              fontSize: '28px', 
              fontWeight: 900, 
              color: '#111827',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              borderBottom: '4px solid #111827',
              paddingBottom: '12px'
            }}>
              POWER FEATURES
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
              {[
                { icon: '⚡', title: '18 CHAINS', desc: 'All networks unified', color: '#3b82f6' },
                { icon: '🛡️', title: 'SECURED', desc: 'Military-grade safety', color: '#10b981' },
                { icon: '🤖', title: 'AI BRAIN', desc: 'Smart automation', color: '#a855f7' },
                { icon: '💎', title: '20% APY', desc: 'Maximum rewards', color: '#f97316' }
              ].map((feature, i) => (
                <div key={i} style={{
                  background: 'white',
                  border: '3px solid #111827',
                  padding: '28px 20px',
                  textAlign: 'center',
                  boxShadow: '6px 6px 0 ' + feature.color
                }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>{feature.icon}</div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 900, color: '#111827', letterSpacing: '0.05em' }}>
                    {feature.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick Facts - Brutalist List */}
            <div style={{
              background: '#f9fafb',
              border: '3px solid #111827',
              padding: '32px',
              marginBottom: '32px'
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 900, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                WHY BLAZE?
              </h3>
              {[
                '2% cashback in BLAZE on every transaction',
                'Stake tokens for up to 20% annual returns',
                'AI scam detector keeps you protected',
                'Schedule transactions for optimal timing'
              ].map((fact, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: i < 3 ? '16px' : 0
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#f97316',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '16px',
                    flexShrink: 0,
                    border: '2px solid #111827'
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 700 }}>
                    {fact}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center' }}>
              <a href="https://my.blazewallet.io" style={{
                display: 'inline-block',
                padding: '18px 40px',
                background: 'white',
                color: '#111827',
                textDecoration: 'none',
                fontWeight: 900,
                fontSize: '16px',
                border: '3px solid #111827',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                boxShadow: '4px 4px 0 #fbbf24'
              }}>
                OPEN WALLET →
              </a>
            </div>
          </div>

          {/* Footer - Bold */}
          <div style={{ 
            background: '#111827',
            borderTop: '4px solid #f97316',
            padding: '32px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 8px', color: 'white', fontSize: '20px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              BLAZE WALLET
            </p>
            <p style={{ margin: '0 0 16px', color: '#9ca3af', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>
              BUILT DIFFERENT. BUILT BETTER.
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px' }}>
              {['WALLET', 'ABOUT', 'SECURITY', 'SUPPORT'].map((link, i) => (
                <a key={i} href={`https://my.blazewallet.io/${link.toLowerCase()}`} style={{
                  color: '#9ca3af',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.05em'
                }}>
                  {link}
                </a>
              ))}
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>
              © 2025 BLAZE. ALL RIGHTS RESERVED.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

