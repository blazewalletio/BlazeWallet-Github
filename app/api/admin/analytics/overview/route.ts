import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Whitelisted admin emails
const ALLOWED_ADMINS = [
  'ricks_@live.nl',
  // Add team members here
];

/**
 * Verify admin access
 */
async function verifyAdmin(request: NextRequest): Promise<{ authorized: boolean; email?: string }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { authorized: false };
    }

    // Get user from Supabase
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (error || !user || !user.email) {
      return { authorized: false };
    }

    // Check if email is in whitelist
    if (!ALLOWED_ADMINS.includes(user.email)) {
      logger.warn(`[Admin API] Unauthorized access attempt: ${user.email}`);
      return { authorized: false };
    }

    return { authorized: true, email: user.email };
  } catch (error) {
    logger.error('[Admin API] Auth error:', error);
    return { authorized: false };
  }
}

/**
 * GET /api/admin/analytics/overview
 * 
 * Returns comprehensive analytics overview
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, email } = await verifyAdmin(request);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.log(`[Admin API] Overview requested by ${email}`);

    // Fetch latest realtime metrics
    const { data: realtimeMetrics } = await supabaseAdmin
      .from('realtime_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Parse metrics into object
    const metrics: Record<string, number> = {};
    realtimeMetrics?.forEach(m => {
      metrics[m.metric_key] = parseFloat(m.metric_value);
    });

    // Fetch user cohort summary
    const { data: cohorts } = await supabaseAdmin
      .from('user_cohorts')
      .select('user_segment')
      .order('user_segment');

    const cohortCounts: Record<string, number> = {
      new: 0,
      active: 0,
      power_user: 0,
      dormant: 0,
      churned: 0,
    };

    cohorts?.forEach(c => {
      if (c.user_segment) {
        cohortCounts[c.user_segment] = (cohortCounts[c.user_segment] || 0) + 1;
      }
    });

    // Fetch unread alerts count
    const { count: unreadAlertsCount } = await supabaseAdmin
      .from('admin_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread');

    // Fetch critical alerts
    const { data: criticalAlerts } = await supabaseAdmin
      .from('admin_alerts')
      .select('*')
      .eq('severity', 'critical')
      .eq('status', 'unread')
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch recent transaction events (last 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEvents } = await supabaseAdmin
      .from('transaction_events')
      .select('*')
      .gte('created_at', last24h)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate trends (compare last 24h vs previous 24h)
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { count: txsLast24h } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    const { count: txsPrevious24h } = await supabaseAdmin
      .from('transaction_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last48h)
      .lt('created_at', last24h);

    const txTrend = txsPrevious24h && txsPrevious24h > 0
      ? (((txsLast24h || 0) - txsPrevious24h) / txsPrevious24h) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          activeUsers24h: metrics.active_users_24h || 0,
          transactions24h: metrics.transactions_24h || 0,
          volume24h: metrics.volume_24h || 0,
          failedRate: metrics.failed_rate || 0,
        },
        trends: {
          transactions: txTrend,
        },
        cohorts: cohortCounts,
        totalUsers: Object.values(cohortCounts).reduce((sum, count) => sum + count, 0),
        alerts: {
          unreadCount: unreadAlertsCount || 0,
          critical: criticalAlerts || [],
        },
        recentActivity: recentEvents || [],
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    logger.error('[Admin API] Overview error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

