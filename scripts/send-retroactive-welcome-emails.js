#!/usr/bin/env node

/**
 * Send Welcome Emails to Existing Users
 * 
 * This script sends the new premium welcome + verification email
 * to all existing users who registered before this feature was implemented.
 * 
 * Usage: node scripts/send-retroactive-welcome-emails.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://ldehmephukevxumwdbwt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c';
const RESEND_API_KEY = 're_GSrnNH5V_NDNNHf7dDeFjEqJ2xR6CZeSx';
const RESEND_API_URL = 'https://api.resend.com/emails';
const APP_URL = 'https://my.blazewallet.io';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Generate the premium welcome email HTML
 */
function generateWelcomeEmail(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Wallet</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
      opacity: 0.3;
    }
    .logo {
      font-size: 48px;
      font-weight: 800;
      color: white;
      margin: 0;
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 1;
    }
    .tagline {
      color: rgba(255, 255, 255, 0.95);
      font-size: 18px;
      margin: 12px 0 0 0;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .content {
      padding: 48px 32px;
    }
    .welcome-text {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 16px 0;
      text-align: center;
    }
    .subtitle {
      font-size: 16px;
      color: #6b7280;
      margin: 0 0 32px 0;
      text-align: center;
      line-height: 1.6;
    }
    .cta-section {
      background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      margin: 32px 0;
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.2);
    }
    .cta-text {
      color: white;
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 20px 0;
    }
    .cta-button {
      display: inline-block;
      background: white;
      color: #f97316;
      padding: 16px 48px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 32px 0;
    }
    .feature-card {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .feature-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    .feature-title {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 4px 0;
    }
    .feature-desc {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
      line-height: 1.4;
    }
    .features-list {
      margin: 32px 0;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      border-left: 4px solid #f97316;
    }
    .feature-item-icon {
      font-size: 24px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .feature-item-text {
      flex: 1;
    }
    .feature-item-title {
      font-size: 15px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 4px 0;
    }
    .feature-item-desc {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
      line-height: 1.5;
    }
    .getting-started {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border-radius: 16px;
      padding: 32px;
      margin: 32px 0;
      color: white;
    }
    .getting-started-title {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 20px 0;
      text-align: center;
    }
    .step {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      background: rgba(255, 255, 255, 0.1);
      padding: 16px;
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }
    .step-number {
      width: 32px;
      height: 32px;
      background: white;
      color: #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .step-text {
      font-size: 15px;
      margin: 0;
      line-height: 1.5;
    }
    .help-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 32px 0;
    }
    .help-title {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 12px 0;
    }
    .help-text {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 16px 0;
      line-height: 1.6;
    }
    .help-email {
      color: #f97316;
      text-decoration: none;
      font-weight: 600;
    }
    .footer {
      background: #1f2937;
      padding: 32px;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
    }
    .footer-links {
      margin: 16px 0;
    }
    .footer-link {
      color: #d1d5db;
      text-decoration: none;
      margin: 0 12px;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #f97316;
    }
    .social-links {
      margin: 20px 0 0 0;
    }
    .social-link {
      display: inline-block;
      width: 36px;
      height: 36px;
      background: #374151;
      border-radius: 50%;
      margin: 0 8px;
      line-height: 36px;
      text-decoration: none;
      color: #d1d5db;
      font-size: 18px;
      transition: all 0.2s;
    }
    .social-link:hover {
      background: #f97316;
      color: white;
      transform: translateY(-2px);
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        margin: 0;
        border-radius: 0;
      }
      .header {
        padding: 32px 24px;
      }
      .content {
        padding: 32px 24px;
      }
      .features-grid {
        grid-template-columns: 1fr;
      }
      .welcome-text {
        font-size: 24px;
      }
      .cta-button {
        display: block;
        padding: 14px 32px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header with Gradient -->
    <div class="header">
      <h1 class="logo">🔥 BLAZE</h1>
      <p class="tagline">The Ultimate Multi-Chain Web3 Wallet</p>
    </div>

    <!-- Main Content -->
    <div class="content">
      <h2 class="welcome-text">Welcome to BLAZE! 🎉</h2>
      <p class="subtitle">
        You've joined the future of Web3 wallets. We're excited to have you on board!
        <br><br>
        <strong>Your account is already active and ready to use.</strong>
      </p>

      <!-- Features Grid -->
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3 class="feature-title">18 Blockchains</h3>
          <p class="feature-desc">Full EVM, Solana & Bitcoin support</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3 class="feature-title">Bank-Grade Security</h3>
          <p class="feature-desc">Face ID, encryption & WebAuthn</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3 class="feature-title">AI-Powered</h3>
          <p class="feature-desc">Smart assistant & scam detector</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💎</div>
          <h3 class="feature-title">BLAZE Ecosystem</h3>
          <p class="feature-desc">Stake, earn cashback & govern</p>
        </div>
      </div>

      <!-- Call to Action -->
      <div class="cta-section">
        <p class="cta-text">🚀 Ready to explore your wallet?</p>
        <a href="${APP_URL}" class="cta-button">Open BLAZE Wallet</a>
      </div>

      <!-- Key Features List -->
      <div class="features-list">
        <div class="feature-item">
          <div class="feature-item-icon">💸</div>
          <div class="feature-item-text">
            <h3 class="feature-item-title">2% Cashback on Every Transaction</h3>
            <p class="feature-item-desc">Earn BLAZE tokens back automatically on swaps, sends, and purchases</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-item-icon">📅</div>
          <div class="feature-item-text">
            <h3 class="feature-item-title">Smart Scheduler</h3>
            <p class="feature-item-desc">Schedule transactions for future execution with automated gas optimization</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-item-icon">🛡️</div>
          <div class="feature-item-text">
            <h3 class="feature-item-title">AI Scam Detector</h3>
            <p class="feature-item-desc">Real-time protection against phishing, rug pulls, and malicious contracts</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-item-icon">🎯</div>
          <div class="feature-item-text">
            <h3 class="feature-item-title">Portfolio Advisor</h3>
            <p class="feature-item-desc">AI-powered insights, risk analysis, and personalized investment recommendations</p>
          </div>
        </div>
      </div>

      <!-- Getting Started Guide -->
      <div class="getting-started">
        <h3 class="getting-started-title">🎯 Getting Started</h3>
        <div class="step">
          <div class="step-number">1</div>
          <p class="step-text"><strong>Add Funds:</strong> Transfer crypto from an exchange or another wallet</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <p class="step-text"><strong>Explore Features:</strong> Try Smart Scheduler, AI Assistant, or Scam Detector</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <p class="step-text"><strong>Stake BLAZE:</strong> Lock tokens for up to 20% APY and governance rights</p>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <p class="step-text"><strong>Earn Cashback:</strong> Get 2% back in BLAZE on every transaction you make</p>
        </div>
      </div>

      <!-- Secondary CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}" class="cta-button" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;">
          🔥 Start Using BLAZE Now
        </a>
      </div>

      <!-- Help Section -->
      <div class="help-section">
        <h3 class="help-title">Need Help?</h3>
        <p class="help-text">
          Our support team is here for you 24/7. Have questions about features, security, or getting started?
        </p>
        <a href="mailto:support@blazewallet.io" class="help-email">📧 support@blazewallet.io</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #d1d5db;">🔥 BLAZE Wallet</p>
      <p style="margin: 0 0 16px 0;">The Most Advanced Multi-Chain Web3 Wallet</p>
      
      <div class="footer-links">
        <a href="${APP_URL}" class="footer-link">Wallet</a>
        <a href="${APP_URL}/about" class="footer-link">About</a>
        <a href="${APP_URL}/security" class="footer-link">Security</a>
        <a href="${APP_URL}/docs" class="footer-link">Docs</a>
      </div>

      <div class="social-links">
        <a href="https://twitter.com/blazewallet" class="social-link">𝕏</a>
        <a href="https://discord.gg/blazewallet" class="social-link">💬</a>
        <a href="https://t.me/blazewallet" class="social-link">✈️</a>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 12px; color: #6b7280;">
        You're receiving this because you created an account at ${APP_URL}
        <br>
        © 2025 BLAZE Wallet. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send welcome email to a user
 */
async function sendWelcomeEmail(email, userId) {
  try {
    const html = generateWelcomeEmail(email);
    
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BLAZE Wallet <noreply@blazewallet.io>',
        to: email,
        subject: '🔥 Welcome to BLAZE Wallet - Your Web3 Journey Starts Now!',
        html: html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to send to ${email}:`, errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`✅ Sent to ${email} (ID: ${data.id})`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(`❌ Exception for ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🔥 BLAZE Wallet - Retroactive Welcome Email Sender\n');
  console.log('='.repeat(80));
  console.log('\n📋 Fetching existing users from Supabase...\n');

  // Fetch all users
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  const users = data.users;
  console.log(`📊 Found ${users.length} users\n`);
  console.log('='.repeat(80));
  console.log('\n🚀 Sending welcome emails...\n');

  // Send emails with delay to avoid rate limits
  const results = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\n[${i + 1}/${users.length}] Processing: ${user.email}`);
    
    const result = await sendWelcomeEmail(user.email, user.id);
    results.push({
      email: user.email,
      userId: user.id,
      ...result
    });

    // Add delay between emails (1 second) to avoid rate limits
    if (i < users.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Successfully sent: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📧 Total: ${results.length}\n`);

  if (failed > 0) {
    console.log('❌ Failed emails:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.email}: ${r.error}`);
    });
    console.log();
  }

  console.log('='.repeat(80));
  console.log('\n✨ Done! All welcome emails have been sent.\n');
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

