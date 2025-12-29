/**
 * 🔥 BLAZE WALLET - Get Active Scheduled Transactions
 * 
 * Fetches all active scheduled transactions from Supabase
 * Run with: npx tsx scripts/get-active-scheduled-transactions.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getActiveScheduledTransactions() {
  console.log('🔍 Fetching active scheduled transactions...\n');

  try {
    // Get all active transactions
    const { data: transactions, error } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .in('status', ['pending', 'executing', 'ready'])
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching transactions:', error);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('✅ No active scheduled transactions found');
      return;
    }

    console.log(`📊 Found ${transactions.length} active scheduled transactions:\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group by status
    const byStatus = transactions.reduce((acc, tx) => {
      if (!acc[tx.status]) acc[tx.status] = [];
      acc[tx.status].push(tx);
      return acc;
    }, {} as Record<string, typeof transactions>);

    // Show summary
    console.log('📈 SUMMARY:\n');
    Object.entries(byStatus).forEach(([status, txs]) => {
      const txsArray = txs as any[];
      const ready = txsArray.filter((tx: any) =>
        !tx.scheduled_for || new Date(tx.scheduled_for) <= new Date()
      ).length;
      console.log(`  ${status.toUpperCase()}: ${txsArray.length} total, ${ready} ready to execute`);
    });
    console.log('');

    // Show details
    console.log('📋 DETAILS:\n');
    transactions.forEach((tx, index) => {
      const isReady = !tx.scheduled_for || new Date(tx.scheduled_for) <= new Date();
      const isExpired = tx.expires_at && new Date(tx.expires_at) < new Date();
      
      console.log(`${index + 1}. Transaction ${tx.id}`);
      console.log(`   User: ${tx.user_id}`);
      console.log(`   Chain: ${tx.chain}`);
      console.log(`   Amount: ${tx.amount} ${tx.token_symbol || ''}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Priority: ${tx.priority}`);
      console.log(`   Scheduled for: ${tx.scheduled_for || 'Immediate'}`);
      console.log(`   Expires at: ${tx.expires_at || 'Never'}`);
      console.log(`   Ready: ${isReady ? '✅ YES' : '⏳ NO'}`);
      if (isExpired) console.log(`   ⚠️  EXPIRED`);
      if (tx.retry_count > 0) console.log(`   Retries: ${tx.retry_count}`);
      if (tx.error_message) console.log(`   Error: ${tx.error_message}`);
      console.log('');
    });

    // Get statistics
    const { count: totalCount } = await supabase
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'executing', 'ready']);

    const { count: readyCount } = await supabase
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'executing', 'ready'])
      .or('scheduled_for.is.null,scheduled_for.lte.' + new Date().toISOString())
      .gt('expires_at', new Date().toISOString());

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`📊 Total active: ${totalCount || 0}`);
    console.log(`✅ Ready to execute: ${readyCount || 0}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
getActiveScheduledTransactions();

