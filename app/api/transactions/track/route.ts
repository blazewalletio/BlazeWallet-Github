import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      chainKey,
      txHash,
      transactionType = 'send',
      direction,
      fromAddress,
      toAddress,
      tokenSymbol,
      tokenAddress,
      tokenDecimals = 18,
      isNative = false,
      amount,
      amountUSD,
      gasUsed,
      gasPrice,
      gasCostUSD,
      status = 'confirmed',
      blockNumber,
      timestamp,
      metadata = {}
    } = body;

    // Validation
    if (!userId || !chainKey || !txHash || !direction || !fromAddress || !toAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Track transaction using database function
    const { data, error } = await getSupabaseAdmin().rpc('track_user_transaction', {
      p_user_id: userId,
      p_chain_key: chainKey,
      p_tx_hash: txHash,
      p_transaction_type: transactionType,
      p_direction: direction,
      p_from_address: fromAddress,
      p_to_address: toAddress,
      p_token_symbol: tokenSymbol || null,
      p_token_address: tokenAddress || null,
      p_token_decimals: tokenDecimals,
      p_is_native: isNative,
      p_amount: amount,
      p_amount_usd: amountUSD || null,
      p_gas_used: gasUsed || null,
      p_gas_price: gasPrice || null,
      p_gas_cost_usd: gasCostUSD || null,
      p_status: status,
      p_block_number: blockNumber || null,
      p_timestamp: timestamp || new Date().toISOString(),
      p_metadata: metadata
    });

    if (error) {
      logger.error('Failed to track transaction:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to track transaction' },
        { status: 500 }
      );
    }

    logger.log(`✅ Transaction tracked: ${txHash} (${direction} ${amountUSD ? `$${amountUSD}` : ''})`);

    return NextResponse.json({
      success: true,
      transactionId: data
    });

  } catch (error: any) {
    logger.error('Transaction tracking API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Fetch user transaction stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    // Get transaction stats
    const { data, error } = await getSupabaseAdmin().rpc('get_user_transaction_stats', {
      p_user_id: userId
    });

    if (error) {
      logger.error('Failed to get transaction stats:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get stats' },
        { status: 500 }
      );
    }

    const stats = data && data.length > 0 ? data[0] : {
      total_transactions: 0,
      total_volume_usd: 0,
      total_sent: 0,
      total_received: 0,
      total_gas_spent: 0,
      last_transaction_at: null
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error: any) {
    logger.error('Transaction stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

