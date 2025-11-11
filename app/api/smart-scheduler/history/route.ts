/**
 * 📋 BLAZE WALLET - SCHEDULED TRANSACTION HISTORY API
 * 
 * Returns executed/completed scheduled transactions for display in History tab
 * Combines with on-chain transactions for complete transaction history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log(`📋 [History API] Fetching scheduled transactions for ${address} on ${chain || 'all chains'}`);

    // Build query
    let query = supabase
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
      console.error('❌ [History API] Supabase error:', error);
      throw error;
    }

    console.log(`✅ [History API] Found ${transactions?.length || 0} scheduled transactions`);

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      count: transactions?.length || 0
    });

  } catch (error) {
    console.error('❌ [History API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transaction history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

