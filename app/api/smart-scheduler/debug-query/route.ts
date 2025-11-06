// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER DEBUG QUERY
// ============================================================================
// Direct Supabase query test to debug why transactions aren't appearing
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  console.log('\n========================================');
  console.log('🔍 SMART SCHEDULER DEBUG QUERY - START');
  console.log('========================================\n');

  try {
    // Trim environment variables
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    console.log('📋 Request params:', { user_id });

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        has_url: !!supabaseUrl,
        has_key: !!supabaseServiceKey,
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test 1: Count all transactions
    console.log('\n📊 TEST 1: Counting ALL transactions...');
    const { count: totalCount, error: countError } = await supabase
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true });
    
    console.log('   Total count:', totalCount);
    if (countError) console.error('   Error:', countError);

    // Test 2: Get all transactions (no filters)
    console.log('\n📊 TEST 2: Fetching ALL transactions (no filters)...');
    const { data: allData, error: allError } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('   Found:', allData?.length || 0, 'transaction(s)');
    if (allError) {
      console.error('   Error:', allError);
    } else if (allData && allData.length > 0) {
      console.log('   Sample transaction:', {
        id: allData[0].id,
        user_id: allData[0].user_id,
        user_id_type: typeof allData[0].user_id,
        chain: allData[0].chain,
        status: allData[0].status,
        scheduled_for: allData[0].scheduled_for,
      });
    }

    // Test 3: If user_id provided, test exact match
    if (user_id) {
      console.log(`\n📊 TEST 3: Fetching transactions for user_id="${user_id}"...`);
      const { data: userData, error: userError } = await supabase
        .from('scheduled_transactions')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });
      
      console.log('   Found:', userData?.length || 0, 'transaction(s)');
      if (userError) {
        console.error('   Error:', userError);
      } else if (userData && userData.length > 0) {
        console.log('   Transactions:', userData.map(tx => ({
          id: tx.id,
          user_id: tx.user_id,
          chain: tx.chain,
          status: tx.status,
          scheduled_for: tx.scheduled_for,
        })));
      }
    }

    // Test 4: Test with status filter
    if (user_id) {
      console.log(`\n📊 TEST 4: Fetching PENDING transactions for user_id="${user_id}"...`);
      const { data: pendingData, error: pendingError } = await supabase
        .from('scheduled_transactions')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      console.log('   Found:', pendingData?.length || 0, 'pending transaction(s)');
      if (pendingError) {
        console.error('   Error:', pendingError);
      }
    }

    // Test 5: Check RLS status
    console.log('\n📊 TEST 5: Checking RLS status...');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname, 
            tablename, 
            rowsecurity 
          FROM pg_tables 
          WHERE tablename = 'scheduled_transactions';
        `
      });
    
    if (rlsError) {
      console.log('   Could not check RLS (RPC might not exist):', rlsError.message);
    } else {
      console.log('   RLS status:', rlsData);
    }

    // Test 6: Try different user_id formats if provided
    if (user_id) {
      console.log(`\n📊 TEST 6: Testing different user_id formats...`);
      
      // Try URL decoded
      const decodedUserId = decodeURIComponent(user_id);
      if (decodedUserId !== user_id) {
        console.log(`   Testing decoded: "${decodedUserId}"`);
        const { data: decodedData } = await supabase
          .from('scheduled_transactions')
          .select('*')
          .eq('user_id', decodedUserId);
        console.log('   Found:', decodedData?.length || 0, 'transaction(s)');
      }

      // Try with @ encoded
      const encodedUserId = user_id.replace('@', '%40');
      if (encodedUserId !== user_id) {
        console.log(`   Testing encoded: "${encodedUserId}"`);
        const { data: encodedData } = await supabase
          .from('scheduled_transactions')
          .select('*')
          .eq('user_id', encodedUserId);
        console.log('   Found:', encodedData?.length || 0, 'transaction(s)');
      }
    }

    const response = {
      success: true,
      tests: {
        total_count: totalCount,
        all_transactions: allData?.length || 0,
        user_transactions: user_id ? (allData?.filter(tx => tx.user_id === user_id).length || 0) : null,
        pending_transactions: user_id ? (allData?.filter(tx => tx.user_id === user_id && tx.status === 'pending').length || 0) : null,
      },
      sample_transactions: allData?.slice(0, 3).map(tx => ({
        id: tx.id,
        user_id: tx.user_id,
        user_id_type: typeof tx.user_id,
        chain: tx.chain,
        status: tx.status,
        scheduled_for: tx.scheduled_for,
      })) || [],
    };

    console.log('\n========================================');
    console.log('✅ DEBUG QUERY - END');
    console.log('========================================\n');

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ DEBUG QUERY - ERROR');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================\n');

    return NextResponse.json({
      error: 'Debug query failed',
      details: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}


