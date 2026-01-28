import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Admin client with service role
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

    if (!ALLOWED_ADMINS.includes(user.email)) {
      return { authorized: false };
    }

    return { authorized: true, email: user.email };
  } catch (error) {
    return { authorized: false };
  }
}

/**
 * GET /api/admin/analytics/cohorts
 * 
 * Returns user cohorts data with stats
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, email } = await verifyAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabaseAdmin
      .from('user_cohorts')
      .select('*')
      .order('engagement_score', { ascending: false })
      .limit(limit);

    if (segment && segment !== 'all') {
      query = query.eq('user_segment', segment);
    }

    const { data: cohorts, error } = await query;

    if (error) throw error;

    // Calculate summary stats
    const summary = {
      total: cohorts?.length || 0,
      bySegment: {
        new: 0,
        active: 0,
        power_user: 0,
        dormant: 0,
        churned: 0,
      },
      totalVolume: 0,
      totalTransactions: 0,
      avgEngagementScore: 0,
    };

    cohorts?.forEach(cohort => {
      if (cohort.user_segment) {
        summary.bySegment[cohort.user_segment as keyof typeof summary.bySegment]++;
      }
      summary.totalVolume += parseFloat(cohort.total_volume_usd || '0');
      summary.totalTransactions += cohort.total_transactions || 0;
      summary.avgEngagementScore += cohort.engagement_score || 0;
    });

    if (summary.total > 0) {
      summary.avgEngagementScore = Math.round(summary.avgEngagementScore / summary.total);
    }

    return NextResponse.json({
      success: true,
      data: {
        cohorts: cohorts || [],
        summary,
      },
    });

  } catch (error: any) {
    logger.error('[Admin API] Cohorts error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

