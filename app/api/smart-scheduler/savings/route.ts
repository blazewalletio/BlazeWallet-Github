// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - SAVINGS
// ============================================================================
// Get savings statistics for a user
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user savings stats
    const { data: stats, error: statsError } = await supabase
      .from('user_savings_stats')
      .select('*')
      .eq('user_id', user_id)
      .single();

    // Get recent savings (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSavings, error: savingsError } = await supabase
      .from('transaction_savings')
      .select('*')
      .eq('user_id', user_id)
      .gte('executed_at', thirtyDaysAgo)
      .order('executed_at', { ascending: false });

    if (statsError && statsError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ Failed to fetch savings stats:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch savings statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: stats || {
        user_id,
        total_transactions: 0,
        scheduled_transactions: 0,
        total_savings_usd: 0,
        average_savings_per_tx_usd: 0,
        best_single_saving_usd: 0,
        savings_per_chain: {},
      },
      recent_savings: recentSavings || [],
    });

  } catch (error: any) {
    console.error('❌ Smart Scheduler API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

