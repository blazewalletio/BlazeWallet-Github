/**
 * 📋 BLAZE WALLET - SCHEDULED TRANSACTION HISTORY API
 * 
 * Returns executed/completed scheduled transactions for display in History tab
 * Combines with on-chain transactions for complete transaction history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const chain = searchParams.get('chain');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    logger.log(`📋 [History API] Fetching scheduled transactions for ${address} on ${chain || 'all chains'}`);

    // Build query
    let query = getSupabaseAdmin()
      .from('scheduled_transactions')
      .select('*')
      .eq('from_address', address)
      .in('status', ['completed', 'failed']) // Only show executed transactions
      .not('transaction_hash', 'is', null) // Must have a transaction hash
      .order('executed_at', { ascending: false })
      .limit(50);

    // Filter by chain if specified
    if (chain) {
      query = query.eq('chain', chain);
    }

    const { data: transactions, error } = await query;

    if (error) {
      logger.error('❌ [History API] Supabase error:', error);
      throw error;
    }

    logger.log(`✅ [History API] Found ${transactions?.length || 0} scheduled transactions`);

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      count: transactions?.length || 0
    });

  } catch (error) {
    logger.error('❌ [History API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transaction history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

