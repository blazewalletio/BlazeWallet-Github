import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { verifyAdminSession } from '@/lib/admin-auth-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdminSession(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // NOTE: All transaction analytics currently return 0
    // transaction_events table exists but is empty - wallet app does not track transactions yet
    // This tracking needs to be implemented in the wallet app

    // Send transactions
    const { count: sendInitiated } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'send_initiated')
      .gte('created_at', last24h);

    const { count: sendConfirmed } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'send_confirmed')
      .gte('created_at', last24h);

    const { count: sendFailed } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'send_failed')
      .gte('created_at', last24h);

    // Swap transactions
    const { count: swapInitiated } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'swap_initiated')
      .gte('created_at', last24h);

    const { count: swapConfirmed } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'swap_confirmed')
      .gte('created_at', last24h);

    const { count: swapFailed } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'swap_failed')
      .gte('created_at', last24h);

    // Receive events
    const { count: receiveDetected24h } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'receive_detected')
      .gte('created_at', last24h);

    const { count: receiveDetected7d } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'receive_detected')
      .gte('created_at', last7d);

    return NextResponse.json({
      success: true,
      data: {
        send: {
          initiated: sendInitiated || 0,
          confirmed: sendConfirmed || 0,
          failed: sendFailed || 0,
        },
        swap: {
          initiated: swapInitiated || 0,
          confirmed: swapConfirmed || 0,
          failed: swapFailed || 0,
        },
        receive: {
          detected24h: receiveDetected24h || 0,
          detected7d: receiveDetected7d || 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Admin API] Transactions failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

