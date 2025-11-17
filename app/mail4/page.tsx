export default function Mail4() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#111827', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Premium Card Design met Glow Effects */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          borderRadius: '32px',
          overflow: 'hidden',
          border: '1px solid rgba(249,115,22,0.3)',
          boxShadow: '0 0 80px rgba(249,115,22,0.3), 0 20px 60px rgba(0,0,0,0.5)',
          position: 'relative'
        }}>
          
          {/* Animated Glow Top Border */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #f97316, #fb923c, #fbbf24, #fb923c, #f97316, transparent)',
            boxShadow: '0 0 20px #f97316'
          }} />

          {/* Hero met 3D Effect */}
          <div style={{ padding: '64px 48px', textAlign: 'center', position: 'relative' }}>
            
            {/* Glow Circle Background */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '300px',
              height: '300px',
              background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: '112px',
                height: '112px',
                margin: '0 auto 32px',
                background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                borderRadius: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 60px rgba(249,115,22,0.6), 0 20px 40px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.1)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  background: 'linear-gradient(135deg, transparent, rgba(249,115,22,0.3), transparent)',
                  borderRadius: '30px',
                  filter: 'blur(8px)',
                  zIndex: -1
                }} />
                <span style={{ fontSize: '64px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>🔥</span>
              </div>
              
              <h1 style={{ 
                margin: '0 0 16px', 
                fontSize: '48px', 
                fontWeight: 900,
                background: 'linear-gradient(135deg, #ffffff 0%, #f97316 50%, #fbbf24 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.03em',
                lineHeight: '1.1',
                textShadow: '0 0 40px rgba(249,115,22,0.3)'
              }}>
                BLAZE WALLET
              </h1>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '18px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Your Crypto Empire Starts Here
              </p>
            </div>
          </div>

          {/* Verification Premium Card */}
          <div style={{ padding: '0 48px 48px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(239,68,68,0.15) 100%)',
              border: '1px solid rgba(249,115,22,0.4)',
              borderRadius: '24px',
              padding: '48px',
              marginBottom: '40px',
              boxShadow: '0 8px 32px rgba(249,115,22,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Inner Glow */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '200px',
                height: '200px',
                background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)',
                filter: 'blur(30px)',
                pointerEvents: 'none'
              }} />
              
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '64px', marginBottom: '20px', filter: 'drop-shadow(0 0 20px rgba(249,115,22,0.5))' }}>
                  ⚡
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: '28px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
                  Activate Your Wallet
                </h2>
                <p style={{ margin: '0 0 32px', color: '#cbd5e1', fontSize: '16px', lineHeight: '1.6' }}>
                  Verify your email to unlock unlimited potential
                </p>
                <a href={verificationLink} style={{
                  display: 'inline-block',
                  padding: '20px 56px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '18px',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 0 40px rgba(249,115,22,0.5), 0 8px 24px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textTransform: 'uppercase'
                }}>
                  Verify Now →
                </a>
                <p style={{ margin: '24px 0 0', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                  ⏰ Expires in 24 hours
                </p>
              </div>
            </div>

            {/* Premium Features Grid */}
            <h3 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 800, color: 'white', textAlign: 'center', letterSpacing: '-0.01em' }}>
              Elite Features
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
              {[
                { icon: '⚡', title: '18 Chains', desc: 'Lightning fast', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', glow: 'rgba(59,130,246,0.2)' },
                { icon: '🛡️', title: 'Fort Knox', desc: 'Military security', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', glow: 'rgba(16,185,129,0.2)' },
                { icon: '🤖', title: 'AI Brain', desc: 'Smart insights', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', glow: 'rgba(168,85,247,0.2)' },
                { icon: '💎', title: '20% APY', desc: 'Premium rewards', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', glow: 'rgba(249,115,22,0.2)' }
              ].map((feature, i) => (
                <div key={i} style={{
                  background: feature.bg,
                  border: `1px solid ${feature.border}`,
                  borderRadius: '20px',
                  padding: '28px 24px',
                  textAlign: 'center',
                  boxShadow: `0 4px 20px ${feature.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px', filter: `drop-shadow(0 0 10px ${feature.glow})` }}>
                    {feature.icon}
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: 'white' }}>
                    {feature.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <a href="https://my.blazewallet.io" style={{
                display: 'inline-block',
                padding: '16px 40px',
                background: 'rgba(249,115,22,0.1)',
                color: '#f97316',
                textDecoration: 'none',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '16px',
                border: '1px solid rgba(249,115,22,0.4)',
                letterSpacing: '-0.01em'
              }}>
                Launch Wallet →
              </a>
            </div>
          </div>

          {/* Footer Premium */}
          <div style={{ 
            background: 'rgba(0,0,0,0.4)', 
            padding: '32px', 
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{ margin: '0 0 8px', color: '#f3f4f6', fontSize: '16px', fontWeight: 800, letterSpacing: '0.05em' }}>
              BLAZE WALLET
            </p>
            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              The Future of Multi-Chain
            </p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '11px' }}>
              © 2025 BLAZE. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

