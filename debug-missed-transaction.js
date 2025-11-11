const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMissedTransaction() {
  console.log('\n🔍 DEBUGGING MISSED TRANSACTION');
  console.log('================================================================\n');
  
  const now = new Date();
  console.log(`Current Time: ${now.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`Current UTC:  ${now.toISOString()}\n`);

  // Get transactions from last 30 minutes
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  
  const { data: recentTxs, error } = await supabase
    .from('scheduled_transactions')
    .select('*')
    .gte('created_at', thirtyMinAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Database error:', error);
    return;
  }

  console.log(`📊 Found ${recentTxs.length} transactions in last 30 minutes\n`);

  if (recentTxs.length === 0) {
    console.log('❌ NO TRANSACTIONS FOUND!');
    console.log('Mogelijk probleem:');
    console.log('1. Transaction niet correct opgeslagen');
    console.log('2. Database connection issue');
    console.log('3. Wrong user_id');
    return;
  }

  // Find the one scheduled around 10:03-10:05
  const targetTx = recentTxs.find(tx => {
    const scheduledTime = new Date(tx.scheduled_for);
    const hour = scheduledTime.getHours();
    const minute = scheduledTime.getMinutes();
    return hour === 9 && minute >= 3 && minute <= 5; // UTC is 1 hour behind CET
  });

  if (!targetTx) {
    console.log('⚠️  Could not find transaction scheduled for 10:03-10:05 CET');
    console.log('\nAll recent transactions:');
    recentTxs.forEach(tx => {
      const scheduled = new Date(tx.scheduled_for);
      console.log(`  - ${tx.id.substring(0, 8)}: ${scheduled.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET, status: ${tx.status}`);
    });
    return;
  }

  console.log('🎯 FOUND TARGET TRANSACTION:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`ID: ${targetTx.id}`);
  console.log(`Status: ${targetTx.status}`);
  console.log(`Chain: ${targetTx.chain}`);
  console.log(`Amount: ${targetTx.amount}`);
  console.log(`To: ${targetTx.to_address}`);
  console.log(`Created: ${new Date(targetTx.created_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`Scheduled: ${new Date(targetTx.scheduled_for).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`Scheduled UTC: ${targetTx.scheduled_for}`);
  console.log(`Expires: ${new Date(targetTx.expires_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`Has encrypted keys: ${!!targetTx.encrypted_mnemonic}`);
  console.log(`Retry count: ${targetTx.retry_count || 0}/3`);
  
  if (targetTx.error_message) {
    console.log(`\n❌ ERROR MESSAGE: ${targetTx.error_message}`);
  }
  
  if (targetTx.executed_at) {
    console.log(`\nExecuted at: ${new Date(targetTx.executed_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  }
  
  if (targetTx.transaction_hash) {
    console.log(`\nTransaction hash: ${targetTx.transaction_hash}`);
  }

  console.log('\n\n🔍 DIAGNOSE:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scheduledTime = new Date(targetTx.scheduled_for);
  const minutesSince = Math.floor((now - scheduledTime) / (1000 * 60));
  
  console.log(`⏰ Scheduled tijd: ${scheduledTime.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`⏰ Current tijd:   ${now.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`⏰ Verstreken:     ${minutesSince} minuten geleden\n`);

  // Check cron timing
  console.log('📅 CRON TIMING CHECK:\n');
  console.log('Cron runs: every 5 minutes (xx:00, xx:05, xx:10, xx:15, etc.)');
  
  const scheduledMinute = scheduledTime.getMinutes();
  const nextCronMinute = Math.ceil(scheduledMinute / 5) * 5;
  const expectedExecutionTime = new Date(scheduledTime);
  expectedExecutionTime.setMinutes(nextCronMinute);
  
  console.log(`Scheduled for: ${scheduledMinute} minutes past the hour`);
  console.log(`Next cron run: ${nextCronMinute} minutes past the hour`);
  console.log(`Expected execution: ${expectedExecutionTime.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
  console.log(`That was at: ${expectedExecutionTime.toISOString()}\n`);

  // Determine the issue
  if (targetTx.status === 'completed') {
    console.log('✅ Transaction WAS executed!');
    console.log(`Executed at: ${new Date(targetTx.executed_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} CET`);
    if (targetTx.transaction_hash) {
      console.log(`Hash: ${targetTx.transaction_hash}`);
    }
  } else if (targetTx.status === 'failed') {
    console.log('❌ Transaction FAILED!');
    console.log(`Error: ${targetTx.error_message || 'Unknown error'}`);
    console.log(`Retry count: ${targetTx.retry_count || 0}/3`);
  } else if (targetTx.status === 'pending') {
    console.log('⚠️  Transaction is STILL PENDING!');
    console.log('\n🔍 POSSIBLE CAUSES:\n');
    
    console.log('1. CRON JOB NOT RUNNING');
    console.log('   • Check Vercel cron dashboard');
    console.log('   • Look for "Last Run" timestamp');
    console.log('   • Should run every 5 minutes\n');
    
    console.log('2. CRON JOB RUNNING BUT FAILING');
    console.log('   • Check Vercel logs');
    console.log('   • Look for errors in execution');
    console.log('   • May be auth or database issues\n');
    
    console.log('3. TIMEZONE ISSUE');
    console.log('   • Scheduled time in future (UTC)?');
    console.log(`   • Scheduled UTC: ${targetTx.scheduled_for}`);
    console.log(`   • Current UTC: ${now.toISOString()}`);
    console.log(`   • In past: ${scheduledTime < now ? 'YES ✅' : 'NO ❌'}\n`);
    
    console.log('4. ENCRYPTED KEYS MISSING');
    console.log(`   • Has encrypted_mnemonic: ${!!targetTx.encrypted_mnemonic ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   • Has kms_key: ${!!targetTx.kms_encrypted_ephemeral_key ? 'YES ✅' : 'NO ❌'}\n`);
  }

  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Check Vercel cron logs');
  console.log('2. Verify cron is running');
  console.log('3. Check for execution errors');
}

debugMissedTransaction().catch(console.error);
