import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { verifyAdminSession } from '@/lib/admin-auth-utils';

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

    // Active users (24h)
    const { data: activeUsersData } = await supabaseAdmin
      .from('transaction_events')
      .select('user_id')
      .gte('created_at', last24h);
    const activeUsers = new Set(activeUsersData?.map(e => e.user_id)).size;

    // Transactions (24h)
    const { count: totalTxs } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('created_at', last24h);

    // Volume (24h)
    const { data: volumeData } = await supabaseAdmin
      .from('transaction_events')
      .select('value_usd')
      .eq('status', 'success')
      .gte('created_at', last24h);
    const totalVolume = volumeData?.reduce((sum, tx) => sum + (parseFloat(tx.value_usd) || 0), 0) || 0;

    // Failed rate
    const { count: failedTxs } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', last24h);
    const failedRate = totalTxs ? ((failedTxs || 0) / totalTxs) * 100 : 0;

    // User segments
    const { data: cohorts } = await supabaseAdmin
      .from('user_cohorts')
      .select('user_segment');
    
    const segments = { new_users: 0, active: 0, power_user: 0, dormant: 0, churned: 0 };
    cohorts?.forEach(c => {
      if (c.user_segment in segments) {
        segments[c.user_segment as keyof typeof segments]++;
      }
    });

    // Get total unique users
    const { count: totalUsersCount } = await supabaseAdmin
      .from('user_cohorts')
      .select('*', { count: 'exact', head: true });

    // Get alerts (critical only)
    const { data: criticalAlerts } = await supabaseAdmin
      .from('analytics_alerts')
      .select('*')
      .eq('severity', 'critical')
      .eq('status', 'unread')
      .order('created_at', { ascending: false })
      .limit(5);

    const { count: unreadAlertCount } = await supabaseAdmin
      .from('analytics_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread');

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          activeUsers24h: activeUsers,
          transactions24h: totalTxs || 0,
          volume24h: totalVolume,
          failedRate,
        },
        trends: {
          transactions: 0, // TODO: Calculate trend vs previous 24h
        },
        cohorts: segments,
        totalUsers: totalUsersCount || 0,
        alerts: {
          unreadCount: unreadAlertCount || 0,
          critical: criticalAlerts || [],
        },
        recentActivity: [], // TODO: Add recent activity
      },
    });
  } catch (error: any) {
    logger.error('[Admin API] Overview failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
