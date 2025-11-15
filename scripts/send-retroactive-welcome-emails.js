#!/usr/bin/env node

/**
 * Send Welcome Emails to Existing Users
 * 
 * This script sends the new premium welcome + verification email
 * to all existing users who registered before this feature was implemented.
 * 
 * Usage: node scripts/send-retroactive-welcome-emails.js
 */

require('ts-node/register/transpile-only');
const { createClient } = require('@supabase/supabase-js');
const { generateWalletStyleEmail } = require('../lib/email-template');

// Configuration
const SUPABASE_URL = 'https://ldehmephukevxumwdbwt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c';
const RESEND_API_KEY = 're_GSrnNH5V_NDNNHf7dDeFjEqJ2xR6CZeSx';
const RESEND_API_URL = 'https://api.resend.com/emails';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Send welcome email to a user
 */
async function sendWelcomeEmail(email, userId) {
  try {
    const html = generateWalletStyleEmail({ email });
    
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

