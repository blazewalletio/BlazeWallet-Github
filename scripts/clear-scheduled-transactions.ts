/**
 * Utility script to delete ALL rows from the scheduled_transactions table.
 *
 * Usage:
 *   npx tsx scripts/clear-scheduled-transactions.ts
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS. Be careful!
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('⚠️ About to delete ALL rows from scheduled_transactions...');

  // First delete dependent transaction_savings rows to satisfy FK constraint
  const { error: savingsError } = await supabase
    .from('transaction_savings')
    .delete()
    .not('scheduled_transaction_id', 'is', null);

  if (savingsError) {
    console.error('❌ Failed to clear transaction_savings:', savingsError.message);
    process.exit(1);
  }

  const { error } = await supabase
    .from('scheduled_transactions')
    .delete()
    .not('id', 'is', null); // delete all rows (id is non-null PK)

  if (error) {
    console.error('❌ Failed to clear scheduled_transactions:', error.message);
    process.exit(1);
  }

  console.log('✅ All scheduled_transactions have been deleted.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});


