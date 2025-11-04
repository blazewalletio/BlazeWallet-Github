/**
 * 🔥 BLAZE WALLET - SMART SEND SCHEDULE API
 * 
 * Schedule transactions for optimal gas timing
 * - Create scheduled transaction
 * - Store in Supabase
 * - Return scheduling confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ScheduleRequest {
  userId: string;
  supabaseUserId?: string;
  chain: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress?: string;
  tokenSymbol: string;
  scheduledFor: string; // ISO timestamp
  estimatedGasPrice: number;
  estimatedGasCostUSD: number;
  estimatedSavingsUSD: number;
  priority?: 'low' | 'standard' | 'high' | 'instant';
  maxWaitHours?: number;
  memo?: string;
}

export async function POST(req: NextRequest) {
  try {
    console.log('\n========================================');
    console.log('📅 [Smart Send] SCHEDULE TRANSACTION');
    console.log('========================================');

    const body: ScheduleRequest = await req.json();
    console.log('📊 Request:', { 
      chain: body.chain, 
      amount: body.amount, 
      token: body.tokenSymbol,
      scheduledFor: body.scheduledFor 
    });

    // Validate required fields
    if (!body.userId || !body.chain || !body.fromAddress || !body.toAddress || !body.amount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
      }, { status: 400 });
    }

    // Calculate expiry (default: 24 hours from scheduled time)
    const scheduledDate = new Date(body.scheduledFor);
    const expiryDate = new Date(scheduledDate);
    expiryDate.setHours(expiryDate.getHours() + (body.maxWaitHours || 24));

    // Insert into Supabase
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .insert({
        user_id: body.userId,
        supabase_user_id: body.supabaseUserId || null,
        chain: body.chain,
        from_address: body.fromAddress,
        to_address: body.toAddress,
        amount: body.amount,
        token_address: body.tokenAddress || null,
        token_symbol: body.tokenSymbol,
        scheduled_for: scheduledDate.toISOString(),
        expires_at: expiryDate.toISOString(),
        estimated_gas_price: body.estimatedGasPrice,
        estimated_gas_cost_usd: body.estimatedGasCostUSD,
        estimated_savings_usd: body.estimatedSavingsUSD,
        priority: body.priority || 'standard',
        max_wait_hours: body.maxWaitHours || 24,
        memo: body.memo || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      throw new Error(`Failed to schedule transaction: ${error.message}`);
    }

    console.log('✅ Transaction scheduled:', data.id);
    console.log('📅 Execution time:', scheduledDate.toLocaleString());
    console.log('💰 Estimated savings: $', body.estimatedSavingsUSD.toFixed(2));
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      scheduled: {
        id: data.id,
        scheduledFor: data.scheduled_for,
        expiresAt: data.expires_at,
        estimatedSavings: data.estimated_savings_usd,
        status: data.status,
      },
    });

  } catch (error: any) {
    console.error('❌ [Smart Send] Schedule error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to schedule transaction',
    }, { status: 500 });
  }
}

/**
 * GET /api/smart-send/schedule?userId=xxx
 * Get user's scheduled transactions
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'pending';

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('scheduled_for', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      scheduled: data || [],
    });

  } catch (error: any) {
    console.error('❌ [Smart Send] Get scheduled error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get scheduled transactions',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/smart-send/schedule?id=xxx
 * Cancel a scheduled transaction
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'id is required',
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('scheduled_transactions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending'); // Only cancel if still pending

    if (error) {
      throw new Error(error.message);
    }

    console.log('✅ Transaction cancelled:', id);

    return NextResponse.json({
      success: true,
      message: 'Transaction cancelled successfully',
    });

  } catch (error: any) {
    console.error('❌ [Smart Send] Cancel error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to cancel transaction',
    }, { status: 500 });
  }
}

