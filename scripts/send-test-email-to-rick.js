#!/usr/bin/env node

/**
 * Test Email Sender - uses the production wallet-style template
 */

require('ts-node/register/transpile-only');
const { generateWalletStyleEmail } = require('../lib/email-template');

const RESEND_API_KEY = 're_GSrnNH5V_NDNNHf7dDeFjEqJ2xR6CZeSx';
const RESEND_API_URL = 'https://api.resend.com/emails';
const TEST_EMAIL = 'h.schlimback@gmail.com';

async function sendTestEmail() {
  console.log(`\n🔥 Sending TEST Email to ${TEST_EMAIL}\n`);

  const html = generateWalletStyleEmail({
    email: TEST_EMAIL,
    firstName: 'Rick',
    verificationLink: 'https://my.blazewallet.io/auth/verify?token=TEST_VERIFICATION_TOKEN'
  });

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BLAZE Wallet <noreply@blazewallet.io>',
        to: TEST_EMAIL,
        subject: '🔥 Welcome to BLAZE Wallet - Verify Your Email',
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log(`✅ SUCCESS! Email sent to ${TEST_EMAIL}`);
    console.log(`📧 Message ID: ${data.id}`);
    console.log(`\n💡 Template: production wallet-style email (PNG icons, hero logo)\n`);
  } catch (error) {
    console.error('❌ Exception:', error.message);
    process.exit(1);
  }
}

sendTestEmail();
