/**
 * Simple script to clear priority list via Supabase client
 * Run with: node scripts/clear-priority-list-simple.js
 */

const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and key from environment or .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearPriorityList() {
  try {
    console.log('🗑️ Starting to clear priority list...');

    // First, delete email verification tokens
    console.log('Deleting email verification tokens...');
    const { error: tokensError } = await supabase
      .from('email_verification_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (tokensError) {
      console.error('Error deleting verification tokens:', tokensError);
      throw tokensError;
    }
    console.log('✅ Email verification tokens deleted');

    // Then, delete all priority list registrations
    console.log('Deleting priority list registrations...');
    const { error: registrationsError } = await supabase
      .from('priority_list_registrations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (registrationsError) {
      console.error('Error deleting registrations:', registrationsError);
      throw registrationsError;
    }
    console.log('✅ Priority list registrations deleted');

    // Verify deletion
    const { count, error: countError } = await supabase
      .from('priority_list_registrations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting remaining registrations:', countError);
    } else {
      console.log(`✅ Verification: ${count} registrations remaining (should be 0)`);
    }

    console.log('🎉 Priority list cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing priority list:', error);
    process.exit(1);
  }
}

clearPriorityList();
