// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - LIST
// ============================================================================
// Get all scheduled transactions for a user
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ FIX: Mark route as dynamic to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  console.log('\n========================================');
  console.log('🔥 SMART SCHEDULER LIST API - DEBUG START (RLS DISABLED)');
  console.log('========================================\n');
  
  try {
    // ✅ FIX: Trim environment variables INSIDE the function to avoid module-level caching
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');
    const chain = searchParams.get('chain');
    const status = searchParams.get('status') || 'pending';

    console.log('📋 [1] REQUEST PARAMS:', { 
      user_id, 
      chain, 
      status,
      full_url: req.url,
      timestamp: new Date().toISOString()
    });

    if (!user_id) {
      console.log('❌ [ERROR] Missing user_id parameter');
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    console.log('📋 [2] SUPABASE CONFIG:', {
      url: supabaseUrl,
      url_has_newline: supabaseUrl.includes('\n'),
      service_key_length: supabaseServiceKey?.length || 0,
      service_key_starts_with: supabaseServiceKey?.substring(0, 20) + '...',
      service_key_exists: !!supabaseServiceKey,
      service_key_has_newline: supabaseServiceKey.includes('\n')
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ [3] Supabase client created');

    // Build query
    let query = supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    console.log('📋 [4] BASE QUERY BUILT:', {
      table: 'scheduled_transactions',
      user_id_filter: user_id,
      order_by: 'created_at DESC'
    });

    // Filter by chain if provided
    if (chain) {
      console.log(`🔍 [5] Adding chain filter: ${chain}`);
      query = query.eq('chain', chain.toLowerCase());
    } else {
      console.log('ℹ️ [5] No chain filter applied');
    }

    // Filter by status if provided
    if (status !== 'all') {
      console.log(`🔍 [6] Adding status filter: ${status}`);
      query = query.eq('status', status);
    } else {
      console.log('ℹ️ [6] No status filter applied (fetching all statuses)');
    }

    console.log('🔄 [7] Executing Supabase query...');
    const { data, error } = await query;

    if (error) {
      console.error('❌ [8] SUPABASE ERROR:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json(
        { error: 'Failed to fetch scheduled transactions', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ [8] Query successful! Found ${data?.length || 0} transaction(s)`);
    
    if (data && data.length > 0) {
      console.log('📦 [9] TRANSACTION DETAILS:');
      data.forEach((tx, index) => {
        console.log(`  [${index + 1}] Transaction:`, {
          id: tx.id,
          user_id: tx.user_id,
          chain: tx.chain,
          status: tx.status,
          scheduled_for: tx.scheduled_for,
          amount: tx.amount,
          token_symbol: tx.token_symbol,
          recipient_address: tx.recipient_address?.substring(0, 10) + '...',
          created_at: tx.created_at
        });
      });
    } else {
      console.log('⚠️ [9] NO TRANSACTIONS FOUND - Empty result set');
      console.log('   Query filters:', { user_id, chain, status });
    }

    const response = {
      success: true,
      data: data || [],
      count: data?.length || 0,
    };

    console.log('📤 [10] SENDING RESPONSE:', {
      success: response.success,
      count: response.count,
      has_data: response.data.length > 0
    });

    console.log('\n========================================');
    console.log('✅ SMART SCHEDULER LIST API - DEBUG END');
    console.log('========================================\n');

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ SMART SCHEDULER LIST API - ERROR');
    console.error('========================================');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================\n');
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

