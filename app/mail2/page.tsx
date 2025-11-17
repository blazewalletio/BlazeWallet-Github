export default function Mail2() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Card met Dark Mode Premium Look */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '24px',
          overflow: 'hidden',
          border: '1px solid rgba(249,115,22,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          
          {/* Hero met Animated Gradient Border Effect */}
          <div style={{ padding: '48px 40px', textAlign: 'center', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #f97316 0%, #fb923c 33%, #fbbf24 66%, #f97316 100%)',
              backgroundSize: '200% 100%'
            }} />
            
            <div style={{
              width: '96px',
              height: '96px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(249,115,22,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{ fontSize: '48px' }}>🔥</span>
            </div>
            
            <h1 style={{ 
              margin: '0 0 12px', 
              color: 'white', 
              fontSize: '32px', 
              fontWeight: 800,
              background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em'
            }}>
              Welcome to BLAZE
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '16px', fontWeight: 500 }}>
              Your Journey Starts Here
            </p>
          </div>

          {/* Verification Section */}
          <div style={{ padding: '0 40px 40px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(251,146,60,0.1) 100%)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: '20px',
              padding: '32px',
              marginBottom: '32px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(249,115,22,0.3)'
                }}>
                  <span style={{ fontSize: '28px' }}>✉️</span>
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: 'white' }}>
                  Verify Your Email
                </h2>
                <p style={{ margin: '0 0 24px', color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
                  One quick step to unlock your wallet's full potential
                </p>
                <a href={verificationLink} style={{
                  display: 'inline-block',
                  padding: '16px 48px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '16px',
                  boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  Verify Now
                </a>
                <p style={{ margin: '16px 0 0', color: '#64748b', fontSize: '12px' }}>
                  🕐 Expires in 24 hours
                </p>
              </div>
            </div>

            {/* Feature Cards - Dark Premium */}
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: 'white' }}>
              Powerful Features
            </h3>
            
            <div style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}>
              {[
                { icon: '⚡', title: 'Lightning Fast', desc: '18+ blockchains in one wallet', gradient: 'from-blue-500 to-cyan-500' },
                { icon: '🛡️', title: 'Military-Grade Security', desc: 'Your keys, your crypto - always safe', gradient: 'from-green-500 to-emerald-500' },
                { icon: '🤖', title: 'AI Co-Pilot', desc: 'Smart insights for better decisions', gradient: 'from-purple-500 to-pink-500' },
                { icon: '💎', title: 'Earn While You Hold', desc: 'Up to 20% APY + 2% cashback', gradient: 'from-orange-500 to-red-500' }
              ].map((feature, i) => (
                <div key={i} style={{
                  background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(239,68,68,0.2) 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(249,115,22,0.3)',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '24px' }}>{feature.icon}</span>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: 'white' }}>
                      {feature.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ 
              textAlign: 'center', 
              paddingTop: '24px', 
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
              <a href="https://my.blazewallet.io" style={{
                display: 'inline-block',
                padding: '14px 32px',
                background: 'rgba(249,115,22,0.1)',
                color: '#f97316',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '15px',
                border: '1px solid rgba(249,115,22,0.3)'
              }}>
                Open Wallet →
              </a>
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            background: 'rgba(0,0,0,0.3)', 
            padding: '24px', 
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}>
            <p style={{ margin: '0 0 4px', color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>
              BLAZE Wallet
            </p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '11px' }}>
              © 2025 BLAZE. Built for the future of Web3.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

