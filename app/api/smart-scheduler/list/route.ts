// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - LIST
// ============================================================================
// Get all scheduled transactions for a user
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');
    const chain = searchParams.get('chain');
    const status = searchParams.get('status') || 'pending'; // pending, completed, failed, cancelled

    logger.log('📋 [List API] Request:', { user_id, chain, status });

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    // Filter by chain if provided
    if (chain) {
      logger.log(`🔍 [List API] Filtering by chain: ${chain}`);
      query = query.eq('chain', chain.toLowerCase());
    }

    // Filter by status if provided
    if (status !== 'all') {
      logger.log(`🔍 [List API] Filtering by status: ${status}`);
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('❌ [List API] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled transactions', details: error.message },
        { status: 500 }
      );
    }

    logger.log(`✅ [List API] Found ${data?.length || 0} transaction(s)`);
    if (data && data.length > 0) {
      logger.log('📦 [List API] Sample transaction:', {
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
    logger.error('❌ [List API] Smart Scheduler API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

