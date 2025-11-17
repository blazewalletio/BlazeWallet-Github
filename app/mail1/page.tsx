export default function Mail1() {
  const verificationLink = "https://my.blazewallet.io/verify?token=demo";
  
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        
        {/* Hero Section - Glass Morphism zoals Dashboard */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)', 
          padding: '60px 40px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              margin: '0 auto 24px', 
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
              <span style={{ fontSize: '40px' }}>🔥</span>
            </div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.2)' }}>
              Welcome to BLAZE
            </h1>
            <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.95)', fontSize: '18px', fontWeight: 500 }}>
              Your multi-chain wallet is ready
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ padding: '40px' }}>
          
          {/* Verification Card - Glass Card zoals Staking */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(249,115,22,0.05) 0%, rgba(251,191,36,0.05) 100%)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 4px 16px rgba(249,115,22,0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                Verify Your Email
              </h2>
              <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
                Complete your setup to unlock all features
              </p>
              <a href={verificationLink} style={{
                display: 'inline-block',
                padding: '16px 40px',
                background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '16px',
                boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
                transition: 'all 0.2s'
              }}>
                Verify Email →
              </a>
              <p style={{ margin: '16px 0 0', color: '#9ca3af', fontSize: '13px' }}>
                Link expires in 24 hours
              </p>
            </div>
          </div>

          {/* Features Grid - Dashboard Style */}
          <h3 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#111827' }}>
            What's Inside
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
            {[
              { icon: '⚡', title: '18 Chains', desc: 'EVM, Solana & Bitcoin', color: 'from-blue-500 to-blue-600' },
              { icon: '🛡️', title: 'Secure', desc: 'Face ID & encryption', color: 'from-green-500 to-green-600' },
              { icon: '🤖', title: 'AI-Powered', desc: 'Smart assistant', color: 'from-purple-500 to-purple-600' },
              { icon: '💰', title: '2% Cashback', desc: 'Earn on every tx', color: 'from-orange-500 to-orange-600' }
            ].map((feature, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{feature.icon}</div>
                <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                  {feature.title}
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
            <a href="https://my.blazewallet.io" style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '15px',
              boxShadow: '0 4px 12px rgba(249,115,22,0.2)'
            }}>
              Open Wallet
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#111827', padding: '32px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', color: '#d1d5db', fontSize: '14px', fontWeight: 600 }}>
            BLAZE Wallet
          </p>
          <p style={{ margin: '0 0 16px', color: '#9ca3af', fontSize: '12px' }}>
            The Most Advanced Multi-Chain Wallet
          </p>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '11px' }}>
            © 2025 BLAZE. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}

