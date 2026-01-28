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

    // Onramp events by status
    const { count: initiated } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_initiated')
      .gte('created_at', last24h);

    const { count: pending } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_pending')
      .gte('created_at', last24h);

    const { count: processing } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_processing')
      .gte('created_at', last24h);

    const { count: completed } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_completed')
      .gte('created_at', last24h);

    const { count: failed } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_failed')
      .gte('created_at', last24h);

    const { count: refunded } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_refunded')
      .gte('created_at', last24h);

    const { count: cancelled } = await supabaseAdmin
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'onramp_purchase_cancelled')
      .gte('created_at', last24h);

    // Total onramp volume
    const { data: completedData } = await supabaseAdmin
      .from('user_events')
      .select('event_data')
      .eq('event_name', 'onramp_purchase_completed')
      .gte('created_at', last24h);

    let totalVolume = 0;
    completedData?.forEach((event: any) => {
      if (event.event_data?.fiatAmount) {
        totalVolume += parseFloat(event.event_data.fiatAmount);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        initiated: initiated || 0,
        pending: pending || 0,
        processing: processing || 0,
        completed: completed || 0,
        failed: failed || 0,
        refunded: refunded || 0,
        cancelled: cancelled || 0,
        totalVolume24h: totalVolume,
      },
    });
  } catch (error: any) {
    logger.error('[Admin API] Onramp analytics failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

