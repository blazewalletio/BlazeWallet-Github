// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - LIST
// ============================================================================
// Get all scheduled transactions for a user
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');
    const chain = searchParams.get('chain');
    const status = searchParams.get('status') || 'pending'; // pending, completed, failed, cancelled

    console.log('📋 [List API] Request:', { user_id, chain, status });

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let query = supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    // Filter by chain if provided
    if (chain) {
      console.log(`🔍 [List API] Filtering by chain: ${chain}`);
      query = query.eq('chain', chain.toLowerCase());
    }

    // Filter by status if provided
    if (status !== 'all') {
      console.log(`🔍 [List API] Filtering by status: ${status}`);
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [List API] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled transactions', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ [List API] Found ${data?.length || 0} transaction(s)`);
    if (data && data.length > 0) {
      console.log('📦 [List API] Sample transaction:', {
        id: data[0].id,
        chain: data[0].chain,
        status: data[0].status,
        scheduled_for: data[0].scheduled_for,
        amount: data[0].amount,
        token_symbol: data[0].token_symbol,
      });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });

  } catch (error: any) {
    console.error('❌ [List API] Smart Scheduler API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

