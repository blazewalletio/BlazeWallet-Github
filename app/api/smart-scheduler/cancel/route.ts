// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - CANCEL
// ============================================================================
// Cancel a scheduled transaction
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transaction_id, user_id } = body;

    if (!transaction_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: transaction_id, user_id' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership and update status
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)
      .eq('user_id', user_id)
      .in('status', ['pending', 'ready']) // Can only cancel pending/ready transactions
      .select()
      .single();

    if (error) {
      logger.error('❌ Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to cancel transaction', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Transaction not found or cannot be cancelled' },
        { status: 404 }
      );
    }

    logger.log('✅ Scheduled transaction cancelled:', transaction_id);

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user_id,
      supabase_user_id: data.supabase_user_id || null,
      type: 'transaction_cancelled',
      title: 'Transaction Cancelled',
      message: `Your scheduled ${data.token_symbol || 'native'} transaction has been cancelled`,
      data: {
        scheduled_transaction_id: transaction_id,
        chain: data.chain,
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    logger.error('❌ Smart Scheduler API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

