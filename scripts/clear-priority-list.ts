/**
 * Script to clear all priority list registrations
 * Run with: npx tsx scripts/clear-priority-list.ts
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

async function clearPriorityList() {
  try {
    logger.log('🗑️ Starting to clear priority list...');

    // First, delete email verification tokens (foreign key constraint)
    logger.log('Deleting email verification tokens...');
    const { error: tokensError } = await supabase
      .from('email_verification_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (tokensError) {
      logger.error('Error deleting verification tokens:', tokensError);
      throw tokensError;
    }
    logger.log('✅ Email verification tokens deleted');

    // Then, delete all priority list registrations
    logger.log('Deleting priority list registrations...');
    const { error: registrationsError } = await supabase
      .from('priority_list_registrations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (registrationsError) {
      logger.error('Error deleting registrations:', registrationsError);
      throw registrationsError;
    }
    logger.log('✅ Priority list registrations deleted');

    // Verify deletion
    const { count, error: countError } = await supabase
      .from('priority_list_registrations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error('Error counting remaining registrations:', countError);
    } else {
      logger.log(`✅ Verification: ${count} registrations remaining (should be 0)`);
    }

    logger.log('🎉 Priority list cleared successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error clearing priority list:', error);
    process.exit(1);
  }
}

clearPriorityList();

